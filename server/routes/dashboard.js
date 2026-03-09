import express from 'express';
import Request from '../models/Request.js';
import Knowledge from '../models/Knowledge.js';
import AgentRun from '../models/AgentRun.js';
import { generateCard } from '../services/aiService.js';
import { publishCardDraft } from '../services/cardService.js';
import { addLog, getStats, incrementStats } from '../services/stateStore.js';

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

// 创作卡片
router.post('/create', async (req, res) => {
  try {
    const { theme, style, model } = req.body;
    
    if (!theme || !theme.trim()) {
      return res.status(400).json({ 
        success: false, 
        message: '请输入卡片主题' 
      });
    }
    
    const modelId = model || 'doubao';
    const modelName = modelId === 'ollama-qwen' ? 'Ollama Qwen3.5' : '豆包';
    
    addLog('info', `开始创作卡片: ${theme} (模型: ${modelName})`);
    
    // 1. 调用 AI 生成卡片
    addLog('info', `正在调用 ${modelName} 生成卡片...`);
    const cardData = await generateCard(theme, style, modelId);
    addLog('success', 'AI 生成卡片成功');
    
    // 2. 发布为草稿
    const feedback = {
      feedbackType: 'SUGGESTION',
      content: theme,
      resourceId: null
    };
    
    addLog('info', '正在发布卡片草稿...');
    const result = await publishCardDraft(cardData, feedback);
    addLog('success', `卡片发布成功: ${result.cardName}`);
    
    // 更新统计
    incrementStats('todayTotal');
    incrementStats('todaySuccess');
    incrementStats('totalGenerated');
    
    res.json({
      success: true,
      data: {
        cardId: result.cardId,
        cardName: result.cardName,
        theme: cardData.theme || theme,
        status: 'DRAFT',
        model: modelName,
        message: '卡片已生成并保存为草稿，可在小程序后台审核发布'
      }
    });
    
  } catch (error) {
    addLog('error', `创作卡片失败: ${error.message}`);
    incrementStats('todayTotal');
    incrementStats('todayFailed');
    
    res.status(500).json({ 
      success: false, 
      message: error.message || '创作失败，请重试' 
    });
  }
});

export default router;
