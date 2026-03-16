import express from 'express';
import Request from '../models/Request.js';
import Knowledge from '../models/Knowledge.js';
import AgentRun from '../models/AgentRun.js';

const router = express.Router();

// 获取仪表盘数据
router.get('/', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    // 今日统计
    const todayRequests = await Request.countDocuments({ createdAt: { $gte: today } });
    const todayCards = await Request.countDocuments({ 
      createdAt: { $gte: today }, 
      status: 'success' 
    });
    
    // 知识库统计
    const knowledgeTotal = await Knowledge.countDocuments();
    const knowledgeUsedToday = await Knowledge.countDocuments({ 
      'metadata.lastUsed': { $gte: today } 
    });
    
    // 本周趋势
    const weeklyTrend = await Request.aggregate([
      {
        $match: { createdAt: { $gte: weekAgo } }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // 智能体性能概览
    const agentStats = await AgentRun.aggregate([
      {
        $match: { createdAt: { $gte: weekAgo } }
      },
      {
        $group: {
          _id: '$agentName',
          totalRuns: { $sum: 1 },
          successRuns: {
            $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] }
          },
          avgDuration: { $avg: '$durationMs' }
        }
      }
    ]);
    
    // 最近需求
    const recentRequests = await Request.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('id userId requirement status createdAt');
    
    // 热门知识点
    const hotKnowledge = await Knowledge.find()
      .sort({ 'metadata.usageCount': -1 })
      .limit(5)
      .select('id subject topic metadata.usageCount');
    
    res.json({
      success: true,
      data: {
        today: {
          requests: todayRequests,
          cards: todayCards,
          knowledgeUsed: knowledgeUsedToday
        },
        knowledge: {
          total: knowledgeTotal
        },
        weeklyTrend,
        agentStats,
        recentRequests,
        hotKnowledge
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
