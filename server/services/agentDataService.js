/**
 * 智能体成果表管理服务
 *
 * 职责：
 *   - 根据 Agent.outputSchema 动态创建 MongoDB 集合 + 索引
 *   - 注册 / 注销 CollectionMeta
 *   - 统计成果表数据
 *   - 向成果表推送数据（外部输入 API 使用）
 */

import mongoose from 'mongoose';
import CollectionMeta from '../models/CollectionMeta.js';
import Agent from '../models/Agent.js';

/**
 * 确保集合存在并创建必要索引
 */
export async function ensureCollection(collectionName) {
  const db = mongoose.connection.db;
  const collections = await db.listCollections({ name: collectionName }).toArray();

  if (collections.length === 0) {
    await db.createCollection(collectionName);
  }

  const coll = db.collection(collectionName);

  await coll.createIndex({ entityId: 1 }, { unique: true, sparse: true }).catch(() => {});
  await coll.createIndex({ updatedAt: 1 }).catch(() => {});
  await coll.createIndex({ status: 1 }).catch(() => {});

  return coll;
}

/**
 * 为 Agent 创建成果表 + 注册元数据
 */
export async function createAgentDataTable(agentId, agentName) {
  const collectionName = `agent_data_${agentId}`;

  await ensureCollection(collectionName);

  await CollectionMeta.findOneAndUpdate(
    { name: collectionName },
    {
      name: collectionName,
      displayName: `${agentName || agentId} 成果表`,
      category: '智能体数据',
      agentIds: [agentId],
      description: `智能体 ${agentName || agentId} 的成果表`,
      order: 200
    },
    { upsert: true, new: true }
  );

  console.log(`[AgentData] 成果表就绪: ${collectionName}`);
  return { success: true, collectionName };
}

/**
 * 删除 Agent 的成果表 + 注销元数据
 */
export async function dropAgentDataTable(agentId) {
  const collectionName = `agent_data_${agentId}`;
  const db = mongoose.connection.db;

  const collections = await db.listCollections({ name: collectionName }).toArray();
  if (collections.length > 0) {
    await db.dropCollection(collectionName);
  }

  await CollectionMeta.deleteOne({ name: collectionName });

  console.log(`[AgentData] 成果表已删除: ${collectionName}`);
  return { success: true };
}

/**
 * 获取成果表统计
 */
export async function getAgentDataStats(agentId) {
  const collectionName = `agent_data_${agentId}`;
  const db = mongoose.connection.db;

  try {
    const coll = db.collection(collectionName);
    const [total, pending, completed, failed] = await Promise.all([
      coll.countDocuments(),
      coll.countDocuments({ status: 'pending' }),
      coll.countDocuments({ status: 'completed' }),
      coll.countDocuments({ status: 'failed' })
    ]);

    return { collectionName, total, byStatus: { pending, completed, failed } };
  } catch {
    return { collectionName, total: 0, byStatus: { pending: 0, completed: 0, failed: 0 } };
  }
}

/**
 * 向成果表推送数据（外部输入 / 手动推送）
 * 使用 entityId 做 upsert
 */
export async function pushData(agentId, entityId, data) {
  const collectionName = `agent_data_${agentId}`;
  const db = mongoose.connection.db;
  const coll = db.collection(collectionName);

  const result = await coll.updateOne(
    { entityId },
    {
      $set: {
        entityId,
        data,
        status: 'completed',
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date(),
        isDeleted: false
      }
    },
    { upsert: true }
  );

  return {
    entityId,
    upserted: result.upsertedCount > 0,
    modified: result.modifiedCount > 0
  };
}

/**
 * 启动时为所有已有 Agent 确保成果表存在
 */
export async function initializeAgentDataTables() {
  const agents = await Agent.find({ enabled: true });
  const results = [];

  for (const agent of agents) {
    if (agent.outputSchema?.collectionName) {
      await ensureCollection(agent.outputSchema.collectionName);

      await CollectionMeta.findOneAndUpdate(
        { name: agent.outputSchema.collectionName },
        {
          name: agent.outputSchema.collectionName,
          displayName: `${agent.name} 成果表`,
          category: '智能体数据',
          agentIds: [agent.id],
          description: `智能体 ${agent.name} 的成果表`,
          order: 200
        },
        { upsert: true }
      );

      results.push({ agentId: agent.id, collection: agent.outputSchema.collectionName });
    }
  }

  if (results.length > 0) {
    console.log(`[AgentData] 初始化 ${results.length} 个成果表`);
  }
  return results;
}

export default {
  ensureCollection,
  createAgentDataTable,
  dropAgentDataTable,
  getAgentDataStats,
  pushData,
  initializeAgentDataTables
};
