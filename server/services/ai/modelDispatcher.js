/**
 * 模型调度器
 * 从配置文件加载模型，提供统一的调用接口
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置文件路径
const CONFIG_PATH = path.join(__dirname, '../../../config/models.json');

// 缓存
let configCache = null;
let configCacheTime = 0;
const CACHE_TTL = 5000; // 5秒缓存

/**
 * 读取模型配置
 */
function loadConfig() {
  const now = Date.now();
  if (configCache && (now - configCacheTime) < CACHE_TTL) {
    return configCache;
  }
  
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf8');
    configCache = JSON.parse(data);
    configCacheTime = now;
    return configCache;
  } catch (error) {
    console.error('[modelDispatcher] 读取配置文件失败:', error);
    return { models: [], ollama: { apiUrl: 'http://localhost:11434' } };
  }
}

/**
 * 获取所有可用模型（包含云端和本地）
 */
export function getAvailableModels() {
  const config = loadConfig();
  const models = config.models || [];
  const localModels = config.localModels || [];
  return [...models, ...localModels];
}

/**
 * 获取启用的模型列表
 */
export function getEnabledModels() {
  return getAvailableModels().filter(m => m.enabled !== false);
}

/**
 * 根据能力获取模型
 * @param {string} capability - 能力标签
 */
export function getModelsByCapability(capability) {
  return getEnabledModels().filter(m => 
    m.capabilities && m.capabilities.includes(capability)
  );
}

/**
 * 获取模型配置
 * @param {string} modelId - 模型 ID
 */
export function getModelConfig(modelId) {
  const config = loadConfig();
  const models = config.models || [];
  const localModels = config.localModels || [];
  
  // 先从云端模型查找
  let model = models.find(m => m.id === modelId);
  
  // 如果没找到，从本地模型查找
  if (!model) {
    model = localModels.find(m => m.id === modelId);
  }
  
  return model;
}

/**
 * 获取 Ollama 配置
 */
export function getOllamaConfig() {
  const config = loadConfig();
  return config.ollama || { apiUrl: 'http://localhost:11434' };
}

/**
 * 调用模型
 * @param {string} modelId - 模型 ID
 * @param {string} systemPrompt - 系统提示词
 * @param {string} userPrompt - 用户提示词
 * @param {object} options - 其他选项
 */
export async function callModel(modelId, systemPrompt, userPrompt, options = {}) {
  const model = getModelConfig(modelId);
  
  if (!model) {
    throw new Error(`模型不存在: ${modelId}`);
  }
  
  if (!model.enabled) {
    throw new Error(`模型已禁用: ${modelId}`);
  }
  
  const { temperature, maxTokens } = {
    temperature: model.temperature || 0.7,
    maxTokens: model.maxTokens || 4096,
    ...options
  };
  
  const startTime = Date.now();
  let result;
  let error;
  
  try {
    if (model.provider === 'ollama') {
      result = await callOllama(model, systemPrompt, userPrompt, { temperature });
    } else if (model.provider === 'openai') {
      result = await callOpenAI(model, systemPrompt, userPrompt, { temperature, maxTokens });
    } else if (model.provider === 'anthropic') {
      result = await callAnthropic(model, systemPrompt, userPrompt, { temperature, maxTokens });
    } else if (model.provider === 'doubao') {
      result = await callOpenAI(model, systemPrompt, userPrompt, { temperature, maxTokens });
    } else {
      throw new Error(`不支持的提供商: ${model.provider}`);
    }
  } catch (err) {
    error = err.message;
    throw err;
  } finally {
    // 记录调用日志
    const duration = Date.now() - startTime;
    logModelCall(modelId, duration, error);
  }
  
  return result;
}

/**
 * 调用 Ollama
 */
async function callOllama(model, systemPrompt, userPrompt, options) {
  const ollamaConfig = getOllamaConfig();
  const apiUrl = model.apiUrl || `${ollamaConfig.apiUrl}/api/chat`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: false,
      options: {
        temperature: options.temperature || 0.7
      }
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama 调用失败: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  return result.message?.content || '';
}

/**
 * 调用 OpenAI 兼容 API (包括豆包)
 */
async function callOpenAI(model, systemPrompt, userPrompt, options) {
  if (!model.apiKey) {
    throw new Error(`模型 ${model.id} 未配置 API Key`);
  }
  
  const response = await fetch(model.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${model.apiKey}`
    },
    body: JSON.stringify({
      model: model.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 调用失败: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  return result.choices?.[0]?.message?.content || '';
}

/**
 * 调用 Anthropic Claude
 */
async function callAnthropic(model, systemPrompt, userPrompt, options) {
  if (!model.apiKey) {
    throw new Error(`模型 ${model.id} 未配置 API Key`);
  }
  
  const response = await fetch(model.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': model.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model.model,
      max_tokens: options.maxTokens || 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic 调用失败: ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  return result.content?.[0]?.text || '';
}

/**
 * 调用日志（简单内存记录）
 */
const callLogs = [];
const MAX_LOGS = 1000;

function logModelCall(modelId, duration, error) {
  callLogs.unshift({
    modelId,
    duration,
    error,
    timestamp: new Date().toISOString()
  });
  
  // 限制日志数量
  if (callLogs.length > MAX_LOGS) {
    callLogs.pop();
  }
}

/**
 * 获取调用日志
 */
export function getCallLogs(limit = 100) {
  return callLogs.slice(0, limit);
}

/**
 * 获取模型调用统计
 */
export function getModelStats() {
  const stats = {};
  
  for (const log of callLogs) {
    if (!stats[log.modelId]) {
      stats[log.modelId] = { calls: 0, errors: 0, totalDuration: 0 };
    }
    stats[log.modelId].calls++;
    if (log.error) stats[log.modelId].errors++;
    stats[log.modelId].totalDuration += log.duration;
  }
  
  // 计算平均时间
  for (const modelId in stats) {
    stats[modelId].avgDuration = Math.round(
      stats[modelId].totalDuration / stats[modelId].calls
    );
  }
  
  return stats;
}

/**
 * 创建模型调用函数（兼容旧接口）
 */
export function createModelCaller(modelId) {
  return async (systemPrompt, userPrompt, options = {}) => {
    return callModel(modelId, systemPrompt, userPrompt, options);
  };
}

export default {
  getAvailableModels,
  getEnabledModels,
  getModelsByCapability,
  getModelConfig,
  getOllamaConfig,
  callModel,
  getCallLogs,
  getModelStats,
  createModelCaller
};
