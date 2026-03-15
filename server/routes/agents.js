import express from 'express';

const router = express.Router();

// 模拟智能体数据
let agents = [
  {
    id: '1',
    name: '需求分析师',
    role: 'analyst',
    description: '分析用户需求，提取关键信息',
    model: 'doubao',
    prompt: '你是一名专业的需求分析师，负责分析用户提出的需求，提取关键信息，识别需求的核心内容和潜在要求。',
    enabled: true,
    capabilities: ['需求分析', '知识检索']
  },
  {
    id: '2',
    name: '内容生成器',
    role: 'generator',
    description: '根据需求生成相关内容',
    model: 'gpt-4',
    prompt: '你是一名专业的内容生成器，负责根据用户需求生成高质量的内容，确保内容准确、全面、有价值。',
    enabled: true,
    capabilities: ['内容生成', '多语言支持']
  },
  {
    id: '3',
    name: '卡片设计师',
    role: 'designer',
    description: '设计知识卡片',
    model: 'claude-3',
    prompt: '你是一名专业的卡片设计师，负责将内容设计成美观、易读的知识卡片，确保卡片布局合理、信息清晰。',
    enabled: true,
    capabilities: ['卡片设计', '内容生成']
  }
];

// 获取所有智能体
router.get('/', (req, res) => {
  res.json({
    success: true,
    agents
  });
});

// 获取单个智能体
router.get('/:id', (req, res) => {
  const agent = agents.find(a => a.id === req.params.id);
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
});

// 创建智能体
router.post('/', (req, res) => {
  const { name, role, description, model, prompt, enabled, capabilities } = req.body;
  
  if (!name || !role || !model || !prompt) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数'
    });
  }
  
  const newAgent = {
    id: Date.now().toString(),
    name,
    role,
    description: description || '',
    model,
    prompt,
    enabled: enabled !== false,
    capabilities: capabilities || []
  };
  
  agents.push(newAgent);
  
  res.json({
    success: true,
    agent: newAgent
  });
});

// 更新智能体
router.put('/:id', (req, res) => {
  const agentIndex = agents.findIndex(a => a.id === req.params.id);
  
  if (agentIndex === -1) {
    return res.status(404).json({
      success: false,
      error: '智能体不存在'
    });
  }
  
  const { name, role, description, model, prompt, enabled, capabilities } = req.body;
  
  if (!name || !role || !model || !prompt) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数'
    });
  }
  
  agents[agentIndex] = {
    ...agents[agentIndex],
    name,
    role,
    description: description || '',
    model,
    prompt,
    enabled: enabled !== false,
    capabilities: capabilities || []
  };
  
  res.json({
    success: true,
    agent: agents[agentIndex]
  });
});

// 删除智能体
router.delete('/:id', (req, res) => {
  const agentIndex = agents.findIndex(a => a.id === req.params.id);
  
  if (agentIndex === -1) {
    return res.status(404).json({
      success: false,
      error: '智能体不存在'
    });
  }
  
  agents.splice(agentIndex, 1);
  
  res.json({
    success: true,
    message: '智能体删除成功'
  });
});

// 获取智能体统计信息（用于监控）
router.get('/stats', (req, res) => {
  // 模拟统计数据
  const stats = agents.map(agent => ({
    agentName: agent.name,
    totalCalls: Math.floor(Math.random() * 1000),
    successRate: Math.floor(Math.random() * 30) + 70,
    avgDuration: Math.floor(Math.random() * 500) + 100
  }));
  
  // 模拟最近运行记录
  const recentRuns = [];
  for (let i = 0; i < 10; i++) {
    const agent = agents[Math.floor(Math.random() * agents.length)];
    recentRuns.push({
      id: Date.now() + i,
      agentName: agent.name,
      status: ['success', 'pending', 'failed'][Math.floor(Math.random() * 3)],
      startTime: new Date(Date.now() - i * 60000).toISOString(),
      duration: Math.floor(Math.random() * 1000) + 100,
      requestId: Math.floor(Math.random() * 1000).toString(),
      error: Math.random() > 0.8 ? '模拟错误信息' : null
    });
  }
  
  res.json({
    success: true,
    stats,
    recentRuns
  });
});

export default router;