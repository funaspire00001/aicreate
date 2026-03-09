import express from 'express';
import Knowledge from '../models/Knowledge.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// 搜索知识点
router.get('/search', async (req, res) => {
  try {
    const { subject, category, topic, keyword } = req.query;
    
    const query = {};
    if (subject) query.subject = subject;
    if (category) query.category = category;
    if (topic) query.topic = new RegExp(topic, 'i');
    if (keyword) {
      query.$or = [
        { topic: new RegExp(keyword, 'i') },
        { 'knowledgePoints.question': new RegExp(keyword, 'i') },
        { 'knowledgePoints.keywords': new RegExp(keyword, 'i') }
      ];
    }
    
    const results = await Knowledge.find(query).sort({ 'metadata.usageCount': -1 }).limit(20);
    
    res.json({
      success: true,
      count: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取知识库列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, subject, category } = req.query;
    
    const query = {};
    if (subject) query.subject = subject;
    if (category) query.category = category;
    
    const total = await Knowledge.countDocuments(query);
    const data = await Knowledge.find(query)
      .sort({ 'metadata.usageCount': -1 })
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

// 获取单个知识点
router.get('/:id', async (req, res) => {
  try {
    const knowledge = await Knowledge.findOne({ id: req.params.id });
    if (!knowledge) {
      return res.status(404).json({ success: false, error: '知识点不存在' });
    }
    res.json({ success: true, data: knowledge });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建知识点
router.post('/', async (req, res) => {
  try {
    // 为 knowledgePoints 自动生成 id
    const knowledgePoints = (req.body.knowledgePoints || []).map((point, index) => ({
      id: `kp_${Date.now()}_${index}`,
      ...point
    }));
    
    const knowledge = new Knowledge({
      id: `knowledge_${Date.now()}_${uuidv4().slice(0, 8)}`,
      ...req.body,
      knowledgePoints,
      metadata: {
        ...req.body.metadata,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    await knowledge.save();
    res.status(201).json({ success: true, data: knowledge });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新知识点
router.put('/:id', async (req, res) => {
  try {
    const knowledge = await Knowledge.findOneAndUpdate(
      { id: req.params.id },
      { 
        ...req.body, 
        'metadata.updatedAt': new Date() 
      },
      { new: true }
    );
    
    if (!knowledge) {
      return res.status(404).json({ success: false, error: '知识点不存在' });
    }
    
    res.json({ success: true, data: knowledge });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新使用统计
router.put('/:id/usage', async (req, res) => {
  try {
    const knowledge = await Knowledge.findOneAndUpdate(
      { id: req.params.id },
      {
        $inc: { 'metadata.usageCount': 1 },
        $set: { 'metadata.lastUsed': new Date() }
      },
      { new: true }
    );
    
    if (!knowledge) {
      return res.status(404).json({ success: false, error: '知识点不存在' });
    }
    
    res.json({ success: true, data: knowledge });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除知识点
router.delete('/:id', async (req, res) => {
  try {
    const knowledge = await Knowledge.findOneAndDelete({ id: req.params.id });
    
    if (!knowledge) {
      return res.status(404).json({ success: false, error: '知识点不存在' });
    }
    
    res.json({ success: true, message: '知识点已删除' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取知识库统计
router.get('/stats/overview', async (req, res) => {
  try {
    const total = await Knowledge.countDocuments();
    const subjects = await Knowledge.aggregate([
      { $group: { _id: '$subject', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const topUsed = await Knowledge.find()
      .sort({ 'metadata.usageCount': -1 })
      .limit(5)
      .select('id subject topic metadata.usageCount');
    
    res.json({
      success: true,
      data: {
        total,
        subjects,
        topUsed
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
