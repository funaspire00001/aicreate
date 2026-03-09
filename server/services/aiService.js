/**
 * AI 服务 - 调用豆包 API 或 Ollama 生成卡片
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载 server 目录下的 .env 文件
dotenv.config({ path: join(__dirname, '../.env') });

// 豆包 API 配置
const DOUBAO_API_URL = process.env.DOUBAO_API_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY;
const DOUBAO_MODEL = process.env.DOUBAO_MODEL || 'doubao-seed-1-8-251228';

// Ollama 配置
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api/chat';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:35b';

// 支持的模型列表
export const AVAILABLE_MODELS = [
  { id: 'ollama-qwen', name: 'Ollama Qwen3.5', model: OLLAMA_MODEL },
  { id: 'doubao', name: '豆包', model: DOUBAO_MODEL }
];

/**
 * 卡片生成系统提示词
 */
const CARD_SYSTEM_PROMPT = `【角色】你是一位富有创意的卡片设计师，请按照以下流程进行思考设计，最终输出卡片JSON。

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

### 输出示例（参考格式，根据你的设计生成实际内容）
{"cardData":{"faces":{"front":{"background":{"id":"background-front-1","type":"background","metadata":{"image":"","text":"背景"},"layout":{"width":"600px","height":"800px","left":"0px","top":"0px","zIndex":1,"position":"relative"},"style":{"background":"linear-gradient(135deg, #667eea, #764ba2)","borderRadius":"16px"}},"components":[{"id":"text-front-1","type":"text","metadata":{"text":"标题","textType":"title"},"layout":{"left":"50px","top":"300px","width":"500px","height":"100px","zIndex":10,"position":"absolute"},"style":{"fontSize":"48px","fontWeight":"bold","color":"#ffffff","textAlign":"center"}}]},"back":{"background":{"id":"background-back-1","type":"background","metadata":{"image":"","text":"背景"},"layout":{"width":"600px","height":"800px","left":"0px","top":"0px","zIndex":1,"position":"relative"},"style":{"background":"#ffffff","borderRadius":"16px"}},"components":[{"id":"text-back-1","type":"text","metadata":{"text":"正文内容","textType":"body"},"layout":{"left":"50px","top":"100px","width":"500px","height":"600px","zIndex":10,"position":"absolute"},"style":{"fontSize":"24px","color":"#333333","lineHeight":"1.8"}}]}}},"theme":"主题","contentData":[{"text-front-1":"标题","text-back-1":"正文内容"}]}

只输出一行合法JSON，无任何额外字符。`;

/**
 * 调用 AI 生成卡片
 * @param {string} requirement - 用户需求描述
 * @param {string} styleHint - 风格提示（可选）
 * @param {string} modelId - 模型 ID：doubao | ollama-qwen
 * @returns {Promise<Object>} 生成的卡片数据
 */
export async function generateCard(requirement, styleHint = '', modelId = 'doubao') {
  // 构建用户提示
  const userPrompt = styleHint 
    ? `用户输入："${requirement}"，风格要求：${styleHint}`
    : `用户输入："${requirement}"`;

  let content;

  if (modelId === 'ollama-qwen') {
    content = await callOllama(userPrompt);
  } else {
    content = await callDoubao(userPrompt);
  }

  // 解析 JSON
  const cardData = parseCardJSON(content);
  return cardData;
}

/**
 * 调用豆包 API
 */
async function callDoubao(userPrompt) {
  if (!DOUBAO_API_KEY) {
    throw new Error('DOUBAO_API_KEY 未配置');
  }

  try {
    const response = await fetch(DOUBAO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DOUBAO_API_KEY}`
      },
      body: JSON.stringify({
        model: DOUBAO_MODEL,
        messages: [
          { role: 'system', content: CARD_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`豆包 API 调用失败: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('豆包返回内容为空');
    }

    return content;
  } catch (error) {
    console.error('[aiService] 豆包调用失败:', error);
    throw error;
  }
}

/**
 * 调用 Ollama API
 */
async function callOllama(userPrompt) {
  try {
    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: CARD_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama 调用失败: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const content = result.message?.content;

    if (!content) {
      throw new Error('Ollama 返回内容为空');
    }

    return content;
  } catch (error) {
    console.error('[aiService] Ollama 调用失败:', error);
    throw error;
  }
}

/**
 * 解析 AI 返回的 JSON
 */
function parseCardJSON(content) {
  try {
    // 尝试直接解析
    return JSON.parse(content);
  } catch (e) {
    // 尝试提取 JSON 块
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        throw new Error('无法解析 AI 返回的 JSON');
      }
    }
    throw new Error('AI 返回的不是有效的 JSON 格式');
  }
}

/**
 * 根据反馈类型生成风格提示
 */
export function getStyleHintByFeedbackType(feedbackType, catalog) {
  const styleMap = {
    'CARD': {
      'contentError': '清晰明了、重点突出、易于理解',
      'hardToUnderstand': '简洁直观、图文并茂、层次分明',
      'other': '精致美观、协调统一'
    },
    'CARD_SET': {
      'contentError': '准确清晰、重点突出',
      'categoryUnreasonable': '逻辑清晰、分类明确',
      'needMoreCards': '系列化、统一风格',
      'other': '协调美观'
    },
    'SUGGESTION': '根据建议内容灵活设计'
  };

  if (feedbackType === 'SUGGESTION') {
    return styleMap['SUGGESTION'];
  }

  return styleMap[feedbackType]?.[catalog] || '简约美观';
}

export default {
  generateCard,
  getStyleHintByFeedbackType
};
