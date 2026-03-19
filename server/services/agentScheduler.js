/**
 * 智能体调度器 — 每个 Agent 独立调度循环
 *
 * 流程：
 *   1. 启动时从数据库加载所有 enabled 的 Agent
 *   2. 为每个 Agent 创建独立的 setTimeout 循环
 *   3. 每个循环按 Agent.schedule.interval 轮询
 *   4. 遍历 subscriptions，基于水位线增量读取 → AI 处理 → upsert 成果
 *   5. Agent 配置变更时可热重启单个循环
 */

import mongoose from 'mongoose';
import Agent from '../models/Agent.js';
import AgentSyncTask from '../models/AgentSyncTask.js';
import AgentLog from '../models/AgentLog.js';
import { callModel, getModelConfig } from './ai/modelDispatcher.js';
import { v4 as uuidv4 } from 'uuid';

const timers = new Map();

function traceId() {
  return `trace-${Date.now()}-${uuidv4().slice(0, 8)}`;
}

async function writeLog(params) {
  try {
    await AgentLog.create({
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      traceId: params.traceId || traceId(),
      type: params.type || 'run',
      agentId: params.agentId,
      action: params.action,
      status: params.status,
      message: params.message || '',
      data: params.data,
      error: params.error,
      duration: params.duration || 0,
      metadata: params.metadata,
      createdAt: new Date()
    });
  } catch (err) {
    console.error('[Scheduler] 日志写入失败:', err.message);
  }
}

// ────────────────────────────────────────
// 单个 Agent 的一轮处理
// ────────────────────────────────────────
async function runAgentCycle(agentId) {
  const agent = await Agent.findOne({ id: agentId });
  if (!agent || !agent.enabled || !agent.schedule?.enabled) return;

  const subs = agent.subscriptions || [];
  if (subs.length === 0) return;

  const tid = traceId();
  const cycleStart = Date.now();

  try {
    agent.status.state = 'running';
    await agent.save();

    let totalProcessed = 0;

    for (const sub of subs) {
      const processed = await processSubscription(agent, sub, tid);
      totalProcessed += processed;
    }

    agent.status.state = 'idle';
    agent.status.lastRun = new Date();
    if (totalProcessed > 0) {
      agent.stats.totalRuns += 1;
      agent.stats.successRuns += 1;
      const dur = Date.now() - cycleStart;
      agent.stats.avgDuration = agent.stats.avgDuration
        ? Math.round((agent.stats.avgDuration + dur) / 2)
        : dur;
    }
    await agent.save();
  } catch (err) {
    console.error(`[Scheduler][${agent.name}] 周期错误:`, err.message);
    agent.status.state = 'error';
    agent.stats.totalRuns += 1;
    agent.stats.failedRuns += 1;
    await agent.save().catch(() => {});

    await writeLog({
      traceId: tid,
      type: 'error',
      agentId: agent.id,
      action: 'agent_cycle',
      status: 'fail',
      message: err.message,
      error: err.message,
      duration: Date.now() - cycleStart
    });
  }
}

// ────────────────────────────────────────
// 处理单个订阅源
// ────────────────────────────────────────
async function processSubscription(agent, sub, tid) {
  const syncTask = await AgentSyncTask.findOne({
    subscriberAgentId: agent.id,
    sourceAgentId: sub.agentId
  });
  if (!syncTask) return 0;

  // 重试等待中则跳过
  if (syncTask.nextRetryAt && syncTask.nextRetryAt > new Date()) return 0;

  const watermark = syncTask.lastReadWatermark || new Date(0);
  const wmField = sub.watermarkField || 'updatedAt';

  const db = mongoose.connection.db;
  const query = { [wmField]: { $gt: watermark }, ...sub.filters };

  let records;
  try {
    records = await db.collection(sub.collectionName)
      .find(query)
      .sort({ [wmField]: 1 })
      .limit(sub.batchSize || 100)
      .toArray();
  } catch (err) {
    console.error(`[Scheduler][${agent.name}] 读取 ${sub.collectionName} 失败:`, err.message);
    await markSyncFail(syncTask, err.message);
    return 0;
  }

  if (records.length === 0) return 0;

  const startTime = Date.now();

  await writeLog({
    traceId: tid,
    type: 'sync',
    agentId: agent.id,
    action: 'read_subscription',
    status: 'processing',
    message: `从 ${sub.collectionName} 读取 ${records.length} 条`,
    data: { sourceAgentId: sub.agentId, count: records.length }
  });

  // AI 处理
  let results;
  try {
    results = await processRecords(agent, records);
  } catch (err) {
    console.error(`[Scheduler][${agent.name}] 处理失败:`, err.message);
    await markSyncFail(syncTask, err.message);
    return 0;
  }

  // upsert 到成果表
  const outputCollection = agent.outputSchema?.collectionName;
  if (outputCollection && results.length > 0) {
    const coll = db.collection(outputCollection);
    for (const item of results) {
      const entityId = item.entityId || item._id?.toString() || uuidv4();
      await coll.updateOne(
        { entityId },
        {
          $set: {
            entityId,
            data: item.data || item,
            status: 'completed',
            updatedAt: new Date()
          },
          $setOnInsert: { createdAt: new Date(), isDeleted: false }
        },
        { upsert: true }
      );
    }
  }

  // 更新水位线
  const lastRecord = records[records.length - 1];
  syncTask.lastReadWatermark = lastRecord[wmField] || new Date();
  syncTask.lastReadCount = records.length;
  syncTask.lastRunAt = new Date();
  syncTask.lastStatus = 'success';
  syncTask.retryCount = 0;
  syncTask.nextRetryAt = null;
  syncTask.totalReadCount += records.length;
  await syncTask.save();

  const duration = Date.now() - startTime;

  await writeLog({
    traceId: tid,
    type: 'sync',
    agentId: agent.id,
    action: 'sync_complete',
    status: 'success',
    message: `处理完成: ${records.length} 条 → ${results.length} 条成果`,
    data: { sourceAgentId: sub.agentId, readCount: records.length, outputCount: results.length },
    duration,
    metadata: { modelId: agent.ai?.modelId }
  });

  return records.length;
}

// ────────────────────────────────────────
// AI 处理记录
// ────────────────────────────────────────
async function processRecords(agent, records) {
  if (!agent.ai?.enabled || !agent.ai?.prompt) {
    return records.map(r => ({
      entityId: r.entityId || r._id?.toString(),
      data: r.data || r
    }));
  }

  const modelConfig = getModelConfig(String(agent.ai.modelId || ''));
  if (!modelConfig) {
    return records.map(r => ({
      entityId: r.entityId || r._id?.toString(),
      data: r.data || r
    }));
  }

  const results = [];

  for (const record of records) {
    const inputData = record.data || record;
    const prompt = `${agent.ai.prompt}\n\n输入数据：\n${JSON.stringify(inputData, null, 2)}\n\n请处理并输出 JSON 格式结果。`;

    try {
      const response = await callModel(modelConfig.id, '', prompt);

      let parsed;
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { content: response };
      } catch {
        parsed = { content: response };
      }

      results.push({
        entityId: record.entityId || record._id?.toString() || uuidv4(),
        data: parsed
      });
    } catch (err) {
      console.error(`[Scheduler] AI 调用失败:`, err.message);
      results.push({
        entityId: record.entityId || record._id?.toString() || uuidv4(),
        data: { ...inputData, _aiError: err.message }
      });
    }
  }

  return results;
}

// ────────────────────────────────────────
// 标记订阅失败 + 指数退避
// ────────────────────────────────────────
async function markSyncFail(syncTask, errorMsg) {
  syncTask.lastStatus = 'fail';
  syncTask.errorMsg = errorMsg;
  syncTask.retryCount += 1;

  if (syncTask.retryCount <= syncTask.maxRetries) {
    const delays = [10000, 60000, 300000];
    const delay = delays[Math.min(syncTask.retryCount - 1, delays.length - 1)];
    syncTask.nextRetryAt = new Date(Date.now() + delay);
  } else {
    syncTask.nextRetryAt = null;
  }

  await syncTask.save();
}

// ────────────────────────────────────────
// 调度循环管理
// ────────────────────────────────────────
function scheduleAgent(agentId, interval) {
  const timer = setTimeout(async () => {
    try {
      await runAgentCycle(agentId);
    } catch (err) {
      console.error(`[Scheduler][${agentId}] 未捕获错误:`, err.message);
    }

    // 重新读取最新配置来决定下次间隔
    const agent = await Agent.findOne({ id: agentId }).catch(() => null);
    if (agent && agent.enabled) {
      scheduleAgent(agentId, agent.schedule?.interval || 30000);
    } else {
      timers.delete(agentId);
    }
  }, interval);

  timers.set(agentId, timer);
}

export async function startAgentScheduler() {
  stopAgentScheduler();

  const agents = await Agent.find({ enabled: true, 'schedule.enabled': true });
  console.log(`[Scheduler] 启动 ${agents.length} 个智能体的独立调度循环`);

  for (const agent of agents) {
    const interval = agent.schedule?.interval || 30000;
    console.log(`  → ${agent.name} (${agent.id}) 间隔 ${interval}ms`);
    scheduleAgent(agent.id, interval);
  }
}

export function stopAgentScheduler() {
  for (const [id, timer] of timers) {
    clearTimeout(timer);
  }
  timers.clear();
}

export function restartAgent(agentId) {
  const existing = timers.get(agentId);
  if (existing) clearTimeout(existing);
  timers.delete(agentId);

  Agent.findOne({ id: agentId }).then(agent => {
    if (agent && agent.enabled && agent.schedule?.enabled) {
      const interval = agent.schedule?.interval || 30000;
      console.log(`[Scheduler] 重启智能体 ${agent.name} 间隔 ${interval}ms`);
      scheduleAgent(agentId, interval);
    }
  }).catch(() => {});
}

export function stopAgent(agentId) {
  const existing = timers.get(agentId);
  if (existing) clearTimeout(existing);
  timers.delete(agentId);
  console.log(`[Scheduler] 停止智能体 ${agentId}`);
}

export function getSchedulerStatus() {
  return {
    activeAgents: timers.size,
    agentIds: [...timers.keys()]
  };
}
