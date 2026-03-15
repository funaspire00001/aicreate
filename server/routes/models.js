import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置文件路径 - 项目根目录的 config 文件夹
const CONFIG_PATH = path.join(__dirname, '../../config/models.json');

// 读取配置文件
function readConfig() {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取配置文件失败:', error);
    return { models: [], ollama: {} };
  }
}

// 写入配置文件
function writeConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('写入配置文件失败:', error);
    return false;
  }
}

// Ollama API 地址（从配置文件读取或默认）
function getOllamaApiUrl() {
  const config = readConfig();
  return config.ollama?.apiUrl || 'http://localhost:11434';
}

// 辅助函数：HTTP 请求
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, options, (response) => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        resolve({ data, statusCode: response.statusCode, headers: response.headers });
      });
    });
    
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    
    if (options.body) req.write(options.body);
    req.end();
  });
}

// 安全解析JSON
function safeJsonParse(data) {
  try {
    const cleanData = data.replace(/^\uFEFF/, '').trim();
    return JSON.parse(cleanData);
  } catch (error) {
    throw new Error('JSON parse error: ' + error.message);
  }
}

// ============ 路由 ============

// 获取所有模型列表
router.get('/', async (req, res) => {
  try {
    const config = readConfig();
    
    // 尝试获取 Ollama 本地模型
    let ollamaModels = [];
    try {
      const ollamaUrl = getOllamaApiUrl();
      const response = await httpRequest(`${ollamaUrl}/api/tags`);
      const result = safeJsonParse(response.data);
      
      if (result.models && Array.isArray(result.models)) {
        ollamaModels = result.models.map(model => ({
          id: `ollama-${model.name}`,
          name: model.name,
          provider: 'ollama',
          model: model.name,
          apiUrl: `${ollamaUrl}/api/chat`,
          apiKey: '',
          capabilities: ['intent-analysis', 'knowledge-generation', 'card-design'],
          maxTokens: 4096,
          temperature: 0.7,
          cost: { input: 0, output: 0 },
          priority: 1,
          enabled: true,
          size: model.size,
          modified_at: model.modified_at,
          isLocal: true // 标记为本地模型
        }));
      }
    } catch (e) {
      console.log('Ollama 服务不可用:', e.message);
    }
    
    // 合并配置的模型和本地 Ollama 模型
    const configuredModels = config.models || [];
    
    // 检查 Ollama 服务状态
    let ollamaStatus = 'stopped';
    let ollamaVersion = '';
    try {
      const ollamaUrl = getOllamaApiUrl();
      const response = await httpRequest(`${ollamaUrl}/api/version`);
      const result = safeJsonParse(response.data);
      ollamaStatus = 'running';
      ollamaVersion = result.version || '';
    } catch (e) {
      ollamaStatus = 'stopped';
    }
    
    res.json({
      success: true,
      data: {
        models: configuredModels,
        localModels: ollamaModels,
        total: configuredModels.length,
        ollamaCount: ollamaModels.length,
        cloudCount: configuredModels.filter(m => m.provider !== 'ollama').length,
        ollamaUrl: getOllamaApiUrl(),
        ollamaStatus,
        ollamaVersion
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取 Ollama 状态
router.get('/ollama/status', async (req, res) => {
  try {
    const ollamaUrl = getOllamaApiUrl();
    const response = await httpRequest(`${ollamaUrl}/api/version`);
    const result = safeJsonParse(response.data);
    
    res.json({
      success: true,
      data: {
        status: 'running',
        version: result.version,
        ollamaUrl: ollamaUrl
      }
    });
  } catch (error) {
    res.json({
      success: true,
      data: {
        status: 'stopped',
        ollamaUrl: getOllamaApiUrl()
      }
    });
  }
});

// 获取 Ollama 本地模型列表
router.get('/ollama', async (req, res) => {
  try {
    const ollamaUrl = getOllamaApiUrl();
    const response = await httpRequest(`${ollamaUrl}/api/tags`);
    const result = safeJsonParse(response.data);
    
    if (!result.models || !Array.isArray(result.models)) {
      throw new Error('Invalid Ollama response');
    }
    
    const models = result.models.map(model => ({
      id: `ollama-${model.name}`,
      name: model.name,
      provider: 'ollama',
      model: model.name,
      apiUrl: `${ollamaUrl}/api/chat`,
      capabilities: ['intent-analysis', 'knowledge-generation', 'card-design'],
      maxTokens: 4096,
      temperature: 0.7,
      cost: { input: 0, output: 0 },
      priority: 1,
      enabled: true,
      size: model.size,
      modified_at: model.modified_at
    }));
    
    res.json({
      success: true,
      data: { models, total: models.length, ollamaUrl }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加模型
router.post('/', (req, res) => {
  try {
    const config = readConfig();
    const model = req.body;
    
    // 生成 ID
    if (!model.id) {
      model.id = `${model.provider}-${Date.now()}`;
    }
    
    // 设置默认值
    model.enabled = model.enabled !== false;
    model.capabilities = model.capabilities || ['intent-analysis', 'knowledge-generation', 'card-design'];
    model.maxTokens = model.maxTokens || 4096;
    model.temperature = model.temperature || 0.7;
    model.cost = model.cost || { input: 0, output: 0 };
    
    // 添加到配置
    config.models = config.models || [];
    config.models.push(model);
    
    if (writeConfig(config)) {
      res.json({ success: true, data: model });
    } else {
      throw new Error('保存配置失败');
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新模型
router.put('/:id', (req, res) => {
  try {
    const config = readConfig();
    const { id } = req.params;
    const updates = req.body;
    
    const index = config.models.findIndex(m => m.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: '模型不存在' });
    }
    
    // 更新模型
    config.models[index] = { ...config.models[index], ...updates };
    
    if (writeConfig(config)) {
      res.json({ success: true, data: config.models[index] });
    } else {
      throw new Error('保存配置失败');
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除模型
router.delete('/:id', (req, res) => {
  try {
    const config = readConfig();
    const { id } = req.params;
    
    const index = config.models.findIndex(m => m.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: '模型不存在' });
    }
    
    config.models.splice(index, 1);
    
    if (writeConfig(config)) {
      res.json({ success: true });
    } else {
      throw new Error('保存配置失败');
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 测试模型
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const { testPrompt } = req.body;
    const config = readConfig();
    
    // 查找模型配置
    let model = config.models.find(m => m.id === id);
    
    // 如果是本地 Ollama 模型，动态构建
    if (!model && id.startsWith('ollama-')) {
      const ollamaUrl = getOllamaApiUrl();
      const modelName = id.replace('ollama-', '');
      model = {
        id,
        name: modelName,
        provider: 'ollama',
        model: modelName,
        apiUrl: `${ollamaUrl}/api/chat`,
        apiKey: ''
      };
    }
    
    if (!model) {
      return res.status(404).json({ success: false, error: '模型不存在' });
    }
    
    // 构建测试消息
    const systemPrompt = '你是一个有用的AI助手。请用简短的一句话回复用户。';
    const userPrompt = testPrompt || '你好，请介绍一下你自己';
    
    let result;
    
    if (model.provider === 'ollama') {
      // Ollama 调用
      const response = await httpRequest(model.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false,
          options: { temperature: 0.7 }
        })
      });
      
      const json = safeJsonParse(response.data);
      result = json.message?.content || '';
      
    } else if (model.provider === 'openai' || model.provider === 'doubao') {
      // OpenAI/豆包 兼容 API
      const apiKey = model.apiKey || process.env.OPENAI_API_KEY || process.env.DOUBAO_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ success: false, error: 'API Key 未配置' });
      }
      
      const response = await httpRequest(model.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: model.temperature || 0.7,
          max_tokens: model.maxTokens || 4096
        })
      });
      
      const json = safeJsonParse(response.data);
      result = json.choices?.[0]?.message?.content || '';
      
    } else if (model.provider === 'anthropic') {
      // Anthropic Claude
      const apiKey = model.apiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ success: false, error: 'API Key 未配置' });
      }
      
      const response = await httpRequest(model.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model.model,
          max_tokens: model.maxTokens || 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      
      const json = safeJsonParse(response.data);
      result = json.content?.[0]?.text || '';
      
    } else {
      return res.status(400).json({ success: false, error: `不支持的模型提供商: ${model.provider}` });
    }
    
    res.json({ success: true, data: { result, model: model.name } });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新 Ollama 配置
router.put('/ollama/config', (req, res) => {
  try {
    const config = readConfig();
    const { apiUrl, enabled } = req.body;
    
    config.ollama = config.ollama || {};
    if (apiUrl) config.ollama.apiUrl = apiUrl;
    if (enabled !== undefined) config.ollama.enabled = enabled;
    
    if (writeConfig(config)) {
      res.json({ success: true });
    } else {
      throw new Error('保存配置失败');
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
