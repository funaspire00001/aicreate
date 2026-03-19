import express from 'express';
import Agent from '../models/Agent.js';
import { createAgentDataTable, dropAgentDataTable, getAgentDataStats, pushData } from '../services/agentDataService.js';
import { syncTasksForAgent, removeAllTasksForAgent } from '../services/syncService.js';
import { restartAgent, stopAgent } from '../services/agentScheduler.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// ────────────────────────────────────────
// GET /api/agents
// ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { workspaceId, enabled } = req.query;
    const filter = {};
    if (workspaceId) filter.workspaceId = workspaceId;
    if (enabled !== undefined) filter.enabled = enabled === 'true';

    const agents = await Agent.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: agents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// GET /api/agents/:id
// ────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const agent = await Agent.findOne({ id: req.params.id });
    if (!agent) return res.status(404).json({ success: false, error: '智能体不存在' });
    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// POST /api/agents — 创建智能体
// 自动创建成果表 + 同步任务
// ────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, description, workspaceId, ai, schedule, outputSchema, subscriptions, skillIds, enabled } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: '缺少必要参数: name' });
    }

    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const collectionName = outputSchema?.collectionName || `agent_data_${agentId}`;

    const newAgent = new Agent({
      id: agentId,
      name,
      description: description || '',
      workspaceId: workspaceId || '',
      ai: {
        enabled: ai?.enabled !== false,
        modelId: ai?.modelId || '',
        prompt: ai?.prompt || '',
        temperature: ai?.temperature ?? 0.7,
        maxTokens: ai?.maxTokens ?? 4096
      },
      schedule: {
        enabled: schedule?.enabled !== false,
        interval: schedule?.interval || 30000,
        batchSize: schedule?.batchSize || 10,
        maxRetries: schedule?.maxRetries || 3
      },
      outputSchema: {
        collectionName,
        version: outputSchema?.version || 1,
        fields: outputSchema?.fields || {}
      },
      subscriptions: subscriptions || [],
      skillIds: skillIds || [],
      enabled: enabled !== false
    });

    await newAgent.save();

    // 自动创建成果表
    await createAgentDataTable(agentId, name);

    // 自动创建同步任务
    if (subscriptions && subscriptions.length > 0) {
      await syncTasksForAgent(agentId, subscriptions);
    }

    // 如果启用调度，启动循环
    if (newAgent.enabled && newAgent.schedule.enabled) {
      restartAgent(agentId);
    }

    res.json({ success: true, data: newAgent });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// PUT /api/agents/:id — 更新智能体
// subscriptions 变更时自动同步 SyncTask
// ────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const agent = await Agent.findOne({ id: req.params.id });
    if (!agent) return res.status(404).json({ success: false, error: '智能体不存在' });

    const { name, description, workspaceId, ai, schedule, outputSchema, subscriptions, skillIds, enabled } = req.body;

    if (name !== undefined) agent.name = name;
    if (description !== undefined) agent.description = description;
    if (workspaceId !== undefined) agent.workspaceId = workspaceId;
    if (enabled !== undefined) agent.enabled = enabled;
    if (skillIds !== undefined) agent.skillIds = skillIds;

    if (ai !== undefined) {
      agent.ai = { ...agent.ai.toObject?.() || agent.ai, ...ai };
    }
    if (schedule !== undefined) {
      agent.schedule = { ...agent.schedule.toObject?.() || agent.schedule, ...schedule };
    }
    if (outputSchema !== undefined) {
      agent.outputSchema = { ...agent.outputSchema.toObject?.() || agent.outputSchema, ...outputSchema };
    }

    // subscriptions 变更 → 重建同步任务
    if (subscriptions !== undefined) {
      agent.subscriptions = subscriptions;
      await syncTasksForAgent(agent.id, subscriptions);
    }

    await agent.save();

    // 热重启调度
    if (agent.enabled && agent.schedule.enabled) {
      restartAgent(agent.id);
    } else {
      stopAgent(agent.id);
    }

    res.json({ success: true, data: agent });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// DELETE /api/agents/:id
// ────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const agent = await Agent.findOne({ id: req.params.id });
    if (!agent) return res.status(404).json({ success: false, error: '智能体不存在' });

    stopAgent(agent.id);
    await removeAllTasksForAgent(agent.id);
    await dropAgentDataTable(agent.id);
    await Agent.deleteOne({ id: req.params.id });

    res.json({ success: true, message: '智能体及关联资源已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// POST /api/agents/:id/input — 外部数据推送
// ────────────────────────────────────────
router.post('/:id/input', async (req, res) => {
  try {
    const agent = await Agent.findOne({ id: req.params.id });
    if (!agent) return res.status(404).json({ success: false, error: '智能体不存在' });

    const { entityId, data } = req.body;
    if (!data) return res.status(400).json({ success: false, error: '缺少 data 字段' });

    const collectionName = agent.outputSchema?.collectionName;
    if (!collectionName) {
      return res.status(400).json({ success: false, error: '智能体未配置成果表' });
    }

    const result = await pushData(agent.id, entityId || uuidv4(), data);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// GET /api/agents/:id/data-stats — 成果表统计
// ────────────────────────────────────────
router.get('/:id/data-stats', async (req, res) => {
  try {
    const stats = await getAgentDataStats(req.params.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// GET /api/agents/stats/summary — 全局统计
// ────────────────────────────────────────
router.get('/stats/summary', async (req, res) => {
  try {
    const total = await Agent.countDocuments();
    const enabled = await Agent.countDocuments({ enabled: true });

    res.json({
      success: true,
      data: { total, enabled, disabled: total - enabled }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
