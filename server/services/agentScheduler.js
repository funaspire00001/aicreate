/**
 * 智能体调度器 - 自主智能体架构
 * 每个智能体独立运行，主动拉取数据
 */

import Demand from '../models/Demand.js';
import KeyPoint from '../models/KeyPoint.js';
import KnowledgeTree from '../models/KnowledgeTree.js';
import CardPlan from '../models/CardPlan.js';
import StepLog from '../models/StepLog.js';
import Agent from '../models/Agent.js';
import { callModel, getModelConfig } from './ai/modelDispatcher.js';
import { v4 as uuidv4 } from 'uuid';

const POLL_INTERVAL = 5000; // 5秒轮询

// 智能体状态追踪
const agentStatus = {
  organizer: { status: 'idle', currentTask: null, lastRun: null },
  architect: { status: 'idle', currentTask: null, lastRun: null },
  planner: { status: 'idle', currentTask: null, lastRun: null },
  generator: { status: 'idle', currentTask: null, lastRun: null }
};

// 获取智能体状态（供外部调用）
export function getAgentStatus() {
  return agentStatus;
}

// 记录日志
async function log(agentKey, agentName, level, message, data = {}) {
  console.log(`[调度器][${level}] ${agentName}: ${message}`);
  
  try {
    await StepLog.create({
      id: uuidv4(),
      agentKey,
      agentName,
      level,
      message,
      ...data,
      createdAt: new Date()
    });
  } catch (err) {
    console.error('日志保存失败:', err);
  }
}

// ============================================
// 智能体 1: 信息整理智能体
// 监听: Demand 表中未被消费的记录
// 输出: KeyPoint 表
// ============================================
async function runOrganizerAgent() {
  const agentKey = 'organizer';
  const agentName = '信息整理智能体';
  
  if (agentStatus.organizer.status === 'running') {
    return; // 正在执行，跳过
  }
  
  try {
    // 查找未被消费且状态为 processing 的需求
    const demand = await Demand.findOne({
      status: 'processing',
      consumedByKeyPoint: false
    }).sort({ createdAt: 1 });
    
    if (!demand) return;
    
    agentStatus.organizer.status = 'running';
    agentStatus.organizer.currentTask = demand.theme;
    
    await log(agentKey, agentName, 'info', `开始处理需求: ${demand.theme}`);
    
    // 获取智能体配置
    const agent = await Agent.findOne({ role: 'organizer', enabled: true });
    if (!agent) {
      await log(agentKey, agentName, 'error', '未找到启用的信息整理智能体');
      agentStatus.organizer.status = 'idle';
      return;
    }
    
    console.log('[DEBUG] agent.modelId:', agent.modelId, typeof agent.modelId);
    console.log('[DEBUG] agent.modelId value:', agent.modelId?.valueOf?.() ?? agent.modelId);
    
    // 获取模型配置
    let modelIdStr = 'ollama-qwen';
    if (agent.modelId) {
      modelIdStr = typeof agent.modelId === 'string' ? agent.modelId : 
                   agent.modelId.id || 
                   JSON.stringify(agent.modelId);
    }
    console.log('[DEBUG] modelIdStr:', modelIdStr);
    const modelConfig = getModelConfig(modelIdStr);
    console.log('[DEBUG] modelConfig:', modelConfig);
    if (!modelConfig) {
      await log(agentKey, agentName, 'error', `模型不存在: ${agent.modelId || 'ollama-qwen'}`);
      agentStatus.organizer.status = 'idle';
      return;
    }
    
    // 构建 prompt
    const prompt = `${agent.systemPrompt}

用户需求：
主题：${demand.theme}
内容：${demand.content || '无详细内容'}

请分析这个需求，提取关键点，输出 JSON 格式：
{
  "points": [
    {"title": "关键点标题", "description": "详细描述", "priority": 1}
  ],
  "summary": "需求总结"
}`;
    
    const startTime = Date.now();
    
    // 调用模型
    const response = await callModel(modelConfig.id, '', prompt);
    const duration = Date.now() - startTime;
    
    // 解析响应
    let result;
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { points: [], summary: response };
    } catch (e) {
      result = { points: [], summary: response };
    }
    
    // 保存 KeyPoint
    const keyPoint = await KeyPoint.create({
      id: `KP_${Date.now()}_${uuidv4().slice(0, 8)}`,
      demandId: demand.id,
      status: 'completed',
      input: demand.content || demand.theme,
      points: result.points,
      summary: result.summary,
      rawOutput: response,
      duration,
      processedAt: new Date()
    });
    
    // 标记需求已消费
    demand.consumedByKeyPoint = true;
    demand.consumedByKeyPointAt = new Date();
    demand.keyPointId = keyPoint.id;
    demand.currentStep = 1;
    await demand.save();
    
    await log(agentKey, agentName, 'info', `完成需求处理，提取 ${result.points?.length || 0} 个关键点`, { duration });
    
    agentStatus.organizer.status = 'idle';
    agentStatus.organizer.currentTask = null;
    agentStatus.organizer.lastRun = new Date();
    
  } catch (err) {
    await log(agentKey, agentName, 'error', `执行失败: ${err.message}`);
    agentStatus.organizer.status = 'failed';
    agentStatus.organizer.currentTask = null;
  }
}

// ============================================
// 智能体 2: 知识树构建智能体
// 监听: KeyPoint 表中未被消费的记录
// 输出: KnowledgeTree 表
// ============================================
async function runArchitectAgent() {
  const agentKey = 'architect';
  const agentName = '知识树构建智能体';
  
  if (agentStatus.architect.status === 'running') {
    return;
  }
  
  try {
    // 查找未被消费的 KeyPoint
    const keyPoint = await KeyPoint.findOne({
      status: 'completed',
      consumedByKnowledgeTree: false
    }).sort({ createdAt: 1 });
    
    if (!keyPoint) return;
    
    agentStatus.architect.status = 'running';
    agentStatus.architect.currentTask = keyPoint.summary || keyPoint.id;
    
    await log(agentKey, agentName, 'info', `开始构建知识树: ${keyPoint.summary || keyPoint.id}`);
    
    // 获取智能体配置
    const agent = await Agent.findOne({ role: 'architect', enabled: true });
    if (!agent) {
      await log(agentKey, agentName, 'error', '未找到启用的知识树构建智能体');
      agentStatus.architect.status = 'idle';
      return;
    }
    
    const modelIdStr = String(agent.modelId || 'ollama-qwen');
    const modelConfig = getModelConfig(modelIdStr);
    if (!modelConfig) {
      await log(agentKey, agentName, 'error', `模型不存在: ${agent.modelId || 'ollama-qwen'}`);
      agentStatus.architect.status = 'idle';
      return;
    }
    
    // 构建 prompt
    const prompt = `${agent.systemPrompt}

关键点信息：
${JSON.stringify(keyPoint.points, null, 2)}

总结：${keyPoint.summary}

请构建知识树结构，输出 JSON 格式：
{
  "root": "根节点主题",
  "branches": [
    {
      "name": "分支名称",
      "description": "分支描述",
      "children": [
        {"name": "子节点", "description": "描述"}
      ]
    }
  ]
}`;
    
    const startTime = Date.now();
    const response = await callModel(modelConfig.id, '', prompt);
    const duration = Date.now() - startTime;
    
    let result;
    try {
      const jsonMatch = response.match(/\{"[\s\S]*"\}|\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { root: keyPoint.summary, branches: [] };
    } catch (e) {
      result = { root: keyPoint.summary, branches: [] };
    }
    
    // 保存 KnowledgeTree
    const knowledgeTree = await KnowledgeTree.create({
      id: `KT_${Date.now()}_${uuidv4().slice(0, 8)}`,
      demandId: keyPoint.demandId,
      keyPointId: keyPoint.id,
      status: 'completed',
      input: keyPoint.points,
      tree: result,
      rawOutput: response,
      duration,
      processedAt: new Date()
    });
    
    // 标记 KeyPoint 已消费
    keyPoint.consumedByKnowledgeTree = true;
    keyPoint.consumedByKnowledgeTreeAt = new Date();
    await keyPoint.save();
    
    // 更新 Demand
    await Demand.updateOne(
      { id: keyPoint.demandId },
      { knowledgeTreeId: knowledgeTree.id, currentStep: 2 }
    );
    
    await log(agentKey, agentName, 'info', `知识树构建完成，共 ${result.branches?.length || 0} 个分支`, { duration });
    
    agentStatus.architect.status = 'idle';
    agentStatus.architect.currentTask = null;
    agentStatus.architect.lastRun = new Date();
    
  } catch (err) {
    await log(agentKey, agentName, 'error', `执行失败: ${err.message}`);
    agentStatus.architect.status = 'failed';
    agentStatus.architect.currentTask = null;
  }
}

// ============================================
// 智能体 3: 卡片规划智能体
// 监听: KnowledgeTree 表中未被消费的记录
// 输出: CardPlan 表
// ============================================
async function runPlannerAgent() {
  const agentKey = 'planner';
  const agentName = '卡片规划智能体';
  
  if (agentStatus.planner.status === 'running') {
    return;
  }
  
  try {
    const knowledgeTree = await KnowledgeTree.findOne({
      status: 'completed',
      consumedByCardPlan: false
    }).sort({ createdAt: 1 });
    
    if (!knowledgeTree) return;
    
    agentStatus.planner.status = 'running';
    agentStatus.planner.currentTask = knowledgeTree.tree?.root || knowledgeTree.id;
    
    await log(agentKey, agentName, 'info', `开始规划卡片: ${knowledgeTree.tree?.root || knowledgeTree.id}`);
    
    const agent = await Agent.findOne({ role: 'planner', enabled: true });
    if (!agent) {
      await log(agentKey, agentName, 'error', '未找到启用的卡片规划智能体');
      agentStatus.planner.status = 'idle';
      return;
    }
    
    const modelIdStr = String(agent.modelId || 'ollama-qwen');
    const modelConfig = getModelConfig(modelIdStr);
    if (!modelConfig) {
      await log(agentKey, agentName, 'error', `模型不存在: ${modelIdStr}`);
      agentStatus.planner.status = 'idle';
      return;
    }
    
    const prompt = `${agent.systemPrompt}

知识树结构：
${JSON.stringify(knowledgeTree.tree, null, 2)}

请规划卡片，输出 JSON 格式：
{
  "plans": [
    {
      "order": 1,
      "title": "卡片标题",
      "type": "概念/方法/案例/练习",
      "description": "卡片内容描述",
      "keyPoints": ["要点1", "要点2"]
    }
  ],
  "totalCards": 5
}`;
    
    const startTime = Date.now();
    const response = await callModel(modelConfig.id, '', prompt);
    const duration = Date.now() - startTime;
    
    let result;
    try {
      const jsonMatch = response.match(/\{"[\s\S]*"\}|\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { plans: [], totalCards: 0 };
    } catch (e) {
      result = { plans: [], totalCards: 0 };
    }
    
    const cardPlan = await CardPlan.create({
      id: `CP_${Date.now()}_${uuidv4().slice(0, 8)}`,
      demandId: knowledgeTree.demandId,
      knowledgeTreeId: knowledgeTree.id,
      status: 'completed',
      input: knowledgeTree.tree,
      plans: result.plans,
      totalCards: result.totalCards || result.plans?.length || 0,
      rawOutput: response,
      duration,
      processedAt: new Date()
    });
    
    knowledgeTree.consumedByCardPlan = true;
    knowledgeTree.consumedByCardPlanAt = new Date();
    await knowledgeTree.save();
    
    await Demand.updateOne(
      { id: knowledgeTree.demandId },
      { cardPlanId: cardPlan.id, currentStep: 3 }
    );
    
    await log(agentKey, agentName, 'info', `卡片规划完成，共 ${result.plans?.length || 0} 张卡片`, { duration });
    
    agentStatus.planner.status = 'idle';
    agentStatus.planner.currentTask = null;
    agentStatus.planner.lastRun = new Date();
    
  } catch (err) {
    await log(agentKey, agentName, 'error', `执行失败: ${err.message}`);
    agentStatus.planner.status = 'failed';
    agentStatus.planner.currentTask = null;
  }
}

// ============================================
// 智能体 4: 卡片生成智能体
// 监听: CardPlan 表中未被消费的记录
// 输出: 更新 Demand 状态为完成
// ============================================
async function runGeneratorAgent() {
  const agentKey = 'generator';
  const agentName = '卡片生成智能体';
  
  if (agentStatus.generator.status === 'running') {
    return;
  }
  
  try {
    const cardPlan = await CardPlan.findOne({
      status: 'completed',
      consumedByCardGenerator: false
    }).sort({ createdAt: 1 });
    
    if (!cardPlan) return;
    
    agentStatus.generator.status = 'running';
    agentStatus.generator.currentTask = `共 ${cardPlan.totalCards} 张卡片`;
    
    await log(agentKey, agentName, 'info', `开始生成卡片: 共 ${cardPlan.totalCards} 张`);
    
    const agent = await Agent.findOne({ role: 'generator', enabled: true });
    if (!agent) {
      await log(agentKey, agentName, 'error', '未找到启用的卡片生成智能体');
      agentStatus.generator.status = 'idle';
      return;
    }
    
    const modelIdStr = String(agent.modelId || 'ollama-qwen');
    const modelConfig = getModelConfig(modelIdStr);
    if (!modelConfig) {
      await log(agentKey, agentName, 'error', `模型不存在: ${modelIdStr}`);
      agentStatus.generator.status = 'idle';
      return;
    }
    
    // 这里简化处理，实际应该逐张生成卡片
    // TODO: 对接 LocalCard 模型
    
    // 标记完成
    cardPlan.consumedByCardGenerator = true;
    cardPlan.consumedByCardGeneratorAt = new Date();
    await cardPlan.save();
    
    // 更新 Demand 状态为完成
    await Demand.updateOne(
      { id: cardPlan.demandId },
      { 
        status: 'completed', 
        currentStep: 5,
        cardCount: cardPlan.totalCards,
        processedAt: new Date()
      }
    );
    
    await log(agentKey, agentName, 'info', `卡片生成完成，共 ${cardPlan.totalCards} 张`);
    
    agentStatus.generator.status = 'idle';
    agentStatus.generator.currentTask = null;
    agentStatus.generator.lastRun = new Date();
    
  } catch (err) {
    await log(agentKey, agentName, 'error', `执行失败: ${err.message}`);
    agentStatus.generator.status = 'failed';
    agentStatus.generator.currentTask = null;
  }
}

// ============================================
// 启动调度器
// ============================================
let schedulerInterval = null;

export function startAgentScheduler() {
  console.log(`智能体调度器启动，轮询间隔: ${POLL_INTERVAL}ms`);
  
  // 立即执行一次
  runAllAgents();
  
  // 定时轮询
  schedulerInterval = setInterval(() => {
    runAllAgents();
  }, POLL_INTERVAL);
}

export function stopAgentScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

function runAllAgents() {
  // 并行运行所有智能体
  runOrganizerAgent().catch(console.error);
  runArchitectAgent().catch(console.error);
  runPlannerAgent().catch(console.error);
  runGeneratorAgent().catch(console.error);
}

// 导出状态获取接口
export { agentStatus };