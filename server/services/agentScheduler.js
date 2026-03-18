/**
 * 智能体调度器 - 双表架构
 * 每个智能体独立运行，主动拉取数据
 * 使用 AgentInput 和 AgentOutput 管理数据流
 */

import Demand from '../models/Demand.js';
import KeyPoint from '../models/KeyPoint.js';
import KnowledgeTree from '../models/KnowledgeTree.js';
import CardPlan from '../models/CardPlan.js';
import LocalCard from '../models/LocalCard.js';
import StepLog from '../models/StepLog.js';
import Agent from '../models/Agent.js';
import AgentInput from '../models/AgentInput.js';
import AgentOutput from '../models/AgentOutput.js';
import { callModel, getModelConfig } from './ai/modelDispatcher.js';
import { v4 as uuidv4 } from 'uuid';

const POLL_INTERVAL = 5000; // 5秒轮询

// 智能体状态追踪
const agentStatus = {
  demand: { status: 'idle', currentTask: null, lastRun: null, stats: { total: 0, success: 0, failed: 0 } },
  organizer: { status: 'idle', currentTask: null, lastRun: null, stats: { total: 0, success: 0, failed: 0 } },
  architect: { status: 'idle', currentTask: null, lastRun: null, stats: { total: 0, success: 0, failed: 0 } },
  planner: { status: 'idle', currentTask: null, lastRun: null, stats: { total: 0, success: 0, failed: 0 } },
  generator: { status: 'idle', currentTask: null, lastRun: null, stats: { total: 0, success: 0, failed: 0 } },
  output: { status: 'idle', currentTask: null, lastRun: null, stats: { total: 0, success: 0, failed: 0 } }
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
// 核心函数: 认领输入数据
// 使用原子操作防止重复处理
// ============================================
async function claimInput(agentKey, sourceId, sourceType, sourceUpdatedAt, data) {
  try {
    const input = await AgentInput.create({
      agentKey,
      sourceId,
      sourceType,
      sourceUpdatedAt,
      data,
      status: 'pending',
      claimedAt: new Date()
    });
    return input;
  } catch (err) {
    // 唯一索引冲突，说明已被认领
    if (err.code === 11000) {
      return null;
    }
    throw err;
  }
}

// ============================================
// 核心函数: 获取可用数据
// 排除已成功处理或正在处理的
// ============================================
async function getAvailableSources(agentKey, sourceModel, sourceType) {
  // 获取已认领的记录（不管状态）
  const claimedInputs = await AgentInput.find({ agentKey, sourceType })
    .select('sourceId sourceUpdatedAt status')
    .lean();
  
  const claimedMap = new Map(
    claimedInputs.map(input => [
      input.sourceId.toString(),
      { updatedAt: input.sourceUpdatedAt, status: input.status }
    ])
  );
  
  // 查询所有完成的源数据
  const allSources = await sourceModel.find({ status: 'completed' }).lean();
  
  // 过滤出可处理的
  return allSources.filter(source => {
    const claimed = claimedMap.get(source._id.toString());
    if (!claimed) return true; // 未认领过
    
    // 已成功处理，检查是否有更新
    if (claimed.status === 'completed') {
      return new Date(source.updatedAt) > new Date(claimed.updatedAt);
    }
    
    // 正在处理或失败待重试
    return claimed.status === 'failed' || claimed.status === 'pending';
  });
}

// ============================================
// 核心函数: 完成处理，写入输出
// ============================================
async function completeProcessing(inputRecord, outputData, outputType, outputIds = [], duration = 0, metadata = {}) {
  // 创建输出记录
  await AgentOutput.create({
    agentKey: inputRecord.agentKey,
    inputId: inputRecord._id,
    sourceId: inputRecord.sourceId,
    sourceType: inputRecord.sourceType,
    data: outputData,
    outputType,
    outputIds,
    status: 'success',
    duration,
    metadata
  });
  
  // 更新输入记录状态
  inputRecord.status = 'completed';
  inputRecord.processedAt = new Date();
  inputRecord.duration = duration;
  await inputRecord.save();
}

// ============================================
// 核心函数: 处理失败
// ============================================
async function failProcessing(inputRecord, errorMsg, duration = 0) {
  inputRecord.status = 'failed';
  inputRecord.errorMsg = errorMsg;
  inputRecord.retryCount += 1;
  inputRecord.processedAt = new Date();
  inputRecord.duration = duration;
  await inputRecord.save();
}

// ============================================
// 智能体 0: 需求智能体
// 输入: 用户输入、反馈、外部数据源
// 输出: Demand 表
// ============================================
async function runDemandAgent() {
  const agentKey = 'demand';
  const agentName = '需求智能体';
  
  if (agentStatus.demand.status === 'running') return;
  
  try {
    // 获取智能体配置
    const agent = await Agent.findOne({ key: 'demand', enabled: true });
    if (!agent) return;
    
    // 查找新用户输入（status=new 的需求）
    const newDemand = await Demand.findOne({ 
      status: 'new',
      $or: [
        { consumedByDemandAgent: { $exists: false } },
        { consumedByDemandAgent: false }
      ]
    }).sort({ createdAt: 1 });
    
    if (!newDemand) return;
    
    agentStatus.demand.status = 'running';
    agentStatus.demand.currentTask = newDemand.theme;
    agentStatus.demand.stats.total++;
    
    await log(agentKey, agentName, 'info', `开始处理需求: ${newDemand.theme}`);
    
    const startTime = Date.now();
    
    // 尝试认领
    const input = await claimInput(
      agentKey,
      newDemand._id,
      'demand',
      newDemand.updatedAt || newDemand.createdAt,
      { theme: newDemand.theme, content: newDemand.content }
    );
    
    if (!input) {
      agentStatus.demand.status = 'idle';
      return; // 已被认领
    }
    
    // 更新输入状态为处理中
    input.status = 'processing';
    input.processingAt = new Date();
    await input.save();
    
    let processedDemand = { ...newDemand.toObject() };
    
    // AI 处理（如果启用）
    if (agent.ai?.enabled && agent.ai?.prompt) {
      try {
        const modelIdStr = String(agent.ai.modelId || 'ollama-qwen');
        const modelConfig = getModelConfig(modelIdStr);
        
        if (modelConfig) {
          const prompt = `${agent.ai.prompt}

需求信息：
主题：${newDemand.theme}
内容：${newDemand.content || '无详细内容'}

请分析这个需求，输出 JSON 格式：
{
  "priority": 1-5,
  "quality": 1-10,
  "category": "分类名称",
  "tags": ["标签1", "标签2"],
  "summary": "需求摘要",
  "suggestions": "改进建议"
}`;
          
          const response = await callModel(modelConfig.id, '', prompt);
          
          let aiResult;
          try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            aiResult = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
          } catch (e) {
            aiResult = {};
          }
          
          // 更新需求信息
          processedDemand.priority = aiResult.priority || 3;
          processedDemand.quality = aiResult.quality || 5;
          processedDemand.category = aiResult.category;
          processedDemand.tags = aiResult.tags || [];
          processedDemand.aiSummary = aiResult.summary;
          processedDemand.aiSuggestions = aiResult.suggestions;
          processedDemand.aiProcessed = true;
        }
      } catch (aiErr) {
        await log(agentKey, agentName, 'warn', `AI处理失败: ${aiErr.message}`);
      }
    }
    
    const duration = Date.now() - startTime;
    
    // 更新需求状态为 pending，供下游消费
    newDemand.status = 'pending';
    newDemand.consumedByDemandAgent = true;
    newDemand.consumedByDemandAgentAt = new Date();
    newDemand.priority = processedDemand.priority || 3;
    newDemand.quality = processedDemand.quality;
    newDemand.category = processedDemand.category;
    newDemand.tags = processedDemand.tags;
    newDemand.aiSummary = processedDemand.aiSummary;
    newDemand.aiSuggestions = processedDemand.aiSuggestions;
    newDemand.aiProcessed = processedDemand.aiProcessed || false;
    newDemand.processedAt = new Date();
    await newDemand.save();
    
    // 完成处理
    await completeProcessing(input, processedDemand, 'demand', [newDemand._id], duration);
    
    await log(agentKey, agentName, 'info', `需求处理完成: ${newDemand.theme}`, { duration });
    
    agentStatus.demand.status = 'idle';
    agentStatus.demand.currentTask = null;
    agentStatus.demand.lastRun = new Date();
    agentStatus.demand.stats.success++;
    
  } catch (err) {
    await log(agentKey, agentName, 'error', `执行失败: ${err.message}`);
    agentStatus.demand.status = 'failed';
    agentStatus.demand.currentTask = null;
    agentStatus.demand.stats.failed++;
  }
}

// ============================================
// 智能体 1: 信息整理智能体
// 监听: Demand 表中 processing 状态的记录
// 输出: KeyPoint 表
// ============================================
async function runOrganizerAgent() {
  const agentKey = 'organizer';
  const agentName = '信息整理智能体';
  
  if (agentStatus.organizer.status === 'running') return;
  
  try {
    // 查找处理中的需求
    const demand = await Demand.findOne({ status: 'processing' }).sort({ createdAt: 1 });
    if (!demand) return;
    
    // 尝试认领
    const input = await claimInput(
      agentKey,
      demand._id,
      'demand',
      demand.updatedAt || demand.createdAt,
      { theme: demand.theme, content: demand.content }
    );
    
    if (!input) return; // 已被其他实例认领
    
    agentStatus.organizer.status = 'running';
    agentStatus.organizer.currentTask = demand.theme;
    agentStatus.organizer.stats.total++;
    
    await log(agentKey, agentName, 'info', `开始处理需求: ${demand.theme}`);
    
    // 获取智能体配置
    const agent = await Agent.findOne({ role: 'organizer', enabled: true });
    if (!agent) {
      await log(agentKey, agentName, 'error', '未找到启用的信息整理智能体');
      await failProcessing(input, '未找到启用的智能体');
      agentStatus.organizer.status = 'idle';
      return;
    }
    
    const modelIdStr = String(agent.modelId || 'ollama-qwen');
    const modelConfig = getModelConfig(modelIdStr);
    if (!modelConfig) {
      await log(agentKey, agentName, 'error', `模型不存在: ${modelIdStr}`);
      await failProcessing(input, `模型不存在: ${modelIdStr}`);
      agentStatus.organizer.status = 'idle';
      return;
    }
    
    // 构建 prompt
    const prompt = `${agent.prompt}

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
    
    // 更新输入状态为处理中
    input.status = 'processing';
    input.processingAt = new Date();
    await input.save();
    
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
    
    // 更新需求状态
    demand.consumedByKeyPoint = true;
    demand.consumedByKeyPointAt = new Date();
    demand.keyPointId = keyPoint.id;
    demand.currentStep = 1;
    await demand.save();
    
    // 完成处理
    await completeProcessing(input, result, 'keypoint', [keyPoint._id], duration, { modelId: modelConfig.id });
    
    await log(agentKey, agentName, 'info', `完成需求处理，提取 ${result.points?.length || 0} 个关键点`, { duration });
    
    agentStatus.organizer.status = 'idle';
    agentStatus.organizer.currentTask = null;
    agentStatus.organizer.lastRun = new Date();
    agentStatus.organizer.stats.success++;
    
  } catch (err) {
    await log(agentKey, agentName, 'error', `执行失败: ${err.message}`);
    agentStatus.organizer.status = 'failed';
    agentStatus.organizer.currentTask = null;
    agentStatus.organizer.stats.failed++;
  }
}

// ============================================
// 智能体 2: 知识树构建智能体
// 监听: KeyPoint 表中已完成的记录
// 输出: KnowledgeTree 表
// ============================================
async function runArchitectAgent() {
  const agentKey = 'architect';
  const agentName = '知识树构建智能体';
  
  if (agentStatus.architect.status === 'running') return;
  
  try {
    // 获取可处理的 KeyPoint
    const availableKeyPoints = await getAvailableSources(agentKey, KeyPoint, 'keypoint');
    if (availableKeyPoints.length === 0) return;
    
    const keyPoint = availableKeyPoints[0];
    
    // 尝试认领
    const input = await claimInput(
      agentKey,
      keyPoint._id,
      'keypoint',
      keyPoint.updatedAt || keyPoint.createdAt,
      { summary: keyPoint.summary, points: keyPoint.points }
    );
    
    if (!input) return;
    
    agentStatus.architect.status = 'running';
    agentStatus.architect.currentTask = keyPoint.summary || keyPoint.id;
    agentStatus.architect.stats.total++;
    
    await log(agentKey, agentName, 'info', `开始构建知识树: ${keyPoint.summary || keyPoint.id}`);
    
    const agent = await Agent.findOne({ role: 'architect', enabled: true });
    if (!agent) {
      await log(agentKey, agentName, 'error', '未找到启用的知识树构建智能体');
      await failProcessing(input, '未找到启用的智能体');
      agentStatus.architect.status = 'idle';
      return;
    }
    
    const modelIdStr = String(agent.modelId || 'ollama-qwen');
    const modelConfig = getModelConfig(modelIdStr);
    if (!modelConfig) {
      await failProcessing(input, `模型不存在: ${modelIdStr}`);
      agentStatus.architect.status = 'idle';
      return;
    }
    
    const prompt = `${agent.prompt}

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
    
    input.status = 'processing';
    input.processingAt = new Date();
    await input.save();
    
    const response = await callModel(modelConfig.id, '', prompt);
    const duration = Date.now() - startTime;
    
    let result;
    try {
      const jsonMatch = response.match(/\{"[\s\S]*"\}|\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { root: keyPoint.summary, branches: [] };
    } catch (e) {
      result = { root: keyPoint.summary, branches: [] };
    }
    
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
    
    keyPoint.consumedByKnowledgeTree = true;
    keyPoint.consumedByKnowledgeTreeAt = new Date();
    await keyPoint.save();
    
    await Demand.updateOne(
      { id: keyPoint.demandId },
      { knowledgeTreeId: knowledgeTree.id, currentStep: 2 }
    );
    
    await completeProcessing(input, result, 'knowledgetree', [knowledgeTree._id], duration, { modelId: modelConfig.id });
    
    await log(agentKey, agentName, 'info', `知识树构建完成，共 ${result.branches?.length || 0} 个分支`, { duration });
    
    agentStatus.architect.status = 'idle';
    agentStatus.architect.currentTask = null;
    agentStatus.architect.lastRun = new Date();
    agentStatus.architect.stats.success++;
    
  } catch (err) {
    await log(agentKey, agentName, 'error', `执行失败: ${err.message}`);
    agentStatus.architect.status = 'failed';
    agentStatus.architect.currentTask = null;
    agentStatus.architect.stats.failed++;
  }
}

// ============================================
// 智能体 3: 卡片规划智能体
// 监听: KnowledgeTree 表中已完成的记录
// 输出: CardPlan 表
// ============================================
async function runPlannerAgent() {
  const agentKey = 'planner';
  const agentName = '卡片规划智能体';
  
  if (agentStatus.planner.status === 'running') return;
  
  try {
    const availableTrees = await getAvailableSources(agentKey, KnowledgeTree, 'knowledgetree');
    if (availableTrees.length === 0) return;
    
    const knowledgeTree = availableTrees[0];
    
    const input = await claimInput(
      agentKey,
      knowledgeTree._id,
      'knowledgetree',
      knowledgeTree.updatedAt || knowledgeTree.createdAt,
      { tree: knowledgeTree.tree }
    );
    
    if (!input) return;
    
    agentStatus.planner.status = 'running';
    agentStatus.planner.currentTask = knowledgeTree.tree?.root || knowledgeTree.id;
    agentStatus.planner.stats.total++;
    
    await log(agentKey, agentName, 'info', `开始规划卡片: ${knowledgeTree.tree?.root || knowledgeTree.id}`);
    
    const agent = await Agent.findOne({ role: 'planner', enabled: true });
    if (!agent) {
      await log(agentKey, agentName, 'error', '未找到启用的卡片规划智能体');
      await failProcessing(input, '未找到启用的智能体');
      agentStatus.planner.status = 'idle';
      return;
    }
    
    const modelIdStr = String(agent.modelId || 'ollama-qwen');
    const modelConfig = getModelConfig(modelIdStr);
    if (!modelConfig) {
      await failProcessing(input, `模型不存在: ${modelIdStr}`);
      agentStatus.planner.status = 'idle';
      return;
    }
    
    const prompt = `${agent.prompt}

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
    
    input.status = 'processing';
    input.processingAt = new Date();
    await input.save();
    
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
    
    await completeProcessing(input, result, 'cardplan', [cardPlan._id], duration, { modelId: modelConfig.id });
    
    await log(agentKey, agentName, 'info', `卡片规划完成，共 ${result.plans?.length || 0} 张卡片`, { duration });
    
    agentStatus.planner.status = 'idle';
    agentStatus.planner.currentTask = null;
    agentStatus.planner.lastRun = new Date();
    agentStatus.planner.stats.success++;
    
  } catch (err) {
    await log(agentKey, agentName, 'error', `执行失败: ${err.message}`);
    agentStatus.planner.status = 'failed';
    agentStatus.planner.currentTask = null;
    agentStatus.planner.stats.failed++;
  }
}

// ============================================
// 智能体 4: 卡片生成智能体
// 监听: CardPlan 表中已完成的记录
// 输出: LocalCard 表
// ============================================
async function runGeneratorAgent() {
  const agentKey = 'generator';
  const agentName = '卡片生成智能体';
  
  if (agentStatus.generator.status === 'running') return;
  
  try {
    const availablePlans = await getAvailableSources(agentKey, CardPlan, 'cardplan');
    if (availablePlans.length === 0) return;
    
    const cardPlan = availablePlans[0];
    
    const input = await claimInput(
      agentKey,
      cardPlan._id,
      'cardplan',
      cardPlan.updatedAt || cardPlan.createdAt,
      { plans: cardPlan.plans, totalCards: cardPlan.totalCards }
    );
    
    if (!input) return;
    
    agentStatus.generator.status = 'running';
    agentStatus.generator.currentTask = `共 ${cardPlan.totalCards} 张卡片`;
    agentStatus.generator.stats.total++;
    
    await log(agentKey, agentName, 'info', `开始生成卡片: 共 ${cardPlan.totalCards} 张`);
    
    const agent = await Agent.findOne({ role: 'generator', enabled: true });
    if (!agent) {
      await log(agentKey, agentName, 'error', '未找到启用的卡片生成智能体');
      await failProcessing(input, '未找到启用的智能体');
      agentStatus.generator.status = 'idle';
      return;
    }
    
    const modelIdStr = String(agent.modelId || 'ollama-qwen');
    const modelConfig = getModelConfig(modelIdStr);
    if (!modelConfig) {
      await failProcessing(input, `模型不存在: ${modelIdStr}`);
      agentStatus.generator.status = 'idle';
      return;
    }
    
    const startTime = Date.now();
    
    input.status = 'processing';
    input.processingAt = new Date();
    await input.save();
    
    // 生成卡片
    const generatedCards = [];
    const outputIds = [];
    
    for (const plan of (cardPlan.plans || [])) {
      try {
        const cardPrompt = `${agent.prompt}

卡片规划：
标题：${plan.title}
类型：${plan.type}
描述：${plan.description}
关键点：${plan.keyPoints?.join('、') || '无'}

请生成卡片内容，输出 JSON 格式：
{
  "title": "卡片标题",
  "content": "卡片正文内容",
  "style": "卡片风格描述",
  "tags": ["标签1", "标签2"]
}`;
        
        const response = await callModel(modelConfig.id, '', cardPrompt);
        
        let cardData;
        try {
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          cardData = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: plan.title, content: response };
        } catch (e) {
          cardData = { title: plan.title, content: response };
        }
        
        const localCard = await LocalCard.create({
          id: `LC_${Date.now()}_${uuidv4().slice(0, 8)}`,
          title: cardData.title || plan.title,
          content: cardData.content,
          type: plan.type || '知识卡片',
          style: cardData.style || '简约风格',
          tags: cardData.tags || [],
          metadata: {
            demandId: cardPlan.demandId,
            cardPlanId: cardPlan.id,
            planOrder: plan.order
          },
          status: 'completed',
          createdAt: new Date()
        });
        
        generatedCards.push(cardData);
        outputIds.push(localCard._id);
        
      } catch (err) {
        console.error(`生成卡片失败 [${plan.title}]:`, err.message);
      }
    }
    
    const duration = Date.now() - startTime;
    
    // 标记 CardPlan 已消费
    cardPlan.consumedByCardGenerator = true;
    cardPlan.consumedByCardGeneratorAt = new Date();
    await cardPlan.save();
    
    // 更新 Demand 状态为完成
    await Demand.updateOne(
      { id: cardPlan.demandId },
      { 
        status: 'completed', 
        currentStep: 5,
        cardCount: generatedCards.length,
        processedAt: new Date()
      }
    );
    
    await completeProcessing(input, { cards: generatedCards, total: generatedCards.length }, 'card', outputIds, duration, { modelId: modelConfig.id });
    
    await log(agentKey, agentName, 'info', `卡片生成完成，共 ${generatedCards.length} 张`, { duration });
    
    agentStatus.generator.status = 'idle';
    agentStatus.generator.currentTask = null;
    agentStatus.generator.lastRun = new Date();
    agentStatus.generator.stats.success++;
    
  } catch (err) {
    await log(agentKey, agentName, 'error', `执行失败: ${err.message}`);
    agentStatus.generator.status = 'failed';
    agentStatus.generator.currentTask = null;
    agentStatus.generator.stats.failed++;
  }
}

// ============================================
// 动态调度器 - 支持配置即时生效
// ============================================
let schedulerTimers = {
  demand: null,
  organizer: null,
  architect: null,
  planner: null,
  generator: null
};

// 每个智能体独立调度
async function scheduleAgent(agentKey, runFunc) {
  // 获取最新配置
  const agent = await Agent.findOne({ 
    $or: [{ key: agentKey }, { role: agentKey }] 
  });
  
  // 默认间隔5秒
  const interval = agent?.schedule?.interval || 5000;
  const enabled = agent?.enabled !== false && agent?.schedule?.enabled !== false;
  
  // 如果禁用，延迟后重新检查
  if (!enabled) {
    schedulerTimers[agentKey] = setTimeout(() => {
      scheduleAgent(agentKey, runFunc);
    }, interval);
    return;
  }
  
  // 执行智能体任务
  try {
    await runFunc();
  } catch (err) {
    console.error(`[${agentKey}] 执行错误:`, err);
  }
  
  // 执行完成后，重新调度（此时会读取最新配置）
  schedulerTimers[agentKey] = setTimeout(() => {
    scheduleAgent(agentKey, runFunc);
  }, interval);
}

// 启动所有智能体
export function startAgentScheduler() {
  console.log('智能体调度器启动（动态配置模式）');
  
  // 启动各智能体
  scheduleAgent('demand', runDemandAgent);
  scheduleAgent('organizer', runOrganizerAgent);
  scheduleAgent('architect', runArchitectAgent);
  scheduleAgent('planner', runPlannerAgent);
  scheduleAgent('generator', runGeneratorAgent);
}

// 停止所有智能体
export function stopAgentScheduler() {
  Object.keys(schedulerTimers).forEach(key => {
    if (schedulerTimers[key]) {
      clearTimeout(schedulerTimers[key]);
      schedulerTimers[key] = null;
    }
  });
}

// 重启单个智能体（配置变更时调用）
export function restartAgent(agentKey) {
  const runFuncMap = {
    demand: runDemandAgent,
    organizer: runOrganizerAgent,
    architect: runArchitectAgent,
    planner: runPlannerAgent,
    generator: runGeneratorAgent
  };
  
  // 清除当前定时器
  if (schedulerTimers[agentKey]) {
    clearTimeout(schedulerTimers[agentKey]);
    schedulerTimers[agentKey] = null;
  }
  
  // 立即重新调度
  const runFunc = runFuncMap[agentKey];
  if (runFunc) {
    scheduleAgent(agentKey, runFunc);
  }
}

// 兼容旧接口
function runAllAgents() {
  runDemandAgent().catch(console.error);
  runOrganizerAgent().catch(console.error);
  runArchitectAgent().catch(console.error);
  runPlannerAgent().catch(console.error);
  runGeneratorAgent().catch(console.error);
}

export { agentStatus };

// 获取智能体输入输出统计
export async function getAgentDataStats(agentKey) {
  const inputCount = await AgentInput.countDocuments({ agentKey });
  const outputCount = await AgentOutput.countDocuments({ agentKey });
  const pendingCount = await AgentInput.countDocuments({ agentKey, status: 'pending' });
  const processingCount = await AgentInput.countDocuments({ agentKey, status: 'processing' });
  const completedCount = await AgentInput.countDocuments({ agentKey, status: 'completed' });
  const failedCount = await AgentInput.countDocuments({ agentKey, status: 'failed' });
  
  return {
    input: { total: inputCount, pending: pendingCount, processing: processingCount, completed: completedCount, failed: failedCount },
    output: { total: outputCount }
  };
}
