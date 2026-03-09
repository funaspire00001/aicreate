import express from 'express';
import { generateCardWithSteps, executeStep, AVAILABLE_MODELS } from '../services/ai/index.js';
import { publishCardDraft } from '../services/cardService.js';
import { addLog } from '../services/stateStore.js';
import StepLog from '../models/StepLog.js';

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
 * 多步骤生成卡片
 */
router.post('/', async (req, res) => {
  const { theme, style, model = 'ollama-qwen' } = req.body;
  
  if (!theme || !theme.trim()) {
    return res.status(400).json({
      success: false,
      message: '请输入卡片主题'
    });
  }
  
  const taskId = generateTaskId();
  const startTime = Date.now();
  
  // 构建用户输入
  const userInput = style 
    ? `${theme}，风格：${style}`
    : theme;
  
  addLog('info', `开始生成卡片: ${theme} (模型: ${model}, 任务: ${taskId})`);
  
  // 保存步骤日志
  const stepLogs = [];
  let previousOutput = userInput;  // 上一步输出，作为下一步输入
  
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
        
        // 保存上一步输出
        if (step.output) {
          previousOutput = step.output;
        }
        
        // 保存到数据库
        try {
          await StepLog.create(log);
        } catch (e) {
          console.error('保存步骤日志失败:', e);
        }
        
        addLog('info', `步骤${step.step} ${step.name} 完成 (${step.duration}ms)`);
      }
    });
    
    if (!result.success) {
      addLog('error', `生成失败: ${result.error}`);
      return res.json({
        success: false,
        taskId,
        error: result.error,
        steps: result.steps,
        totalDuration: Date.now() - startTime
      });
    }
    
    // 发布为草稿
    addLog('info', '正在发布卡片草稿...');
    
    const feedback = {
      feedbackType: 'SUGGESTION',
      content: theme,
      resourceId: null
    };
    
    const publishResult = await publishCardDraft(result.cardData, feedback);
    
    addLog('success', `卡片发布成功: ${publishResult.cardName}`);
    
    res.json({
      success: true,
      taskId,
      cardId: publishResult.cardId,
      cardName: publishResult.cardName,
      theme: result.theme,
      contentData: result.contentData,
      analysis: result.analysis,
      design: result.design,
      steps: result.steps,
      totalDuration: Date.now() - startTime
    });
    
  } catch (error) {
    addLog('error', `生成卡片失败: ${error.message}`);
    
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
