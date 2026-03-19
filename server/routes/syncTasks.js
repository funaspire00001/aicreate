import express from 'express';
import AgentSyncTask from '../models/AgentSyncTask.js';
import { triggerSync, getSyncStats, createSyncTask, runSyncTasks } from '../services/syncService.js';

const router = express.Router();

// 获取同步任务列表
router.get('/', async (req, res) => {
  try {
    const { consumerAgentId, producerAgentId, status } = req.query;
    
    const filter = {};
    if (consumerAgentId) filter.consumerAgentId = consumerAgentId;
    if (producerAgentId) filter.producerAgentId = producerAgentId;
    if (status) filter.lastStatus = status;
    
    const tasks = await AgentSyncTask.find(filter).sort({ updatedAt: -1 });
    
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个同步任务
router.get('/:id', async (req, res) => {
  try {
    const task = await AgentSyncTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: '同步任务不存在' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建同步任务
router.post('/', async (req, res) => {
  try {
    const { consumerAgentId, producerAgentId, sourceCollection, maxRetries } = req.body;
    
    // 检查是否已存在
    const existing = await AgentSyncTask.findOne({
      consumerAgentId,
      producerAgentId,
      sourceCollection
    });
    
    if (existing) {
      return res.status(400).json({ success: false, error: '该同步任务已存在' });
    }
    
    const task = new AgentSyncTask({
      consumerAgentId,
      producerAgentId,
      sourceCollection,
      maxRetries: maxRetries || 3
    });
    
    await task.save();
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新同步任务
router.put('/:id', async (req, res) => {
  try {
    const task = await AgentSyncTask.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!task) {
      return res.status(404).json({ success: false, error: '同步任务不存在' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除同步任务
router.delete('/:id', async (req, res) => {
  try {
    const task = await AgentSyncTask.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: '同步任务不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 重置重试计数
router.post('/:id/reset-retry', async (req, res) => {
  try {
    const task = await AgentSyncTask.findByIdAndUpdate(
      req.params.id,
      { retryCount: 0, nextRetryAt: null, updatedAt: new Date() },
      { new: true }
    );
    if (!task) {
      return res.status(404).json({ success: false, error: '同步任务不存在' });
    }
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取同步统计
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await getSyncStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 手动触发单个同步任务
router.post('/:id/trigger', async (req, res) => {
  try {
    const result = await triggerSync(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 手动触发所有同步任务
router.post('/trigger-all', async (req, res) => {
  try {
    const results = await runSyncTasks();
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
