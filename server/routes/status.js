/**
 * 稡块状态 API - 提供实时处理状态
 */
import express from 'express';
import { getState, addLog } from '../services/stateStore.js';
import scheduler from '../services/scheduler.js';

const router = express.Router();

/**
 * 后端健康检查
 */
router.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    success: true,
    data: {
      status: 'running',
      uptime: Math.floor(uptime),
      uptimeFormatted: formatUptime(uptime),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform
    }
  });
});

/**
 * 格式化运行时间
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) return `${days}天 ${hours}时 ${mins}分`;
  if (hours > 0) return `${hours}时 ${mins}分 ${secs}秒`;
  if (mins > 0) return `${mins}分 ${secs}秒`;
  return `${secs}秒`;
}

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
