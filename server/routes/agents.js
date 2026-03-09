import express from 'express';
import AgentRun from '../models/AgentRun.js';

const router = express.Router();

// 获取智能体列表
router.get('/', async (req, res) => {
  try {
    const agents = [
      { name: 'card-intent', description: '需求分析智能体' },
      { name: 'knowledge-manager', description: '知识库管理智能体' },
      { name: 'card-designer', description: '卡片设计智能体' },
      { name: 'quality-reviewer', description: '质量检查智能体' },
      { name: 'card-creator', description: '卡片创建智能体' }
    ];
    
    res.json({ success: true, data: agents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取智能体性能统计
router.get('/:name/stats', async (req, res) => {
  try {
    const { name } = req.params;
    const { days = 7 } = req.query;
    
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days));
    
    const stats = await AgentRun.aggregate([
      {
        $match: {
          agentName: name,
          createdAt: { $gte: since }
        }
      },
      {
        $group: {
          _id: null,
          totalRuns: { $sum: 1 },
          successRuns: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
          },
          failedRuns: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          avgDurationMs: { $avg: '$durationMs' },
          minDurationMs: { $min: '$durationMs' },
          maxDurationMs: { $max: '$durationMs' }
        }
      }
    ]);
    
    const result = stats[0] || {
      totalRuns: 0,
      successRuns: 0,
      failedRuns: 0,
      avgDurationMs: 0,
      minDurationMs: 0,
      maxDurationMs: 0
    };
    
    res.json({
      success: true,
      data: {
        agentName: name,
        period: `${days}天`,
        ...result,
        successRate: result.totalRuns > 0 
          ? ((result.successRuns / result.totalRuns) * 100).toFixed(2) + '%'
          : '0%'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取智能体日志
router.get('/:name/logs', async (req, res) => {
  try {
    const { name } = req.params;
    const { page = 1, limit = 20, status } = req.query;
    
    const query = { agentName: name };
    if (status) query.status = status;
    
    const total = await AgentRun.countDocuments(query);
    const data = await AgentRun.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
