import express from 'express';
import Request from '../models/Request.js';
import AgentRun from '../models/AgentRun.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// 创建需求记录
router.post('/', async (req, res) => {
  try {
    const { userId, source, requirement, feedbackId, feedbackType, resourceId } = req.body;
    
    const request = new Request({
      id: `req_${Date.now()}_${uuidv4().slice(0, 8)}`,
      userId: userId || 'admin',
      source: source || 'feishu',
      feedbackId,
      feedbackType,
      resourceId,
      requirement,
      status: 'processing'
    });
    
    await request.save();
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取需求列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, userId, source } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (userId) query.userId = userId;
    if (source) query.source = source;
    
    const total = await Request.countDocuments(query);
    const data = await Request.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('-designResult -agentRuns');
    
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

// 获取需求详情
router.get('/:id', async (req, res) => {
  try {
    const request = await Request.findOne({ id: req.params.id });
    if (!request) {
      return res.status(404).json({ success: false, error: '需求不存在' });
    }
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新需求步骤
router.put('/:id/step', async (req, res) => {
  try {
    const { step, result, agentName, durationMs, status } = req.body;
    
    const request = await Request.findOne({ id: req.params.id });
    if (!request) {
      return res.status(404).json({ success: false, error: '需求不存在' });
    }
    
    // 更新对应步骤的结果
    switch (step) {
      case 'intent':
        request.intentResult = result;
        break;
      case 'knowledge':
        request.knowledgeResult = result;
        break;
      case 'design':
        request.designResult = result;
        break;
      case 'review':
        request.reviewResult = result;
        break;
      case 'card':
        request.cardResult = result;
        break;
    }
    
    // 添加智能体运行记录
    if (agentName) {
      request.agentRuns.push({
        agentName,
        input: result?.input,
        output: result,
        status: status || 'success',
        durationMs,
        createdAt: new Date()
      });
    }
    
    request.updatedAt = new Date();
    await request.save();
    
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 完成需求
router.put('/:id/complete', async (req, res) => {
  try {
    const { success, totalTimeMs, cardId, cardName } = req.body;
    
    const request = await Request.findOne({ id: req.params.id });
    if (!request) {
      return res.status(404).json({ success: false, error: '需求不存在' });
    }
    
    request.status = success ? 'success' : 'failed';
    request.totalTimeMs = totalTimeMs;
    if (cardId) {
      request.cardResult = {
        success,
        cardId,
        cardName
      };
    }
    request.updatedAt = new Date();
    
    await request.save();
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
