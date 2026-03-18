<template>
  <div class="agent-modal-overlay" @click.self="$emit('close')">
    <div class="agent-modal">
      <div class="modal-header">
        <span class="modal-title">{{ agentName }} - 详情配置</span>
        <button class="close-btn" @click="$emit('close')">✕</button>
      </div>
      
      <!-- Tab切换 -->
      <div class="detail-tabs">
        <button :class="['tab-btn', { active: activeTab === 'config' }]" @click="activeTab = 'config'">
          基础配置
        </button>
        <button :class="['tab-btn', { active: activeTab === 'model' }]" @click="activeTab = 'model'">
          模型配置
        </button>
        <button :class="['tab-btn', { active: activeTab === 'skills' }]" @click="activeTab = 'skills'; loadSkills()">
          技能设置
        </button>
        <button :class="['tab-btn', { active: activeTab === 'data' }]" @click="activeTab = 'data'; fetchInputs(); fetchOutputs(); fetchDataStats()">数据管理</button>
        <button :class="['tab-btn', { active: activeTab === 'logs' }]" @click="activeTab = 'logs'; fetchLogs()">
          执行日志
        </button>
      </div>
      
      <!-- Tab内容 -->
      <div class="tab-content">
        <!-- 基础配置 -->
        <div v-if="activeTab === 'config'" class="tab-pane config-pane">
          <template v-if="agentConfig">
            <div class="config-header">
              <h3>基础配置</h3>
              <button @click="saveConfig" class="btn-save">保存修改</button>
            </div>
            
            <div class="config-list">
              <!-- 基础信息 -->
              <div class="config-group">
                <div class="group-title">基础信息</div>
                <div class="config-row">
                  <span class="config-label">名称</span>
                  <input v-model="editForm.name" class="config-input" placeholder="智能体名称" />
                </div>
                <div class="config-row">
                  <span class="config-label">类型</span>
                  <span class="config-value">{{ agentConfig.type || 'processor' }}</span>
                </div>
                <div class="config-row">
                  <span class="config-label">描述</span>
                  <input v-model="editForm.description" class="config-input" placeholder="功能描述" />
                </div>
                <div class="config-row">
                  <span class="config-label">启用状态</span>
                  <label class="switch">
                    <input v-model="editForm.enabled" type="checkbox" />
                    <span class="slider"></span>
                  </label>
                </div>
              </div>
              
              <!-- 调度配置 -->
              <div class="config-group" v-if="agentConfig.schedule">
                <div class="group-title">调度配置</div>
                <div class="config-row">
                  <span class="config-label">轮询间隔</span>
                  <div class="input-with-unit">
                    <input v-model.number="editForm.scheduleInterval" type="number" step="1000" min="1000" max="60000" class="config-input small" />
                    <span class="unit">ms</span>
                  </div>
                </div>
                <div class="config-row">
                  <span class="config-label">批处理数量</span>
                  <input v-model.number="editForm.scheduleBatchSize" type="number" step="1" min="1" max="10" class="config-input small" />
                </div>
              </div>
            </div>
          </template>
          <div v-else class="empty-tip">未找到智能体配置</div>
        </div>
        
        <!-- 模型配置 -->
        <div v-if="activeTab === 'model'" class="tab-pane model-pane">
          <template v-if="agentConfig">
            <div class="config-header">
              <h3>模型配置</h3>
              <button @click="saveConfig" class="btn-save">保存修改</button>
            </div>
            
            <div class="config-list">
              <div class="config-group">
                <div class="group-title">AI 能力</div>
                <div class="config-row">
                  <span class="config-label">启用AI</span>
                  <label class="switch">
                    <input v-model="editForm.aiEnabled" type="checkbox" />
                    <span class="slider"></span>
                  </label>
                </div>
              </div>
              
              <template v-if="editForm.aiEnabled">
                <div class="config-group">
                  <div class="group-title">模型选择</div>
                  <div class="config-row">
                    <span class="config-label">模型</span>
                    <select v-model="editForm.modelId" class="config-select">
                      <option v-for="m in availableModels" :key="m.id" :value="m.id">{{ m.name }} ({{ m.provider }})</option>
                    </select>
                  </div>
                </div>
                
                <div class="config-group">
                  <div class="group-title">模型参数</div>
                  <div class="config-row">
                    <span class="config-label">温度</span>
                    <div class="input-with-unit">
                      <input v-model.number="editForm.temperature" type="number" step="0.1" min="0" max="2" class="config-input small" />
                      <span class="unit">(0-2)</span>
                    </div>
                  </div>
                  <div class="config-row">
                    <span class="config-label">最大Token</span>
                    <input v-model.number="editForm.maxTokens" type="number" step="512" min="256" max="128000" class="config-input small" />
                  </div>
                </div>
                
                <div class="config-group">
                  <div class="group-title">提示词</div>
                  <p class="prompt-tip">定义AI的角色、任务和行为方式</p>
                  <textarea v-model="editForm.prompt" class="prompt-textarea" rows="15" placeholder="请输入 AI Prompt..."></textarea>
                </div>
              </template>
              
              <template v-else>
                <div class="empty-tip">请先启用AI能力</div>
              </template>
            </div>
          </template>
        </div>
        
        <!-- 技能设置 -->
        <div v-if="activeTab === 'skills'" class="tab-pane skills-pane">
          <div class="skills-header">
            <h3>当前智能体技能</h3>
            <button @click="showAddSkillModal = true" class="btn-add-skill">+ 添加技能</button>
          </div>
          
          <div v-if="agentSkills.length === 0" class="empty-tip">暂无分配技能</div>
          
          <div class="skill-list">
            <div v-for="skill in agentSkills" :key="skill.id" class="skill-item">
              <div class="skill-info">
                <span class="skill-name">{{ skill.name }}</span>
                <span class="skill-category">{{ skill.category }}</span>
              </div>
              <button @click="removeSkill(skill.id)" class="btn-remove-skill">移除</button>
            </div>
          </div>
          
          <div class="divider"></div>
          
          <h4>可用技能库</h4>
          <div class="filter-bar">
            <button 
              v-for="cat in categories" 
              :key="cat"
              :class="['filter-btn', { active: selectedCategory === cat }]"
              @click="selectedCategory = selectedCategory === cat ? '' : cat"
            >
              {{ cat }}
            </button>
          </div>
          
          <div class="available-skills">
            <div 
              v-for="skill in filteredAvailableSkills" 
              :key="skill.id" 
              class="available-skill-item"
              @click="addSkillToAgent(skill)"
            >
              <span class="skill-name">{{ skill.name }}</span>
              <span class="skill-category">{{ skill.category }}</span>
              <span class="add-icon">+</span>
            </div>
          </div>
        </div>
        
        <!-- 执行日志 -->
        <div v-if="activeTab === 'logs'" class="tab-pane logs-pane">
          <div class="logs-content">
            <div v-if="logsLoading" class="loading-tip">加载中...</div>
            <div v-else-if="logs.length === 0" class="empty-tip">暂无日志</div>
            <div class="log-item" v-else v-for="(log, index) in logs" :key="index" :class="log.level">
              <span class="log-time">{{ log.time }}</span>
              <span class="log-level">{{ log.level }}</span>
              <span class="log-msg">{{ log.message }}</span>
              <span class="log-duration" v-if="log.duration">{{ log.duration }}ms</span>
            </div>
          </div>
        </div>
        
        <!-- 数据管理 -->
        <div v-if="activeTab === 'data'" class="tab-pane data-pane">
          <!-- 数据配置 -->
          <div class="config-group" v-if="agentConfig?.data" style="margin-bottom: 20px;">
            <div class="group-title">数据配置</div>
            <div class="config-row" v-if="agentConfig.data.inputs">
              <span class="config-label">输入源</span>
              <div class="tag-list">
                <span v-for="(input, idx) in agentConfig.data.inputs" :key="idx" class="tag">
                  {{ input.source }} <small>({{ input.trigger || input.type }})</small>
                </span>
              </div>
            </div>
            <div class="config-row" v-if="agentConfig.data.output">
              <span class="config-label">输出目标</span>
              <span class="config-value">{{ agentConfig.data.output.collection }} → {{ agentConfig.data.output.status }}</span>
            </div>
          </div>
          
          <template v-if="agentKey !== 'demand' && agentKey !== 'output'">
            <!-- 数据统计 -->
            <div class="data-stats-row">
              <div class="stat-card">
                <div class="stat-num">{{ inputStats.total }}</div>
                <div class="stat-label">输入总数</div>
              </div>
              <div class="stat-card pending">
                <div class="stat-num">{{ inputStats.pending }}</div>
                <div class="stat-label">待处理</div>
              </div>
              <div class="stat-card processing">
                <div class="stat-num">{{ inputStats.processing }}</div>
                <div class="stat-label">处理中</div>
              </div>
              <div class="stat-card completed">
                <div class="stat-num">{{ inputStats.completed }}</div>
                <div class="stat-label">已完成</div>
              </div>
              <div class="stat-card failed">
                <div class="stat-num">{{ inputStats.failed }}</div>
                <div class="stat-label">失败</div>
              </div>
              <div class="stat-card success">
                <div class="stat-num">{{ outputStats.total }}</div>
                <div class="stat-label">输出总数</div>
              </div>
            </div>
            
            <!-- 输入数据列表 -->
            <div class="data-section">
              <div class="data-header">
                <h4>输入数据</h4>
                <button @click="fetchInputs" class="btn-refresh">刷新</button>
              </div>
              <div v-if="inputsLoading" class="loading-tip">加载中...</div>
              <div v-else-if="inputList.length === 0" class="empty-tip">暂无输入数据</div>
              <table v-else class="data-table">
                <thead>
                  <tr>
                    <th>来源类型</th>
                    <th>状态</th>
                    <th>数据摘要</th>
                    <th>处理耗时</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in inputList" :key="item._id">
                    <td><span class="source-type">{{ item.sourceType }}</span></td>
                    <td><span class="item-status" :class="item.status">{{ statusText[item.status] }}</span></td>
                    <td class="item-summary">{{ getInputSummary(item) }}</td>
                    <td>{{ item.duration ? `${item.duration}ms` : '-' }}</td>
                    <td class="item-time">{{ formatDate(item.createdAt) }}</td>
                    <td>
                      <button v-if="item.status === 'failed'" @click="retryInput(item._id)" class="btn-retry">重试</button>
                      <button @click="viewInputDetail(item)" class="btn-view">详情</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- 输出数据列表 -->
            <div class="data-section">
              <div class="data-header">
                <h4>输出数据</h4>
                <button @click="fetchOutputs" class="btn-refresh">刷新</button>
              </div>
              <div v-if="outputsLoading" class="loading-tip">加载中...</div>
              <div v-else-if="outputList.length === 0" class="empty-tip">暂无输出数据</div>
              <table v-else class="data-table">
                <thead>
                  <tr>
                    <th>输出类型</th>
                    <th>状态</th>
                    <th>数据摘要</th>
                    <th>处理耗时</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in outputList" :key="item._id">
                    <td><span class="output-type">{{ item.outputType }}</span></td>
                    <td><span class="item-status" :class="item.status === 'success' ? 'completed' : item.status">{{ item.status === 'success' ? '成功' : item.status }}</span></td>
                    <td class="item-summary">{{ getOutputSummary(item) }}</td>
                    <td>{{ item.duration ? `${item.duration}ms` : '-' }}</td>
                    <td class="item-time">{{ formatDate(item.createdAt) }}</td>
                    <td>
                      <button @click="viewOutputDetail(item)" class="btn-view">详情</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
          
          <template v-else>
            <div class="empty-tip">该节点不支持数据管理</div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  agentKey: { type: String, required: true },
  agentName: { type: String, required: true }
})

const emit = defineEmits(['close', 'update'])

const API_URL = 'http://localhost:3001/api'

// 状态文本映射
const statusText = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  failed: '失败'
}

// 状态
const activeTab = ref('config')
const agentConfig = ref(null)
const editForm = ref({})
const availableModels = ref([])
const logs = ref([])
const logsLoading = ref(false)

// 输入输出数据
const inputList = ref([])
const outputList = ref([])
const inputsLoading = ref(false)
const outputsLoading = ref(false)
const inputStats = ref({ total: 0, pending: 0, processing: 0, completed: 0, failed: 0 })
const outputStats = ref({ total: 0 })

// 技能相关
const allSkills = ref([])
const agentSkills = ref([])
const showAddSkillModal = ref(false)
const selectedCategory = ref('')

const categories = [
  '信息处理', '知识构建', '内容生成', '分析推理', '视觉设计', '质量检查', '其他'
]

const filteredAvailableSkills = computed(() => {
  const assignedIds = new Set(agentSkills.value.map(s => s.id))
  const available = allSkills.value.filter(s => !assignedIds.has(s.id))
  if (!selectedCategory.value) return available
  return available.filter(s => s.category === selectedCategory.value)
})

// 加载智能体配置
const loadConfig = async () => {
  try {
    const res = await fetch(`${API_URL}/demands/agents/${props.agentKey}/detail`)
    const data = await res.json()
    if (data.success) {
      agentConfig.value = data.detail.config
      // 初始化编辑表单
      editForm.value = {
        ...data.detail.config,
        // AI 配置
        aiEnabled: data.detail.config.ai?.enabled ?? false,
        modelId: data.detail.config.ai?.modelId || 'ollama-qwen',
        prompt: data.detail.config.ai?.prompt || '',
        temperature: data.detail.config.ai?.temperature ?? 0.7,
        maxTokens: data.detail.config.ai?.maxTokens ?? 4096,
        // 调度配置
        scheduleInterval: data.detail.config.schedule?.interval ?? 5000,
        scheduleBatchSize: data.detail.config.schedule?.batchSize ?? 1
      }
      // 加载模型列表
      loadModels()
    }
  } catch (err) {
    console.error('加载配置失败:', err)
  }
}

// 获取模型列表
const loadModels = async () => {
  try {
    const res = await fetch(`${API_URL}/agents/models`)
    const data = await res.json()
    if (data.success) {
      availableModels.value = data.models
    }
  } catch (err) {
    console.error('加载模型失败:', err)
  }
}

// 保存配置
const saveConfig = async () => {
  if (!editForm.value.id && !editForm.value._id) return
  try {
    const agentId = editForm.value.id || editForm.value._id
    const res = await fetch(`${API_URL}/agents/${agentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.value.name,
        description: editForm.value.description,
        enabled: editForm.value.enabled,
        // AI 配置
        ai: {
          enabled: editForm.value.aiEnabled,
          modelId: editForm.value.modelId,
          prompt: editForm.value.prompt,
          temperature: editForm.value.temperature,
          maxTokens: editForm.value.maxTokens
        },
        // 调度配置
        schedule: {
          interval: editForm.value.scheduleInterval,
          batchSize: editForm.value.scheduleBatchSize
        }
      })
    })
    const data = await res.json()
    if (data.success) {
      loadConfig()
      emit('update')
      alert('保存成功！')
    } else {
      alert('保存失败: ' + data.error)
    }
  } catch (err) {
    console.error('保存失败:', err)
    alert('保存失败')
  }
}

// 加载日志
const fetchLogs = async () => {
  logsLoading.value = true
  logs.value = []
  try {
    const res = await fetch(`${API_URL}/demands/agents/${props.agentKey}/logs?limit=50`)
    const data = await res.json()
    if (data.success) {
      logs.value = data.logs.map(log => ({
        time: new Date(log.createdAt).toTimeString().slice(0, 8),
        level: log.level || 'info',
        message: log.message,
        duration: log.duration
      }))
    }
  } catch (err) {
    console.error('加载日志失败:', err)
  }
  logsLoading.value = false
}

// 加载输入数据
const fetchInputs = async () => {
  inputsLoading.value = true
  try {
    const res = await fetch(`${API_URL}/demands/agents/${props.agentKey}/inputs?limit=20`)
    const data = await res.json()
    if (data.success) {
      inputList.value = data.data || []
    }
  } catch (err) {
    console.error('加载输入数据失败:', err)
  }
  inputsLoading.value = false
}

// 加载输出数据
const fetchOutputs = async () => {
  outputsLoading.value = true
  try {
    const res = await fetch(`${API_URL}/demands/agents/${props.agentKey}/outputs?limit=20`)
    const data = await res.json()
    if (data.success) {
      outputList.value = data.data || []
    }
  } catch (err) {
    console.error('加载输出数据失败:', err)
  }
  outputsLoading.value = false
}

// 加载数据统计
const fetchDataStats = async () => {
  try {
    const res = await fetch(`${API_URL}/demands/agents/${props.agentKey}/data-stats`)
    const data = await res.json()
    if (data.success) {
      inputStats.value = data.stats.input
      outputStats.value = data.stats.output
    }
  } catch (err) {
    console.error('加载数据统计失败:', err)
  }
}

// 重试失败的输入
const retryInput = async (inputId) => {
  try {
    const res = await fetch(`${API_URL}/demands/inputs/${inputId}/retry`, { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      fetchInputs()
      fetchDataStats()
    }
  } catch (err) {
    console.error('重试失败:', err)
  }
}

// 获取输入摘要
const getInputSummary = (item) => {
  if (item.data) {
    return item.data.theme || item.data.summary || item.data.title || JSON.stringify(item.data).slice(0, 50)
  }
  return '-'
}

// 获取输出摘要
const getOutputSummary = (item) => {
  if (item.data) {
    if (item.data.summary) return item.data.summary
    if (item.data.total) return `共 ${item.data.total} 条`
    if (item.data.cards) return `共 ${item.data.cards.length} 张卡片`
    return JSON.stringify(item.data).slice(0, 50)
  }
  return '-'
}

// 格式化日期
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

// 查看输入详情
const viewInputDetail = (item) => {
  console.log('输入详情:', item)
  alert(`输入详情:\n${JSON.stringify(item.data, null, 2)}`)
}

// 查看输出详情
const viewOutputDetail = (item) => {
  console.log('输出详情:', item)
  alert(`输出详情:\n${JSON.stringify(item.data, null, 2)}`)
}

// 技能相关
const loadSkills = () => {
  // 从 localStorage 加载技能
  const stored = localStorage.getItem('agentSkills')
  if (stored) {
    const skillsMap = JSON.parse(stored)
    agentSkills.value = skillsMap[props.agentKey] || []
  }
  
  // 加载所有技能
  const allStored = localStorage.getItem('skills')
  if (allStored) {
    allSkills.value = JSON.parse(allStored)
  }
}

const addSkillToAgent = (skill) => {
  const stored = localStorage.getItem('agentSkills') || '{}'
  const skillsMap = JSON.parse(stored)
  if (!skillsMap[props.agentKey]) {
    skillsMap[props.agentKey] = []
  }
  
  // 检查是否已存在
  if (!skillsMap[props.agentKey].find(s => s.id === skill.id)) {
    skillsMap[props.agentKey].push(skill)
    localStorage.setItem('agentSkills', JSON.stringify(skillsMap))
    agentSkills.value = skillsMap[props.agentKey]
  }
}

const removeSkill = (skillId) => {
  const stored = localStorage.getItem('agentSkills') || '{}'
  const skillsMap = JSON.parse(stored)
  if (skillsMap[props.agentKey]) {
    skillsMap[props.agentKey] = skillsMap[props.agentKey].filter(s => s.id !== skillId)
    localStorage.setItem('agentSkills', JSON.stringify(skillsMap))
    agentSkills.value = skillsMap[props.agentKey]
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped>
.agent-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.agent-modal {
  background: white;
  border-radius: 12px;
  width: 900px;
  height: 700px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}

.close-btn:hover {
  color: #333;
}

.detail-tabs {
  display: flex;
  gap: 4px;
  padding: 0 20px;
  border-bottom: 1px solid #e8e8e8;
}

.tab-btn {
  padding: 12px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.3s;
}

.tab-btn:hover {
  color: #333;
}

.tab-btn.active {
  color: #667eea;
  border-bottom-color: #667eea;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.tab-pane {
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 配置面板 */
.config-pane {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.config-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.config-header h3 {
  margin: 0;
  font-size: 16px;
}

.hint {
  margin-left: 8px;
  font-size: 12px;
  color: #999;
}

.config-actions {
  display: flex;
  gap: 8px;
}

.btn-edit, .btn-save, .btn-cancel {
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-edit {
  background: #667eea;
  color: white;
  border: none;
}

.btn-save {
  background: #52c41a;
  color: white;
  border: none;
}

.btn-cancel {
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
}

/* 配置列表样式 */
.config-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-group {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
}

.group-title {
  font-size: 14px;
  font-weight: 600;
  color: #1890ff;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e8e8e8;
}

.config-row {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}

.config-row:last-child {
  border-bottom: none;
}

.config-label {
  width: 120px;
  flex-shrink: 0;
  color: #666;
  font-size: 13px;
}

.config-value {
  color: #333;
  font-size: 13px;
}

.config-input {
  flex: 1;
  max-width: 300px;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  transition: border-color 0.2s;
}

.config-input:focus {
  border-color: #1890ff;
  outline: none;
}

.config-input.small {
  width: 100px;
  max-width: 100px;
}

.config-select {
  flex: 1;
  max-width: 300px;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  background: white;
}

.input-with-unit {
  display: flex;
  align-items: center;
  gap: 8px;
}

.unit {
  color: #999;
  font-size: 13px;
}

/* 开关样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.switch input:checked + .slider {
  background-color: #52c41a;
}

.switch input:checked + .slider:before {
  transform: translateX(20px);
}

/* 标签列表 */
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  color: #1890ff;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
}

.tag small {
  color: #999;
}

/* 模型配置面板 */
.model-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.prompt-tip {
  color: #999;
  font-size: 13px;
  margin: 0 0 12px 0;
}

.prompt-textarea {
  width: 100%;
  width: 100%;
  padding: 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 13px;
  font-family: 'Consolas', 'Monaco', monospace;
  line-height: 1.6;
  resize: none;
}

.prompt-textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.prompt-text {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
  font-size: 12px;
  max-height: 150px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
  width: 100%;
  margin: 0;
}

/* 技能面板 */
.skills-pane {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skills-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.skills-header h3 {
  margin: 0;
}

.btn-add-skill {
  background: #667eea;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.skill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.skill-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 6px;
}

.skill-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.skill-item .skill-name {
  font-size: 13px;
}

.skill-item .skill-category {
  font-size: 11px;
  color: #999;
  background: #e8e8e8;
  padding: 2px 6px;
  border-radius: 3px;
}

.btn-remove-skill {
  background: #ff4d4f;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}

.divider {
  height: 1px;
  background: #e8e8e8;
  margin: 8px 0;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-btn {
  padding: 4px 10px;
  border: 1px solid #d9d9d9;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.filter-btn.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.available-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.available-skill-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.available-skill-item:hover {
  border-color: #667eea;
  background: #f0f5ff;
}

.available-skill-item .skill-name {
  font-size: 13px;
}

.available-skill-item .skill-category {
  font-size: 11px;
  color: #999;
}

.add-icon {
  color: #667eea;
  font-weight: bold;
}

/* 日志面板 */
.logs-pane .logs-content {
  max-height: 320px;
  overflow-y: auto;
  background: #1e1e1e;
  border-radius: 6px;
  padding: 12px;
}

.log-item {
  display: flex;
  gap: 12px;
  padding: 4px 0;
  font-family: monospace;
  font-size: 12px;
}

.log-item .log-time {
  color: #888;
}

.log-item .log-level {
  color: #4fc1ff;
  min-width: 50px;
}

.log-item.info .log-level { color: #4fc1ff; }
.log-item.warn .log-level { color: #faad14; }
.log-item.error .log-level { color: #ff4d4f; }

.log-item .log-msg {
  color: #d4d4d4;
}

.log-item .log-duration {
  color: #888;
  margin-left: auto;
}

/* 数据面板 */
.data-pane {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.data-stats-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-card {
  flex: 1;
  min-width: 80px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 6px;
  text-align: center;
}

.stat-card .stat-num {
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.stat-card .stat-label {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.stat-card.pending { background: #fff7e6; }
.stat-card.pending .stat-num { color: #fa8c16; }
.stat-card.processing { background: #e6f7ff; }
.stat-card.processing .stat-num { color: #1890ff; }
.stat-card.completed, .stat-card.success { background: #f6ffed; }
.stat-card.completed .stat-num, .stat-card.success .stat-num { color: #52c41a; }
.stat-card.failed { background: #fff1f0; }
.stat-card.failed .stat-num { color: #f5222d; }

.data-section {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
}

.data-pane .data-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.data-pane .data-header h4 {
  margin: 0;
  font-size: 14px;
}

.btn-refresh {
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th,
.data-table td {
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid #e8e8e8;
}

.data-table th {
  background: #fafafa;
  font-weight: 500;
}

.item-id {
  font-family: monospace;
  font-size: 11px;
  color: #999;
}

.item-status {
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
}

.item-status.pending { background: #fff7e6; color: #fa8c16; }
.item-status.processing { background: #e6f7ff; color: #1890ff; }
.item-status.completed { background: #f6ffed; color: #52c41a; }
.item-status.failed { background: #fff1f0; color: #f5222d; }

.item-summary {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-time {
  color: #999;
  font-size: 12px;
}

.btn-delete {
  background: #ff4d4f;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}

.btn-retry {
  background: #fa8c16;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  margin-right: 4px;
}

.btn-view {
  background: #1890ff;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}

.source-type, .output-type {
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  background: #f0f0f0;
  color: #666;
}

.empty-tip, .loading-tip {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
