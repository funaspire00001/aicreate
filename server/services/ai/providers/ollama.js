/**
 * Ollama API 提供者
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../../.env') });

const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api/chat';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3.5:35b';

/**
 * 调用 Ollama API
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userPrompt - 用户提示词
 * @param {object} options - 可选参数
 * @returns {Promise<string>} 返回内容
 */
export async function callOllama(systemPrompt, userPrompt, options = {}) {
  const { temperature = 0.7 } = options;

  try {
    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
        options: {
          temperature
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API 调用失败: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const content = result.message?.content;

    if (!content) {
      throw new Error('Ollama 返回内容为空');
    }

    return content;

  } catch (error) {
    console.error('[ollama] 调用失败:', error);
    throw error;
  }
}

export default {
  call: callOllama,
  name: 'Ollama',
  model: OLLAMA_MODEL
};
