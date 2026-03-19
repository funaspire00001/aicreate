import express from 'express';
import Workspace from '../models/Workspace.js';
import Agent from '../models/Agent.js';
import { startAgentScheduler, stopAgentScheduler, restartAgent, stopAgent } from '../services/agentScheduler.js';

const router = express.Router();

// ────────────────────────────────────────
// GET /api/workspaces
// ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const workspaces = await Workspace.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: workspaces });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// GET /api/workspaces/:id
// ────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const workspace = await Workspace.findOne({ id: req.params.id });
    if (!workspace) return res.status(404).json({ success: false, error: '空间不存在' });

    const agents = await Agent.find({ id: { $in: workspace.agentIds || [] } });

    res.json({ success: true, data: { workspace, agents } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// POST /api/workspaces
// ────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, error: '空间名称不能为空' });

    const spaceId = `space_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const workspace = new Workspace({
      id: spaceId,
      name,
      description: description || '',
      status: 'active',
      agentIds: []
    });

    await workspace.save();
    res.json({ success: true, data: workspace });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// PUT /api/workspaces/:id
// ────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const workspace = await Workspace.findOne({ id: req.params.id });
    if (!workspace) return res.status(404).json({ success: false, error: '空间不存在' });

    const { name, description, agentIds } = req.body;
    if (name !== undefined) workspace.name = name;
    if (description !== undefined) workspace.description = description;
    if (agentIds !== undefined) workspace.agentIds = agentIds;

    await workspace.save();
    res.json({ success: true, data: workspace });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// DELETE /api/workspaces/:id
// ────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const workspace = await Workspace.findOne({ id: req.params.id });
    if (!workspace) return res.status(404).json({ success: false, error: '空间不存在' });

    await Workspace.deleteOne({ id: req.params.id });
    res.json({ success: true, message: '空间已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// GET /api/workspaces/:id/agents — 空间下的智能体
// ────────────────────────────────────────
router.get('/:id/agents', async (req, res) => {
  try {
    const workspace = await Workspace.findOne({ id: req.params.id });
    if (!workspace) return res.status(404).json({ success: false, error: '空间不存在' });

    const agents = await Agent.find({ id: { $in: workspace.agentIds || [] } });
    res.json({ success: true, data: agents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// POST /api/workspaces/:id/start — 启动空间
// 启动空间下所有智能体的调度循环
// ────────────────────────────────────────
router.post('/:id/start', async (req, res) => {
  try {
    const workspace = await Workspace.findOne({ id: req.params.id });
    if (!workspace) return res.status(404).json({ success: false, error: '空间不存在' });

    workspace.status = 'active';
    await workspace.save();

    const agents = await Agent.find({ id: { $in: workspace.agentIds || [] }, enabled: true });
    for (const agent of agents) {
      restartAgent(agent.id);
    }

    res.json({
      success: true,
      data: { status: 'active', startedAgents: agents.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// POST /api/workspaces/:id/pause — 暂停空间
// 停止空间下所有智能体的调度循环
// ────────────────────────────────────────
router.post('/:id/pause', async (req, res) => {
  try {
    const workspace = await Workspace.findOne({ id: req.params.id });
    if (!workspace) return res.status(404).json({ success: false, error: '空间不存在' });

    workspace.status = 'paused';
    await workspace.save();

    const agents = await Agent.find({ id: { $in: workspace.agentIds || [] } });
    for (const agent of agents) {
      stopAgent(agent.id);
    }

    res.json({
      success: true,
      data: { status: 'paused', stoppedAgents: agents.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
