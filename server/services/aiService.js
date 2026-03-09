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
const CARD_SYSTEM_PROMPT = `【角色】你是一位富有创意的卡片设计师，需根据以下要求生成卡片JSON。请发挥你的设计直觉，让卡片美观、协调，同时严格遵守技术规则。

### 一、解析用户输入
从中提取：
- **主题**：核心内容（如"2026新春祝福""10个冷笑话"）。
- **数量需求**：输入中隐含的数字（如"12个月"→12），无明确数字则默认1，最大不超过12（超过12则强制设为12）。
- **设计风格要求**：输入中可能含风格形容词（如"简约""可爱"），若无则忽略。

### 二、设计风格来源
默认风格：简约留白；配色：蓝白干净；布局：居中对称；文字：简洁清晰；精致度：适中标准；质感：渐变通透

**注意**：如果用户输入中包含额外的风格形容词（如"简约""可爱"），请在保持基础风格核心调性的前提下，适当融合这些要求。

### 三、设计风格转化参考
| 风格维度 | 示例描述 | 可能的转化方向 |
|----------|----------|----------------------------|
| 模板风格 | "商务硬朗" | 线条利落、结构分明，圆角可小可无，阴影清晰有力度 |
| 配色方案 | "蓝天清新" | 以蓝白为主调，可纯色可渐变，整体明亮通透，点缀色活泼 |
| 布局方式 | "居中对称" | 主要组件在视觉中心形成平衡，留白均匀，不偏不倚 |
| 文字气质 | "简洁清晰" | 字体干净易读，行距舒适，标题与正文对比明显但不夸张 |
| 精致度   | "适中标准" | 细节处理得当，圆角阴影恰到好处，既不粗糙也不过腻 |
| 质感偏好 | "渐变通透" | 背景若有若无的渐变，或轻微光泽感，营造呼吸感 |

### 四、正反面设计差异与视觉平衡
| 方面 | 正面 (front) | 背面 (back) |
|------|--------------|-------------|
| 角色 | 吸引用户，传达核心主题，制造悬念 | 深化内容，提供答案/细节/祝福 |
| 内容 | 标题、问题引子 | 具体条目、答案、祝福语 |
| 视觉 | 大标题(title)+几何装饰 | 正文(body)+分隔线 |
| 组件 | 1-2个title，少量geometry | 多个body，可带divider |
| 情感 | 引发好奇 | 给予满足感/温馨 |

**设计原则**：
- 问答类：正面提问，背面答案。
- 列表类（如12个月）：正面总标题，背面多个条目。
- 祝福类：正面祝福标题，背面具体祝福语。
- 正反面组件数尽量均衡，总数≤15。

### 五、核心约束（必须遵守）
1. **JSON格式**：仅输出一行纯JSON，无注释/空格/尾逗号，双引号，括号配对。
2. **结构**：{ "cardData": { "faces": { "front": { "background":{}, "components":[] }, "back":{...} } }, "theme":"", "contentData":[] }
3. **背景**：
   - id="background-面-1"，type="background"，metadata: { "image":"", "text":"背景" }
   - layout: width="600px", height="800px", left="0px", top="0px", zIndex=1, position="relative"
   - style: 必须包含 **background** 字段，其值可以是纯色值（如 "#F9F9F9"）或渐变字符串（如 "linear-gradient(135deg, #fad0c4, #ffd1b3)"）。
4. **组件通用**：
   - position="absolute"，zIndex: text≥3，其他1-2
   - width/height≥20px，left≤580，top≤780，带px单位
   - opacity≥0.3
5. **各类型组件**：
   - **text**：fontSize标题≥40px，正文≥32px；fontWeight=bold/normal；textType=title/body；文字内容完全适配组件尺寸。
   - **divider**：height=3/6/8px；style必须包含 borderTopWidth, borderTopStyle, borderBottomWidth, borderBottomStyle, borderLeftWidth="0px", borderRightWidth="0px", background="none"。
   - **geometry**：metadata shapeType=circle/square/rectangle；style background="transparent", borderWidth="1px", borderStyle="solid", borderRadius/borderColor必填。
   - **image**：metadata含src,alt,mode；style含borderRadius,boxShadow；禁止object-fit。
6. **theme**：≤12字，提炼主题。
7. **contentData**：
   - 数组长度 = 解析出的数量（若>12则取12）。
   - 每个元素对象，键必须包含所有组件ID，值：text组件非空字符串，其他组件可空。

### 六、输出示例
{"cardData":{"faces":{"front":{"background":{"id":"background-front-1","type":"background","metadata":{"image":"","text":"背景"},"layout":{"width":"600px","height":"800px","left":"0px","top":"0px","zIndex":1,"position":"relative"},"style":{"background":"linear-gradient(135deg, #667eea, #764ba2)","borderRadius":"16px"}},"components":[{"id":"text-front-1","type":"text","metadata":{"text":"标题","textType":"title"},"layout":{"left":"50px","top":"300px","width":"500px","height":"100px","zIndex":10,"position":"absolute"},"style":{"fontSize":"48px","fontWeight":"bold","color":"#ffffff","textAlign":"center"}}]},"back":{"background":{"id":"background-back-1","type":"background","metadata":{"image":"","text":"背景"},"layout":{"width":"600px","height":"800px","left":"0px","top":"0px","zIndex":1,"position":"relative"},"style":{"background":"#ffffff","borderRadius":"16px"}},"components":[{"id":"text-back-1","type":"text","metadata":{"text":"正文内容","textType":"body"},"layout":{"left":"50px","top":"100px","width":"500px","height":"600px","zIndex":10,"position":"absolute"},"style":{"fontSize":"24px","color":"#333333","lineHeight":"1.8"}}]}}},"theme":"主题","contentData":[{"text-front-1":"标题","text-back-1":"正文内容"}]}

只输出一行合法JSON，无任何额外字符。背面至少有一个组件。`;

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
