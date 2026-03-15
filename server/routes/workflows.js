import express from 'express';

const router = express.Router();

// 模拟工作流数据
let workflows = [
  {
    id: '1',
    name: '知识卡片生成流程',
    description: '从用户需求到知识卡片的完整生成流程',
    trigger: 'manual',
    enabled: true,
    lastRun: null,
    steps: [
      {
        name: '需求分析',
        agent: '需求分析师',
        prompt: '分析用户提出的需求，提取关键信息和核心内容'
      },
      {
        name: '内容生成',
        agent: '内容生成器',
        prompt: '根据分析结果生成详细的知识内容'
      },
      {
        name: '卡片设计',
        agent: '卡片设计师',
        prompt: '将生成的内容设计成美观的知识卡片'
      }
    ]
  },
  {
    id: '2',
    name: '多语言翻译流程',
    description: '将内容翻译成多种语言',
    trigger: 'webhook',
    enabled: true,
    lastRun: new Date(Date.now() - 3600000).toISOString(),
    steps: [
      {
        name: '内容提取',
        agent: '需求分析师',
        prompt: '提取需要翻译的内容'
      },
      {
        name: '多语言翻译',
        agent: '内容生成器',
        prompt: '将内容翻译成英文、日文、韩文等多种语言'
      }
    ]
  }
];

// 获取所有工作流
router.get('/', (req, res) => {
  res.json({
    success: true,
    workflows
  });
});

// 获取单个工作流
router.get('/:id', (req, res) => {
  const workflow = workflows.find(w => w.id === req.params.id);
  if (workflow) {
    res.json({
      success: true,
      workflow
    });
  } else {
    res.status(404).json({
      success: false,
      error: '工作流不存在'
    });
  }
});

// 创建工作流
router.post('/', (req, res) => {
  const { name, description, trigger, enabled, steps } = req.body;
  
  if (!name || !trigger) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数'
    });
  }
  
  if (!steps || steps.length === 0) {
    return res.status(400).json({
      success: false,
      error: '工作流至少需要一个步骤'
    });
  }
  
  const newWorkflow = {
    id: Date.now().toString(),
    name,
    description: description || '',
    trigger,
    enabled: enabled !== false,
    lastRun: null,
    steps: steps.map((step, index) => ({
      ...step,
      order: index + 1
    }))
  };
  
  workflows.push(newWorkflow);
  
  res.json({
    success: true,
    workflow: newWorkflow
  });
});

// 更新工作流
router.put('/:id', (req, res) => {
  const workflowIndex = workflows.findIndex(w => w.id === req.params.id);
  
  if (workflowIndex === -1) {
    return res.status(404).json({
      success: false,
      error: '工作流不存在'
    });
  }
  
  const { name, description, trigger, enabled, steps } = req.body;
  
  if (!name || !trigger) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数'
    });
  }
  
  if (!steps || steps.length === 0) {
    return res.status(400).json({
      success: false,
      error: '工作流至少需要一个步骤'
    });
  }
  
  workflows[workflowIndex] = {
    ...workflows[workflowIndex],
    name,
    description: description || '',
    trigger,
    enabled: enabled !== false,
    steps: steps.map((step, index) => ({
      ...step,
      order: index + 1
    }))
  };
  
  res.json({
    success: true,
    workflow: workflows[workflowIndex]
  });
});

// 删除工作流
router.delete('/:id', (req, res) => {
  const workflowIndex = workflows.findIndex(w => w.id === req.params.id);
  
  if (workflowIndex === -1) {
    return res.status(404).json({
      success: false,
      error: '工作流不存在'
    });
  }
  
  workflows.splice(workflowIndex, 1);
  
  res.json({
    success: true,
    message: '工作流删除成功'
  });
});

// 运行工作流
router.post('/:id/run', (req, res) => {
  const workflow = workflows.find(w => w.id === req.params.id);
  
  if (!workflow) {
    return res.status(404).json({
      success: false,
      error: '工作流不存在'
    });
  }
  
  if (!workflow.enabled) {
    return res.status(400).json({
      success: false,
      error: '工作流已禁用'
    });
  }
  
  // 更新最后运行时间
  workflow.lastRun = new Date().toISOString();
  
  // 模拟工作流执行
  res.json({
    success: true,
    message: '工作流已启动',
    workflowId: workflow.id,
    executionId: Date.now().toString(),
    steps: workflow.steps.map((step, index) => ({
      step: step.name,
      agent: step.agent,
      status: 'pending',
      order: index + 1
    }))
  });
});

// 获取工作流执行历史
router.get('/:id/executions', (req, res) => {
  const workflow = workflows.find(w => w.id === req.params.id);
  
  if (!workflow) {
    return res.status(404).json({
      success: false,
      error: '工作流不存在'
    });
  }
  
  // 模拟执行历史
  const executions = [];
  for (let i = 0; i < 5; i++) {
    executions.push({
      id: Date.now() - i * 60000,
      workflowId: workflow.id,
      startTime: new Date(Date.now() - i * 60000).toISOString(),
      endTime: new Date(Date.now() - i * 60000 + 30000).toISOString(),
      status: ['success', 'success', 'success', 'failed', 'success'][i],
      duration: 30000,
      steps: workflow.steps.map((step, index) => ({
        step: step.name,
        agent: step.agent,
        status: ['success', 'pending', 'running'][Math.floor(Math.random() * 3)],
        duration: Math.floor(Math.random() * 10000) + 5000,
        order: index + 1
      }))
    });
  }
  
  res.json({
    success: true,
    executions
  });
});

export default router;