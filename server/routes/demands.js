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
    
    // 返回按 agentId 为 key 的统计（兼容旧的硬编码 key 和新的动态 id）
    res.json({
      success: true,
      stats: {
        // 兼容旧版（organizer, architect 等）
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
    
    // 支持任意 agentKey（不再限制 enum）
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
    
    // 首先尝试通过 id 查找智能体
    let agent = await Agent.findOne({ id: key });
    
    // 如果没找到，尝试通过旧字段 key/role 查找（兼容旧数据）
    if (!agent) {
      agent = await Agent.findOne({ 
        $or: [
          { key: key },
          { role: key }
        ]
      });
    }
    
    if (!agent) {
      return res.status(404).json({ 
        success: false, 
        error: '智能体不存在' 
      });
    }
    
    // 获取统计数据
    const inputStats = { total: 0, pending: 0, consumed: 0 };
    const outputStats = { total: 0, completed: 0 };
    
    res.json({
      success: true,
      detail: {
        config: agent,
        inputStats,
        outputStats,
        currentData: []
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
      priority: typeof priority === 'number' ? priority : 3,
      status: 'new'  // 新需求，等待需求智能体处理
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

// ============================================
// KeyPoint 数据 CRUD
// ============================================
router.get('/data/keypoints', async (req, res) => {
  try {
    const { limit = 20, page = 1, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    
    const total = await KeyPoint.countDocuments(filter);
    const data = await KeyPoint.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    res.json({ success: true, data, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/data/keypoints', async (req, res) => {
  try {
    const { demandId, input, points, summary, status = 'pending' } = req.body;
    const keyPoint = await KeyPoint.create({
      id: `KP_${Date.now()}_${uuidv4().slice(0, 8)}`,
      demandId,
      input,
      points,
      summary,
      status,
      createdAt: new Date()
    });
    res.json({ success: true, data: keyPoint });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/data/keypoints/:id', async (req, res) => {
  try {
    const { points, summary, status } = req.body;
    const keyPoint = await KeyPoint.findOneAndUpdate(
      { id: req.params.id },
      { ...(points && { points }), ...(summary && { summary }), ...(status && { status }) },
      { new: true }
    );
    res.json({ success: true, data: keyPoint });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/data/keypoints/:id', async (req, res) => {
  try {
    await KeyPoint.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// KnowledgeTree 数据 CRUD
// ============================================
router.get('/data/knowledge-trees', async (req, res) => {
  try {
    const { limit = 20, page = 1, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    
    const total = await KnowledgeTree.countDocuments(filter);
    const data = await KnowledgeTree.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    res.json({ success: true, data, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/data/knowledge-trees', async (req, res) => {
  try {
    const { demandId, keyPointId, input, tree, status = 'pending' } = req.body;
    const knowledgeTree = await KnowledgeTree.create({
      id: `KT_${Date.now()}_${uuidv4().slice(0, 8)}`,
      demandId,
      keyPointId,
      input,
      tree,
      status,
      createdAt: new Date()
    });
    res.json({ success: true, data: knowledgeTree });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/data/knowledge-trees/:id', async (req, res) => {
  try {
    const { tree, status } = req.body;
    const knowledgeTree = await KnowledgeTree.findOneAndUpdate(
      { id: req.params.id },
      { ...(tree && { tree }), ...(status && { status }) },
      { new: true }
    );
    res.json({ success: true, data: knowledgeTree });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/data/knowledge-trees/:id', async (req, res) => {
  try {
    await KnowledgeTree.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CardPlan 数据 CRUD
// ============================================
router.get('/data/card-plans', async (req, res) => {
  try {
    const { limit = 20, page = 1, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    
    const total = await CardPlan.countDocuments(filter);
    const data = await CardPlan.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    res.json({ success: true, data, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/data/card-plans', async (req, res) => {
  try {
    const { demandId, knowledgeTreeId, input, plans, totalCards = 0, status = 'pending' } = req.body;
    const cardPlan = await CardPlan.create({
      id: `CP_${Date.now()}_${uuidv4().slice(0, 8)}`,
      demandId,
      knowledgeTreeId,
      input,
      plans,
      totalCards,
      status,
      createdAt: new Date()
    });
    res.json({ success: true, data: cardPlan });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/data/card-plans/:id', async (req, res) => {
  try {
    const { plans, totalCards, status } = req.body;
    const cardPlan = await CardPlan.findOneAndUpdate(
      { id: req.params.id },
      { 
        ...(plans && { plans }), 
        ...(totalCards !== undefined && { totalCards }), 
        ...(status && { status }) 
      },
      { new: true }
    );
    res.json({ success: true, data: cardPlan });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/data/card-plans/:id', async (req, res) => {
  try {
    await CardPlan.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// AgentInput 和 AgentOutput API
// ============================================

import AgentInput from '../models/AgentInput.js';
import AgentOutput from '../models/AgentOutput.js';
import { getAgentDataStats } from '../services/agentScheduler.js';

/**
 * 获取智能体输入数据列表
 */
router.get('/agents/:key/inputs', async (req, res) => {
  try {
    const { key } = req.params;
    const { status, limit = 20, skip = 0 } = req.query;
    
    const query = { agentKey: key };
    if (status) query.status = status;
    
    const inputs = await AgentInput.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();
    
    const total = await AgentInput.countDocuments(query);
    
    res.json({
      success: true,
      data: inputs,
      total,
      hasMore: total > parseInt(skip) + inputs.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取智能体输出数据列表
 */
router.get('/agents/:key/outputs', async (req, res) => {
  try {
    const { key } = req.params;
    const { limit = 20, skip = 0 } = req.query;
    
    const outputs = await AgentOutput.find({ agentKey: key })
      .sort({ createdAt: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .populate('inputId')
      .lean();
    
    const total = await AgentOutput.countDocuments({ agentKey: key });
    
    res.json({
      success: true,
      data: outputs,
      total,
      hasMore: total > parseInt(skip) + outputs.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取智能体数据统计
 */
router.get('/agents/:key/data-stats', async (req, res) => {
  try {
    const { key } = req.params;
    const stats = await getAgentDataStats(key);
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取单条输入详情
 */
router.get('/inputs/:id', async (req, res) => {
  try {
    const input = await AgentInput.findById(req.params.id).lean();
    if (!input) {
      return res.status(404).json({ success: false, error: '未找到记录' });
    }
    res.json({ success: true, data: input });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取单条输出详情
 */
router.get('/outputs/:id', async (req, res) => {
  try {
    const output = await AgentOutput.findById(req.params.id)
      .populate('inputId')
      .lean();
    if (!output) {
      return res.status(404).json({ success: false, error: '未找到记录' });
    }
    res.json({ success: true, data: output });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 重试失败的输入
 */
router.post('/inputs/:id/retry', async (req, res) => {
  try {
    const input = await AgentInput.findById(req.params.id);
    if (!input) {
      return res.status(404).json({ success: false, error: '未找到记录' });
    }
    
    if (input.status !== 'failed') {
      return res.status(400).json({ success: false, error: '只能重试失败的记录' });
    }
    
    input.status = 'pending';
    input.retryCount += 1;
    input.errorMsg = '';
    await input.save();
    
    res.json({ success: true, message: '已加入重试队列' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
