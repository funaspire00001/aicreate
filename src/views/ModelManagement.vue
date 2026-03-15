<template>
  <div class="model-management">
    <div class="header">
      <div>
        <h1>模型管理</h1>
        <p class="subtitle">管理和配置 AI 模型</p>
      </div>
      <button class="add-btn" @click="openAddModal">
        <span>+</span> 添加模型
      </button>
    </div>
    
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ modelStats.total }}</div>
        <div class="stat-label">总模型数</div>
      </div>
      <div class="stat-card active">
        <div class="stat-value">{{ modelStats.active }}</div>
        <div class="stat-label">活跃模型</div>
      </div>
      <div class="stat-card local">
        <div class="stat-value">{{ localModels.length }}</div>
        <div class="stat-label">本地模型</div>
      </div>
      <div class="stat-card cloud">
        <div class="stat-value">{{ modelStats.cloud }}</div>
        <div class="stat-label">在线模型</div>
      </div>
    </div>
    
    <!-- Ollama 服务状态 -->
    <div class="ollama-status-card" :class="ollamaStatus">
      <div class="status-header">
        <span class="status-title">🔌 Ollama 本地服务</span>
        <div class="status-actions">
          <button class="text-btn" @click="showOllamaConfig = true">配置</button>
          <button class="refresh-btn" @click="refreshModels" :disabled="loading">
            {{ loading ? '刷新中...' : '刷新' }}
          </button>
        </div>
      </div>
      <div class="status-content">
        <div class="status-item">
          <span class="status-label">状态:</span>
          <span class="status-value" :class="ollamaStatus">
            {{ ollamaStatus === 'running' ? '🟢 运行中' : '🔴 已停止' }}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">版本:</span>
          <span class="status-value">{{ ollamaVersion || '-' }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">地址:</span>
          <span class="status-value">{{ ollamaUrl }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">本地模型:</span>
          <span class="status-value">{{ localModels.length }} 个</span>
        </div>
      </div>
    </div>
    
    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      {{ error }}
      <button class="close-btn" @click="error = ''">×</button>
    </div>
    
    <!-- 在线模型列表 -->
    <div class="models-section">
      <div class="section-header">
        <h2>☁️ 在线模型</h2>
        <div class="filter-buttons">
          <button 
            :class="['filter-btn', { active: cloudFilter === 'all' }]"
            @click="cloudFilter = 'all'"
          >
            全部
          </button>
          <button 
            :class="['filter-btn', { active: cloudFilter === 'active' }]"
            @click="cloudFilter = 'active'"
          >
            活跃
          </button>
        </div>
      </div>
      
      <div v-if="filteredCloudModels.length === 0" class="empty-state">
        <p>暂无在线模型，点击"添加模型"配置新的 AI 模型</p>
      </div>
      
      <div v-else class="models-grid">
        <div 
          v-for="model in filteredCloudModels" 
          :key="model.id"
          class="model-card cloud"
          :class="{ disabled: !model.enabled }"
        >
          <!-- 模型头部 -->
          <div class="model-header">
            <div class="model-info">
              <h3 class="model-name">{{ model.name }}</h3>
              <span class="model-provider">{{ getProviderName(model.provider) }}</span>
            </div>
            <div class="model-status">
              <span class="status-indicator" :class="{ active: model.enabled }"></span>
              <span class="status-text">{{ model.enabled ? '启用' : '禁用' }}</span>
            </div>
          </div>
          
          <!-- 模型详情 -->
          <div class="model-details">
            <div class="detail-item">
              <span class="detail-label">模型ID:</span>
              <span class="detail-value">{{ model.model }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">API地址:</span>
              <span class="detail-value api-url">{{ model.apiUrl }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">API Key:</span>
              <span class="detail-value">{{ model.apiKey ? '******' + model.apiKey.slice(-4) : '未设置' }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">最大Token:</span>
              <span class="detail-value">{{ model.maxTokens }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">成本:</span>
              <span class="detail-value" v-if="model.cost">
                ¥{{ model.cost.input }}/in ¥{{ model.cost.output }}/out
              </span>
              <span class="detail-value" v-else>免费</span>
            </div>
          </div>
          
          <!-- 操作按钮 -->
          <div class="model-actions">
            <button 
              class="action-btn"
              :class="model.enabled ? 'secondary' : 'primary'"
              @click="toggleModel(model)"
            >
              {{ model.enabled ? '禁用' : '启用' }}
            </button>
            <button class="action-btn primary" @click="testModel(model)">
              测试
            </button>
            <button class="action-btn secondary" @click="openEditModal(model)">
              编辑
            </button>
            <button class="action-btn danger" @click="deleteModel(model)">
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 本地模型列表 -->
    <div class="models-section">
      <div class="section-header">
        <h2>🖥️ 本地模型 (Ollama)</h2>
      </div>
      
      <div v-if="localModels.length === 0" class="empty-state">
        <p v-if="ollamaStatus !== 'running'">Ollama 服务未运行</p>
        <p v-else>暂无本地模型，请先下载模型到 Ollama</p>
      </div>
      
      <div v-else class="models-grid">
        <div 
          v-for="model in localModels" 
          :key="model.id"
          class="model-card local"
        >
          <div class="model-header">
            <div class="model-info">
              <h3 class="model-name">{{ model.name }}</h3>
              <span class="model-provider">Ollama</span>
            </div>
            <span class="status-indicator active"></span>
          </div>
          
          <div class="model-details">
            <div class="detail-item">
              <span class="detail-label">模型:</span>
              <span class="detail-value">{{ model.model }}</span>
            </div>
            <div class="detail-item" v-if="model.size">
              <span class="detail-label">大小:</span>
              <span class="detail-value">{{ formatSize(model.size) }}</span>
            </div>
          </div>
          
          <div class="model-actions">
            <button class="action-btn primary" @click="testLocalModel(model)">
              测试
            </button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 添加/编辑模型弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ isEditing ? '编辑模型' : '添加模型' }}</h2>
          <button class="close-btn" @click="closeModal">×</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>模型名称 *</label>
            <input v-model="formData.name" type="text" placeholder="如: GPT-4o" />
          </div>
          
          <div class="form-group">
            <label>提供商 *</label>
            <select v-model="formData.provider">
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="doubao">豆包</option>
              <option value="custom">自定义</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>模型 ID *</label>
            <input v-model="formData.model" type="text" placeholder="如: gpt-4o" />
          </div>
          
          <div class="form-group">
            <label>API 地址 *</label>
            <input v-model="formData.apiUrl" type="text" placeholder="如: https://api.openai.com/v1/chat/completions" />
          </div>
          
          <div class="form-group">
            <label>API Key</label>
            <input v-model="formData.apiKey" type="password" placeholder="留空则使用环境变量" />
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>最大 Token</label>
              <input v-model.number="formData.maxTokens" type="number" placeholder="4096" />
            </div>
            <div class="form-group">
              <label>温度</label>
              <input v-model.number="formData.temperature" type="number" step="0.1" min="0" max="2" placeholder="0.7" />
            </div>
          </div>
          
          <div class="form-group">
            <label>能力标签</label>
            <div class="checkbox-group">
              <label v-for="cap in capabilityOptions" :key="cap.value">
                <input type="checkbox" :value="cap.value" v-model="formData.capabilities" />
                {{ cap.label }}
              </label>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>输入价格 (¥/1K)</label>
              <input v-model.number="formData.costInput" type="number" step="0.0001" placeholder="0" />
            </div>
            <div class="form-group">
              <label>输出价格 (¥/1K)</label>
              <input v-model.number="formData.costOutput" type="number" step="0.0001" placeholder="0" />
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="action-btn secondary" @click="closeModal">取消</button>
          <button class="action-btn primary" @click="saveModel" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
    
    <!-- 测试结果弹窗 -->
    <div v-if="showTestModal" class="modal-overlay" @click.self="showTestModal = false">
      <div class="modal">
        <div class="modal-header">
          <h2>测试模型: {{ testingModel?.name }}</h2>
          <button class="close-btn" @click="showTestModal = false">×</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>测试 prompt</label>
            <textarea v-model="testPrompt" rows="3" placeholder="输入测试内容..."></textarea>
          </div>
          
          <button class="action-btn primary" @click="runTest" :disabled="testing">
            {{ testing ? '测试中...' : '发送测试' }}
          </button>
          
          <div v-if="testResult" class="test-result">
            <label>返回结果:</label>
            <div class="result-content">{{ testResult }}</div>
          </div>
          
          <div v-if="testError" class="test-error">
            {{ testError }}
          </div>
        </div>
      </div>
    </div>
    
    <!-- Ollama 配置弹窗 -->
    <div v-if="showOllamaConfig" class="modal-overlay" @click.self="showOllamaConfig = false">
      <div class="modal">
        <div class="modal-header">
          <h2>Ollama 配置</h2>
          <button class="close-btn" @click="showOllamaConfig = false">×</button>
        </div>
        
        <div class="modal-body">
          <div class="form-group">
            <label>API 地址</label>
            <input v-model="ollamaConfigUrl" type="text" placeholder="http://localhost:11434" />
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="action-btn secondary" @click="showOllamaConfig = false">取消</button>
          <button class="action-btn primary" @click="saveOllamaConfig">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { modelsApi } from '../api'

// 数据
const models = ref([])
const localModels = ref([])
const loading = ref(false)
const error = ref(null)
const saving = ref(false)

// Ollama 状态
const ollamaStatus = ref('stopped')
const ollamaVersion = ref('')
const ollamaUrl = ref('')

// 过滤
const cloudFilter = ref('all')
const localFilter = ref('all')

// 弹窗状态
const showModal = ref(false)
const isEditing = ref(false)
const editingId = ref(null)

// 表单数据
const formData = ref({
  name: '',
  provider: 'openai',
  model: '',
  apiUrl: '',
  apiKey: '',
  maxTokens: 4096,
  temperature: 0.7,
  capabilities: ['intent-analysis', 'knowledge-generation', 'card-design'],
  costInput: 0,
  costOutput: 0
})

// 能力选项
const capabilityOptions = [
  { value: 'intent-analysis', label: '意图分析' },
  { value: 'knowledge-generation', label: '知识生成' },
  { value: 'card-design', label: '卡片设计' },
  { value: 'quality-check', label: '质量检查' }
]

// 测试弹窗
const showTestModal = ref(false)
const testingModel = ref(null)
const testPrompt = ref('你好，请用一句话介绍你自己')
const testing = ref(false)
const testResult = ref('')
const testError = ref('')

// Ollama 配置弹窗
const showOllamaConfig = ref(false)
const ollamaConfigUrl = ref('')

// 计算属性
const cloudModels = computed(() => models.value.filter(m => m.provider !== 'ollama'))
const filteredCloudModels = computed(() => {
  if (cloudFilter.value === 'all') return cloudModels.value
  return cloudModels.value.filter(m => m.enabled)
})

const modelStats = computed(() => ({
  total: models.value.length,
  active: models.value.filter(m => m.enabled).length,
  cloud: cloudModels.value.length
}))

// 方法
const getProviderName = (provider) => {
  const map = { openai: 'OpenAI', anthropic: 'Claude', doubao: '豆包', custom: '自定义' }
  return map[provider] || provider
}

const formatSize = (bytes) => {
  if (!bytes) return '未知'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes, unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

// 获取模型列表
const fetchModels = async () => {
  loading.value = true
  error.value = null
  
  try {
    const response = await modelsApi.list()
    if (response.success) {
      models.value = response.data.models || []
      localModels.value = response.data.localModels || []
      ollamaStatus.value = response.data.ollamaStatus || 'stopped'
      ollamaVersion.value = response.data.ollamaVersion || ''
      ollamaUrl.value = response.data.ollamaUrl || 'http://localhost:11434'
    } else {
      error.value = response.error
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

// 刷新
const refreshModels = () => fetchModels()

// 打开添加弹窗
const openAddModal = () => {
  isEditing.value = false
  editingId.value = null
  formData.value = {
    name: '',
    provider: 'openai',
    model: '',
    apiUrl: '',
    apiKey: '',
    maxTokens: 4096,
    temperature: 0.7,
    capabilities: ['intent-analysis', 'knowledge-generation', 'card-design'],
    costInput: 0,
    costOutput: 0
  }
  showModal.value = true
}

// 打开编辑弹窗
const openEditModal = (model) => {
  isEditing.value = true
  editingId.value = model.id
  formData.value = {
    name: model.name,
    provider: model.provider,
    model: model.model,
    apiUrl: model.apiUrl,
    apiKey: model.apiKey || '',
    maxTokens: model.maxTokens || 4096,
    temperature: model.temperature || 0.7,
    capabilities: model.capabilities || [],
    costInput: model.cost?.input || 0,
    costOutput: model.cost?.output || 0
  }
  showModal.value = true
}

// 关闭弹窗
const closeModal = () => {
  showModal.value = false
}

// 保存模型
const saveModel = async () => {
  if (!formData.value.name || !formData.value.model || !formData.value.apiUrl) {
    error.value = '请填写必填字段'
    return
  }
  
  saving.value = true
  error.value = null
  
  try {
    const modelData = {
      name: formData.value.name,
      provider: formData.value.provider,
      model: formData.value.model,
      apiUrl: formData.value.apiUrl,
      apiKey: formData.value.apiKey,
      maxTokens: formData.value.maxTokens,
      temperature: formData.value.temperature,
      capabilities: formData.value.capabilities,
      cost: { input: formData.value.costInput, output: formData.value.costOutput }
    }
    
    let response
    if (isEditing.value) {
      response = await modelsApi.update(editingId.value, modelData)
    } else {
      response = await modelsApi.add(modelData)
    }
    
    if (response.success) {
      closeModal()
      fetchModels()
    } else {
      error.value = response.error
    }
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}

// 切换模型状态
const toggleModel = async (model) => {
  try {
    const response = await modelsApi.update(model.id, { enabled: !model.enabled })
    if (response.success) {
      model.enabled = !model.enabled
    }
  } catch (err) {
    error.value = err.message
  }
}

// 删除模型
const deleteModel = async (model) => {
  if (!confirm(`确定要删除模型 "${model.name}" 吗？`)) return
  
  try {
    const response = await modelsApi.delete(model.id)
    if (response.success) {
      fetchModels()
    } else {
      error.value = response.error
    }
  } catch (err) {
    error.value = err.message
  }
}

// 测试模型
const testModel = (model) => {
  testingModel.value = model
  testPrompt.value = '你好，请用一句话介绍你自己'
  testResult.value = ''
  testError.value = ''
  showTestModal.value = true
}

// 测试本地模型
const testLocalModel = (model) => {
  testingModel.value = model
  testPrompt.value = '你好，请用一句话介绍你自己'
  testResult.value = ''
  testError.value = ''
  showTestModal.value = true
}

// 执行测试
const runTest = async () => {
  testing.value = true
  testResult.value = ''
  testError.value = ''
  
  try {
    const response = await modelsApi.test(testingModel.value.id, testPrompt.value)
    if (response.success) {
      testResult.value = response.data.result
    } else {
      testError.value = response.error
    }
  } catch (err) {
    testError.value = err.message
  } finally {
    testing.value = false
  }
}

// 保存 Ollama 配置
const saveOllamaConfig = async () => {
  try {
    await modelsApi.updateOllamaConfig({ apiUrl: ollamaConfigUrl.value })
    showOllamaConfig.value = false
    fetchModels()
  } catch (err) {
    error.value = err.message
  }
}

// 初始化
onMounted(() => {
  fetchModels()
  ollamaConfigUrl.value = ollamaUrl.value
})
</script>

<style scoped>
.model-management {
  padding: 24px;
  max-width: 100%;
  margin: 0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

h1 { margin: 0 0 8px 0; color: #333; }
.subtitle { margin: 0; color: #666; font-size: 14px; }

.add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.add-btn:hover { background: #5a6fd6; }

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  text-align: center;
  border-top: 3px solid #667eea;
}

.stat-card.active { border-top-color: #52c41a; }
.stat-card.local { border-top-color: #1890ff; }
.stat-card.cloud { border-top-color: #fa8c16; }

.stat-value { font-size: 32px; font-weight: bold; color: #333; margin-bottom: 4px; }
.stat-label { font-size: 14px; color: #666; }

.ollama-status-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  margin-bottom: 24px;
  border-left: 4px solid #999;
}

.ollama-status-card.running { border-left-color: #52c41a; }
.ollama-status-card.stopped { border-left-color: #f5222d; }

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.status-title { font-size: 16px; font-weight: 600; color: #333; }

.status-actions { display: flex; gap: 8px; }

.text-btn {
  background: none;
  border: none;
  color: #667eea;
  cursor: pointer;
  font-size: 14px;
  padding: 4px 8px;
}

.text-btn:hover { text-decoration: underline; }

.refresh-btn {
  padding: 8px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.refresh-btn:hover:not(:disabled) { background: #5a6fd6; }
.refresh-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.status-content { display: flex; gap: 24px; flex-wrap: wrap; }
.status-item { display: flex; gap: 8px; }
.status-label { color: #666; font-size: 13px; }
.status-value { font-size: 13px; color: #333; font-family: monospace; }
.status-value.running { color: #52c41a; font-weight: 600; }
.status-value.stopped { color: #f5222d; }

.error-message {
  background: #fff1f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 24px;
  color: #f5222d;
  font-size: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.error-message .close-btn {
  background: none;
  border: none;
  color: #f5222d;
  font-size: 20px;
  cursor: pointer;
  padding: 0 8px;
}

.models-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-header h2 { font-size: 18px; color: #333; margin: 0; }

.filter-buttons { display: flex; gap: 8px; }

.filter-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 20px;
  background: white;
  cursor: pointer;
  font-size: 14px;
}

.filter-btn:hover { border-color: #667eea; color: #667eea; }
.filter-btn.active { background: #667eea; border-color: #667eea; color: white; }

.empty-state {
  text-align: center;
  padding: 40px 20px;
  background: #f9f9f9;
  border-radius: 12px;
  color: #666;
}

.models-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.model-card {
  background: #f9f9f9;
  border-radius: 12px;
  padding: 20px;
  border-left: 4px solid #667eea;
}

.model-card.local { border-left-color: #1890ff; }
.model-card.cloud { border-left-color: #fa8c16; }
.model-card.disabled { opacity: 0.6; }

.model-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.model-info h3 { font-size: 18px; color: #333; margin: 0 0 4px 0; }

.model-provider {
  font-size: 12px;
  color: #667eea;
  background: rgba(102,126,234,0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.model-status { display: flex; align-items: center; gap: 8px; }

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
}

.status-indicator.active {
  background: #52c41a;
  box-shadow: 0 0 0 4px rgba(82,196,26,0.2);
}

.status-text { font-size: 12px; color: #666; }

.model-details { margin-bottom: 16px; }

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid #eee;
  font-size: 13px;
}

.detail-item:last-child { border-bottom: none; }
.detail-label { color: #666; }
.detail-value { color: #333; font-family: monospace; }
.detail-value.api-url { font-size: 11px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }

.model-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.action-btn.primary { background: #667eea; color: white; }
.action-btn.primary:hover { background: #5a6fd6; }
.action-btn.secondary { background: #f0f0f0; color: #333; }
.action-btn.secondary:hover { background: #e0e0e0; }
.action-btn.danger { background: #fff1f0; color: #f5222d; }
.action-btn.danger:hover { background: #ffccc7; }

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #eee;
}

.modal-header h2 { font-size: 18px; color: #333; margin: 0; }

.modal-header .close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  padding: 0;
}

.modal-body { padding: 24px; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #eee;
}

.form-group { margin-bottom: 16px; }

.form-group label {
  display: block;
  font-size: 14px;
  color: #333;
  margin-bottom: 6px;
  font-weight: 500;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: normal;
  cursor: pointer;
}

.checkbox-group input { width: auto; }

.test-result {
  margin-top: 16px;
  padding: 16px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 8px;
}

.test-result label {
  font-weight: 600;
  color: #52c41a;
  margin-bottom: 8px;
}

.result-content {
  font-size: 14px;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}

.test-error {
  margin-top: 16px;
  padding: 12px;
  background: #fff1f0;
  border: 1px solid #ffccc7;
  border-radius: 8px;
  color: #f5222d;
  font-size: 14px;
}

@media (max-width: 768px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .models-grid { grid-template-columns: 1fr; }
  .form-row { grid-template-columns: 1fr; }
}
</style>
