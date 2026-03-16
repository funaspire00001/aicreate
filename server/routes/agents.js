import express from 'express';
import Agent from '../models/Agent.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * 获取所有智能体
 */
router.get('/', async (req, res) => {
  try {
    const agents = await Agent.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      agents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个智能体
 */
router.get('/:id', async (req, res) => {
  try {
    const agent = await Agent.findOne({ id: req.params.id });
    if (agent) {
      res.json({
        success: true,
        agent
      });
    } else {
      res.status(404).json({
        success: false,
        error: '智能体不存在'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建智能体
 */
router.post('/', async (req, res) => {
  try {
    const { name, role, description, modelId, prompt, temperature, maxTokens, enabled, capabilities } = req.body;
    
    if (!name || !role || !prompt) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：name, role, prompt'
      });
    }
    
    const newAgent = new Agent({
      id: uuidv4(),
      name,
      role,
      description: description || '',
      modelId: modelId || 'ollama-qwen',
      prompt,
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 4096,
      enabled: enabled !== false,
      capabilities: capabilities || []
    });
    
    await newAgent.save();
    
    res.json({
      success: true,
      agent: newAgent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新智能体
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, role, description, modelId, prompt, temperature, maxTokens, enabled, capabilities } = req.body;
    
    const agent = await Agent.findOne({ id: req.params.id });
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: '智能体不存在'
      });
    }
    
    // 更新字段
    if (name !== undefined) agent.name = name;
    if (role !== undefined) agent.role = role;
    if (description !== undefined) agent.description = description;
    if (modelId !== undefined) agent.modelId = modelId;
    if (prompt !== undefined) agent.prompt = prompt;
    if (temperature !== undefined) agent.temperature = temperature;
    if (maxTokens !== undefined) agent.maxTokens = maxTokens;
    if (enabled !== undefined) agent.enabled = enabled;
    if (capabilities !== undefined) agent.capabilities = capabilities;
    
    await agent.save();
    
    res.json({
      success: true,
      agent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 删除智能体
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await Agent.deleteOne({ id: req.params.id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: '智能体不存在'
      });
    }
    
    res.json({
      success: true,
      message: '智能体删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取智能体统计信息
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const total = await Agent.countDocuments();
    const enabled = await Agent.countDocuments({ enabled: true });
    const byRole = await Agent.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      stats: {
        total,
        enabled,
        disabled: total - enabled,
        byRole: byRole.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
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
 * 初始化默认智能体
 */
router.post('/init-defaults', async (req, res) => {
  try {
    const count = await Agent.countDocuments();
    
    if (count > 0) {
      return res.json({
        success: true,
        message: '智能体已存在，跳过初始化',
        count
      });
    }
    
    const defaultAgents = [
      {
        id: uuidv4(),
        name: '需求分析师',
        role: 'analyst',
        description: '分析用户需求，提取关键信息',
        modelId: 'ollama-qwen',
        prompt: '你是一名专业的需求分析师，负责分析用户提出的需求，提取关键信息，识别需求的核心内容和潜在要求。请用 JSON 格式输出分析结果。',
        temperature: 0.3,
        maxTokens: 2048,
        enabled: true,
        capabilities: ['需求分析', '知识检索', '信息提取']
      },
      {
        id: uuidv4(),
        name: '内容生成器',
        role: 'generator',
        description: '根据需求生成相关内容',
        modelId: 'ollama-qwen',
        prompt: '你是一名专业的内容生成器，负责根据用户需求生成高质量的内容，确保内容准确、全面、有价值。',
        temperature: 0.7,
        maxTokens: 4096,
        enabled: true,
        capabilities: ['内容生成', '多语言支持', '创意写作']
      },
      {
        id: uuidv4(),
        name: '卡片设计师',
        role: 'designer',
        description: '设计知识卡片',
        modelId: 'ollama-qwen',
        prompt: '你是一名专业的卡片设计师，负责将内容设计成美观、易读的知识卡片，确保卡片布局合理、信息清晰。请输出符合规范的 JSON 格式。',
        temperature: 0.5,
        maxTokens: 8192,
        enabled: true,
        capabilities: ['卡片设计', '布局优化', '视觉设计']
      },
      {
        id: uuidv4(),
        name: '质量审核员',
        role: 'reviewer',
        description: '审核生成内容质量',
        modelId: 'ollama-qwen',
        prompt: '你是一名专业的质量审核员，负责审核生成的内容是否符合要求，检查格式、内容完整性和准确性。如发现问题，请提供修正建议。',
        temperature: 0.2,
        maxTokens: 2048,
        enabled: true,
        capabilities: ['质量审核', '内容校验', '问题检测']
      }
    ];
    
    await Agent.insertMany(defaultAgents);
    
    res.json({
      success: true,
      message: '默认智能体创建成功',
      count: defaultAgents.length,
      agents: defaultAgents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
