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

    <!-- 下方：智能体工作空间 -->
    <div class="workspace-section">
      <div class="section-header">
        <h2>智能体工作空间</h2>
        <div class="workspace-controls">
          <button @click="autoRun" class="run-btn" :disabled="isRunning" :class="{ running: isRunning }">
            {{ isRunning ? '运行中...' : '启动处理' }}
          </button>
        </div>
      </div>

      <div class="workspace-stats">
        <span class="stat"><b>{{ demandStats.pending }}</b> 待处理</span>
        <span class="stat"><b>{{ demandStats.processing }}</b> 处理中</span>
        <span class="stat"><b>{{ demandStats.completed }}</b> 已完成</span>
      </div>

      <!-- 工作空间画布 -->
      <div class="workspace-canvas" ref="workspaceCanvas">
        <!-- 连接线 -->
        <svg class="connection-lines" v-if="showConnections">
          <line 
            v-for="(line, idx) in connectionLines" 
            :key="idx"
            :x1="line.x1" :y1="line.y1"
            :x2="line.x2" :y2="line.y2"
            stroke="#d9d9d9"
            stroke-width="2"
            stroke-dasharray="5,5"
          />
        </svg>
        
        <!-- 需求工作站 -->
        <div 
          :class="['station-card', { active: selectedAgentKey === 'demand', dragging: draggingKey === 'demand' }]"
          :style="getStationStyle('demand')"
          @mousedown="startDrag($event, 'demand')"
          @click.stop="onStationClick('demand')"
        >
          <div class="station-drag-handle">⋮⋮</div>
          <div class="station-header">
            <div class="station-icon">📋</div>
            <div class="station-title">需求管理</div>
          </div>
          <div class="station-status" :class="demandStats.pending > 0 ? 'has-work' : 'idle'">
            {{ demandStats.pending > 0 ? '有待处理' : '空闲' }}
          </div>
          <div class="station-queue">
            <div class="queue-item">
              <span class="queue-label">待处理</span>
              <span class="queue-value pending">{{ demandStats.pending }}</span>
            </div>
            <div class="queue-item">
              <span class="queue-label">处理中</span>
              <span class="queue-value processing">{{ demandStats.processing }}</span>
            </div>
            <div class="queue-item">
              <span class="queue-label">已完成</span>
              <span class="queue-value">{{ demandStats.completed }}</span>
            </div>
          </div>
        </div>

        <!-- 智能体工作站 -->
        <div 
          v-for="agent in agentWorkstations" 
          :key="agent.key"
          :class="['station-card', agent.status, { active: selectedAgentKey === agent.key, dragging: draggingKey === agent.key }]"
          :style="getStationStyle(agent.key)"
          @mousedown="startDrag($event, agent.key)"
          @click.stop="onStationClick(agent.key)"
        >
          <div class="station-drag-handle">⋮⋮</div>
          <div class="station-header">
            <div class="station-icon">{{ agent.icon }}</div>
            <div class="station-title">{{ agent.name }}</div>
            <div class="station-indicator" :class="agent.status">
              <span v-if="agent.status === 'running'" class="spinner-small"></span>
              <span v-else-if="agent.status === 'success'">✓</span>
              <span v-else-if="agent.status === 'failed'">✗</span>
            </div>
          </div>
          <div class="station-status" :class="agent.status">
            {{ getAgentStatusText(agent.status) }}
          </div>
          <div class="station-queue">
            <div class="queue-item" v-if="agent.stats?.unconsumed !== undefined">
              <span class="queue-label">待消费</span>
              <span class="queue-value pending">{{ agent.stats.unconsumed || 0 }}</span>
            </div>
            <div class="queue-item" v-if="agent.stats?.total !== undefined">
              <span class="queue-label">已处理</span>
              <span class="queue-value">{{ agent.stats.total || 0 }}</span>
            </div>
            <div class="queue-item" v-if="agent.stats?.totalCards !== undefined">
              <span class="queue-label">生成卡片</span>
              <span class="queue-value success">{{ agent.stats.totalCards || 0 }}</span>
            </div>
          </div>
          <div class="station-current" v-if="agent.currentTask">
            {{ agent.currentTask }}
          </div>
        </div>

        <!-- 输出工作站 -->
        <div 
          :class="['station-card output', { active: selectedAgentKey === 'output', dragging: draggingKey === 'output' }]"
          :style="getStationStyle('output')"
          @mousedown="startDrag($event, 'output')"
          @click.stop="onStationClick('output')"
        >
          <div class="station-drag-handle">⋮⋮</div>
          <div class="station-header">
            <div class="station-icon">📤</div>
            <div class="station-title">卡片输出</div>
          </div>
          <div class="station-status" :class="agentStats.generator?.totalCards > 0 ? 'success' : 'idle'">
            {{ agentStats.generator?.totalCards > 0 ? '已输出' : '待输出' }}
          </div>
          <div class="station-queue">
            <div class="queue-item">
              <span class="queue-label">卡片总数</span>
              <span class="queue-value success">{{ agentStats.generator?.totalCards || 0 }}</span>
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

// ========== 拖拽相关 ==========
const workspaceCanvas = ref(null)
const draggingKey = ref('')
const dragStartPos = ref({ x: 0, y: 0 })
const stationStartPos = ref({ x: 0, y: 0 })
const showConnections = ref(true)
const isActuallyDragging = ref(false) // 是否真的发生了拖拽（移动距离超过阈值）
const DRAG_THRESHOLD = 5 // 拖拽阈值（像素）

// 工作站默认位置配置
const defaultPositions = {
  demand: { x: 20, y: 20 },
  organizer: { x: 240, y: 20 },
  architect: { x: 460, y: 20 },
  planner: { x: 240, y: 220 },
  generator: { x: 460, y: 220 },
  output: { x: 680, y: 220 }
}

// 工作站位置状态
const stationPositions = ref({})

// 初始化位置（从localStorage恢复或使用默认值）
const initPositions = () => {
  const saved = localStorage.getItem('workspace_positions')
  if (saved) {
    try {
      stationPositions.value = JSON.parse(saved)
    } catch {
      stationPositions.value = { ...defaultPositions }
    }
  } else {
    stationPositions.value = { ...defaultPositions }
  }
}

// 保存位置到localStorage
const savePositions = () => {
  localStorage.setItem('workspace_positions', JSON.stringify(stationPositions.value))
}

// 获取工作站样式
const getStationStyle = (key) => {
  const pos = stationPositions.value[key] || defaultPositions[key] || { x: 0, y: 0 }
  return {
    left: `${pos.x}px`,
    top: `${pos.y}px`
  }
}

// 开始拖拽
const startDrag = (event, key) => {
  if (event.button !== 0) return // 只响应左键
  
  draggingKey.value = key
  dragStartPos.value = { x: event.clientX, y: event.clientY }
  stationStartPos.value = { ...stationPositions.value[key] } || { x: 0, y: 0 }
  isActuallyDragging.value = false // 重置拖拽标记
  
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  
  event.preventDefault()
}

// 拖拽中
const onDrag = (event) => {
  if (!draggingKey.value) return
  
  const dx = event.clientX - dragStartPos.value.x
  const dy = event.clientY - dragStartPos.value.y
  
  // 检查是否超过拖拽阈值
  if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
    isActuallyDragging.value = true
  }
  
  const newX = stationStartPos.value.x + dx
  const newY = stationStartPos.value.y + dy
  
  // 限制在工作空间范围内
  const maxX = workspaceCanvas.value ? workspaceCanvas.value.clientWidth - 180 : 800
  const maxY = workspaceCanvas.value ? workspaceCanvas.value.clientHeight - 180 : 600
  
  stationPositions.value[draggingKey.value] = {
    x: Math.max(0, Math.min(newX, maxX)),
    y: Math.max(0, Math.min(newY, maxY))
  }
}

// 停止拖拽
const stopDrag = () => {
  if (draggingKey.value) {
    savePositions()
  }
  
  // 延迟重置，确保click事件能读取到正确的isActuallyDragging值
  const wasDragging = isActuallyDragging.value
  draggingKey.value = ''
  
  setTimeout(() => {
    isActuallyDragging.value = false
  }, 100)
  
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// 点击工作站（排除拖拽）
const onStationClick = (key) => {
  // 如果发生了拖拽，不触发详情弹窗
  if (isActuallyDragging.value) {
    return
  }
  selectAgent(key)
}

// 连接线计算
const connectionLines = computed(() => {
  const lines = []
  const flow = ['demand', 'organizer', 'architect', 'planner', 'generator', 'output']
  
  for (let i = 0; i < flow.length - 1; i++) {
    const from = stationPositions.value[flow[i]] || defaultPositions[flow[i]]
    const to = stationPositions.value[flow[i + 1]] || defaultPositions[flow[i + 1]]
    
    if (from && to) {
      lines.push({
        x1: from.x + 90,
        y1: from.y + 90,
        x2: to.x + 90,
        y2: to.y + 90
      })
    }
  }
  
  return lines
})

// 重置位置
const resetPositions = () => {
  stationPositions.value = { ...defaultPositions }
  savePositions()
}

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

// 智能体工作站列表
const agentWorkstations = computed(() => {
  const workstations = [
    { key: 'organizer', name: '信息整理', icon: '🔍' },
    { key: 'architect', name: '知识树构建', icon: '🌳' },
    { key: 'planner', name: '卡片规划', icon: '📐' },
    { key: 'generator', name: '卡片生成', icon: '🎨' }
  ]
  
  return workstations.map(ws => {
    const status = agentStatus.value[ws.key]
    const stats = agentStats.value[ws.key]
    const wsStatus = status.status === 'running' ? 'running' :
                     status.status === 'failed' ? 'failed' :
                     status.status === 'idle' && status.lastRun ? 'success' : 'idle'
    
    return {
      ...ws,
      status: wsStatus,
      currentTask: status.currentTask,
      stats: stats
    }
  })
})

// 获取智能体状态文本
const getAgentStatusText = (status) => {
  const map = {
    idle: '空闲',
    running: '运行中',
    success: '已完成',
    failed: '出错'
  }
  return map[status] || status
}

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
  initPositions() // 初始化工作站位置
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

/* 智能体工作空间 */
.workspace-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.workspace-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.run-btn {
  padding: 8px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.run-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.run-btn:disabled {
  background: #b7eb8f;
  cursor: not-allowed;
}

.run-btn.running {
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
}

.workspace-stats {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.workspace-stats .stat {
  font-size: 13px;
  color: #666;
}

.workspace-stats .stat b {
  font-size: 18px;
  color: #333;
  margin-right: 4px;
}

/* 工作空间画布 */
.workspace-canvas {
  position: relative;
  min-height: 650px;
  background: 
    linear-gradient(90deg, #f0f0f0 1px, transparent 1px),
    linear-gradient(#f0f0f0 1px, transparent 1px);
  background-size: 20px 20px;
  border-radius: 12px;
  overflow: hidden;
  user-select: none;
}

.connection-lines {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.station-card {
  position: absolute;
  width: 180px;
  background: white;
  border: 2px solid #e8e8e8;
  border-radius: 12px;
  padding: 16px;
  cursor: move;
  transition: box-shadow 0.3s, border-color 0.3s;
  z-index: 10;
}

.station-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.station-card.dragging {
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
  z-index: 100;
  cursor: grabbing;
}

.station-card.active {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

.station-card.running {
  border-color: #1890ff;
  background: linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%);
}

.station-card.success {
  border-color: #52c41a;
  background: linear-gradient(135deg, #f6ffed 0%, #f0fff0 100%);
}

.station-card.failed {
  border-color: #ff4d4f;
  background: linear-gradient(135deg, #fff2f0 0%, #fff5f5 100%);
}

.station-card.output {
  background: linear-gradient(135deg, #f6f8fc 0%, #f0f2f5 100%);
}

.station-drag-handle {
  position: absolute;
  top: 4px;
  right: 8px;
  color: #d9d9d9;
  font-size: 14px;
  cursor: grab;
  letter-spacing: -2px;
}

.station-card.dragging .station-drag-handle {
  cursor: grabbing;
}

.station-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.station-icon {
  font-size: 24px;
}

.station-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  flex: 1;
}

.station-indicator {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}

.station-indicator.idle { background: #f0f0f0; color: #999; }
.station-indicator.running { background: #1890ff; color: white; }
.station-indicator.success { background: #52c41a; color: white; }
.station-indicator.failed { background: #ff4d4f; color: white; }

.spinner-small {
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

.station-status {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  margin-bottom: 12px;
  text-align: center;
}

.station-status.idle { background: #f5f5f5; color: #999; }
.station-status.has-work { background: #fff7e6; color: #fa8c16; }
.station-status.running { background: #e6f7ff; color: #1890ff; }
.station-status.success { background: #f6ffed; color: #52c41a; }
.station-status.failed { background: #fff2f0; color: #ff4d4f; }

.station-queue {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.queue-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 4px 8px;
  background: #f9f9f9;
  border-radius: 4px;
}

.queue-label {
  color: #999;
}

.queue-value {
  font-weight: 600;
  color: #333;
}

.queue-value.pending { color: #fa8c16; }
.queue-value.processing { color: #1890ff; }
.queue-value.success { color: #52c41a; }

.station-current {
  margin-top: 10px;
  padding: 8px;
  background: #e6f7ff;
  border-radius: 6px;
  font-size: 11px;
  color: #1890ff;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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