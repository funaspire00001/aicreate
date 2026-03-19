import express from 'express';
import Skill from '../models/Skill.js';

const router = express.Router();

// 获取技能列表
router.get('/', async (req, res) => {
  try {
    const { type, category, enabled, agentId } = req.query;
    
    const filter = {};
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (enabled !== undefined) filter.enabled = enabled === 'true';
    if (agentId) filter.agentIds = agentId;
    
    const skills = await Skill.find(filter).sort({ createdAt: -1 });
    
    res.json({ success: true, data: skills });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个技能
router.get('/:id', async (req, res) => {
  try {
    const skill = await Skill.findOne({ id: req.params.id });
    if (!skill) {
      return res.status(404).json({ success: false, error: '技能不存在' });
    }
    res.json({ success: true, data: skill });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建技能
router.post('/', async (req, res) => {
  try {
    const skill = new Skill({
      id: `skill-${Date.now()}`,
      ...req.body
    });
    await skill.save();
    res.json({ success: true, data: skill });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新技能
router.put('/:id', async (req, res) => {
  try {
    const skill = await Skill.findOneAndUpdate(
      { id: req.params.id },
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!skill) {
      return res.status(404).json({ success: false, error: '技能不存在' });
    }
    res.json({ success: true, data: skill });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除技能
router.delete('/:id', async (req, res) => {
  try {
    const skill = await Skill.findOneAndDelete({ id: req.params.id });
    if (!skill) {
      return res.status(404).json({ success: false, error: '技能不存在' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取技能分类
router.get('/meta/categories', async (req, res) => {
  try {
    const categories = await Skill.distinct('category');
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取技能标签
router.get('/meta/tags', async (req, res) => {
  try {
    const skills = await Skill.find({}, 'tags');
    const tags = [...new Set(skills.flatMap(s => s.tags))];
    res.json({ success: true, data: tags });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
