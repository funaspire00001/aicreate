<template>
  <div class="monitor-page">
    <div class="page-header">
      <h1>执行监控</h1>
      <div class="header-actions">
        <select v-model="selectedWorkflowId" class="workflow-select" @change="onWorkflowChange">
          <option value="">选择工作流</option>
          <option v-for="wf in workflows" :key="wf.id" :value="wf.id">
            {{ wf.name }}
          </option>
        </select>
        <button @click="autoRun" class="run-btn" :disabled="isRunning" :class="{ running: isRunning }">
          {{ isRunning ? '⏳ 运行中...' : '▶ 开始运行' }}
        </button>
        <button @click="refreshAll" class="refresh-btn">🔄 刷新</button>
      </div>
    </div>

    <!-- 无工作流提示 -->
    <div v-if="!selectedWorkflowId" class="empty-state">
      <div class="empty-icon">📋</div>
      <p>请先选择一个工作流</p>
    </div>

    <!-- 无执行记录提示 -->
    <div v-else-if="!currentExecution" class="empty-state">
      <div class="empty-icon">🚀</div>
      <p>该工作流暂无执行记录</p>
      <button @click="startWorkflow" class="start-btn">启动工作流</button>
    </div>

    <!-- 流程图视图 -->
    <div v-else class="flowchart-view">
      <!-- 智能体节点流程 -->
      <div class="agent-flow">
        <!-- 需求管理节点（第一个） -->
        <div class="flow-node demand-node" @click="goToDemands">
          <div class="node-header">
            <span class="node-icon">📋</span>
            需求管理
          </div>
          <div class="demand-stats">
            <div class="stat-item">
              <span class="stat-value">{{ demandStats.total }}</span>
              <span class="stat-label">总需求</span>
            </div>
            <div class="stat-row">
              <span class="stat-dot pending"></span>
              <span class="stat-num">{{ demandStats.pending }}</span>
              <span class="stat-dot processing"></span>
              <span class="stat-num">{{ demandStats.processing }}</span>
              <span class="stat-dot completed"></span>
              <span class="stat-num">{{ demandStats.completed }}</span>
            </div>
          </div>
        </div>

        <template v-for="(step, index) in pipelineSteps" :key="index">
          <!-- 箭头 -->
          <div class="flow-arrow">
            <svg width="40" height="24" viewBox="0 0 40 24">
              <line x1="0" y1="12" x2="30" y2="12" stroke="#d9d9d9" stroke-width="2"/>
              <polygon points="30,6 40,12 30,18" :fill="getArrowColor(step, index)"/>
            </svg>
          </div>
          
          <!-- 智能体节点 -->
          <div :class="['flow-node', 'agent-node', step.status]" @click="showStepDetail(step, index)">
            <div class="node-status">
              <span v-if="step.status === 'success'" class="status-icon success">✓</span>
              <span v-else-if="step.status === 'running'" class="status-icon running">
                <span class="spinner"></span>
              </span>
              <span v-else-if="step.status === 'failed'" class="status-icon failed">✗</span>
              <span v-else class="status-icon pending">○</span>
            </div>
            
            <div class="node-header">
              <span class="step-num">{{ index + 1 }}</span>
              {{ step.name }}
            </div>
            
            <div class="node-agent">{{ step.agentName }}</div>
            
            <!-- 显示详细状态 -->
            <div class="node-detail-status" v-if="step.detailStatus">
              {{ step.detailStatus }}
            </div>
            
            <!-- 显示输出 -->
            <div class="node-output" v-if="step.output">
              {{ truncateOutput(step.output) }}
            </div>
            <!-- 显示错误 -->
            <div class="node-error" v-else-if="step.error">
              ❌ {{ truncate(step.error, 40) }}
            </div>
            <!-- 运行中 -->
            <div class="node-output loading" v-else-if="step.status === 'running'">
              处理中...
            </div>
          </div>
        </template>

        <!-- 最终箭头 -->
        <div class="flow-arrow">
          <svg width="40" height="24" viewBox="0 0 40 24">
            <line x1="0" y1="12" x2="30" y2="12" stroke="#d9d9d9" stroke-width="2"/>
            <polygon points="30,6 40,12 30,18" :fill="currentExecution.status === 'success' ? '#52c41a' : '#d9d9d9'"/>
          </svg>
        </div>

        <!-- 输出节点 -->
        <div class="flow-node output-node" :class="{ success: currentExecution.status === 'success' }">
          <div class="node-header">输出</div>
          <div class="node-body">
            <span v-if="currentExecution.output">{{ truncate(currentExecution.output, 80) }}</span>
            <span v-else class="pending">{{ currentExecution.status === 'running' ? '等待中...' : '-' }}</span>
          </div>
        </div>
      </div>

      <!-- 执行信息 -->
      <div class="execution-info">
        <div class="info-item">
          <span class="label">执行ID</span>
          <span class="value">{{ currentExecution.id?.slice(0, 8) }}</span>
        </div>
        <div class="info-item">
          <span class="label">开始时间</span>
          <span class="value">{{ formatTime(currentExecution.startTime) }}</span>
        </div>
        <div class="info-item" v-if="currentExecution.duration">
          <span class="label">耗时</span>
          <span class="value">{{ (currentExecution.duration / 1000).toFixed(1) }}s</span>
        </div>
        <div class="info-item">
          <span class="label">状态</span>
          <span :class="['status-tag', currentExecution.status]">{{ getStatusText(currentExecution.status) }}</span>
        </div>
      </div>

      <!-- 执行日志 -->
      <div class="execution-logs">
        <div class="logs-header">
          <h3>📋 执行日志</h3>
          <span class="logs-count">{{ logs.length }} 条</span>
        </div>
        <div class="logs-content" ref="logsContainer">
          <div v-if="logs.length === 0" class="logs-empty">
            暂无日志
          </div>
          <div v-for="(log, index) in logs" :key="index" :class="['log-item', log.level]">
            <span class="log-time">{{ formatLogTime(log.createdAt) }}</span>
            <span :class="['log-level', log.level]">{{ log.level.toUpperCase() }}</span>
            <span class="log-step" v-if="log.step > 0">[{{ log.stepName }}]</span>
            <span class="log-message">{{ log.message }}</span>
            <span class="log-duration" v-if="log.duration">{{ log.duration }}ms</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 步骤详情弹窗 -->
    <div v-if="showDetail" class="modal-overlay" @click.self="showDetail = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ currentStep.name }} - 详情</h2>
          <button class="close-btn" @click="showDetail = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="detail-row">
            <label>状态</label>
            <span :class="['status-badge', currentStep.status]">
              {{ getStatusText(currentStep.status) }}
            </span>
          </div>
          <div class="detail-row">
            <label>智能体</label>
            <span>{{ currentStep.agentName }}</span>
          </div>
          <div v-if="currentStep.input" class="detail-section">
            <label>输入</label>
            <pre class="code-block">{{ formatJson(currentStep.input) }}</pre>
          </div>
          <div v-if="currentStep.output" class="detail-section">
            <label>输出</label>
            <pre class="code-block">{{ formatJson(currentStep.output) }}</pre>
          </div>
          <div v-if="currentStep.error" class="detail-section error">
            <label>错误信息</label>
            <div class="error-text">{{ currentStep.error }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const API_URL = 'http://localhost:3001/api'

const workflows = ref([])
const selectedWorkflowId = ref('')
const currentExecution = ref(null)
const showDetail = ref(false)
const currentStep = ref({})
const demandStats = ref({ total: 0, pending: 0, processing: 0, completed: 0 })
const isRunning = ref(false)
const logs = ref([])
const logsContainer = ref(null)

let refreshTimer = null

// 获取执行日志
const fetchLogs = async () => {
  if (!currentExecution.value?.id) return
  
  try {
    const res = await fetch(`${API_URL}/workflows/execution/${currentExecution.value.id}/logs`)
    const data = await res.json()
    if (data.success) {
      logs.value = data.logs
      // 滚动到底部
      if (logsContainer.value) {
        logsContainer.value.scrollTop = logsContainer.value.scrollHeight
      }
    }
  } catch (err) {
    console.error('获取日志失败:', err)
  }
}

// 格式化日志时间
const formatLogTime = (time) => {
  if (!time) return ''
  return new Date(time).toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  })
}

// 自动运行：获取待处理或失败的需求并执行
const autoRun = async () => {
  if (!selectedWorkflowId.value || isRunning.value) return
  
  try {
    isRunning.value = true
    
    // 先获取待处理需求
    let res = await fetch(`${API_URL}/demands?status=pending&limit=1`)
    let data = await res.json()
    
    // 没有待处理的，获取失败的需求
    if (!data.success || data.demands.length === 0) {
      res = await fetch(`${API_URL}/demands?status=failed&limit=1`)
      data = await res.json()
    }
    
    // 还没有，获取处理中的（可能之前中断了）
    if (!data.success || data.demands.length === 0) {
      res = await fetch(`${API_URL}/demands?status=processing&limit=1`)
      data = await res.json()
    }
    
    if (!data.success || data.demands.length === 0) {
      alert('没有可处理的需求')
      isRunning.value = false
      return
    }
    
    const demand = data.demands[0]
    
    // 更新需求状态为处理中
    await fetch(`${API_URL}/demands/${demand.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'processing' })
    })
    
    // 执行工作流
    const execRes = await fetch(`${API_URL}/workflows/${selectedWorkflowId.value}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: demand.content || demand.theme,
        demandId: demand.id
      })
    })
    const execData = await execRes.json()
    
    if (execData.success) {
      // 立即刷新执行状态
      setTimeout(fetchCurrentExecution, 500)
    } else {
      alert('启动工作流失败: ' + execData.error)
    }
  } catch (err) {
    console.error('自动运行失败:', err)
    alert('运行失败: ' + err.message)
  } finally {
    setTimeout(() => {
      isRunning.value = false
    }, 2000)
  }
}

// 获取需求统计
const fetchDemandStats = async () => {
  try {
    const res = await fetch(`${API_URL}/demands/stats/overview`)
    const data = await res.json()
    if (data.success) {
      demandStats.value = data.stats
    }
  } catch (err) {
    console.error('获取需求统计失败:', err)
  }
}

// 跳转到需求管理
const goToDemands = () => {
  window.location.href = '/demands'
}

// 流水线步骤
const pipelineSteps = computed(() => {
  if (!currentExecution.value) return []
  
  const steps = currentExecution.value.steps || []
  const workflowSteps = currentExecution.value.workflowSteps || []
  
  return workflowSteps.map((ws, index) => {
    const execStep = steps.find(s => s.stepIndex === index) || {}
    return {
      ...ws,
      status: execStep.status || 'pending',
      input: execStep.input,
      output: execStep.output,
      error: execStep.error
    }
  })
})

const getArrowColor = (step, index) => {
  if (step.status === 'success' || step.status === 'running') {
    return '#667eea'
  }
  // 检查前一个步骤是否完成
  if (index > 0) {
    const prevStep = pipelineSteps.value[index - 1]
    if (prevStep.status === 'success') return '#667eea'
  }
  return '#d9d9d9'
}

const fetchWorkflows = async () => {
  try {
    const res = await fetch(`${API_URL}/workflows`)
    const data = await res.json()
    if (data.success) {
      workflows.value = data.workflows
      if (workflows.value.length > 0 && !selectedWorkflowId.value) {
        selectedWorkflowId.value = workflows.value[0].id
        fetchCurrentExecution()
      }
    }
  } catch (err) {
    console.error('获取工作流列表失败:', err)
  }
}

const fetchCurrentExecution = async () => {
  if (!selectedWorkflowId.value) return
  
  try {
    let res = await fetch(`${API_URL}/workflows/${selectedWorkflowId.value}/executions/running`)
    let data = await res.json()
    
    if (data.success && data.executions.length > 0) {
      const exec = data.executions[0]
      const wf = workflows.value.find(w => w.id === selectedWorkflowId.value)
      currentExecution.value = {
        ...exec,
        workflowSteps: wf?.steps || []
      }
      fetchLogs()
      return
    }
    
    res = await fetch(`${API_URL}/workflows/${selectedWorkflowId.value}/executions?limit=1`)
    data = await res.json()
    
    if (data.success && data.executions.length > 0) {
      const exec = data.executions[0]
      const wf = workflows.value.find(w => w.id === selectedWorkflowId.value)
      currentExecution.value = {
        ...exec,
        workflowSteps: wf?.steps || []
      }
      fetchLogs()
    } else {
      currentExecution.value = null
      logs.value = []
    }
  } catch (err) {
    console.error('获取执行记录失败:', err)
  }
}

const onWorkflowChange = () => {
  currentExecution.value = null
  fetchCurrentExecution()
}

const refreshAll = () => {
  fetchDemandStats()
  fetchWorkflows()
  if (selectedWorkflowId.value) {
    fetchCurrentExecution()
  }
}

const startWorkflow = async () => {
  if (!selectedWorkflowId.value) return
  
  try {
    const res = await fetch(`${API_URL}/workflows/${selectedWorkflowId.value}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: '测试输入：请生成关于Vue3响应式原理的知识卡片'
      })
    })
    const data = await res.json()
    if (data.success) {
      setTimeout(fetchCurrentExecution, 500)
    }
  } catch (err) {
    console.error('启动工作流失败:', err)
  }
}

const showStepDetail = (step, index) => {
  currentStep.value = { ...step, stepIndex: index }
  showDetail.value = true
}

const truncate = (text, maxLen) => {
  if (!text) return '-'
  const str = typeof text === 'object' ? JSON.stringify(text) : String(text)
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str
}

const truncateOutput = (output) => {
  if (!output) return ''
  let str = typeof output === 'object' ? JSON.stringify(output) : String(output)
  if (str.length > 60) return str.slice(0, 60) + '...'
  return str
}

const formatJson = (data) => {
  if (!data) return '-'
  if (typeof data === 'object') return JSON.stringify(data, null, 2)
  try {
    return JSON.stringify(JSON.parse(data), null, 2)
  } catch {
    return data
  }
}

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleTimeString('zh-CN')
}

const getStatusText = (status) => {
  const map = {
    pending: '等待中',
    running: '执行中',
    success: '已完成',
    failed: '失败'
  }
  return map[status] || status
}

onMounted(() => {
  fetchDemandStats()
  fetchWorkflows()
  refreshTimer = setInterval(() => {
    fetchDemandStats()
    if (selectedWorkflowId.value) {
      fetchCurrentExecution()
    }
  }, 3000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.monitor-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.workflow-select {
  padding: 8px 16px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
  min-width: 200px;
}

.refresh-btn {
  padding: 8px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.run-btn {
  padding: 8px 20px;
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s;
}

.run-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(82, 196, 26, 0.4);
}

.run-btn:disabled {
  background: #d9d9d9;
  cursor: not-allowed;
}

.run-btn.running {
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.start-btn {
  margin-top: 16px;
  padding: 10px 24px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

/* 流程图视图 */
.flowchart-view {
  background: white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

/* 输入节点 */
.input-node {
  background: linear-gradient(135deg, #f6f8fc 0%, #eef1f5 100%);
  border: 2px solid #d9d9d9;
  margin-bottom: 24px;
}

/* 需求管理节点 */
.demand-node {
  background: linear-gradient(135deg, #f0f5ff 0%, #e6f0ff 100%);
  border: 2px solid #667eea;
  cursor: pointer;
  min-width: 160px;
}

.demand-node:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
}

.demand-node .node-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.node-icon {
  font-size: 16px;
}

.demand-stats {
  text-align: center;
}

.stat-item {
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #667eea;
}

.stat-label {
  font-size: 11px;
  color: #999;
  margin-left: 4px;
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.stat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.stat-dot.pending {
  background: #faad14;
}

.stat-dot.processing {
  background: #1890ff;
}

.stat-dot.completed {
  background: #52c41a;
}

.stat-num {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  min-width: 16px;
}

/* 智能体流程 */
.agent-flow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 20px 0;
  overflow-x: auto;
}

/* 流程节点 */
.flow-node {
  min-width: 140px;
  max-width: 180px;
  background: white;
  border-radius: 12px;
  padding: 16px;
  position: relative;
  border: 2px solid #e8e8e8;
  transition: all 0.3s;
}

.flow-node.agent-node {
  cursor: pointer;
}

.flow-node.agent-node:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.2);
}

/* 节点状态 */
.node-status {
  position: absolute;
  top: -12px;
  right: -8px;
}

.status-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.status-icon.success {
  background: #52c41a;
  color: white;
}

.status-icon.running {
  background: #1890ff;
  color: white;
}

.status-icon.failed {
  background: #ff4d4f;
  color: white;
}

.status-icon.pending {
  background: #d9d9d9;
  color: white;
}

.spinner {
  width: 10px;
  height: 10px;
  border: 2px solid white;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 节点头部 */
.node-header {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.step-num {
  display: inline-block;
  width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  background: #667eea;
  color: white;
  border-radius: 50%;
  font-size: 11px;
  margin-right: 6px;
}

.node-agent {
  font-size: 11px;
  color: #999;
  margin-bottom: 10px;
}

.node-body {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

.node-body .pending {
  color: #999;
  font-style: italic;
}

/* 节点输出 */
.node-output {
  background: #f9f9f9;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 11px;
  color: #666;
  max-height: 48px;
  overflow: hidden;
  border: 1px solid #f0f0f0;
}

.node-output.loading {
  color: #1890ff;
  font-style: italic;
}

/* 详细状态 */
.node-detail-status {
  background: #e6f7ff;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 10px;
  color: #1890ff;
  margin-bottom: 6px;
  text-align: center;
}

.agent-node.success .node-detail-status {
  background: #f6ffed;
  color: #52c41a;
}

.agent-node.failed .node-detail-status {
  background: #fff2f0;
  color: #ff4d4f;
}

/* 节点错误 */
.node-error {
  background: #fff2f0;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 11px;
  color: #ff4d4f;
  max-height: 48px;
  overflow: hidden;
  border: 1px solid #ffccc7;
}

/* 状态样式 */
.agent-node.success {
  border-color: #b7eb8f;
  background: linear-gradient(135deg, #f6ffed 0%, #e6ffdb 100%);
}

.agent-node.running {
  border-color: #69c0ff;
  background: linear-gradient(135deg, #e6f7ff 0%, #d6efff 100%);
  animation: pulse 2s infinite;
}

.agent-node.failed {
  border-color: #ff7875;
  background: linear-gradient(135deg, #fff2f0 0%, #ffebe8 100%);
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(24, 144, 255, 0.4); }
  50% { box-shadow: 0 0 0 10px rgba(24, 144, 255, 0); }
}

/* 输出节点 */
.output-node {
  background: linear-gradient(135deg, #f6f8fc 0%, #eef1f5 100%);
  border: 2px solid #d9d9d9;
}

.output-node.success {
  background: linear-gradient(135deg, #f6ffed 0%, #e6ffdb 100%);
  border-color: #b7eb8f;
}

/* 箭头 */
.flow-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 4px;
}

/* 执行信息 */
.execution-info {
  display: flex;
  justify-content: center;
  gap: 32px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-item .label {
  font-size: 12px;
  color: #999;
}

.info-item .value {
  font-size: 13px;
  color: #333;
}

.status-tag {
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
}

.status-tag.success { background: #f6ffed; color: #52c41a; }
.status-tag.running { background: #e6f7ff; color: #1890ff; }
.status-tag.failed { background: #fff2f0; color: #ff4d4f; }
.status-tag.pending { background: #f5f5f5; color: #999; }

/* 弹窗 */
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

.modal-content {
  width: 600px;
  max-height: 80vh;
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}

.modal-body {
  padding: 20px;
  max-height: 60vh;
  overflow-y: auto;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.detail-row label {
  min-width: 60px;
  color: #999;
  font-size: 13px;
}

.detail-section {
  margin-bottom: 16px;
}

.detail-section label {
  display: block;
  margin-bottom: 8px;
  color: #999;
  font-size: 13px;
}

.detail-section.error label {
  color: #ff4d4f;
}

.code-block {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 12px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-text {
  background: #fff2f0;
  padding: 12px;
  border-radius: 6px;
  color: #ff4d4f;
  font-size: 13px;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
}

.status-badge.success { background: #f0fff4; color: #52c41a; }
.status-badge.running { background: #e6f7ff; color: #1890ff; }
.status-badge.failed { background: #fff2f0; color: #ff4d4f; }
.status-badge.pending { background: #f5f5f5; color: #999; }

/* 执行日志 */
.execution-logs {
  margin-top: 24px;
  border-top: 1px solid #f0f0f0;
  padding-top: 20px;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.logs-header h3 {
  margin: 0;
  font-size: 14px;
  color: #333;
}

.logs-count {
  font-size: 12px;
  color: #999;
}

.logs-content {
  background: #1e1e1e;
  border-radius: 8px;
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
}

.logs-empty {
  color: #666;
  text-align: center;
  padding: 20px;
}

.log-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  color: #d4d4d4;
  border-bottom: 1px solid #333;
}

.log-item:last-child {
  border-bottom: none;
}

.log-time {
  color: #6a9955;
  white-space: nowrap;
}

.log-level {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

.log-level.info { background: #264f78; color: #9cdcfe; }
.log-level.warn { background: #6a4f1e; color: #dcdcaa; }
.log-level.error { background: #5a1d1d; color: #f48771; }
.log-level.debug { background: #333; color: #888; }

.log-step {
  color: #569cd6;
  white-space: nowrap;
}

.log-message {
  flex: 1;
  word-break: break-all;
}

.log-duration {
  color: #b5cea8;
  font-size: 11px;
  white-space: nowrap;
}
</style>
