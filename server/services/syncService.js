/**
 * 数据订阅服务 — 管理 AgentSyncTask 的 CRUD 和手动触发
 *
 * 注意：日常的增量读取由 agentScheduler 中每个 Agent 的独立循环完成。
 * 本模块提供的能力：
 *   - 从 Agent.subscriptions 自动创建/更新/删除 SyncTask
 *   - 手动触发某个订阅
 *   - 统计信息
 */

import mongoose from 'mongoose';
import AgentSyncTask from '../models/AgentSyncTask.js';
import AgentLog from '../models/AgentLog.js';

/**
 * 根据 Agent 的 subscriptions 同步对应的 SyncTask 记录
 * 新增的 → 创建, 删除的 → 删除, 已有的 → 保留不动
 */
export async function syncTasksForAgent(agentId, subscriptions = []) {
  const existing = await AgentSyncTask.find({ subscriberAgentId: agentId });
  const existingMap = new Map(
    existing.map(t => [`${t.sourceAgentId}`, t])
  );

  const desiredSourceIds = new Set(subscriptions.map(s => s.agentId));

  // 删除不再需要的
  for (const [sourceId, task] of existingMap) {
    if (!desiredSourceIds.has(sourceId)) {
      await AgentSyncTask.deleteOne({ _id: task._id });
      console.log(`[SyncService] 删除订阅任务: ${agentId} <- ${sourceId}`);
    }
  }

  // 创建新增的
  for (const sub of subscriptions) {
    if (!existingMap.has(sub.agentId)) {
      await AgentSyncTask.create({
        subscriberAgentId: agentId,
        sourceAgentId: sub.agentId,
        sourceCollection: sub.collectionName,
        maxRetries: 3,
        lastStatus: 'pending'
      });
      console.log(`[SyncService] 创建订阅任务: ${agentId} <- ${sub.agentId}`);
    }
  }
}

/**
 * 删除某个 Agent 的所有订阅任务
 */
export async function removeAllTasksForAgent(agentId) {
  const result = await AgentSyncTask.deleteMany({ subscriberAgentId: agentId });
  console.log(`[SyncService] 删除 ${agentId} 的 ${result.deletedCount} 个订阅任务`);
  return result.deletedCount;
}

/**
 * 手动触发某个订阅任务（重置状态后由下一个调度周期执行）
 */
export async function triggerSync(taskId) {
  const task = await AgentSyncTask.findById(taskId);
  if (!task) throw new Error('订阅任务不存在');

  task.lastStatus = 'pending';
  task.retryCount = 0;
  task.nextRetryAt = null;
  task.errorMsg = '';
  await task.save();

  return task;
}

/**
 * 手动触发所有订阅任务
 */
export async function triggerAllSync() {
  const result = await AgentSyncTask.updateMany(
    {},
    { $set: { lastStatus: 'pending', retryCount: 0, nextRetryAt: null, errorMsg: '' } }
  );
  return result.modifiedCount;
}

/**
 * 统计
 */
export async function getSyncStats() {
  const total = await AgentSyncTask.countDocuments();

  const byStatus = await AgentSyncTask.aggregate([
    { $group: { _id: '$lastStatus', count: { $sum: 1 }, totalRead: { $sum: '$totalReadCount' } } }
  ]);

  const recentFailures = await AgentSyncTask.find({ lastStatus: 'fail' })
    .sort({ updatedAt: -1 })
    .limit(5)
    .lean();

  return {
    total,
    byStatus: byStatus.reduce((acc, s) => {
      acc[s._id] = { count: s.count, totalRead: s.totalRead };
      return acc;
    }, {}),
    recentFailures
  };
}

/**
 * 清理过期日志
 */
export async function cleanupSyncLogs(daysToKeep = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);

  const result = await AgentLog.deleteMany({ type: 'sync', createdAt: { $lt: cutoff } });
  return result.deletedCount;
}

export default {
  syncTasksForAgent,
  removeAllTasksForAgent,
  triggerSync,
  triggerAllSync,
  getSyncStats,
  cleanupSyncLogs
};
