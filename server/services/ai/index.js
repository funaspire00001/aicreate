/**
 * AI 服务统一入口
 * 多步骤卡片生成
 */

import { callDoubao } from './providers/doubao.js';
import { callOllama } from './providers/ollama.js';
import { analyzeRequirement } from './step1_analyze.js';
import { designPlan } from './step2_design.js';
import { generateCard } from './step3_generate.js';
import { validateCard } from './step4_validate.js';

// 支持的模型
export const AVAILABLE_MODELS = [
  { id: 'ollama-qwen', name: 'Ollama Qwen3.5', call: callOllama },
  { id: 'doubao', name: '豆包', call: callDoubao }
];

/**
 * 获取模型调用函数
 */
function getModelCallFunction(modelId) {
  const model = AVAILABLE_MODELS.find(m => m.id === modelId);
  if (!model) {
    throw new Error(`不支持的模型: ${modelId}`);
  }
  return model.call;
}

/**
 * 多步骤生成卡片
 * @param {string} userInput - 用户输入
 * @param {object} options - 选项
 * @param {string} options.model - 模型 ID
 * @param {function} options.onStepComplete - 步骤完成回调
 * @returns {Promise<object>} 生成结果
 */
export async function generateCardWithSteps(userInput, options = {}) {
  const { model = 'ollama-qwen', onStepComplete } = options;
  
  const callModel = getModelCallFunction(model);
  const steps = [];
  const startTime = Date.now();
  
  try {
    // ========== 步骤1：需求分析 ==========
    const step1 = await analyzeRequirement(userInput, callModel);
    steps.push({
      step: 1,
      name: '需求分析',
      input: userInput,
      ...step1
    });
    onStepComplete?.(steps[0]);
    
    if (!step1.success) {
      throw new Error(`步骤1失败: ${step1.error}`);
    }
    
    // ========== 步骤2：设计规划 ==========
    const step2 = await designPlan(step1.output, callModel);
    steps.push({
      step: 2,
      name: '设计规划',
      input: step1.output,
      ...step2
    });
    onStepComplete?.(steps[1]);
    
    if (!step2.success) {
      throw new Error(`步骤2失败: ${step2.error}`);
    }
    
    // ========== 步骤3：卡片生成 ==========
    const step3 = await generateCard(step1.output, step2.output, callModel);
    steps.push({
      step: 3,
      name: '卡片生成',
      input: { analysis: step1.output, design: step2.output },
      ...step3
    });
    onStepComplete?.(steps[2]);
    
    if (!step3.success) {
      throw new Error(`步骤3失败: ${step3.error}`);
    }
    
    // ========== 步骤4：校验修正 ==========
    const step4 = await validateCard(step3.output, callModel);
    steps.push({
      step: 4,
      name: '校验修正',
      input: step3.output,
      ...step4
    });
    onStepComplete?.(steps[3]);
    
    if (!step4.success) {
      throw new Error(`步骤4失败: ${step4.error}`);
    }
    
    // 返回最终结果
    return {
      success: true,
      cardData: step4.output.cardData,
      theme: step4.output.cardData.theme || step1.output.theme,
      contentData: step4.output.cardData.contentData || [],
      analysis: step1.output,
      design: step2.output,
      steps,
      totalDuration: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      steps,
      totalDuration: Date.now() - startTime
    };
  }
}

/**
 * 单步执行（用于调试）
 */
export async function executeStep(stepNum, userInput, model = 'ollama-qwen') {
  const callModel = getModelCallFunction(model);
  
  switch (stepNum) {
    case 1:
      return analyzeRequirement(userInput, callModel);
    case 2:
      // 需要先执行步骤1
      const step1 = await analyzeRequirement(userInput, callModel);
      if (!step1.success) return step1;
      return designPlan(step1.output, callModel);
    case 3:
      // 需要先执行步骤1和2
      const s1 = await analyzeRequirement(userInput, callModel);
      if (!s1.success) return s1;
      const s2 = await designPlan(s1.output, callModel);
      if (!s2.success) return s2;
      return generateCard(s1.output, s2.output, callModel);
    case 4:
      // 需要先执行步骤1-3
      const r1 = await analyzeRequirement(userInput, callModel);
      if (!r1.success) return r1;
      const r2 = await designPlan(r1.output, callModel);
      if (!r2.success) return r2;
      const r3 = await generateCard(r1.output, r2.output, callModel);
      if (!r3.success) return r3;
      return validateCard(r3.output, callModel);
    default:
      throw new Error(`无效的步骤号: ${stepNum}`);
  }
}

// 导出各步骤
export { analyzeRequirement, designPlan, generateCard, validateCard };

export default {
  generateCardWithSteps,
  executeStep,
  AVAILABLE_MODELS
};
