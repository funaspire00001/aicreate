/**
 * 步骤3：卡片生成
 * 根据设计方案，生成完整的卡片 JSON
 */

// 系统提示词
const SYSTEM_PROMPT = `你是一位卡片生成专家。你的任务是根据需求分析和设计方案，生成完整的卡片 JSON。

请严格按照以下技术规范生成：

═══════════════════════════════════════════════════════════════
JSON 结构
═══════════════════════════════════════════════════════════════

{
  "cardData": {
    "faces": {
      "front": { "background": {...}, "components": [...] },
      "back": { "background": {...}, "components": [...] }
    }
  },
  "theme": "主题（≤12字）",
  "contentData": [{ "组件ID": "内容", ... }, ...]
}

═══════════════════════════════════════════════════════════════
背景 (background)
═══════════════════════════════════════════════════════════════

- id: "background-front-1" 或 "background-back-1"
- type: "background"
- metadata: { "image": "", "text": "背景" }
- layout: { width: "600px", height: "800px", left: "0px", top: "0px", zIndex: 1, position: "relative" }
- style: 必须包含 background 字段（纯色如 "#FFFFFF" 或渐变如 "linear-gradient(135deg, #A, #B)"）

═══════════════════════════════════════════════════════════════
组件类型
═══════════════════════════════════════════════════════════════

1. **text 文本组件**：
   - id: "text-front-1", "text-back-1" 等
   - type: "text"
   - metadata: { text: "内容", textType: "title" 或 "body" }
   - layout: { left, top, width, height, zIndex, position: "absolute" }
   - style: { fontSize, fontWeight, color, textAlign, ... }
   - 规则：标题 fontSize ≥ 40px，正文 fontSize ≥ 32px

2. **divider 分隔线**：
   - id: "divider-back-1" 等
   - type: "divider"
   - metadata: { name: "分隔线", lineType: "solid/dashed/dotted" }
   - layout: { left, top, width, height (3/6/8px), zIndex, position: "absolute" }
   - style: { borderTopWidth, borderTopStyle, borderTopColor, borderBottomWidth, borderBottomStyle, borderBottomColor, borderLeftWidth: "0px", borderRightWidth: "0px", background: "none" }

3. **geometry 几何装饰**：
   - id: "geometry-front-1" 等
   - type: "geometry"
   - metadata: { shapeType: "circle/square/rectangle" }
   - layout: { left, top, width, height, zIndex, position: "absolute" }
   - style: { background: "transparent", borderWidth: "1px", borderStyle: "solid", borderRadius, borderColor }

═══════════════════════════════════════════════════════════════
设计原则
═══════════════════════════════════════════════════════════════

- **正面**：吸引眼球，大标题 + 装饰元素
- **背面**：展示内容，正文 + 分隔线
- **组件总数** ≤ 15
- **contentData 数组长度** = 内容条数（最大12）
- 所有组件 position: "absolute"（背景除外）
- zIndex: text ≥ 3，其他 1-2

═══════════════════════════════════════════════════════════════
输出要求
═══════════════════════════════════════════════════════════════

仅输出一行合法 JSON，无注释、无多余空格、无尾逗号。`;

/**
 * 执行卡片生成
 * @param {object} analysis - 需求分析结果
 * @param {object} design - 设计方案
 * @param {function} callModel - 调用模型的函数
 * @returns {Promise<object>} 生成的卡片数据
 */
export async function generateCard(analysis, design, callModel) {
  const userPrompt = `请根据以下信息生成卡片 JSON：

【需求分析】
- 主题：${analysis.theme}
- 数量：${analysis.count}
- 内容类型：${analysis.contentType}
- 情感基调：${analysis.emotion}

【设计方案】
- 整体风格：${design.overallStyle}
- 配色方案：主色 ${design.colorScheme.primary}，辅助色 ${design.colorScheme.secondary}
- 正面布局：${design.frontLayout.type}，包含 ${design.frontLayout.elements.join('、')}
- 背面布局：${design.backLayout.type}，包含 ${design.backLayout.elements.join('、')}
- 字体风格：标题 ${design.fontStyle.titleSize}，正文 ${design.fontStyle.bodySize}
- 背景效果：${design.backgroundStyle.type} - ${design.backgroundStyle.value}

请生成卡片 JSON（仅输出JSON，无其他内容）。`;

  const startTime = Date.now();
  
  try {
    const response = await callModel(SYSTEM_PROMPT, userPrompt);
    
    // 解析 JSON
    const result = parseJSON(response);
    
    return {
      success: true,
      output: result,
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
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        throw new Error('JSON 解析失败');
      }
    }
    throw new Error('无法解析 JSON');
  }
}

export default {
  name: '卡片生成',
  description: '根据设计方案，生成完整的卡片 JSON',
  execute: generateCard
};
