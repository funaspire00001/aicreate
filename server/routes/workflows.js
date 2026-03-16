import express from 'express';
import Workflow from '../models/Workflow.js';
import WorkflowExecution from '../models/WorkflowExecution.js';
import Agent from '../models/Agent.js';
import { callModel } from '../services/ai/modelDispatcher.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * 获取所有工作流
 */
router.get('/', async (req, res) => {
  try {
    const workflows = await Workflow.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      workflows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取单个工作流
 */
router.get('/:id', async (req, res) => {
  try {
    const workflow = await Workflow.findOne({ id: req.params.id });
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
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 创建工作流
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, trigger, enabled, steps, scheduleConfig } = req.body;
    
    if (!name || !trigger) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：name, trigger'
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
      // 验证智能体是否存在
      const agent = await Agent.findOne({ id: step.agentId });
      if (!agent) {
        return res.status(400).json({
          success: false,
          error: `智能体不存在: ${step.agentId}`
        });
      }
    }
    
    const newWorkflow = new Workflow({
      id: uuidv4(),
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
      })),
      scheduleConfig: scheduleConfig || {}
    });
    
    await newWorkflow.save();
    
    res.json({
      success: true,
      workflow: newWorkflow
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 更新工作流
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, description, trigger, enabled, steps, scheduleConfig } = req.body;
    
    const workflow = await Workflow.findOne({ id: req.params.id });
    
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: '工作流不存在'
      });
    }
    
    // 验证步骤中的 agentId
    if (steps && steps.length > 0) {
      for (const step of steps) {
        if (!step.agentId) {
          return res.status(400).json({
            success: false,
            error: '每个步骤必须指定智能体'
          });
        }
        const agent = await Agent.findOne({ id: step.agentId });
        if (!agent) {
          return res.status(400).json({
            success: false,
            error: `智能体不存在: ${step.agentId}`
          });
        }
      }
    }
    
    // 更新字段
    if (name !== undefined) workflow.name = name;
    if (description !== undefined) workflow.description = description;
    if (trigger !== undefined) workflow.trigger = trigger;
    if (enabled !== undefined) workflow.enabled = enabled;
    if (scheduleConfig !== undefined) workflow.scheduleConfig = scheduleConfig;
    
    if (steps && steps.length > 0) {
      workflow.steps = steps.map((step, index) => ({
        order: index + 1,
        name: step.name,
        agentId: step.agentId,
        agentName: step.agentName || '',
        prompt: step.prompt || ''
      }));
    }
    
    await workflow.save();
    
    res.json({
      success: true,
      workflow
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 删除工作流
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await Workflow.deleteOne({ id: req.params.id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: '工作流不存在'
      });
    }
    
    res.json({
      success: true,
      message: '工作流删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * SSE 事件发送辅助函数
 */
function sendSSE(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * 运行工作流（支持 SSE 流式推送）
 */
router.post('/:id/run', async (req, res) => {
  try {
    const workflow = await Workflow.findOne({ id: req.params.id });
    
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
    
    const { input, stream } = req.body;
    const executionId = uuidv4();
    
    // 如果请求 SSE 流式响应
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
    }
    
    // 创建执行记录
    const execution = new WorkflowExecution({
      id: executionId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'running',
      input: input || '',
      startTime: new Date(),
      steps: workflow.steps.map(step => ({
        order: step.order,
        name: step.name,
        agentId: step.agentId,
        agentName: step.agentName,
        status: 'pending'
      })),
      triggeredBy: 'manual'
    });
    
    await execution.save();
    
    // 更新工作流最后运行时间
    workflow.lastRun = new Date();
    workflow.lastStatus = 'running';
    workflow.stats.totalRuns += 1;
    await workflow.save();
    
    // SSE: 发送开始事件
    if (stream) {
      sendSSE(res, 'start', {
        executionId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        totalSteps: workflow.steps.length
      });
    }
    
    // 执行工作流
    const result = await executeWorkflowWithSSE(execution, workflow, input, stream ? res : null);
    
    // SSE: 发送完成事件
    if (stream) {
      sendSSE(res, 'complete', {
        executionId,
        status: execution.status,
        output: execution.output,
        totalDuration: execution.duration,
        error: execution.error
      });
      res.end();
    } else {
      res.json({
        success: true,
        message: '工作流执行完成',
        executionId,
        workflowId: workflow.id,
        status: execution.status,
        output: execution.output,
        duration: execution.duration
      });
    }
  } catch (error) {
    if (res.headersSent) {
      sendSSE(res, 'error', { error: error.message });
      res.end();
    } else {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
});

/**
 * 执行工作流（支持 SSE 实时推送）
 */
async function executeWorkflowWithSSE(execution, workflow, input, sseRes) {
  let currentInput = typeof input === 'object' ? JSON.stringify(input) : (input || '');
  let cardData = null;
  
  // 如果 input 是对象，提取主题
  if (typeof input === 'object' && input.theme) {
    currentInput = input.theme;
  }
  
  try {
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const execStep = execution.steps[i];
      
      execStep.status = 'running';
      execStep.startTime = new Date();
      execStep.input = currentInput;
      await execution.save();
      
      // SSE: 发送步骤开始事件
      if (sseRes) {
        sendSSE(sseRes, 'step_start', {
          stepIndex: i,
          totalSteps: workflow.steps.length,
          stepName: step.name,
          agentName: step.agentName
        });
      }
      
      try {
        // 获取智能体配置
        const agent = await Agent.findOne({ id: step.agentId });
        
        if (!agent) {
          throw new Error(`智能体不存在: ${step.agentId}`);
        }
        
        if (!agent.enabled) {
          throw new Error(`智能体已禁用: ${agent.name}`);
        }
        
        // 构建提示词
        const systemPrompt = agent.prompt;
        let userPrompt = step.prompt 
          ? `${step.prompt}\n\n输入内容：${currentInput}`
          : currentInput;
        
        // 如果有风格参数，添加到提示词
        if (typeof input === 'object' && input.style) {
          userPrompt += `\n\n风格要求：${input.style}`;
        }
        
        // 调用模型
        const result = await callModel(
          agent.modelId,
          systemPrompt,
          userPrompt,
          {
            temperature: agent.temperature,
            maxTokens: agent.maxTokens
          }
        );
        
        execStep.status = 'success';
        execStep.output = result;
        execStep.endTime = new Date();
        execStep.duration = execStep.endTime - execStep.startTime;
        currentInput = result;
        
        // 尝试解析卡片 JSON（最后一步）
        if (i === workflow.steps.length - 1) {
          try {
            // 尝试从结果中提取 JSON
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              cardData = JSON.parse(jsonMatch[0]);
            }
          } catch (e) {
            // JSON 解析失败，不影响流程
          }
        }
        
        // 更新智能体统计
        agent.stats.totalCalls += 1;
        agent.stats.successCalls += 1;
        agent.stats.avgDuration = Math.round(
          (agent.stats.avgDuration * (agent.stats.totalCalls - 1) + execStep.duration) / agent.stats.totalCalls
        );
        await agent.save();
        
        // SSE: 发送步骤完成事件
        if (sseRes) {
          sendSSE(sseRes, 'step_complete', {
            stepIndex: i,
            stepName: step.name,
            success: true,
            duration: execStep.duration,
            output: result.substring(0, 200) + (result.length > 200 ? '...' : '')
          });
        }
        
      } catch (error) {
        execStep.status = 'failed';
        execStep.error = error.message;
        execStep.endTime = new Date();
        execStep.duration = execStep.endTime - execStep.startTime;
        
        // 更新智能体统计
        const agent = await Agent.findOne({ id: step.agentId });
        if (agent) {
          agent.stats.totalCalls += 1;
          agent.stats.failedCalls += 1;
          await agent.save();
        }
        
        // SSE: 发送步骤失败事件
        if (sseRes) {
          sendSSE(sseRes, 'step_complete', {
            stepIndex: i,
            stepName: step.name,
            success: false,
            error: error.message
          });
        }
        
        throw error;
      }
    }
    
    // 执行成功
    execution.status = 'success';
    execution.output = currentInput;
    
    // 保存卡片到本地
    if (cardData) {
      const LocalCard = (await import('../models/LocalCard.js')).default;
      const card = new LocalCard({
        id: uuidv4(),
        name: cardData.title || cardData.name || '未命名卡片',
        theme: typeof input === 'object' ? input.theme : input,
        style: typeof input === 'object' ? input.style : '',
        data: cardData,
        source: 'workflow',
        workflowId: workflow.id,
        executionId: execution.id
      });
      await card.save();
      
      // SSE: 发送保存事件
      if (sseRes) {
        sendSSE(sseRes, 'saved', {
          cardId: card.id,
          cardName: card.name
        });
      }
    }
    
    // 更新工作流统计
    workflow.stats.successRuns += 1;
    workflow.lastStatus = 'success';
    
  } catch (error) {
    execution.status = 'failed';
    execution.error = error.message;
    workflow.stats.failedRuns += 1;
    workflow.lastStatus = 'failed';
  }
  
  execution.endTime = new Date();
  execution.duration = execution.endTime - execution.startTime;
  
  await execution.save();
  await workflow.save();
  
  return execution;
}

/**
 * 获取工作流执行历史
 */
router.get('/:id/executions', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const executions = await WorkflowExecution.find({ workflowId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      executions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取执行详情
 */
router.get('/execution/:executionId', async (req, res) => {
  try {
    const execution = await WorkflowExecution.findOne({ id: req.params.executionId });
    
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
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取正在执行的执行记录
 */
router.get('/:id/executions/running', async (req, res) => {
  try {
    const executions = await WorkflowExecution.find({
      workflowId: req.params.id,
      status: 'running'
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      executions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 初始化默认工作流
 */
router.post('/init-defaults', async (req, res) => {
  try {
    const count = await Workflow.countDocuments();
    
    if (count > 0) {
      return res.json({
        success: true,
        message: '工作流已存在，跳过初始化',
        count
      });
    }
    
    // 获取智能体
    const agents = await Agent.find();
    
    if (agents.length < 3) {
      return res.status(400).json({
        success: false,
        error: '请先初始化智能体'
      });
    }
    
    const analyst = agents.find(a => a.role === 'analyst');
    const generator = agents.find(a => a.role === 'generator');
    const designer = agents.find(a => a.role === 'designer');
    
    const defaultWorkflows = [
      {
        id: uuidv4(),
        name: '知识卡片生成流程',
        description: '从用户需求到知识卡片的完整生成流程',
        trigger: 'manual',
        enabled: true,
        steps: [
          {
            order: 1,
            name: '需求分析',
            agentId: analyst?.id,
            agentName: analyst?.name,
            prompt: '分析用户需求，提取关键信息和主题'
          },
          {
            order: 2,
            name: '内容生成',
            agentId: generator?.id,
            agentName: generator?.name,
            prompt: '根据分析结果生成详细的知识内容'
          },
          {
            order: 3,
            name: '卡片设计',
            agentId: designer?.id,
            agentName: designer?.name,
            prompt: '将生成的内容设计成美观的知识卡片JSON'
          }
        ]
      }
    ];
    
    await Workflow.insertMany(defaultWorkflows);
    
    res.json({
      success: true,
      message: '默认工作流创建成功',
      count: defaultWorkflows.length,
      workflows: defaultWorkflows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;