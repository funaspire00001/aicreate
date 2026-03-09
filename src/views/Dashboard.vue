<template>
  <div class="dashboard">
    <h1>仪表盘</h1>
    
    <!-- 创作输入框 -->
    <div class="create-section">
      <div class="create-input-wrapper">
        <input 
          v-model="createTheme"
          type="text" 
          placeholder="输入卡片主题，如：12星座运势、10个冷笑话、新春祝福..."
          @keyup.enter="handleCreate"
          :disabled="creating"
        />
        <button @click="handleCreate" :disabled="creating || !createTheme.trim()">
          {{ creating ? '生成中...' : '创作' }}
        </button>
      </div>
      <div class="style-options">
        <label>模型：</label>
        <select v-model="createModel">
          <option value="ollama-qwen">Ollama Qwen3.5</option>
          <option value="doubao">豆包</option>
        </select>
        <label>风格：</label>
        <select v-model="createStyle">
          <option value="">默认</option>
          <option value="简约清新">简约清新</option>
          <option value="可爱卡通">可爱卡通</option>
          <option value="商务硬朗">商务硬朗</option>
          <option value="温馨浪漫">温馨浪漫</option>
          <option value="文艺复古">文艺复古</option>
        </select>
      </div>
      <div class="create-result" v-if="createResult">
        <div class="result-header">
          <span class="result-theme">{{ createResult.theme }}</span>
          <span class="result-status" :class="createResult.status">{{ createResult.status === 'DRAFT' ? '草稿' : createResult.status }}</span>
        </div>
        <div class="result-message">{{ createResult.message }}</div>
        <div class="result-actions" v-if="createResult.cardId">
          <a :href="`https://your-miniapp.com/card/${createResult.cardId}`" target="_blank">查看卡片</a>
        </div>
      </div>
      <div class="create-error" v-if="createError">
        {{ createError }}
      </div>
    </div>
    
    <!-- 实时处理状态 -->
    <div class="processing-status" :class="{ active: processingStatus.isProcessing }">
      <div class="status-header">
        <div class="status-indicator" :class="{ running: processingStatus.isProcessing }"></div>
        <span class="status-text">
          {{ processingStatus.isProcessing ? '正在处理中...' : '待机中' }}
        </span>
        <span class="update-time" v-if="processingStatus.lastUpdateTime">
          更新于 {{ formatTime(processingStatus.lastUpdateTime) }}
        </span>
      </div>
      
      <div class="status-content">
        <div class="status-item">
          <span class="label">待处理需求</span>
          <span class="value pending-count">{{ processingStatus.totalPending }}</span>
        </div>
        <div class="status-item">
          <span class="label">已处理</span>
          <span class="value">{{ processingStatus.processedCount }}</span>
        </div>
        <div class="status-item" v-if="processingStatus.currentFeedback">
          <span class="label">当前处理</span>
          <span class="value current">{{ processingStatus.currentFeedback.feedbackId }}</span>
        </div>
        <div class="status-item" v-if="processingStatus.currentStep">
          <span class="label">当前步骤</span>
          <span class="value step">{{ getStepText(processingStatus.currentStep) }}</span>
        </div>
      </div>

      <!-- 处理日志 -->
      <div class="logs-section" v-if="processingStatus.logs?.length > 0">
        <div class="logs-header" @click="showLogs = !showLogs">
          <span>处理日志 ({{ processingStatus.logs.length }})</span>
          <span class="toggle">{{ showLogs ? '收起' : '展开' }}</span>
        </div>
        <div class="logs-content" v-if="showLogs">
          <div class="log-item" v-for="(log, index) in processingStatus.logs.slice(-10).reverse()" :key="index" :class="log.type">
            <span class="log-time">{{ log.time }}</span>
            <span class="log-msg">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.today.requests }}</div>
        <div class="stat-label">今日需求</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ processingStatus.stats?.totalGenerated || 0 }}</div>
        <div class="stat-label">生成卡片</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ stats.knowledge.total }}</div>
        <div class="stat-label">知识点数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ processingStatus.stats?.todaySuccess || 0 }}</div>
        <div class="stat-label">今日成功</div>
      </div>
    </div>

    <!-- 最近需求 -->
    <div class="section">
      <h2>最近需求</h2>
      <div class="table-container">
        <table v-if="stats.recentRequests.length > 0">
          <thead>
            <tr>
              <th>时间</th>
              <th>需求</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="req in stats.recentRequests" :key="req.id">
              <td>{{ formatTime(req.createdAt) }}</td>
              <td>{{ req.requirement }}</td>
              <td>
                <span :class="['status', req.status]">{{ req.status }}</span>
              </td>
              <td>
                <router-link :to="`/requests/${req.id}`">查看</router-link>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty">暂无数据</div>
      </div>
    </div>

    <!-- 热门知识点 -->
    <div class="section">
      <h2>热门知识点</h2>
      <div class="knowledge-list" v-if="stats.hotKnowledge.length > 0">
        <div class="knowledge-item" v-for="item in stats.hotKnowledge" :key="item.id">
          <span class="subject">{{ item.subject }}</span>
          <span class="topic">{{ item.topic }}</span>
          <span class="count">使用 {{ item.usageCount }} 次</span>
        </div>
      </div>
      <div v-else class="empty">暂无数据</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { dashboardApi, statusApi } from '../api'

const stats = ref({
  today: { requests: 0, cards: 0, knowledgeUsed: 0 },
  knowledge: { total: 0 },
  weeklyTrend: [],
  agentStats: [],
  recentRequests: [],
  hotKnowledge: []
})

const processingStatus = ref({
  isProcessing: false,
  currentFeedback: null,
  currentStep: '',
  totalPending: 0,
  processedCount: 0,
  lastUpdateTime: null,
  logs: [],
  stats: {
    todayTotal: 0,
    todaySuccess: 0,
    todayFailed: 0,
    totalGenerated: 0,
    lastError: null
  }
})

const loading = ref(false)
const error = ref(null)
const showLogs = ref(false)

// 创作相关
const createTheme = ref('')
const createStyle = ref('')
const createModel = ref('ollama-qwen')  // 默认使用 Ollama
const creating = ref(false)
const createResult = ref(null)
const createError = ref(null)

let refreshInterval = null
let statusInterval = null

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const getStepText = (step) => {
  const stepMap = {
    'idle': '空闲',
    'fetching': '获取需求',
    'generating': '生成卡片',
    'publishing': '发布卡片',
    'updating': '更新状态',
    'error': '处理出错',
    'stopped': '已停止'
  }
  return stepMap[step] || step
}

const fetchDashboard = async () => {
  loading.value = true
  error.value = null
  
  try {
    const data = await dashboardApi.get()
    if (data.success) {
      stats.value = data.data
    }
  } catch (err) {
    console.error('获取仪表盘数据失败:', err)
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const fetchProcessingStatus = async () => {
  try {
    const data = await statusApi.scheduler()
    if (data.success) {
      processingStatus.value = data.data
    }
  } catch (err) {
    console.error('获取处理状态失败:', err)
  }
}

// 创作卡片
const handleCreate = async () => {
  if (!createTheme.value.trim() || creating.value) return
  
  creating.value = true
  createError.value = null
  createResult.value = null
  
  try {
    const data = await dashboardApi.createCard({
      theme: createTheme.value.trim(),
      style: createStyle.value,
      model: createModel.value
    })
    
    if (data.success) {
      createResult.value = data.data
      createTheme.value = ''
      // 刷新仪表盘数据
      fetchDashboard()
    } else {
      createError.value = data.message || '创作失败'
    }
  } catch (err) {
    console.error('创作卡片失败:', err)
    createError.value = err.message || '创作失败，请重试'
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  fetchDashboard()
  fetchProcessingStatus()
  
  // 每30秒刷新仪表盘
  refreshInterval = setInterval(fetchDashboard, 30000)
  // 每3秒刷新处理状态
  statusInterval = setInterval(fetchProcessingStatus, 3000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
  if (statusInterval) {
    clearInterval(statusInterval)
  }
})
</script>

<style scoped>
.dashboard {
  padding: 20px;
}

h1 {
  margin-bottom: 24px;
  color: #333;
}

/* 创作区域样式 */
.create-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3);
}

.create-input-wrapper {
  display: flex;
  gap: 12px;
}

.create-input-wrapper input {
  flex: 1;
  padding: 14px 20px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  outline: none;
  background: rgba(255, 255, 255, 0.95);
  transition: all 0.3s;
}

.create-input-wrapper input:focus {
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.3);
}

.create-input-wrapper input::placeholder {
  color: #999;
}

.create-input-wrapper button {
  padding: 14px 32px;
  background: white;
  color: #667eea;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
}

.create-input-wrapper button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.create-input-wrapper button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.style-options {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  color: white;
}

.style-options label {
  font-size: 14px;
  opacity: 0.9;
}

.style-options select {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.95);
  color: #333;
  cursor: pointer;
  outline: none;
}

.create-result {
  margin-top: 16px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  padding: 16px;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.result-theme {
  font-weight: 600;
  color: #333;
}

.result-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  background: #fff7e6;
  color: #fa8c16;
}

.result-status.PUBLISHED {
  background: #e6f7ee;
  color: #52c41a;
}

.result-message {
  font-size: 14px;
  color: #666;
}

.result-actions {
  margin-top: 12px;
}

.result-actions a {
  color: #667eea;
  font-size: 14px;
}

.create-error {
  margin-top: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  color: #f5222d;
  font-size: 14px;
}

/* 处理状态样式 */
.processing-status {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  border-left: 4px solid #999;
  transition: all 0.3s;
}

.processing-status.active {
  border-left-color: #52c41a;
  box-shadow: 0 4px 16px rgba(82, 196, 26, 0.15);
}

.status-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #999;
}

.status-indicator.running {
  background: #52c41a;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(82, 196, 26, 0); }
  100% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0); }
}

.status-text {
  font-weight: 500;
  color: #333;
}

.update-time {
  margin-left: auto;
  font-size: 12px;
  color: #999;
}

.status-content {
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-item .label {
  font-size: 12px;
  color: #999;
}

.status-item .value {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.status-item .value.pending-count {
  color: #fa8c16;
}

.status-item .value.current {
  font-size: 14px;
  font-family: monospace;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 4px;
}

.status-item .value.step {
  color: #667eea;
}

/* 日志样式 */
.logs-section {
  margin-top: 16px;
  border-top: 1px solid #eee;
  padding-top: 12px;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  cursor: pointer;
  font-size: 14px;
  color: #666;
}

.logs-header:hover {
  color: #667eea;
}

.toggle {
  font-size: 12px;
}

.logs-content {
  margin-top: 12px;
  max-height: 200px;
  overflow-y: auto;
  background: #f9f9f9;
  border-radius: 8px;
  padding: 12px;
}

.log-item {
  display: flex;
  gap: 12px;
  font-size: 12px;
  padding: 4px 0;
  font-family: monospace;
}

.log-item .log-time {
  color: #999;
}

.log-item .log-msg {
  color: #333;
}

.log-item.success .log-msg {
  color: #52c41a;
}

.log-item.error .log-msg {
  color: #f5222d;
}

.log-item.warn .log-msg {
  color: #fa8c16;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  color: white;
}

.stat-value {
  font-size: 36px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

.section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.section h2 {
  margin-bottom: 16px;
  font-size: 18px;
  color: #333;
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th {
  font-weight: 500;
  color: #666;
}

.status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
}

.status.success {
  background: #e6f7ee;
  color: #52c41a;
}

.status.pending {
  background: #fff7e6;
  color: #fa8c16;
}

.status.failed {
  background: #fff1f0;
  color: #f5222d;
}

.knowledge-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.knowledge-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
}

.knowledge-item .subject {
  background: #667eea;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.knowledge-item .topic {
  flex: 1;
  color: #333;
}

.knowledge-item .count {
  color: #999;
  font-size: 14px;
}

.empty {
  text-align: center;
  color: #999;
  padding: 40px;
}

a {
  color: #667eea;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
</style>
