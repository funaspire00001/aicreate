/**
 * 稡块状态 API - 提供实时处理状态
 */
import express from 'express';
import { getState, addLog } from '../services/stateStore.js';
import scheduler from '../services/scheduler.js';

const router = express.Router();

/**
 * 获取当前处理状态
 */
router.get('/status', (req, res) => {
  const status = getState();
  res.json({
    success: true,
    data: status
  });
});

/**
 * 获取调度器状态
 */
router.get('/scheduler/status', (req, res) => {
  const status = scheduler.getSchedulerStatus();
  res.json({
    success: true,
    data: status
  });
});

/**
 * 手动触发处理（用于测试）
 */
router.post('/trigger', async (req, res) => {
  try {
    // 异步触发，不等待结果
    import('../services/scheduler.js').then(module => {
      module.default.processPendingFeedback();
    });
    
    res.json({
      success: true,
      message: '已触发处理任务'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
