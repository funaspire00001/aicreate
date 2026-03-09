/**
 * 豆包 API 提供者
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../../.env') });

const DOUBAO_API_URL = process.env.DOUBAO_API_URL || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY;
const DOUBAO_MODEL = process.env.DOUBAO_MODEL || 'doubao-seed-1-8-251228';

/**
 * 调用豆包 API
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userPrompt - 用户提示词
 * @param {object} options - 可选参数
 * @returns {Promise<string>} 返回内容
 */
export async function callDoubao(systemPrompt, userPrompt, options = {}) {
  if (!DOUBAO_API_KEY) {
    throw new Error('DOUBAO_API_KEY 未配置');
  }

  const { temperature = 0.7, maxTokens = 4096 } = options;

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens: maxTokens
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
    console.error('[doubao] 调用失败:', error);
    throw error;
  }
}

export default {
  call: callDoubao,
  name: '豆包',
  model: DOUBAO_MODEL
};
