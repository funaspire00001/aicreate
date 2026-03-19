import express from 'express';
import Agent from '../models/Agent.js';
import Workspace from '../models/Workspace.js';
import AgentSyncTask from '../models/AgentSyncTask.js';
import AgentLog from '../models/AgentLog.js';

const router = express.Router();

// ────────────────────────────────────────
// GET /api/dashboard — 全局概览
// ────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      totalAgents,
      enabledAgents,
      totalWorkspaces,
      activeWorkspaces,
      totalSyncTasks,
      failedSyncTasks,
      todayLogs,
      todayErrors
    ] = await Promise.all([
      Agent.countDocuments(),
      Agent.countDocuments({ enabled: true }),
      Workspace.countDocuments(),
      Workspace.countDocuments({ status: 'active' }),
      AgentSyncTask.countDocuments(),
      AgentSyncTask.countDocuments({ lastStatus: 'fail' }),
      AgentLog.countDocuments({ createdAt: { $gte: today } }),
      AgentLog.countDocuments({ createdAt: { $gte: today }, status: 'fail' })
    ]);

    // 各智能体运行统计
    const agentStats = await Agent.find({ enabled: true })
      .select('id name status stats')
      .lean();

    // 最近活动日志
    const recentLogs = await AgentLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // 一周趋势
    const weeklyTrend = await AgentLog.aggregate([
      { $match: { createdAt: { $gte: weekAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: 1 },
          success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
          fail: { $sum: { $cond: [{ $eq: ['$status', 'fail'] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          agents: { total: totalAgents, enabled: enabledAgents },
          workspaces: { total: totalWorkspaces, active: activeWorkspaces },
          syncTasks: { total: totalSyncTasks, failed: failedSyncTasks },
          today: { logs: todayLogs, errors: todayErrors }
        },
        agentStats,
        recentLogs,
        weeklyTrend
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
