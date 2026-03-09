/**
 * 步骤2：设计规划
 * 根据需求分析结果，决定卡片的设计风格
 */

// 系统提示词
const SYSTEM_PROMPT = `你是一位资深的卡片设计师。你的任务是根据需求分析结果，为卡片制定设计方案。

你需要从以下六个维度进行设计决策：

【维度一：整体风格】
根据主题的气质，决定整体设计走向：
- 这个主题适合严肃还是轻松？
- 应该现代还是复古？
- 需要精致复杂还是简约干净？

【维度二：配色方案】
根据主题的情感，选择合适的色彩：
- 这个主题传达什么情绪？
- 主色调应该是什么？
- 辅助色如何搭配？
- 需要高对比度还是柔和过渡？

【维度三：布局结构】
根据内容类型，规划空间分配：
- 正面如何吸引注意力？
- 背面如何有效展示内容？
- 元素之间如何平衡和呼应？

【维度四：文字处理】
根据阅读需求，决定文字呈现：
- 标题应该多大？用什么字重？
- 正文如何排版便于阅读？

【维度五：细节装饰】
根据整体风格，决定精致程度：
- 需要阴影吗？多大强度？
- 圆角大小如何？
- 是否需要装饰性几何图形？

【维度六：背景质感】
根据氛围需要，选择背景效果：
- 纯色、渐变还是其他效果？
- 如果是渐变，颜色如何过渡？

输出格式（仅输出JSON）：
{
  "overallStyle": "整体风格描述",
  "colorScheme": {
    "primary": "#主色",
    "secondary": "#辅助色",
    "accent": "#强调色",
    "background": "#背景色或渐变"
  },
  "frontLayout": {
    "type": "布局类型",
    "elements": ["元素1", "元素2"],
    "description": "布局说明"
  },
  "backLayout": {
    "type": "布局类型", 
    "elements": ["元素1", "元素2"],
    "description": "布局说明"
  },
  "fontStyle": {
    "titleSize": "标题字号",
    "bodySize": "正文字号",
    "fontWeight": "bold/normal",
    "style": "字体风格描述"
  },
  "decoration": {
    "borderRadius": "圆角大小",
    "shadow": "阴影效果",
    "geometry": ["装饰元素类型"]
  },
  "backgroundStyle": {
    "type": "纯色/渐变",
    "value": "具体值"
  }
}`;

/**
 * 执行设计规划
 * @param {object} analysis - 需求分析结果
 * @param {function} callModel - 调用模型的函数
 * @returns {Promise<object>} 设计方案
 */
export async function designPlan(analysis, callModel) {
  const userPrompt = `请根据以下需求分析结果，制定卡片设计方案：

主题：${analysis.theme}
数量：${analysis.count}
风格提示：${analysis.styleHint || '无特别要求'}
内容类型：${analysis.contentType}
情感基调：${analysis.emotion}
关键词：${analysis.keywords.join('、')}

请输出设计方案（仅输出JSON）。`;

  const startTime = Date.now();
  
  try {
    const response = await callModel(SYSTEM_PROMPT, userPrompt);
    
    // 解析 JSON
    const result = parseJSON(response);
    
    // 验证和修正
    const validated = validateDesign(result);
    
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
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('无法解析 JSON');
  }
}

/**
 * 验证和修正设计方案
 */
function validateDesign(result) {
  return {
    overallStyle: result.overallStyle || '简约现代',
    colorScheme: {
      primary: result.colorScheme?.primary || '#667eea',
      secondary: result.colorScheme?.secondary || '#764ba2',
      accent: result.colorScheme?.accent || '#f093fb',
      background: result.colorScheme?.background || '#ffffff'
    },
    frontLayout: {
      type: result.frontLayout?.type || '居中对称',
      elements: result.frontLayout?.elements || ['标题', '装饰图形'],
      description: result.frontLayout?.description || ''
    },
    backLayout: {
      type: result.backLayout?.type || '列表式',
      elements: result.backLayout?.elements || ['正文', '分隔线'],
      description: result.backLayout?.description || ''
    },
    fontStyle: {
      titleSize: result.fontStyle?.titleSize || '48px',
      bodySize: result.fontStyle?.bodySize || '24px',
      fontWeight: result.fontStyle?.fontWeight || 'bold',
      style: result.fontStyle?.style || '简洁清晰'
    },
    decoration: {
      borderRadius: result.decoration?.borderRadius || '16px',
      shadow: result.decoration?.shadow || '0 4px 12px rgba(0,0,0,0.1)',
      geometry: result.decoration?.geometry || []
    },
    backgroundStyle: {
      type: result.backgroundStyle?.type || '渐变',
      value: result.backgroundStyle?.value || 'linear-gradient(135deg, #667eea, #764ba2)'
    }
  };
}

export default {
  name: '设计规划',
  description: '根据需求分析结果，决定卡片的设计风格',
  execute: designPlan
};
