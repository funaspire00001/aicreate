import express from 'express';
import AgentSyncTask from '../models/AgentSyncTask.js';
import { triggerSync, triggerAllSync, getSyncStats } from '../services/syncService.js';

const router = express.Router();

// ────────────────────────────────────────
// GET /api/sync-tasks
// ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { subscriberAgentId, sourceAgentId, status } = req.query;
    const filter = {};
    if (subscriberAgentId) filter.subscriberAgentId = subscriberAgentId;
    if (sourceAgentId) filter.sourceAgentId = sourceAgentId;
    if (status) filter.lastStatus = status;

    const tasks = await AgentSyncTask.find(filter).sort({ updatedAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// GET /api/sync-tasks/stats/summary
// ────────────────────────────────────────
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await getSyncStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// GET /api/sync-tasks/:id
// ────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const task = await AgentSyncTask.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: '订阅任务不存在' });
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// POST /api/sync-tasks/:id/trigger — 手动触发
// ────────────────────────────────────────
router.post('/:id/trigger', async (req, res) => {
  try {
    const result = await triggerSync(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// POST /api/sync-tasks/trigger-all — 全部触发
// ────────────────────────────────────────
router.post('/trigger-all', async (req, res) => {
  try {
    const count = await triggerAllSync();
    res.json({ success: true, data: { resetCount: count } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// POST /api/sync-tasks/:id/reset-retry — 重置重试
// ────────────────────────────────────────
router.post('/:id/reset-retry', async (req, res) => {
  try {
    const task = await AgentSyncTask.findByIdAndUpdate(
      req.params.id,
      { $set: { retryCount: 0, nextRetryAt: null, errorMsg: '', updatedAt: new Date() } },
      { new: true }
    );
    if (!task) return res.status(404).json({ success: false, error: '订阅任务不存在' });
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────
// DELETE /api/sync-tasks/:id
// ────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const task = await AgentSyncTask.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: '订阅任务不存在' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
