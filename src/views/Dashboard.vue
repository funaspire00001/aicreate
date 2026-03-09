<template>
  <div class="dashboard">
    <h1>仪表盘</h1>
    
    <!-- 左右布局 -->
    <div class="dashboard-layout">
      
      <!-- 左侧：创作和日志 -->
      <div class="left-panel">
        
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
          
          <!-- 生成结果 -->
          <div class="create-result" v-if="createResult">
            <div class="result-header">
              <span class="result-theme">{{ createResult.theme }}</span>
              <span class="result-status success">生成成功</span>
            </div>
            <div class="result-info">
              卡片ID: {{ createResult.cardId }} | 耗时: {{ createResult.totalDuration }}ms
            </div>
            
            <!-- 步骤详情 -->
            <div class="steps-detail" v-if="createResult.steps && createResult.steps.length > 0">
              <div class="steps-title">生成步骤</div>
              <div class="step-item" v-for="step in createResult.steps" :key="step.step" :class="{ success: step.success, failed: !step.success }">
                <div class="step-header">
                  <span class="step-num">步骤{{ step.step }}</span>
                  <span class="step-name">{{ step.name }}</span>
                  <span class="step-duration">{{ step.duration }}ms</span>
                  <span class="step-status">{{ step.success ? '✓' : '✗' }}</span>
                </div>
                <div class="step-io" v-if="step.input || step.output">
                  <div class="step-input" v-if="step.input">
                    <div class="io-label">输入：</div>
                    <pre>{{ typeof step.input === 'object' ? JSON.stringify(step.input, null, 2) : step.input }}</pre>
                  </div>
                  <div class="step-output" v-if="step.output">
                    <div class="io-label">输出：</div>
                    <pre>{{ JSON.stringify(step.output, null, 2) }}</pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="create-error" v-if="createError">
            {{ createError }}
          </div>
        </div>
        
        <!-- 实时状态 -->
        <div class="processing-status" :class="{ active: processingStatus.isProcessing }">
          <div class="status-header">
            <div class="status-indicator" :class="{ running: processingStatus.isProcessing }"></div>
            <span class="status-text">
              {{ processingStatus.isProcessing ? '正在处理中...' : '待机中' }}
            </span>
          </div>
          <div class="status-content">
            <div class="status-item">
              <span class="label">待处理</span>
              <span class="value pending-count">{{ processingStatus.totalPending }}</span>
            </div>
            <div class="status-item">
              <span class="label">已处理</span>
              <span class="value">{{ processingStatus.processedCount }}</span>
            </div>
          </div>
        </div>
        
        <!-- 处理日志 -->
        <div class="logs-section">
          <div class="logs-header">
            <span>处理日志</span>
            <span class="logs-count">{{ filteredLogs.length }} 条</span>
          </div>
          <div class="logs-content">
            <div class="log-item" v-for="(log, index) in filteredLogs.slice(-50).reverse()" :key="index" :class="log.type">
              <span class="log-time">{{ log.time }}</span>
              <span class="log-type" v-if="log.type">{{ log.type }}</span>
              <span class="log-msg">{{ log.message || log }}</span>
            </div>
            <div v-if="filteredLogs.length === 0" class="logs-empty">
              暂无日志
            </div>
          </div>
        </div>
        
      </div>
      
      <!-- 右侧：统计 -->
      <div class="right-panel">
        
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
                </tr>
              </thead>
              <tbody>
                <tr v-for="req in stats.recentRequests" :key="req.id">
                  <td>{{ formatTime(req.createdAt) }}</td>
                  <td>{{ req.requirement }}</td>
                  <td>
                    <span :class="['status', req.status]">{{ req.status }}</span>
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
      
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
  
// 过滤空的日志
const filteredLogs = computed(() => {
  if (!processingStatus.value.logs) return []
  return processingStatus.value.logs.filter(log => {
    // 过滤掉空内容和没有意义的日志
    const msg = log.message || log
    return msg && msg.trim() && !msg.includes('没有待处理的反馈')
  })
})

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
      createResult.value = data
      createTheme.value = ''
      // 刷新仪表盘数据
      fetchDashboard()
    } else {
      createError.value = data.error || data.message || '创作失败'
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
  max-width: 1400px;
  margin: 0 auto;
}

h1 {
  margin-bottom: 24px;
  color: #333;
}

/* 左右布局 */
.dashboard-layout {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.left-panel {
  flex: 1;
  min-width: 0;
}

.right-panel {
  width: 380px;
  flex-shrink: 0;
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
  opacity: 0.7;
  cursor: not-allowed;
}

.style-options {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
  flex-wrap: wrap;
}

.style-options label {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}

.style-options select {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.95);
  cursor: pointer;
  min-width: 120px;
}

/* 生成结果样式 */
.create-result {
  margin-top: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.result-theme {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.result-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.result-status.success {
  background: #e6f7ee;
  color: #52c41a;
}

.result-info {
  font-size: 12px;
  color: #666;
  margin-bottom: 12px;
}

/* 步骤详情样式 */
.steps-detail {
  margin-top: 16px;
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
}

.steps-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  font-size: 14px;
}

.step-item {
  padding: 12px;
  background: #fff;
  border-radius: 6px;
  margin-bottom: 8px;
  border-left: 3px solid #52c41a;
}

.step-item.failed {
  border-left-color: #f5222d;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.step-num {
  background: #667eea;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.step-name {
  font-weight: 500;
  color: #333;
}

.step-duration {
  color: #999;
  font-size: 12px;
}

.step-status {
  margin-left: auto;
  font-size: 14px;
}

.step-item.success .step-status {
  color: #52c41a;
}

.step-item.failed .step-status {
  color: #f5222d;
}

.step-io {
  margin-top: 10px;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
}

.io-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.step-input, .step-output {
  margin-bottom: 8px;
}

.step-input:last-child, .step-output:last-child {
  margin-bottom: 0;
}

.step-io pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 11px;
  color: #333;
  max-height: 150px;
  overflow-y: auto;
}

.create-error {
  margin-top: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  color: #f5222d;
  font-size: 14px;
}

/* 日志区域样式 */
.logs-section {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  font-weight: 600;
  color: #333;
}

.logs-count {
  font-size: 12px;
  color: #999;
  font-weight: normal;
}

.logs-content {
  max-height: 500px;
  overflow-y: auto;
  background: #f9f9f9;
  border-radius: 8px;
  padding: 12px;
}

.log-item {
  display: flex;
  gap: 12px;
  font-size: 13px;
  padding: 8px 0;
  font-family: 'Monaco', 'Menlo', monospace;
  border-bottom: 1px solid #eee;
}

.log-item:last-child {
  border-bottom: none;
}

.log-time {
  color: #999;
  font-size: 12px;
  min-width: 70px;
}

.log-type {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  background: #e6f7ff;
  color: #1890ff;
  min-width: 40px;
  text-align: center;
}

.log-item.success .log-type {
  background: #e6f7ee;
  color: #52c41a;
}

.log-item.error .log-type {
  background: #fff1f0;
  color: #f5222d;
}

.log-msg {
  flex: 1;
  color: #333;
  word-break: break-all;
}

.log-item.success .log-msg {
  color: #52c41a;
}

.log-item.error .log-msg {
  color: #f5222d;
}

.logs-empty {
  text-align: center;
  color: #999;
  padding: 40px;
}

/* 右侧处理状态样式 */
.processing-status {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
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
  margin-bottom: 12px;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #999;
}

.status-indicator.running {
  background: #52c41a;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(82, 196, 26, 0); }
  100% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0); }
}

.status-text {
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.status-content {
  display: flex;
  gap: 24px;
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
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.status-item .value.pending-count {
  color: #fa8c16;
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  color: white;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  opacity: 0.9;
}

.section {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.section h2 {
  margin-bottom: 12px;
  font-size: 14px;
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
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #eee;
  font-size: 12px;
}

th {
  font-weight: 500;
  color: #666;
}

.status {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
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
  gap: 8px;
}

.knowledge-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: #f9f9f9;
  border-radius: 6px;
  font-size: 12px;
}

.knowledge-item .subject {
  background: #667eea;
  color: white;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
}

.knowledge-item .topic {
  flex: 1;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.knowledge-item .count {
  color: #999;
  font-size: 11px;
}

.empty {
  text-align: center;
  color: #999;
  padding: 20px;
  font-size: 12px;
}

/* 响应式布局 */
@media (max-width: 1024px) {
  .dashboard-layout {
    flex-direction: column;
  }
  
  .right-panel {
    width: 100%;
  }
  
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
