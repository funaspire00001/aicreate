/**
 * 智能体数据表管理服务
 * 动态创建和管理智能体专属数据表
 */

import mongoose from 'mongoose';
import CollectionMeta from '../models/CollectionMeta.js';
import Agent from '../models/Agent.js';
import AgentLog from '../models/AgentLog.js';
import { v4 as uuidv4 } from 'uuid';

// 智能体数据表的默认字段
const DEFAULT_DATA_SCHEMA = {
  // 来源信息
  sourceId: { type: String, required: true },           // 来源记录ID
  sourceType: { type: String, required: true },         // 来源类型（demand/keypoint等）
  sourceCollection: { type: String, required: true },   // 来源表名
  
  // 同步信息
  syncWatermark: { type: Date, required: true },        // 同步时间点
  syncTaskId: { type: String },                         // 同步任务ID
  
  // 数据内容
  data: { type: mongoose.Schema.Types.Mixed },          // 实际数据
  
  // 处理状态
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  processedAt: { type: Date },
  
  // 时间戳
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
};

// 缓存已创建的模型
const modelCache = new Map();

/**
 * 生成 traceId
 */
function generateTraceId() {
  return `trace-${Date.now()}-${uuidv4().slice(0, 8)}`;
}

/**
 * 记录日志
 */
async function log(params) {
  const { traceId, type, agentId, action, status, message, data, error, duration } = params;
  
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
      createdAt: new Date()
    });
  } catch (err) {
    console.error('[AgentData] 日志记录失败:', err.message);
  }
}

/**
 * 获取智能体数据表名
 */
export function getAgentDataCollectionName(agentId) {
  return `agent_data_${agentId}`;
}

/**
 * 检查表是否存在
 */
export async function collectionExists(collectionName) {
  const collections = await mongoose.connection.db.listCollections({ name: collectionName }).toArray();
  return collections.length > 0;
}

/**
 * 获取或创建智能体数据模型
 */
export async function getOrCreateAgentDataModel(agentId, customSchema = {}) {
  const collectionName = getAgentDataCollectionName(agentId);
  
  // 检查缓存
  if (modelCache.has(collectionName)) {
    return modelCache.get(collectionName);
  }
  
  // 合并自定义字段
  const finalSchema = {
    ...DEFAULT_DATA_SCHEMA,
    ...customSchema
  };
  
  // 创建 Schema
  const schema = new mongoose.Schema(finalSchema, {
    collection: collectionName,
    timestamps: false
  });
  
  // 添加索引
  schema.index({ sourceId: 1, sourceType: 1 }, { unique: true });
  schema.index({ syncWatermark: 1 });
  schema.index({ status: 1 });
  schema.index({ createdAt: -1 });
  
  // 更新时自动设置 updatedAt
  schema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
  });
  
  try {
    // 尝试获取已存在的模型
    let model;
    if (mongoose.models[collectionName]) {
      model = mongoose.models[collectionName];
    } else {
      model = mongoose.model(collectionName, schema);
    }
    
    modelCache.set(collectionName, model);
    return model;
  } catch (err) {
    // 如果模型已存在，直接获取
    if (err.message.includes('Cannot overwrite')) {
      const model = mongoose.model(collectionName);
      modelCache.set(collectionName, model);
      return model;
    }
    throw err;
  }
}

/**
 * 为智能体创建数据表
 */
export async function createAgentDataTable(agentId, agentName, customSchema = {}) {
  const traceId = generateTraceId();
  const startTime = Date.now();
  const collectionName = getAgentDataCollectionName(agentId);
  
  try {
    // 检查表是否已存在
    const exists = await collectionExists(collectionName);
    if (exists) {
      await log({
        traceId,
        type: 'sync',
        agentId,
        action: 'create_table',
        status: 'success',
        message: `数据表已存在: ${collectionName}`,
        duration: Date.now() - startTime
      });
      
      return { success: true, existed: true, collectionName };
    }
    
    // 创建模型（会自动创建集合）
    const model = await getOrCreateAgentDataModel(agentId, customSchema);
    
    // 创建索引（确保集合被创建）
    await model.createIndexes();
    
    // 注册到 CollectionMeta
    await CollectionMeta.findOneAndUpdate(
      { name: collectionName },
      {
        name: collectionName,
        displayName: `${agentName || agentId} 数据表`,
        category: '智能体数据',
        agentIds: [agentId],
        description: `智能体 ${agentName || agentId} 的专属数据表`,
        order: 200
      },
      { upsert: true, new: true }
    );
    
    const duration = Date.now() - startTime;
    
    await log({
      traceId,
      type: 'sync',
      agentId,
      action: 'create_table',
      status: 'success',
      message: `创建数据表成功: ${collectionName}`,
      data: { collectionName, agentId },
      duration
    });
    
    console.log(`[AgentData] 创建数据表成功: ${collectionName}`);
    
    return { success: true, existed: false, collectionName };
    
  } catch (err) {
    const duration = Date.now() - startTime;
    
    await log({
      traceId,
      type: 'sync',
      agentId,
      action: 'create_table',
      status: 'fail',
      message: `创建数据表失败: ${err.message}`,
      error: {
        code: 'CREATE_TABLE_ERROR',
        message: err.message,
        stack: err.stack
      },
      duration
    });
    
    console.error(`[AgentData] 创建数据表失败 [${collectionName}]:`, err.message);
    
    return { success: false, error: err.message };
  }
}

/**
 * 删除智能体数据表
 */
export async function dropAgentDataTable(agentId) {
  const traceId = generateTraceId();
  const collectionName = getAgentDataCollectionName(agentId);
  
  try {
    // 检查表是否存在
    const exists = await collectionExists(collectionName);
    if (!exists) {
      return { success: true, message: '表不存在' };
    }
    
    // 删除集合
    await mongoose.connection.db.dropCollection(collectionName);
    
    // 从缓存移除
    modelCache.delete(collectionName);
    
    // 删除元数据
    await CollectionMeta.deleteOne({ name: collectionName });
    
    await log({
      traceId,
      type: 'sync',
      agentId,
      action: 'drop_table',
      status: 'success',
      message: `删除数据表成功: ${collectionName}`
    });
    
    console.log(`[AgentData] 删除数据表成功: ${collectionName}`);
    
    return { success: true };
    
  } catch (err) {
    await log({
      traceId,
      type: 'sync',
      agentId,
      action: 'drop_table',
      status: 'fail',
      message: `删除数据表失败: ${err.message}`,
      error: {
        code: 'DROP_TABLE_ERROR',
        message: err.message,
        stack: err.stack
      }
    });
    
    return { success: false, error: err.message };
  }
}

/**
 * 获取智能体数据表统计
 */
export async function getAgentDataStats(agentId) {
  const collectionName = getAgentDataCollectionName(agentId);
  
  try {
    const model = await getOrCreateAgentDataModel(agentId);
    
    const [total, pending, processing, completed, failed] = await Promise.all([
      model.countDocuments(),
      model.countDocuments({ status: 'pending' }),
      model.countDocuments({ status: 'processing' }),
      model.countDocuments({ status: 'completed' }),
      model.countDocuments({ status: 'failed' })
    ]);
    
    return {
      collectionName,
      total,
      byStatus: { pending, processing, completed, failed }
    };
  } catch (err) {
    return { collectionName, total: 0, error: err.message };
  }
}

/**
 * 为所有智能体初始化数据表
 */
export async function initializeAgentDataTables() {
  console.log('[AgentData] 开始初始化智能体数据表...');
  
  const agents = await Agent.find({ enabled: true });
  const results = [];
  
  for (const agent of agents) {
    const result = await createAgentDataTable(agent.id, agent.name);
    results.push({
      agentId: agent.id,
      agentName: agent.name,
      ...result
    });
  }
  
  console.log(`[AgentData] 初始化完成，共 ${results.length} 个智能体`);
  
  return results;
}

/**
 * 清理智能体数据（保留表结构）
 */
export async function clearAgentData(agentId, beforeDate = null) {
  const collectionName = getAgentDataCollectionName(agentId);
  
  try {
    const model = await getOrCreateAgentDataModel(agentId);
    
    const query = beforeDate ? { createdAt: { $lt: beforeDate } } : {};
    const result = await model.deleteMany(query);
    
    console.log(`[AgentData] 清理 ${collectionName} 数据: ${result.deletedCount} 条`);
    
    return { success: true, deletedCount: result.deletedCount };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export default {
  getAgentDataCollectionName,
  collectionExists,
  getOrCreateAgentDataModel,
  createAgentDataTable,
  dropAgentDataTable,
  getAgentDataStats,
  initializeAgentDataTables,
  clearAgentData
};
