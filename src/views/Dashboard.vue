<template>
  <div class="dashboard">
    <!-- 上方：状态信息区 -->
    <div class="status-section">
      <div class="section-header">
        <h1>仪表盘</h1>
        <div class="backend-status" :class="backendStatus">
          <span class="status-dot"></span>
          <span class="status-text">
            {{ backendStatus === 'connected' ? '后端已连接' : backendStatus === 'disconnected' ? '后端未连接' : '检测中...' }}
          </span>
        </div>
      </div>
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-value">{{ demandStats.total }}</span>
          <span class="stat-label">需求总数</span>
        </div>
        <div class="stat-item">
          <span class="stat-value pending">{{ demandStats.pending }}</span>
          <span class="stat-label">待处理</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.knowledge?.total || 0 }}</span>
          <span class="stat-label">知识点</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.today?.cards || 0 }}</span>
          <span class="stat-label">今日卡片</span>
        </div>
      </div>
      <!-- 最近活动 -->
      <div class="recent-activities" v-if="stats.recentRequests?.length > 0">
        <div class="activity-item" v-for="req in stats.recentRequests.slice(0, 3)" :key="req.id">
          <span class="activity-time">{{ formatTime(req.createdAt) }}</span>
          <span class="activity-content">{{ req.requirement }}</span>
          <span :class="['activity-status', req.status]">{{ req.status }}</span>
        </div>
      </div>
    </div>

    <!-- 下方：工作流监控区 -->
    <div class="workflow-section">
      <div class="section-header">
        <h2>工作流执行监控</h2>
        <div class="workflow-controls">
          <select v-model="selectedWorkflowId" class="workflow-select" @change="onWorkflowChange">
            <option value="">选择工作流</option>
            <option v-for="wf in workflows" :key="wf.id" :value="wf.id">{{ wf.name }}</option>
          </select>
          <button @click="autoRun" class="run-btn" :disabled="isRunning" :class="{ running: isRunning }">
            {{ isRunning ? '运行中...' : '开始运行' }}
          </button>
        </div>
      </div>

      <div class="exec-info" v-if="currentExecution">
        <span class="exec-id">ID: {{ currentExecution.id?.slice(0, 8) }}</span>
        <span class="exec-time">{{ formatTime(currentExecution.startTime) }}</span>
        <span :class="['exec-status', currentExecution.status]">{{ getStatusText(currentExecution.status) }}</span>
      </div>

      <!-- 流程图视图 -->
      <div class="flowchart-view">
        <div class="agent-flow">
          <!-- 需求管理节点 -->
          <div :class="['flow-node demand-node', { selected: selectedAgentKey === 'demand' }]" 
               @click="selectAgent('demand')">
            <div class="node-status">
              <span class="status-icon" :class="demandStats.total > 0 ? 'success' : 'pending'">
                {{ demandStats.total > 0 ? '✓' : '○' }}
              </span>
            </div>
            <div class="node-header">
              <span class="node-icon">📋</span>
              需求管理
            </div>
            <div class="demand-stats">
              <div class="stat-total">{{ demandStats.total }}</div>
              <div class="stat-detail">
                <span class="pending">待{{ demandStats.pending }}</span>
                <span class="processing">处理中{{ demandStats.processing }}</span>
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
            <div :class="['flow-node', 'agent-node', step.status, { selected: selectedAgentKey === step.key }]" 
                 @click="selectAgent(step.key)">
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
              
              <!-- 数据统计 -->
              <div class="node-stats">
                <span class="stat" v-if="step.stats?.total !== undefined">
                  总计: {{ step.stats.total }}
                </span>
                <span class="stat pending" v-if="step.stats?.unconsumed">
                  待处理: {{ step.stats.unconsumed }}
                </span>
                <span class="stat" v-if="step.stats?.totalCards">
                  卡片: {{ step.stats.totalCards }}
                </span>
              </div>
              
              <div class="node-current" v-if="step.currentTask && step.status === 'running'">
                {{ step.currentTask }}
              </div>
              <div class="node-error" v-if="step.status === 'failed'">
                执行失败
              </div>
            </div>
          </template>

          <!-- 最终箭头 -->
          <div class="flow-arrow">
            <svg width="40" height="24" viewBox="0 0 40 24">
              <line x1="0" y1="12" x2="30" y2="12" stroke="#d9d9d9" stroke-width="2"/>
              <polygon points="30,6 40,12 30,18" :fill="currentExecution?.status === 'success' ? '#52c41a' : '#d9d9d9'"/>
            </svg>
          </div>

          <!-- 输出节点 -->
          <div :class="['flow-node output-node', { selected: selectedAgentKey === 'output', success: demandStats.completed > 0 }]" 
               @click="selectAgent('output')">
            <div class="node-status">
              <span class="status-icon" :class="demandStats.completed > 0 ? 'success' : 'pending'">
                {{ demandStats.completed > 0 ? '✓' : '○' }}
              </span>
            </div>
            <div class="node-header">
              <span class="node-icon">📤</span>
              完成输出
            </div>
            <div class="demand-stats">
              <div class="stat-total">{{ demandStats.completed }}</div>
              <div class="stat-detail">
                <span class="completed">已完成</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 智能体详情弹窗 -->
      <AgentDetailModal 
        v-if="selectedAgentKey" 
        :agentKey="selectedAgentKey"
        :agentName="getAgentDisplayName(selectedAgentKey)"
        @close="selectedAgentKey = ''"
        @update="fetchAgentStats"
      />
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
            <span :class="['status-badge', currentStep.status]">{{ getStatusText(currentStep.status) }}</span>
          </div>
          <div class="detail-row" v-if="currentStep.detailStatus">
            <label>详情</label>
            <span>{{ currentStep.detailStatus }}</span>
          </div>
          <div class="detail-row" v-if="currentStep.duration">
            <label>耗时</label>
            <span>{{ currentStep.duration }}ms</span>
          </div>
          <div class="detail-section" v-if="currentStep.input">
            <label>输入</label>
            <pre class="code-block">{{ currentStep.input }}</pre>
          </div>
          <div class="detail-section" v-if="currentStep.output">
            <label>输出</label>
            <pre class="code-block">{{ formatJson(currentStep.output) }}</pre>
          </div>
          <div class="detail-section error" v-if="currentStep.error">
            <label>错误信息</label>
            <div class="error-text">{{ currentStep.error }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { dashboardApi, statusApi } from '../api'
import AgentDetailModal from '../components/AgentDetailModal.vue'

const API_URL = 'http://localhost:3001/api'

// 状态
const backendStatus = ref('checking')
const workflows = ref([])
const selectedWorkflowId = ref('')
const currentExecution = ref(null)
const showDetail = ref(false)
const currentStep = ref({})
const demandStats = ref({ total: 0, pending: 0, processing: 0, completed: 0 })
const isRunning = ref(false)
const logs = ref([])
const logsContainer = ref(null)
const stats = ref({
  today: { requests: 0, cards: 0 },
  knowledge: { total: 0 },
  recentRequests: []
})

// 智能体独立状态
const agentStatus = ref({
  organizer: { status: 'idle', currentTask: null, lastRun: null },
  architect: { status: 'idle', currentTask: null, lastRun: null },
  planner: { status: 'idle', currentTask: null, lastRun: null },
  generator: { status: 'idle', currentTask: null, lastRun: null }
})

// 智能体数据统计
const agentStats = ref({
  organizer: { total: 0, completed: 0, unconsumed: 0 },
  architect: { total: 0, completed: 0, unconsumed: 0 },
  planner: { total: 0, completed: 0, unconsumed: 0, totalCards: 0 },
  generator: { totalCards: 0, pending: 0 }
})

// 当前选中的智能体（用于筛选日志）
const selectedAgentKey = ref('')
const activeTab = ref('config') // config, logs, data
const agentDetail = ref({})
const isEditing = ref(false)
const editForm = ref({})
const availableModels = ref([])
const dataList = ref([])
const dataLoading = ref(false)

let refreshTimer = null

// 流水线步骤 - 基于智能体实时状态和统计数据
const pipelineSteps = computed(() => {
  const agents = [
    { key: 'organizer', name: '信息整理', agentName: '信息整理智能体', dataLabel: '关键点' },
    { key: 'architect', name: '知识树构建', agentName: '知识树构建智能体', dataLabel: '知识树' },
    { key: 'planner', name: '卡片规划', agentName: '卡片规划智能体', dataLabel: '规划' },
    { key: 'generator', name: '卡片生成', agentName: '卡片生成智能体', dataLabel: '卡片' }
  ]
  
  return agents.map(agent => {
    const status = agentStatus.value[agent.key]
    const stats = agentStats.value[agent.key]
    const stepStatus = status.status === 'running' ? 'running' :
                       status.status === 'failed' ? 'failed' :
                       status.status === 'idle' && status.lastRun ? 'success' : 'pending'
    
    return {
      ...agent,
      status: stepStatus,
      currentTask: status.currentTask,
      lastRun: status.lastRun,
      stats: stats
    }
  })
})

const getArrowColor = (step, index) => {
  if (step.status === 'success' || step.status === 'running') return '#667eea'
  if (index > 0) {
    const prevStep = pipelineSteps.value[index - 1]
    if (prevStep.status === 'success') return '#667eea'
  }
  return '#d9d9d9'
}

// 添加日志
const addLog = (level, message, data = {}) => {
  const now = new Date()
  logs.value.push({
    time: now.toTimeString().slice(0, 8),
    level: level.toUpperCase(),
    message,
    ...data
  })
  // 滚动到底部
  nextTick(() => {
    if (logsContainer.value) {
      logsContainer.value.scrollTop = logsContainer.value.scrollHeight
    }
  })
}

// 自动运行：启动需求处理
const autoRun = async () => {
  if (!selectedWorkflowId.value || isRunning.value) return
  
  try {
    isRunning.value = true
    addLog('info', '查找可执行的需求...')
    
    // 获取待处理需求
    let res = await fetch(`${API_URL}/demands?status=pending&limit=1`)
    let data = await res.json()
    
    if (!data.success || data.demands.length === 0) {
      res = await fetch(`${API_URL}/demands?status=failed&limit=1`)
      data = await res.json()
    }
    
    if (!data.success || data.demands.length === 0) {
      res = await fetch(`${API_URL}/demands?status=processing&limit=1`)
      data = await res.json()
      
      if (data.success && data.demands.length > 0) {
        addLog('info', `已有正在处理的需求: ${data.demands[0].theme}`)
        currentExecution.value = data.demands[0]
        fetchExecutionLogs(data.demands[0].id)
        return
      }
    }
    
    if (!data.success || data.demands.length === 0) {
      addLog('warn', '没有可执行的需求')
      return
    }
    
    const demand = data.demands[0]
    addLog('info', `启动需求处理: ${demand.theme}`)
    
    // 调用启动API（调度器会自动接管）
    res = await fetch(`${API_URL}/demands/${demand.id}/start`, {
      method: 'POST'
    })
    data = await res.json()
    
    if (data.success) {
      addLog('info', '需求已启动，调度器将自动处理')
      currentExecution.value = data.demand
      fetchDemandStats()
    } else {
      addLog('error', data.error || '启动失败')
    }
  } catch (err) {
    addLog('error', `启动失败: ${err.message}`)
  } finally {
    isRunning.value = false
  }
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
    console.error('获取工作流失败:', err)
  }
}

const fetchCurrentExecution = async () => {
  if (!selectedWorkflowId.value) return
  
  try {
    let res = await fetch(`${API_URL}/workflows/executions/running`)
    let data = await res.json()
    
    if (data.success && data.executions.length > 0) {
      const exec = data.executions[0]
      const wf = workflows.value.find(w => w.id === selectedWorkflowId.value)
      currentExecution.value = { ...exec, workflowSteps: wf?.steps || [] }
      return
    }
    
    res = await fetch(`${API_URL}/workflows/${selectedWorkflowId.value}/executions?limit=1`)
    data = await res.json()
    
    if (data.success && data.executions.length > 0) {
      const exec = data.executions[0]
      const wf = workflows.value.find(w => w.id === selectedWorkflowId.value)
      currentExecution.value = { ...exec, workflowSteps: wf?.steps || [] }
    }
  } catch (err) {
    console.error('获取执行记录失败:', err)
  }
}

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

const fetchDashboardStats = async () => {
  try {
    const data = await dashboardApi.get()
    if (data.success) {
      stats.value = data.data
    }
  } catch (err) {
    console.error('获取统计数据失败:', err)
  }
}

const checkBackendHealth = async () => {
  try {
    const response = await statusApi.health()
    backendStatus.value = response.success ? 'connected' : 'disconnected'
  } catch (err) {
    backendStatus.value = 'disconnected'
  }
}

// 获取需求执行日志
const fetchExecutionLogs = async (demandId) => {
  if (!demandId) return
  
  try {
    const res = await fetch(`${API_URL}/demands/${demandId}/execution`)
    const data = await res.json()
    if (data.success && data.execution) {
      // 更新当前执行状态
      currentExecution.value = data.execution.demand
      
      // 更新日志
      if (data.execution.logs) {
        logs.value = data.execution.logs.map(log => ({
          time: new Date(log.createdAt).toTimeString().slice(0, 8),
          level: log.level,
          message: log.message,
          stepName: log.stepName,
          duration: log.duration
        }))
      }
    }
  } catch (err) {
    console.error('获取执行详情失败:', err)
  }
}

const fetchLogs = async () => {
  if (!currentExecution.value?.id) return
  
  try {
    const res = await fetch(`${API_URL}/workflows/execution/${currentExecution.value.id}/logs`)
    const data = await res.json()
    if (data.success && data.logs) {
      logs.value = data.logs.map(log => ({
        time: new Date(log.timestamp).toTimeString().slice(0, 8),
        level: log.level,
        message: log.message,
        stepName: log.stepName,
        duration: log.duration
      }))
    }
  } catch (err) {
    console.error('获取日志失败:', err)
  }
}

const onWorkflowChange = () => {
  currentExecution.value = null
  logs.value = []
  fetchCurrentExecution()
}

const goToDemands = () => {
  window.location.href = '/demands'
}

const showStepDetail = (step, index) => {
  if (step.status === 'pending') return
  currentStep.value = step
  showDetail.value = true
}

const truncate = (str, maxLen = 80) => {
  if (!str) return ''
  str = typeof str === 'object' ? JSON.stringify(str) : String(str)
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str
}

const truncateOutput = (output) => {
  if (!output) return ''
  let str = typeof output === 'object' ? JSON.stringify(output) : String(output)
  if (str.length > 50) return str.slice(0, 50) + '...'
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
  const map = { pending: '等待中', running: '执行中', success: '已完成', failed: '失败', idle: '空闲' }
  return map[status] || status
}

// 获取智能体状态
const fetchAgentStatus = async () => {
  try {
    const res = await fetch(`${API_URL}/demands/agents/status`)
    const data = await res.json()
    if (data.success) {
      agentStatus.value = data.agents
    }
  } catch (err) {
    console.error('获取智能体状态失败:', err)
  }
}

// 获取智能体数据统计
const fetchAgentStats = async () => {
  try {
    const res = await fetch(`${API_URL}/demands/agents/stats`)
    const data = await res.json()
    if (data.success) {
      agentStats.value = data.stats
    }
  } catch (err) {
    console.error('获取智能体统计失败:', err)
  }
}

// 获取指定智能体的日志
const fetchAgentLogs = async (agentKey) => {
  try {
    const res = await fetch(`${API_URL}/demands/agents/${agentKey}/logs?limit=20`)
    const data = await res.json()
    if (data.success) {
      logs.value = data.logs.map(log => ({
        time: new Date(log.createdAt).toTimeString().slice(0, 8),
        level: log.level,
        message: log.message,
        stepName: log.agentName,
        duration: log.duration
      }))
    }
  } catch (err) {
    console.error('获取智能体日志失败:', err)
  }
}

// 选择智能体查看详情
const selectAgent = (agentKey) => {
  selectedAgentKey.value = selectedAgentKey.value === agentKey ? '' : agentKey
  if (selectedAgentKey.value) {
    activeTab.value = 'config'
    fetchAgentDetail(selectedAgentKey.value)
    fetchAgentLogs(selectedAgentKey.value)
  }
}

// 获取智能体详情
const fetchAgentDetail = async (agentKey) => {
  try {
    const res = await fetch(`${API_URL}/demands/agents/${agentKey}/detail`)
    const data = await res.json()
    if (data.success) {
      agentDetail.value = data.detail
      // 如果是智能体，设置编辑表单
      if (data.detail.config && agentKey !== 'demand' && agentKey !== 'output') {
        editForm.value = { ...data.detail.config }
      }
    }
  } catch (err) {
    console.error('获取智能体详情失败:', err)
    agentDetail.value = {}
  }
}

// 获取可用模型列表
const fetchModels = async () => {
  try {
    const res = await fetch(`${API_URL}/agents/models`)
    const data = await res.json()
    if (data.success) {
      availableModels.value = data.models
    }
  } catch (err) {
    console.error('获取模型列表失败:', err)
  }
}

// 保存智能体配置
const saveAgentConfig = async () => {
  if (!editForm.value.id) return
  try {
    const res = await fetch(`${API_URL}/agents/${editForm.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.value.name,
        description: editForm.value.description,
        modelId: editForm.value.modelId,
        prompt: editForm.value.prompt,
        temperature: editForm.value.temperature,
        maxTokens: editForm.value.maxTokens,
        enabled: editForm.value.enabled
      })
    })
    const data = await res.json()
    if (data.success) {
      isEditing.value = false
      fetchAgentDetail(selectedAgentKey.value)
      fetchAgentStats()
    } else {
      alert('保存失败: ' + data.error)
    }
  } catch (err) {
    console.error('保存配置失败:', err)
    alert('保存失败')
  }
}

// 获取数据列表
const fetchDataList = async () => {
  dataLoading.value = true
  try {
    let endpoint = ''
    if (selectedAgentKey.value === 'demand') {
      endpoint = `${API_URL}/demands?limit=50`
    } else if (selectedAgentKey.value === 'organizer') {
      endpoint = `${API_URL}/demands/data/keypoints?limit=20`
    } else if (selectedAgentKey.value === 'architect') {
      endpoint = `${API_URL}/demands/data/knowledge-trees?limit=20`
    } else if (selectedAgentKey.value === 'planner') {
      endpoint = `${API_URL}/demands/data/card-plans?limit=20`
    } else if (selectedAgentKey.value === 'generator') {
      endpoint = `${API_URL}/local-cards?limit=20`
    }
    
    if (endpoint) {
      const res = await fetch(endpoint)
      const data = await res.json()
      if (data.success || data.data) {
        dataList.value = data.data || data.demands || []
      }
    }
  } catch (err) {
    console.error('获取数据列表失败:', err)
    dataList.value = []
  }
  dataLoading.value = false
}

// 删除数据
const deleteData = async (id) => {
  if (!confirm('确定要删除这条记录吗？')) return
  try {
    let endpoint = ''
    if (selectedAgentKey.value === 'organizer') {
      endpoint = `${API_URL}/demands/data/keypoints/${id}`
    } else if (selectedAgentKey.value === 'architect') {
      endpoint = `${API_URL}/demands/data/knowledge-trees/${id}`
    } else if (selectedAgentKey.value === 'planner') {
      endpoint = `${API_URL}/demands/data/card-plans/${id}`
    }
    
    if (endpoint) {
      const res = await fetch(endpoint, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        fetchDataList()
        fetchAgentStats()
      }
    }
  } catch (err) {
    console.error('删除失败:', err)
  }
}

// 获取显示名称
const getAgentDisplayName = (key) => {
  const map = {
    demand: '需求管理',
    organizer: '信息整理智能体',
    architect: '知识树构建智能体',
    planner: '卡片规划智能体',
    generator: '卡片生成智能体',
    output: '完成输出'
  }
  return map[key] || key
}

onMounted(() => {
  checkBackendHealth()
  fetchWorkflows()
  fetchDemandStats()
  fetchDashboardStats()
  fetchAgentStatus()
  fetchAgentStats()
  
  refreshTimer = setInterval(() => {
    fetchDemandStats()
    fetchAgentStatus()
    fetchAgentStats()
    // 如果选中了智能体，刷新其详情
    if (selectedAgentKey.value) {
      fetchAgentDetail(selectedAgentKey.value)
      fetchAgentLogs(selectedAgentKey.value)
    }
  }, 3000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.dashboard {
  padding: 20px;
}

/* 状态信息区 */
.status-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h1 {
  margin: 0;
  font-size: 20px;
}

.section-header h2 {
  margin: 0;
  font-size: 16px;
}

.backend-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  background: #f5f5f5;
  color: #999;
}

.backend-status.connected {
  background: #f6ffed;
  color: #52c41a;
}

.backend-status .status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.stats-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.stat-item {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 10px;
  padding: 16px 24px;
  text-align: center;
  flex: 1;
  color: white;
}

.stat-item .stat-value {
  font-size: 28px;
  font-weight: 700;
}

.stat-item .stat-value.pending {
  color: #ffd666;
}

.stat-item .stat-label {
  font-size: 12px;
  opacity: 0.9;
}

.recent-activities {
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  font-size: 12px;
  border-bottom: 1px solid #f5f5f5;
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-time {
  color: #999;
  min-width: 60px;
}

.activity-content {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-status {
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 10px;
}

.activity-status.success { background: #f6ffed; color: #52c41a; }
.activity-status.pending { background: #fff7e6; color: #fa8c16; }
.activity-status.failed { background: #fff2f0; color: #ff4d4f; }

/* 工作流监控区 */
.workflow-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.workflow-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.workflow-select {
  padding: 8px 16px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
  min-width: 160px;
}

.run-btn {
  padding: 8px 24px;
  background: #52c41a;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.run-btn:hover:not(:disabled) {
  background: #73d13d;
}

.run-btn:disabled {
  background: #b7eb8f;
  cursor: not-allowed;
}

.run-btn.running {
  background: #1890ff;
}

.exec-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #666;
  margin-bottom: 16px;
}

.exec-status {
  padding: 2px 8px;
  border-radius: 10px;
}

.exec-status.running { background: #e6f7ff; color: #1890ff; }
.exec-status.success { background: #f6ffed; color: #52c41a; }
.exec-status.failed { background: #fff2f0; color: #ff4d4f; }

/* 流程图 */
.flowchart-view {
  overflow-x: auto;
  margin-bottom: 16px;
}

.agent-flow {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 0;
  padding: 10px 0;
}

.flow-node {
  width: 140px;
  min-height: 100px;
  background: white;
  border-radius: 10px;
  padding: 12px;
  position: relative;
  border: 2px solid #e8e8e8;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.flow-node.agent-node {
  cursor: pointer;
}

.flow-node.agent-node:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
}

.node-status {
  position: absolute;
  top: -8px;
  right: -8px;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
}

.status-icon.success { background: #52c41a; color: white; }
.status-icon.running { background: #1890ff; color: white; }
.status-icon.failed { background: #ff4d4f; color: white; }
.status-icon.pending { background: #f0f0f0; color: #999; }

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

.node-header {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.step-num {
  display: inline-block;
  background: #667eea;
  color: white;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  font-size: 10px;
  text-align: center;
  line-height: 18px;
  margin-right: 6px;
}

.node-agent {
  font-size: 11px;
  color: #999;
  margin-bottom: 8px;
}

.node-detail-status {
  background: #e6f7ff;
  border-radius: 4px;
  padding: 3px 6px;
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

.node-output {
  background: #f9f9f9;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 10px;
  color: #666;
  max-height: 36px;
  overflow: hidden;
}

.node-output.loading {
  color: #1890ff;
  font-style: italic;
}

.node-error {
  background: #fff2f0;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 10px;
  color: #ff4d4f;
}

.node-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  margin-top: 4px;
}

.node-stats .stat {
  font-size: 9px;
  color: #666;
  background: rgba(0,0,0,0.05);
  padding: 2px 6px;
  border-radius: 3px;
}

.node-stats .stat.pending {
  color: #fa8c16;
  background: #fff7e6;
}

.node-current {
  font-size: 10px;
  color: #1890ff;
  margin-top: 4px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.agent-node.selected {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.agent-node.success { border-color: #b7eb8f; background: linear-gradient(135deg, #f6ffed 0%, #e6ffdb 100%); }
.agent-node.running { border-color: #91d5ff; background: linear-gradient(135deg, #e6f7ff 0%, #d6efff 100%); animation: pulse 2s infinite; }
.agent-node.failed { border-color: #ff7875; background: linear-gradient(135deg, #fff2f0 0%, #ffebe8 100%); }

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(24, 144, 255, 0.4); }
  50% { box-shadow: 0 0 0 8px rgba(24, 144, 255, 0); }
}

/* 日志筛选标签 */
.log-filter {
  color: #667eea;
  font-weight: 500;
}

/* 统计栏 */
.stats-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.stat-item {
  background: white;
  border-radius: 8px;
  padding: 16px 24px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  min-width: 100px;
}

.stat-item .stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #667eea;
}

.stat-item .stat-value.pending {
  color: #fa8c16;
}

.stat-item .stat-label {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

/* 需求节点 */
.demand-node {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  cursor: pointer;
}

.demand-node:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.demand-node .node-header {
  color: white;
  display: flex;
  align-items: center;
  gap: 6px;
}

.demand-stats {
  text-align: center;
}

.stat-total {
  font-size: 28px;
  font-weight: 700;
  color: white;
}

.stat-detail {
  display: flex;
  justify-content: center;
  gap: 8px;
  font-size: 10px;
  color: rgba(255,255,255,0.8);
}

.stat-detail .pending { color: #ffd666; }
.stat-detail .processing { color: #69c0ff; }
.stat-detail .completed { color: #95de64; }

/* 输出节点 */
.output-node {
  background: linear-gradient(135deg, #f6f8fc 0%, #eef1f5 100%);
  border: 2px solid #d9d9d9;
}

.output-node.success {
  background: linear-gradient(135deg, #f6ffed 0%, #e6ffdb 100%);
  border-color: #b7eb8f;
}

.node-body {
  font-size: 11px;
  color: #666;
}

.node-body .pending {
  color: #999;
}

/* 箭头 */
.flow-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 4px;
}

/* 日志区域 */
.logs-section {
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
}

.activity-status.success { background: #f6ffed; color: #52c41a; }
.activity-status.pending { background: #fff7e6; color: #fa8c16; }
.activity-status.failed { background: #fff2f0; color: #ff4d4f; }

.empty {
  text-align: center;
  color: #999;
  padding: 20px;
  font-size: 12px;
}

/* 日志区域 */
.logs-section {
  flex: 1;
  background: #1e1e1e;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  color: #fff;
  font-size: 14px;
}

.logs-count {
  font-size: 12px;
  color: #888;
}

.logs-content {
  flex: 1;
  overflow-y: auto;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
}

.log-item {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  color: #d4d4d4;
  border-bottom: 1px solid #333;
}

.log-time { color: #888; min-width: 60px; }
.log-level { min-width: 40px; text-align: center; border-radius: 2px; padding: 0 4px; }
.log-step { color: #569cd6; }
.log-msg { flex: 1; }
.log-duration { color: #888; }

.log-item.INFO .log-level { color: #3794ff; }
.log-item.WARN .log-level { color: #cca700; }
.log-item.ERROR .log-level { color: #f14c4c; }
.log-item.DEBUG .log-level { color: #888; }

.log-item.ERROR .log-msg { color: #f14c4c; }

.logs-empty {
  text-align: center;
  color: #666;
  padding: 40px;
}

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
  background: white;
  border-radius: 12px;
  width: 600px;
  max-width: 90%;
  max-height: 80vh;
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
  font-size: 16px;
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

.detail-section.error label { color: #ff4d4f; }

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

/* 详情面板 */
.detail-panel {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-top: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.detail-title {
  font-size: 16px;
  font-weight: 600;
}

/* Tab切换 */
.detail-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid #e8e8e8;
  margin-bottom: 16px;
}

.tab-btn {
  padding: 8px 16px;
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
  min-height: 200px;
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

.config-item {
  display: flex;
  gap: 8px;
  min-width: 200px;
}

.config-item.full {
  width: 100%;
}

.config-item label {
  color: #666;
  font-size: 13px;
  white-space: nowrap;
}

.config-item span {
  color: #333;
  font-size: 13px;
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

/* 编辑表单样式 */
.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
}

.config-header h3 {
  margin: 0;
  font-size: 14px;
}

.config-actions {
  display: flex;
  gap: 8px;
}

.btn-edit, .btn-save, .btn-cancel, .btn-refresh, .btn-delete {
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  border: none;
}

.btn-edit { background: #1890ff; color: white; }
.btn-save { background: #52c41a; color: white; }
.btn-cancel { background: #999; color: white; }
.btn-refresh { background: #1890ff; color: white; padding: 4px 10px; }
.btn-delete { background: #ff4d4f; color: white; padding: 2px 8px; font-size: 11px; }

.edit-input, .edit-select, .edit-textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
}

.edit-input.small {
  width: 80px;
}

.edit-textarea {
  resize: vertical;
  font-family: monospace;
}

/* 数据表格样式 */
.data-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.data-header h4 {
  margin: 0;
  font-size: 13px;
}

.data-table-wrapper {
  margin-top: 16px;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.data-table th, .data-table td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.data-table th {
  background: #fafafa;
  font-weight: 600;
}

.data-table .item-id {
  font-family: monospace;
  color: #666;
}

.data-table .item-summary {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.data-table .item-time {
  color: #999;
  font-size: 11px;
}

.data-table .item-actions {
  white-space: nowrap;
}

.item-status {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
}

.item-status.pending { background: #fff7e6; color: #fa8c16; }
.item-status.processing { background: #e6f7ff; color: #1890ff; }
.item-status.completed { background: #f6ffed; color: #52c41a; }
.item-status.failed { background: #fff2f0; color: #ff4d4f; }

/* 日志面板 */
.logs-pane .logs-content {
  background: #1e1e1e;
  border-radius: 8px;
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
}

/* 数据面板 */
.data-pane {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.data-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #333;
}

.data-stats {
  display: flex;
  gap: 12px;
}

.data-stat-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  min-width: 80px;
}

.data-stat-card .stat-num {
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.data-stat-card .stat-num.pending { color: #fa8c16; }
.data-stat-card .stat-num.processing { color: #1890ff; }
.data-stat-card .stat-num.completed { color: #52c41a; }

.data-stat-card .stat-label {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.data-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.data-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #fafafa;
  border-radius: 6px;
  font-size: 12px;
}

.item-id {
  font-family: monospace;
  color: #666;
}

.item-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.item-status.completed { background: #f0fff4; color: #52c41a; }
.item-status.pending { background: #fff7e6; color: #fa8c16; }
.item-status.running { background: #e6f7ff; color: #1890ff; }

.item-summary {
  flex: 1;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-tip {
  text-align: center;
  color: #999;
  padding: 40px;
  font-size: 14px;
}

/* 选中状态 */
.flow-node.selected {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
}
</style>