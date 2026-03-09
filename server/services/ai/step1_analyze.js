/**
 * 步骤1：需求分析
 * 理解用户输入，提取结构化信息
 */

// 系统提示词
const SYSTEM_PROMPT = `你是一个需求分析专家。你的任务是理解用户的卡片需求，并提取结构化信息。

请分析用户输入，提取以下信息：
1. **主题**：卡片的核心内容是什么
2. **数量**：需要多少条内容（从输入中提取数字，无则默认1，最大12）
3. **风格提示**：用户是否有风格偏好（如"可爱""商务""简约"等）
4. **内容类型**：属于哪种类型
   - 问答类：提问+答案的形式
   - 列表类：多个条目的列表
   - 祝福类：祝福语、问候
   - 知识类：知识科普、信息展示
   - 故事类：有情节的内容
   - 其他：无法归类的
5. **情感基调**：内容传达的情感（如幽默、温馨、严肃、活泼等）

输出格式（仅输出JSON，无其他内容）：
{
  "theme": "主题内容",
  "count": 数量,
  "styleHint": "风格提示或空字符串",
  "contentType": "问答类/列表类/祝福类/知识类/故事类/其他",
  "emotion": "情感基调",
  "keywords": ["关键词1", "关键词2"]
}`;

/**
 * 执行需求分析
 * @param {string} userInput - 用户输入
 * @param {function} callModel - 调用模型的函数
 * @returns {Promise<object>} 分析结果
 */
export async function analyzeRequirement(userInput, callModel) {
  const userPrompt = `请分析以下用户需求：

"${userInput}"

请输出结构化的分析结果（仅输出JSON）。`;

  const startTime = Date.now();
  
  try {
    const response = await callModel(SYSTEM_PROMPT, userPrompt);
    
    // 解析 JSON
    const result = parseJSON(response);
    
    // 验证和修正
    const validated = validateAnalysis(result);
    
    return {
      success: true,
      output: validated,
      rawResponse: response,
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * 解析 JSON 响应
 */
function parseJSON(content) {
  try {
    return JSON.parse(content);
  } catch (e) {
    // 尝试提取 JSON 块
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析 JSON');
  }
}

/**
 * 验证和修正分析结果
 */
function validateAnalysis(result) {
  return {
    theme: result.theme || '未知主题',
    count: Math.min(Math.max(result.count || 1, 1), 12),
    styleHint: result.styleHint || '',
    contentType: result.contentType || '其他',
    emotion: result.emotion || '中性',
    keywords: Array.isArray(result.keywords) ? result.keywords : []
  };
}

export default {
  name: '需求分析',
  description: '理解用户输入，提取结构化信息',
  execute: analyzeRequirement
};
