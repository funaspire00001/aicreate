import express from 'express';
import { generateCardWithSteps, executeStep, AVAILABLE_MODELS } from '../services/ai/index.js';
import { publishCardDraft } from '../services/cardService.js';
import { addLog } from '../services/stateStore.js';
import StepLog from '../models/StepLog.js';
import LocalCard from '../models/LocalCard.js';

const router = express.Router();

// 生成任务计数器
let taskCounter = 0;
function generateTaskId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const time = Date.now().toString().slice(-6);
  return `TASK_${date}_${time}_${String(++taskCounter).padStart(3, '0')}`;
}

/**
 * POST /api/generate
 * 多步骤生成卡片（支持 SSE 实时推送）
 */
router.post('/', async (req, res) => {
  const { theme, style, model = 'ollama-qwen', autoPublish = false, stream = false } = req.body;
  
  if (!theme || !theme.trim()) {
    return res.status(400).json({
      success: false,
      message: '请输入卡片主题'
    });
  }
  
  // 如果启用流式响应，设置 SSE headers
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
  }
  
  const taskId = generateTaskId();
  const cardId = LocalCard.generateCardId();
  const startTime = Date.now();
  
  // 构建用户输入
  const userInput = style 
    ? `${theme}，风格：${style}`
    : theme;
  
  // 发送 SSE 事件的辅助函数
  const sendEvent = (event, data) => {
    if (stream) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };
  
  // 发送开始事件
  sendEvent('start', { taskId, theme, model, autoPublish });
  addLog('info', `开始生成卡片: ${theme} (模型: ${model}, 任务: ${taskId}, 自动发布: ${autoPublish})`);
  
  // 保存步骤日志
  const stepLogs = [];
  let previousOutput = userInput;
  
  try {
    // 执行多步骤生成
    const result = await generateCardWithSteps(userInput, {
      model,
      onStepComplete: async (step) => {
        // 记录步骤日志
        const log = {
          taskId,
          step: step.step,
          stepName: step.name,
          input: step.step === 1 ? userInput : (step.input || previousOutput),
          output: step.output,
          model,
          duration: step.duration,
          success: step.success,
          error: step.error
        };
        stepLogs.push(log);
        
        if (step.output) {
          previousOutput = step.output;
        }
        
        // 保存到数据库
        try {
          await StepLog.create(log);
        } catch (e) {
          console.error('保存步骤日志失败:', e);
        }
        
        // 发送步骤完成事件（包含输出结果）
        sendEvent('step', {
          step: step.step,
          name: step.name,
          duration: step.duration,
          success: step.success,
          error: step.error,
          output: step.output  // 发送步骤输出
        });
        
        addLog('info', `步骤${step.step} ${step.name} 完成 (${step.duration}ms)`);
      }
    });
    
    if (!result.success) {
      sendEvent('error', { error: result.error });
      addLog('error', `生成失败: ${result.error}`);
      
      if (stream) {
        res.end();
        return;
      }
      return res.json({
        success: false,
        taskId,
        error: result.error,
        steps: result.steps,
        totalDuration: Date.now() - startTime
      });
    }
    
    // 保存到本地数据库
    const localCard = await LocalCard.create({
      cardId,
      theme,
      style: style || '',
      model,
      cardData: result.cardData,
      analysis: result.analysis,
      design: result.design,
      status: 'local',
      taskId,
      steps: result.steps.map(s => ({
        step: s.step,
        name: s.name,
        duration: s.duration,
        success: s.success
      })),
      totalDuration: Date.now() - startTime
    });
    
    sendEvent('saved', { cardId: localCard.cardId });
    addLog('success', `卡片已保存到本地: ${cardId}`);
    
    // 如果启用自动发布，发布到云端
    let publishedCardId = null;
    let publishedCardName = null;
    
    if (autoPublish) {
      sendEvent('publishing', { message: '正在发布到云端...' });
      addLog('info', '正在发布卡片到云端...');
      
      const feedback = {
        feedbackType: 'SUGGESTION',
        content: theme,
        resourceId: null
      };
      
      const publishResult = await publishCardDraft(result.cardData, feedback);
      
      localCard.status = 'published';
      localCard.publishedAt = new Date();
      localCard.publishedCardId = publishResult.cardId;
      localCard.publishedCardName = publishResult.cardName;
      await localCard.save();
      
      publishedCardId = publishResult.cardId;
      publishedCardName = publishResult.cardName;
      
      sendEvent('published', { cardId: publishedCardId, cardName: publishedCardName });
      addLog('success', `卡片已发布到云端: ${publishResult.cardName}`);
    }
    
    const totalDuration = Date.now() - startTime;
    
    // 发送完成事件
    sendEvent('complete', {
      success: true,
      taskId,
      cardId: localCard.cardId,
      status: localCard.status,
      publishedCardId,
      publishedCardName,
      theme: result.theme,
      totalDuration
    });
    
    if (stream) {
      res.end();
      return;
    }
    
    res.json({
      success: true,
      taskId,
      cardId: localCard.cardId,
      localCardId: localCard._id,
      status: localCard.status,
      publishedCardId,
      publishedCardName,
      theme: result.theme,
      cardData: result.cardData,
      analysis: result.analysis,
      design: result.design,
      steps: result.steps,
      totalDuration
    });
    
  } catch (error) {
    sendEvent('error', { error: error.message });
    addLog('error', `生成卡片失败: ${error.message}`);
    
    if (stream) {
      res.end();
      return;
    }
    
    res.status(500).json({
      success: false,
      taskId,
      error: error.message,
      steps: stepLogs,
      totalDuration: Date.now() - startTime
    });
  }
});

/**
 * POST /api/generate/step/:step
 * 单步执行（调试用）
 */
router.post('/step/:step', async (req, res) => {
  const step = parseInt(req.params.step);
  const { input, model = 'ollama-qwen' } = req.body;
  
  if (!input) {
    return res.status(400).json({
      success: false,
      message: '请输入内容'
    });
  }
  
  if (step < 1 || step > 4) {
    return res.status(400).json({
      success: false,
      message: '步骤号必须在 1-4 之间'
    });
  }
  
  try {
    const result = await executeStep(step, input, model);
    
    res.json({
      success: result.success,
      step,
      output: result.output,
      error: result.error,
      duration: result.duration
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/generate/models
 * 获取可用模型列表
 */
router.get('/models', (req, res) => {
  res.json({
    success: true,
    models: AVAILABLE_MODELS.map(m => ({
      id: m.id,
      name: m.name
    }))
  });
});

/**
 * GET /api/generate/logs/:taskId
 * 获取任务的步骤日志
 */
router.get('/logs/:taskId', async (req, res) => {
  const { taskId } = req.params;
  
  try {
    const logs = await StepLog.find({ taskId })
      .sort({ step: 1 });
    
    res.json({
      success: true,
      taskId,
      logs
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
