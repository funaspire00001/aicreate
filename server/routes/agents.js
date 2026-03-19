import express from 'express';
import Agent from '../models/Agent.js';
import { createAgentDataTable, dropAgentDataTable, getAgentDataStats } from '../services/agentDataService.js';

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
 * 获取可用模型列表
 */
router.get('/models', async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    const configPath = path.join(__dirname, '../../config/models.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    const models = [...(config.models || []), ...(config.localModels || [])]
      .filter(m => m.enabled)
      .map(m => ({ id: m.id, name: m.name, provider: m.provider, model: m.model }));
    
    res.json({ success: true, models });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
    const { name, description, type, modelId, prompt, temperature, maxTokens, enabled, capabilities } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：name'
      });
    }
    
    // 生成带前缀的唯一ID
    const agentId = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newAgent = new Agent({
      id: agentId,
      name,
      type: type || 'processor',
      description: description || '',
      modelId: modelId || 'ollama-qwen',
      prompt: prompt || '请配置智能体的提示词...',
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 4096,
      enabled: enabled !== false,
      capabilities: capabilities || [],
      ai: {
        enabled: true,
        modelId: modelId || 'ollama-qwen',
        prompt: prompt || '',
        temperature: temperature ?? 0.7,
        maxTokens: maxTokens ?? 4096
      },
      schedule: {
        interval: 5000,
        batchSize: 1,
        maxRetries: 3
      }
    });
    
    await newAgent.save();
    
    // 自动创建智能体数据表
    const tableResult = await createAgentDataTable(agentId, name);
    
    res.json({
      success: true,
      agent: newAgent,
      dataTable: tableResult
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
    const { name, description, modelId, prompt, temperature, maxTokens, enabled, capabilities, ai, schedule, data } = req.body;
    
    const agent = await Agent.findOne({ id: req.params.id });
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: '智能体不存在'
      });
    }
    
    // 更新基础字段
    if (name !== undefined) agent.name = name;
    if (description !== undefined) agent.description = description;
    if (enabled !== undefined) agent.enabled = enabled;
    
    // 更新 AI 配置
    if (ai !== undefined) {
      agent.ai = {
        ...agent.ai,
        ...ai
      };
    }
    
    // 兼容旧字段
    if (modelId !== undefined) {
      agent.ai = agent.ai || {};
      agent.ai.modelId = modelId;
    }
    if (prompt !== undefined) {
      agent.ai = agent.ai || {};
      agent.ai.prompt = prompt;
    }
    if (temperature !== undefined) {
      agent.ai = agent.ai || {};
      agent.ai.temperature = temperature;
    }
    if (maxTokens !== undefined) {
      agent.ai = agent.ai || {};
      agent.ai.maxTokens = maxTokens;
    }
    
    // 更新调度配置
    if (schedule !== undefined) {
      agent.schedule = {
        ...agent.schedule,
        ...schedule
      };
    }
    
    // 更新数据配置
    if (data !== undefined) {
      agent.data = {
        ...agent.data,
        ...data
      };
    }
    
    // 更新能力标签
    if (capabilities !== undefined) {
      agent.skills = capabilities;
    }
    
    await agent.save();
    
    res.json({
      success: true,
      agent,
      message: '配置已保存并立即生效'
    });
  } catch (error) {
    console.error('更新智能体失败:', error);
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
    const agent = await Agent.findOne({ id: req.params.id });
    
    if (!agent) {
      return res.status(404).json({
        success: false,
        error: '智能体不存在'
      });
    }
    
    // 删除智能体数据表
    const tableResult = await dropAgentDataTable(req.params.id);
    
    // 删除智能体记录
    await Agent.deleteOne({ id: req.params.id });
    
    res.json({
      success: true,
      message: '智能体删除成功',
      dataTable: tableResult
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
        name: '信息整理智能体',
        role: 'organizer',
        description: '从用户输入中提取关键信息点',
        modelId: 'ollama-qwen',
        prompt: `你是一个信息整理智能体，负责从用户输入的原始需求中提取关键信息点。

## 你的任务
1. 仔细阅读用户输入的原始文本
2. 提取其中的核心主题、关键概念、重要事实
3. 用结构化的方式输出信息点列表

## 输出格式
请用 JSON 格式输出，结构如下：
{
  "keyPoints": ["关键点1", "关键点2", ...],
  "summary": "一句话总结",
  "topics": ["主题1", "主题2", ...]
}

只输出 JSON，不要有其他内容。`,
        temperature: 0.3,
        maxTokens: 2048,
        enabled: true,
        capabilities: ['信息提取', '文本分析', '关键点识别']
      },
      {
        id: uuidv4(),
        name: '知识树构建智能体',
        role: 'architect',
        description: '根据信息点构建知识体系架构',
        modelId: 'ollama-qwen',
        prompt: `你是一个知识树构建智能体，负责根据关键信息构建完整的知识体系架构。

## 你的任务
1. 分析输入的关键信息点
2. 构建树形知识结构，包含根主题和分支
3. 确保知识架构逻辑清晰、层次分明

## 输入格式
{
  "keyPoints": ["关键点1", "关键点2", ...],
  "theme": "主题名称"
}

## 输出格式
请用 JSON 格式输出，结构如下：
{
  "root": "根主题名称",
  "branches": [
    {
      "name": "分支名称",
      "children": ["子主题1", "子主题2", ...]
    },
    ...
  ],
  "description": "知识体系描述"
}

只输出 JSON，不要有其他内容。`,
        temperature: 0.5,
        maxTokens: 4096,
        enabled: true,
        capabilities: ['知识建模', '结构设计', '逻辑分析']
      },
      {
        id: uuidv4(),
        name: '卡片规划智能体',
        role: 'planner',
        description: '根据知识树制定具体卡片生成计划',
        modelId: 'ollama-qwen',
        prompt: `你是一个卡片规划智能体，负责根据知识树制定具体的卡片生成计划。

## 你的任务
1. 分析输入的知识树结构
2. 为每个知识节点规划对应的卡片
3. 确定每张卡片的标题、内容要点和风格

## 输入格式
{
  "root": "根主题",
  "branches": [
    {
      "name": "分支名称",
      "children": ["子主题1", "子主题2", ...]
    }
  ]
}

## 输出格式
请用 JSON 格式输出，结构如下：
{
  "cards": [
    {
      "title": "卡片标题",
      "targetBranch": "所属分支",
      "keyPoints": ["要点1", "要点2"],
      "style": "推荐风格"
    },
    ...
  ],
  "totalCards": 卡片总数,
  "styles": ["风格1", "风格2"]
}

只输出 JSON，不要有其他内容。`,
        temperature: 0.6,
        maxTokens: 4096,
        enabled: true,
        capabilities: ['卡片规划', '内容策划', '风格设计']
      },
      {
        id: uuidv4(),
        name: '卡片生成智能体',
        role: 'generator',
        description: '根据卡片规划生成完整的知识卡片JSON',
        modelId: 'ollama-qwen',
        prompt: `【角色】你是一位富有创意的卡片设计师，请按照以下流程进行思考设计，最终输出卡片JSON。

═══════════════════════════════════════════════════════════════
第一步：分析用户输入（内部思考，不输出）
═══════════════════════════════════════════════════════════════

请仔细分析用户输入，理解：
- 主题内容是什么？
- 需要多少条内容？（从输入中提取数字，无则默认1，最大12）
- 用户是否指定了风格偏好？
- 主题本身传达什么样的情感和氛围？

═══════════════════════════════════════════════════════════════
第二步：设计规划（内部思考，不输出）
═══════════════════════════════════════════════════════════════

基于对主题的理解，从以下六个设计维度进行自主推理和决策：

【维度一：整体风格】根据主题气质决定：严肃/轻松、现代/复古、精致/简约
【维度二：配色方案】根据主题情感选择色彩，确保视觉和谐
【维度三：布局结构】规划正反面空间分配，确保视觉平衡
【维度四：文字处理】决定字号、字重、行高，确保清晰易读
【维度五：细节装饰】决定阴影、圆角、装饰元素
【维度六：背景质感】选择纯色或渐变效果

═══════════════════════════════════════════════════════════════
第三步：生成 JSON（仅输出此步骤结果）
═══════════════════════════════════════════════════════════════

### 核心约束（必须严格遵守）

1. **JSON格式**：仅输出一行纯JSON，无注释/空格/尾逗号，双引号，括号配对。输出前自行检查。

2. **结构**：
{ "cardData": { "faces": { "front": { "background":{}, "components":[] }, "back":{...} } }, "theme":"", "contentData":[] }

3. **背景规范**：
   - id="background-面-1"，type="background"，metadata: { "image":"", "text":"背景" }
   - layout: width="600px", height="800px", left="0px", top="0px", zIndex=1, position="relative"
   - style: 必须包含 **background** 字段，值可以是纯色值（如 "#F9F9F9"）或渐变字符串（如 "linear-gradient(135deg, #fad0c4, #ffd1b3)"）
   - borderRadius、boxShadow 可选

4. **组件通用**：
   - position="absolute"，zIndex: text≥3，其他1-2
   - width/height≥20px，left≤580，top≤780，带px单位
   - opacity≥0.3

5. **各类型组件**（类型名称必须使用全称）：
   - **text**：fontSize标题≥40px，正文≥32px；fontWeight=bold/normal；textType=title/body；文字内容完全适配组件尺寸
   - **divider**：height=3/6/8px；style必须包含 borderTopWidth, borderTopStyle, borderTopColor, borderBottomWidth, borderBottomStyle, borderBottomColor, borderLeftWidth="0px", borderRightWidth="0px", background="none"
   - **geometry**：metadata shapeType=circle/square/rectangle；style background="transparent", borderWidth="1px", borderStyle="solid", borderRadius/borderColor必填
   - **image**：metadata含src,alt,mode；style含borderRadius,boxShadow；禁止object-fit

6. **theme**：≤12字，提炼主题

7. **contentData**：
   - 数组长度 = 解析出的数量（若>12则取12）
   - 每个元素对象，键必须包含所有组件ID，值：text组件非空字符串，其他组件可空
   - 数量>1时，固定内容的组件在各条目中重复赋值

8. **正反面设计**：
   - 正面：大标题(title)+几何装饰，吸引眼球
   - 背面：正文(body)+分隔线，展示内容
   - 组件总数≤15，背面至少有一个组件

### 输入示例
{"title":"大模型发展","keyPoints":["GPT-5发布","多模态能力","长上下文"],"style":"科技风"}

只输出一行合法JSON，无任何额外字符。`,
        temperature: 0.7,
        maxTokens: 8192,
        enabled: true,
        capabilities: ['卡片生成', 'JSON生成', '视觉设计']
      }
    ];
    
    await Agent.insertMany(defaultAgents);
    
    // 为每个默认智能体创建数据表
    const tableResults = [];
    for (const agent of defaultAgents) {
      const tableResult = await createAgentDataTable(agent.id, agent.name);
      tableResults.push({ agentId: agent.id, agentName: agent.name, ...tableResult });
    }
    
    res.json({
      success: true,
      message: '默认智能体创建成功',
      count: defaultAgents.length,
      agents: defaultAgents,
      dataTables: tableResults
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取智能体数据表统计
 */
router.get('/:id/data-stats', async (req, res) => {
  try {
    const stats = await getAgentDataStats(req.params.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
