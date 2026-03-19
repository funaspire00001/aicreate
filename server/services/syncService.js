/**
 * CDC 同步服务 - 基于 Watermark 的增量数据同步
 * 实现智能体之间的数据流转
 */

import mongoose from 'mongoose';
import AgentSyncTask from '../models/AgentSyncTask.js';
import AgentLog from '../models/AgentLog.js';
import Agent from '../models/Agent.js';
import { v4 as uuidv4 } from 'uuid';

// 同步任务状态
const syncTasks = new Map();

/**
 * 生成 traceId
 */
function generateTraceId() {
  return `trace-${Date.now()}-${uuidv4().slice(0, 8)}`;
}

/**
 * 记录同步日志
 */
async function logSync(params) {
  const { traceId, type, agentId, action, status, message, data, error, duration, metadata } = params;
  
  try {
    await AgentLog.create({
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      traceId,
      type: type || 'sync',
      agentId,
      action,
      status,
      message: message || '',
      data,
      error,
      duration: duration || 0,
      metadata,
      createdAt: new Date()
    });
  } catch (err) {
    console.error('[CDC] 日志记录失败:', err.message);
  }
}

/**
 * 获取增量数据 - 基于水位线
 * @param {string} collection - 集合名称
 * @param {Date} watermark - 上次同步时间点
 * @param {object} options - 查询选项
 */
async function getIncrementalData(collection, watermark, options = {}) {
  const { limit = 100, filter = {}, sortField = 'updatedAt' } = options;
  
  const db = mongoose.connection.db;
  const coll = db.collection(collection);
  
  // 构建查询条件
  const query = { ...filter };
  if (watermark) {
    query[sortField] = { $gt: watermark };
  }
  
  // 查询增量数据
  const data = await coll
    .find(query)
    .sort({ [sortField]: 1 })
    .limit(limit)
    .toArray();
  
  return data;
}

/**
 * 写入数据到目标集合
 * @param {string} collection - 目标集合名称
 * @param {Array} data - 数据数组
 * @param {object} options - 写入选项
 */
async function writeData(collection, data, options = {}) {
  const { upsert = true, idField = '_id' } = options;
  
  if (!data || data.length === 0) {
    return { inserted: 0, updated: 0 };
  }
  
  const db = mongoose.connection.db;
  const coll = db.collection(collection);
  
  let inserted = 0;
  let updated = 0;
  
  for (const item of data) {
    if (upsert && item[idField]) {
      const result = await coll.updateOne(
        { [idField]: item[idField] },
        { $set: item },
        { upsert: true }
      );
      if (result.upsertedCount > 0) inserted++;
      else if (result.modifiedCount > 0) updated++;
    } else {
      await coll.insertOne(item);
      inserted++;
    }
  }
  
  return { inserted, updated };
}

/**
 * 执行单个同步任务
 */
async function executeSyncTask(task) {
  const traceId = generateTraceId();
  const startTime = Date.now();
  
  // 更新任务状态
  task.lastStatus = 'processing';
  task.lastRunAt = new Date();
  await task.save();
  
  try {
    // 记录开始日志
    await logSync({
      traceId,
      type: 'sync',
      agentId: task.consumerAgentId,
      action: 'sync_start',
      status: 'processing',
      message: `开始同步: ${task.sourceCollection}`,
      data: {
        producerAgentId: task.producerAgentId,
        sourceCollection: task.sourceCollection,
        watermark: task.lastSyncWatermark
      }
    });
    
    // 获取增量数据
    const incrementalData = await getIncrementalData(
      task.sourceCollection,
      task.lastSyncWatermark
    );
    
    if (incrementalData.length === 0) {
      // 无新数据
      task.lastStatus = 'success';
      task.updatedAt = new Date();
      await task.save();
      
      await logSync({
        traceId,
        type: 'sync',
        agentId: task.consumerAgentId,
        action: 'sync_complete',
        status: 'success',
        message: '无新数据需要同步',
        duration: Date.now() - startTime
      });
      
      return { success: true, count: 0 };
    }
    
    // 获取目标集合名称（消费者智能体的数据表）
    const targetCollection = `agent_data_${task.consumerAgentId}`;
    
    // 写入目标集合
    const writeResult = await writeData(targetCollection, incrementalData);
    
    // 更新水位线（取最后一条数据的 updatedAt）
    const lastItem = incrementalData[incrementalData.length - 1];
    const newWatermark = lastItem.updatedAt || lastItem.createdAt || new Date();
    
    // 更新任务状态
    task.lastSyncWatermark = newWatermark;
    task.lastSyncCount = incrementalData.length;
    task.lastStatus = 'success';
    task.retryCount = 0;
    task.nextRetryAt = null;
    task.totalSyncCount += incrementalData.length;
    task.totalSuccessCount++;
    task.updatedAt = new Date();
    await task.save();
    
    const duration = Date.now() - startTime;
    
    // 记录完成日志
    await logSync({
      traceId,
      type: 'sync',
      agentId: task.consumerAgentId,
      action: 'sync_complete',
      status: 'success',
      message: `同步完成: ${incrementalData.length} 条数据`,
      data: {
        inserted: writeResult.inserted,
        updated: writeResult.updated,
        watermark: newWatermark
      },
      duration,
      metadata: {
        inputCount: incrementalData.length
      }
    });
    
    return { success: true, count: incrementalData.length, duration };
    
  } catch (err) {
    // 处理失败
    const duration = Date.now() - startTime;
    
    task.lastStatus = 'fail';
    task.errorMsg = err.message;
    task.retryCount += 1;
    task.totalFailCount++;
    
    // 计算重试时间（指数退避）
    if (task.retryCount < task.maxRetries) {
      const retryDelay = Math.min(1000 * Math.pow(2, task.retryCount), 60000);
      task.nextRetryAt = new Date(Date.now() + retryDelay);
    } else {
      task.nextRetryAt = null; // 已达最大重试次数
    }
    
    task.updatedAt = new Date();
    await task.save();
    
    // 记录错误日志
    await logSync({
      traceId,
      type: 'sync',
      agentId: task.consumerAgentId,
      action: 'sync_error',
      status: 'fail',
      message: `同步失败: ${err.message}`,
      error: {
        code: 'SYNC_ERROR',
        message: err.message,
        stack: err.stack
      },
      duration,
      metadata: {
        retryCount: task.retryCount,
        nextRetryAt: task.nextRetryAt
      }
    });
    
    console.error(`[CDC] 同步失败 [${task.consumerAgentId} <- ${task.producerAgentId}]:`, err.message);
    
    return { success: false, error: err.message, duration };
  }
}

/**
 * 运行所有待执行的同步任务
 */
export async function runSyncTasks() {
  const now = new Date();
  
  // 查找需要执行的任务
  const tasks = await AgentSyncTask.find({
    $or: [
      { lastStatus: 'pending' },
      { lastStatus: 'success' },
      { lastStatus: 'fail', nextRetryAt: { $lte: now } }
    ]
  });
  
  console.log(`[CDC] 发现 ${tasks.length} 个待执行同步任务`);
  
  const results = [];
  
  for (const task of tasks) {
    // 检查是否需要重试延迟
    if (task.lastStatus === 'fail' && task.nextRetryAt && task.nextRetryAt > now) {
      continue;
    }
    
    // 执行同步
    const result = await executeSyncTask(task);
    results.push({
      taskId: task._id,
      consumerAgentId: task.consumerAgentId,
      producerAgentId: task.producerAgentId,
      ...result
    });
  }
  
  return results;
}

/**
 * 创建同步任务
 */
export async function createSyncTask(params) {
  const { consumerAgentId, producerAgentId, sourceCollection, maxRetries = 3 } = params;
  
  // 检查是否已存在
  const existing = await AgentSyncTask.findOne({
    consumerAgentId,
    producerAgentId,
    sourceCollection
  });
  
  if (existing) {
    return existing;
  }
  
  const task = await AgentSyncTask.create({
    consumerAgentId,
    producerAgentId,
    sourceCollection,
    maxRetries,
    lastStatus: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  console.log(`[CDC] 创建同步任务: ${consumerAgentId} <- ${producerAgentId}/${sourceCollection}`);
  
  return task;
}

/**
 * 手动触发同步
 */
export async function triggerSync(taskId) {
  const task = await AgentSyncTask.findById(taskId);
  if (!task) {
    throw new Error('同步任务不存在');
  }
  
  // 重置状态以便立即执行
  task.lastStatus = 'pending';
  task.nextRetryAt = null;
  await task.save();
  
  return executeSyncTask(task);
}

/**
 * 获取同步任务统计
 */
export async function getSyncStats() {
  const stats = await AgentSyncTask.aggregate([
    {
      $group: {
        _id: '$lastStatus',
        count: { $sum: 1 },
        totalSynced: { $sum: '$totalSyncCount' }
      }
    }
  ]);
  
  const total = await AgentSyncTask.countDocuments();
  
  // 获取最近失败的同步任务
  const recentFailures = await AgentSyncTask.find({ lastStatus: 'fail' })
    .sort({ updatedAt: -1 })
    .limit(5)
    .lean();
  
  return {
    total,
    byStatus: stats.reduce((acc, s) => {
      acc[s._id] = { count: s.count, totalSynced: s.totalSynced };
      return acc;
    }, {}),
    recentFailures
  };
}

/**
 * 清理过期的同步日志
 */
export async function cleanupSyncLogs(daysToKeep = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);
  
  const result = await AgentLog.deleteMany({
    type: 'sync',
    createdAt: { $lt: cutoff }
  });
  
  console.log(`[CDC] 清理了 ${result.deletedCount} 条过期同步日志`);
  return result.deletedCount;
}

export default {
  runSyncTasks,
  createSyncTask,
  triggerSync,
  getSyncStats,
  cleanupSyncLogs,
  executeSyncTask,
  getIncrementalData,
  writeData
};
