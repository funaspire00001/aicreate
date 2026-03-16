import express from 'express';
import Demand from '../models/Demand.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

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
