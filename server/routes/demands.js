import express from 'express';
import Demand from '../models/Demand.js';
import KeyPoint from '../models/KeyPoint.js';
import KnowledgeTree from '../models/KnowledgeTree.js';
import CardPlan from '../models/CardPlan.js';
import StepLog from '../models/StepLog.js';
import Agent from '../models/Agent.js';
import { v4 as uuidv4 } from 'uuid';
import { getAgentStatus } from '../services/agentScheduler.js';

const router = express.Router();

/**
 * 获取智能体状态
 */
router.get('/agents/status', async (req, res) => {
  try {
    const status = getAgentStatus();
    res.json({
      success: true,
      agents: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取智能体数据统计
 */
router.get('/agents/stats', async (req, res) => {
  try {
    const [
      keyPointTotal,
      keyPointPending,
      keyPointCompleted,
      knowledgeTreeTotal,
      knowledgeTreePending,
      knowledgeTreeCompleted,
      cardPlanTotal,
      cardPlanPending,
      cardPlanCompleted,
      cardPlanTotalCards
    ] = await Promise.all([
      KeyPoint.countDocuments(),
      KeyPoint.countDocuments({ status: 'pending' }),
      KeyPoint.countDocuments({ status: 'completed' }),
      KnowledgeTree.countDocuments(),
      KnowledgeTree.countDocuments({ status: 'pending' }),
      KnowledgeTree.countDocuments({ status: 'completed' }),
      CardPlan.countDocuments(),
      CardPlan.countDocuments({ status: 'pending' }),
      CardPlan.countDocuments({ status: 'completed' }),
      CardPlan.aggregate([{ $group: { _id: null, total: { $sum: '$totalCards' } } }])
    ]);
    
    // 获取待处理数量（未被下游消费）
    const [
      keyPointUnconsumed,
      knowledgeTreeUnconsumed,
      cardPlanUnconsumed
    ] = await Promise.all([
      KeyPoint.countDocuments({ status: 'completed', consumedByKnowledgeTree: false }),
      KnowledgeTree.countDocuments({ status: 'completed', consumedByCardPlan: false }),
      CardPlan.countDocuments({ status: 'completed', consumedByCardGenerator: false })
    ]);
    
    res.json({
      success: true,
      stats: {
        organizer: {
          total: keyPointTotal,
          pending: keyPointPending,
          completed: keyPointCompleted,
          unconsumed: keyPointUnconsumed
        },
        architect: {
          total: knowledgeTreeTotal,
          pending: knowledgeTreePending,
          completed: knowledgeTreeCompleted,
          unconsumed: knowledgeTreeUnconsumed
        },
        planner: {
          total: cardPlanTotal,
          pending: cardPlanPending,
          completed: cardPlanCompleted,
          unconsumed: cardPlanUnconsumed,
          totalCards: cardPlanTotalCards[0]?.total || 0
        },
        generator: {
          totalCards: cardPlanTotalCards[0]?.total || 0,
          pending: cardPlanUnconsumed
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取指定智能体的日志
 */
router.get('/agents/:key/logs', async (req, res) => {
  try {
    const { key } = req.params;
    const { limit = 50 } = req.query;
    
    const validKeys = ['organizer', 'architect', 'planner', 'generator', 'system'];
    if (!validKeys.includes(key)) {
      return res.status(400).json({
        success: false,
        error: '无效的智能体标识'
      });
    }
    
    const logs = await StepLog.find({ agentKey: key })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      logs: logs.map(log => ({
        id: log.id,
        level: log.level,
        message: log.message,
        agentName: log.agentName,
        duration: log.duration,
        createdAt: log.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取智能体详情（配置信息 + 数据库信息）
 */
router.get('/agents/:key/detail', async (req, res) => {
  try {
    const { key } = req.params;
    
    const roleMap = {
      organizer: { modelRole: 'organizer', inputModel: 'Demand', outputModel: 'KeyPoint', inputField: 'consumedByKeyPoint', outputField: 'consumedByKnowledgeTree' },
      architect: { modelRole: 'architect', inputModel: 'KeyPoint', outputModel: 'KnowledgeTree', inputField: 'consumedByKnowledgeTree', outputField: 'consumedByCardPlan' },
      planner: { modelRole: 'planner', inputModel: 'KnowledgeTree', outputModel: 'CardPlan', inputField: 'consumedByCardPlan', outputField: 'consumedByCardGenerator' },
      generator: { modelRole: 'generator', inputModel: 'CardPlan', outputModel: 'Demand', inputField: 'consumedByCardGenerator', outputField: null }
    };
    
    const config = roleMap[key];
    if (!config) {
      return res.status(400).json({ success: false, error: '无效的智能体标识' });
    }
    
    // 获取智能体配置
    const agent = await Agent.findOne({ role: config.modelRole, enabled: true });
    
    // 获取统计数据
    let inputStats = {}, outputStats = {}, currentData = [];
    
    if (config.inputModel === 'Demand') {
      inputStats = {
        total: await Demand.countDocuments({ status: 'processing' }),
        pending: await Demand.countDocuments({ status: 'processing', [config.inputField]: false }),
        consumed: await Demand.countDocuments({ [config.inputField]: true })
      };
      currentData = await Demand.find({ status: 'processing', [config.inputField]: false }).limit(5).sort({ createdAt: -1 });
    } else if (config.inputModel === 'KeyPoint') {
      inputStats = {
        total: await KeyPoint.countDocuments({ status: 'completed' }),
        pending: await KeyPoint.countDocuments({ status: 'completed', [config.inputField]: false }),
        consumed: await KeyPoint.countDocuments({ [config.inputField]: true })
      };
      currentData = await KeyPoint.find({ status: 'completed', [config.inputField]: false }).limit(5).sort({ createdAt: -1 });
    } else if (config.inputModel === 'KnowledgeTree') {
      inputStats = {
        total: await KnowledgeTree.countDocuments({ status: 'completed' }),
        pending: await KnowledgeTree.countDocuments({ status: 'completed', [config.inputField]: false }),
        consumed: await KnowledgeTree.countDocuments({ [config.inputField]: true })
      };
      currentData = await KnowledgeTree.find({ status: 'completed', [config.inputField]: false }).limit(5).sort({ createdAt: -1 });
    } else if (config.inputModel === 'CardPlan') {
      inputStats = {
        total: await CardPlan.countDocuments({ status: 'completed' }),
        pending: await CardPlan.countDocuments({ status: 'completed', [config.inputField]: false }),
        consumed: await CardPlan.countDocuments({ [config.inputField]: true })
      };
      currentData = await CardPlan.find({ status: 'completed', [config.inputField]: false }).limit(5).sort({ createdAt: -1 });
    }
    
    if (config.outputModel === 'KeyPoint') {
      outputStats = {
        total: await KeyPoint.countDocuments(),
        completed: await KeyPoint.countDocuments({ status: 'completed' })
      };
    } else if (config.outputModel === 'KnowledgeTree') {
      outputStats = {
        total: await KnowledgeTree.countDocuments(),
        completed: await KnowledgeTree.countDocuments({ status: 'completed' })
      };
    } else if (config.outputModel === 'CardPlan') {
      outputStats = {
        total: await CardPlan.countDocuments(),
        completed: await CardPlan.countDocuments({ status: 'completed' }),
        totalCards: await CardPlan.aggregate([{ $group: { _id: null, total: { $sum: '$totalCards' } } }])
      };
    }
    
    res.json({
      success: true,
      detail: {
        config: agent ? {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          description: agent.description,
          modelId: agent.modelId,
          prompt: agent.prompt,
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          capabilities: agent.capabilities,
          enabled: agent.enabled
        } : null,
        inputStats,
        outputStats,
        currentData: currentData.map(d => ({
          id: d.id,
          status: d.status,
          summary: d.summary || d.tree?.root || d.plans?.[0]?.title || '-',
          createdAt: d.createdAt
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取所有需求
 */
router.get('/', async (req, res) => {
  try {
    const { status, source, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (source) query.source = source;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [demands, total] = await Promise.all([
      Demand.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Demand.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      demands,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 统计信息（必须在 /:id 之前定义）
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const [
      total,
      pending,
      processing,
      completed,
      failed,
      todayCount
    ] = await Promise.all([
      Demand.countDocuments(),
      Demand.countDocuments({ status: 'pending' }),
      Demand.countDocuments({ status: 'processing' }),
      Demand.countDocuments({ status: 'completed' }),
      Demand.countDocuments({ status: 'failed' }),
      Demand.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      })
    ]);
    
    res.json({
      success: true,
      stats: {
        total,
        pending,
        processing,
        completed,
        failed,
        todayCount
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个需求
 */
router.get('/:id', async (req, res) => {
  try {
    const demand = await Demand.findOne({ id: req.params.id });
    
    if (!demand) {
      return res.status(404).json({
        success: false,
        error: '需求不存在'
      });
    }
    
    res.json({
      success: true,
      demand
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建需求
 */
router.post('/', async (req, res) => {
  try {
    const { theme, content, source, tags, priority } = req.body;
    
    if (!theme || !theme.trim()) {
      return res.status(400).json({
        success: false,
        error: '请输入主题'
      });
    }
    
    const demand = new Demand({
      id: Demand.generateId(),
      theme: theme.trim(),
      content: content?.trim() || '',
      source: source || 'manual',
      tags: tags || [],
      priority: priority || 'normal'
    });
    
    await demand.save();
    
    res.json({
      success: true,
      demand
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新需求
 */
router.put('/:id', async (req, res) => {
  try {
    const { theme, content, tags, priority, status } = req.body;
    
    const demand = await Demand.findOne({ id: req.params.id });
    
    if (!demand) {
      return res.status(404).json({
        success: false,
        error: '需求不存在'
      });
    }
    
    if (theme !== undefined) demand.theme = theme;
    if (content !== undefined) demand.content = content;
    if (tags !== undefined) demand.tags = tags;
    if (priority !== undefined) demand.priority = priority;
    if (status !== undefined) {
      demand.status = status;
      if (status === 'completed') {
        demand.processedAt = new Date();
      }
    }
    
    await demand.save();
    
    res.json({
      success: true,
      demand
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 启动需求处理（将状态改为processing，调度器会自动接管）
 */
router.post('/:id/start', async (req, res) => {
  try {
    const demand = await Demand.findOne({ id: req.params.id });
    
    if (!demand) {
      return res.status(404).json({
        success: false,
        error: '需求不存在'
      });
    }
    
    if (demand.status === 'processing') {
      return res.status(400).json({
        success: false,
        error: '需求正在处理中'
      });
    }
    
    if (demand.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: '需求已完成'
      });
    }
    
    demand.status = 'processing';
    demand.currentStep = 0;
    demand.errorMessage = null;
    await demand.save();
    
    res.json({
      success: true,
      message: '需求已启动处理',
      demand
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取需求执行详情（包含所有关联数据）
 */
router.get('/:id/execution', async (req, res) => {
  try {
    const KeyPoint = (await import('../models/KeyPoint.js')).default;
    const KnowledgeTree = (await import('../models/KnowledgeTree.js')).default;
    const CardPlan = (await import('../models/CardPlan.js')).default;
    const StepLog = (await import('../models/StepLog.js')).default;
    
    const demand = await Demand.findOne({ id: req.params.id });
    
    if (!demand) {
      return res.status(404).json({
        success: false,
        error: '需求不存在'
      });
    }
    
    // 获取关联数据
    const [keyPoint, knowledgeTree, cardPlan, logs] = await Promise.all([
      demand.keyPointId ? KeyPoint.findOne({ id: demand.keyPointId }) : null,
      demand.knowledgeTreeId ? KnowledgeTree.findOne({ id: demand.knowledgeTreeId }) : null,
      demand.cardPlanId ? CardPlan.findOne({ id: demand.cardPlanId }) : null,
      StepLog.find({ executionId: demand.id }).sort({ createdAt: 1 })
    ]);
    
    res.json({
      success: true,
      execution: {
        demand,
        keyPoint,
        knowledgeTree,
        cardPlan,
        logs
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 删除需求
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await Demand.deleteOne({ id: req.params.id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: '需求不存在'
      });
    }
    
    res.json({
      success: true,
      message: '需求删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 批量创建需求（导入）
 */
router.post('/batch', async (req, res) => {
  try {
    const { demands } = req.body;
    
    if (!demands || !Array.isArray(demands) || demands.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供需求列表'
      });
    }
    
    const newDemands = demands.map(item => ({
      id: Demand.generateId(),
      theme: item.theme?.trim(),
      content: item.content?.trim() || '',
      source: item.source || 'import',
      tags: item.tags || [],
      priority: item.priority || 'normal'
    })).filter(d => d.theme); // 过滤掉没有主题的
    
    if (newDemands.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有有效的主题'
      });
    }
    
    await Demand.insertMany(newDemands);
    
    res.json({
      success: true,
      message: `成功导入 ${newDemands.length} 条需求`,
      count: newDemands.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
