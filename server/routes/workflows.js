import express from 'express';
import { callModel, getAvailableModels } from '../services/ai/modelDispatcher.js';

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
        order: 1,
        name: '需求分析',
        agentId: '1',
        agentName: '需求分析师',
        prompt: '分析用户提出的需求，提取关键信息和核心内容'
      },
      {
        order: 2,
        name: '内容生成',
        agentId: '2',
        agentName: '内容生成器',
        prompt: '根据分析结果生成详细的知识内容'
      },
      {
        order: 3,
        name: '卡片设计',
        agentId: '3',
        agentName: '卡片设计师',
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
        order: 1,
        name: '内容提取',
        agentId: '1',
        agentName: '需求分析师',
        prompt: '提取需要翻译的内容'
      },
      {
        order: 2,
        name: '多语言翻译',
        agentId: '2',
        agentName: '内容生成器',
        prompt: '将内容翻译成英文、日文、韩文等多种语言'
      }
    ]
  }
];

// 执行历史记录
let executionHistory = [];

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
  
  // 验证步骤中的 agentId
  for (const step of steps) {
    if (!step.agentId) {
      return res.status(400).json({
        success: false,
        error: '每个步骤必须指定智能体'
      });
    }
  }
  
  const newWorkflow = {
    id: Date.now().toString(),
    name,
    description: description || '',
    trigger,
    enabled: enabled !== false,
    lastRun: null,
    steps: steps.map((step, index) => ({
      order: index + 1,
      name: step.name,
      agentId: step.agentId,
      agentName: step.agentName || '',
      prompt: step.prompt || ''
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
  
  // 验证步骤中的 agentId
  for (const step of steps) {
    if (!step.agentId) {
      return res.status(400).json({
        success: false,
        error: '每个步骤必须指定智能体'
      });
    }
  }
  
  workflows[workflowIndex] = {
    ...workflows[workflowIndex],
    name,
    description: description || '',
    trigger,
    enabled: enabled !== false,
    steps: steps.map((step, index) => ({
      order: index + 1,
      name: step.name,
      agentId: step.agentId,
      agentName: step.agentName || '',
      prompt: step.prompt || ''
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
router.post('/:id/run', async (req, res) => {
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
  
  const { input } = req.body;
  const executionId = Date.now().toString();
  
  // 更新最后运行时间
  workflow.lastRun = new Date().toISOString();
  
  // 创建执行记录
  const execution = {
    id: executionId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    startTime: new Date().toISOString(),
    endTime: null,
    status: 'running',
    input: input || '',
    output: null,
    steps: workflow.steps.map(step => ({
      ...step,
      status: 'pending',
      startTime: null,
      endTime: null,
      output: null,
      error: null
    }))
  };
  
  executionHistory.unshift(execution);
  
  // 保留最近 100 条记录
  if (executionHistory.length > 100) {
    executionHistory = executionHistory.slice(0, 100);
  }
  
  // 异步执行工作流
  executeWorkflowAsync(execution, workflow, input);
  
  res.json({
    success: true,
    message: '工作流已启动',
    executionId,
    workflowId: workflow.id
  });
});

// 异步执行工作流
async function executeWorkflowAsync(execution, workflow, input) {
  let currentInput = input || '';
  
  for (let i = 0; i < workflow.steps.length; i++) {
    const step = workflow.steps[i];
    const execStep = execution.steps[i];
    
    execStep.status = 'running';
    execStep.startTime = new Date().toISOString();
    
    try {
      // 获取智能体配置（从 agents 路由导入）
      const agent = await getAgentById(step.agentId);
      
      if (!agent) {
        throw new Error(`智能体不存在: ${step.agentId}`);
      }
      
      // 构建提示词
      const systemPrompt = agent.prompt;
      const userPrompt = step.prompt 
        ? `${step.prompt}\n\n输入内容：${currentInput}`
        : currentInput;
      
      // 调用模型
      const result = await callModel(
        agent.model,
        systemPrompt,
        userPrompt
      );
      
      execStep.status = 'success';
      execStep.output = result;
      currentInput = result;
      
    } catch (error) {
      execStep.status = 'failed';
      execStep.error = error.message;
      execution.status = 'failed';
      execution.error = `步骤 ${step.name} 失败: ${error.message}`;
      break;
    }
    
    execStep.endTime = new Date().toISOString();
  }
  
  execution.endTime = new Date().toISOString();
  
  if (execution.status === 'running') {
    execution.status = 'success';
    execution.output = currentInput;
  }
}

// 获取智能体（模拟，实际应从数据库获取）
async function getAgentById(agentId) {
  // 模拟智能体数据
  const agents = [
    {
      id: '1',
      name: '需求分析师',
      role: 'analyst',
      description: '分析用户需求，提取关键信息',
      model: 'ollama-qwen',
      prompt: '你是一名专业的需求分析师，负责分析用户提出的需求，提取关键信息，识别需求的核心内容和潜在要求。',
      enabled: true,
      capabilities: ['需求分析', '知识检索']
    },
    {
      id: '2',
      name: '内容生成器',
      role: 'generator',
      description: '根据需求生成相关内容',
      model: 'ollama-qwen',
      prompt: '你是一名专业的内容生成器，负责根据用户需求生成高质量的内容，确保内容准确、全面、有价值。',
      enabled: true,
      capabilities: ['内容生成', '多语言支持']
    },
    {
      id: '3',
      name: '卡片设计师',
      role: 'designer',
      description: '设计知识卡片',
      model: 'ollama-qwen',
      prompt: '你是一名专业的卡片设计师，负责将内容设计成美观、易读的知识卡片，确保卡片布局合理、信息清晰。',
      enabled: true,
      capabilities: ['卡片设计', '内容生成']
    }
  ];
  
  return agents.find(a => a.id === agentId);
}

// 获取工作流执行历史
router.get('/:id/executions', (req, res) => {
  const workflowExecutions = executionHistory.filter(e => e.workflowId === req.params.id);
  
  res.json({
    success: true,
    executions: workflowExecutions.slice(0, 20)
  });
});

// 获取执行详情
router.get('/execution/:executionId', (req, res) => {
  const execution = executionHistory.find(e => e.id === req.params.executionId);
  
  if (!execution) {
    return res.status(404).json({
      success: false,
      error: '执行记录不存在'
    });
  }
  
  res.json({
    success: true,
    execution
  });
});

export default router;
