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
        <div class="workspace-info">
          <h2>{{ currentWorkspace?.name || '默认空间' }}</h2>
          <span class="workspace-meta">{{ workspaceAgents.length }} 个智能体</span>
        </div>
        <div class="workspace-controls">
          <button @click="goToWorkspaceManagement" class="switch-btn">
            切换空间
          </button>
          <button @click="showAddAgentModal = true" class="add-btn">
            + 添加智能体
          </button>
          <button @click="autoRun" class="run-btn" :disabled="isRunning" :class="{ running: isRunning }">
            {{ isRunning ? '运行中...' : '启动处理' }}
          </button>
        </div>
      </div>

      <!-- 工作空间画布 -->
      <div class="workspace-canvas" ref="workspaceCanvas">
        <!-- 连接线 -->
        <svg class="connection-lines" v-if="showConnections && agentWorkstations.length > 0">
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
        
        <!-- 智能体工作站（统一渲染所有智能体） -->
        <div 
          v-for="agent in agentWorkstations" 
          :key="agent.id"
          :class="['station-card', agent.status, { active: selectedAgentKey === agent.id, dragging: draggingKey === agent.id }]"
          :style="getStationStyle(agent.id)"
          @mousedown="startDrag($event, agent.id)"
          @click.stop="onStationClick(agent.id)"
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
            <!-- 普通智能体数据 -->
            <template>
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
            </template>
          </div>
          <div class="station-current" v-if="agent.currentTask">
            {{ agent.currentTask }}
          </div>
        </div>
        
        <!-- 空状态提示 -->
        <div v-if="agentWorkstations.length === 0" class="empty-workspace">
          <div class="empty-icon">🤖</div>
          <p>当前空间暂无智能体</p>
          <button @click="showAddAgentModal = true" class="add-agent-empty-btn">添加智能体</button>
        </div>
      </div>

      <!-- 智能体详情弹窗 -->
      <AgentDetailModal 
        v-if="selectedAgentKey" 
        :agentKey="selectedAgentKey"
        :agentName="getAgentDisplayName(selectedAgentKey)"
        @close="selectedAgentKey = ''"
        @update="onAgentUpdated"
        @delete="onAgentDeleted"
      />
    </div>

    <!-- 新建智能体弹窗 -->
    <div v-if="showAddAgentModal" class="modal-overlay" @click.self="showAddAgentModal = false">
      <div class="add-agent-modal">
        <div class="modal-header">
          <h2>新建智能体</h2>
          <button class="close-btn" @click="showAddAgentModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>名称 <span class="required">*</span></label>
            <input v-model="newAgent.name" class="form-input" placeholder="智能体名称" />
          </div>
          <div class="form-row">
            <label>描述</label>
            <textarea v-model="newAgent.description" class="form-textarea" placeholder="功能描述"></textarea>
          </div>
          <div class="form-row">
            <label>类型</label>
            <select v-model="newAgent.type" class="form-select">
              <option value="source">数据源</option>
              <option value="processor">处理器</option>
              <option value="output">输出</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="showAddAgentModal = false" class="btn-cancel">取消</button>
          <button @click="createAgent" class="btn-confirm" :disabled="!newAgent.name">创建</button>
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
import { useRouter } from 'vue-router'
import { dashboardApi, statusApi } from '../api'
import AgentDetailModal from '../components/AgentDetailModal.vue'

const router = useRouter()
const API_URL = 'http://localhost:3001/api'

// 当前空间
const currentWorkspace = ref(null)
const workspaceAgents = ref([]) // 当前空间的智能体key列表

// 获取当前空间
const fetchCurrentWorkspace = async () => {
  const workspaceId = localStorage.getItem('currentWorkspace')
  console.log('[仪表盘] ========== 开始获取空间 ==========')
  console.log('[仪表盘] localStorage.currentWorkspace:', workspaceId)
  
  if (!workspaceId) {
    // 没有选中空间，显示空
    currentWorkspace.value = null
    workspaceAgents.value = []
    console.log('[仪表盘] 无选中空间')
    return
  }
  
  try {
    const url = `${API_URL}/workspaces/${workspaceId}`
    console.log('[仪表盘] 请求URL:', url)
    const res = await fetch(url)
    const data = await res.json()
    console.log('[仪表盘] API返回完整数据:', JSON.stringify(data, null, 2))
    
    if (data.success && data.workspace) {
      console.log('[仪表盘] 获取到空间:', data.workspace.name, 'ID:', data.workspace.id)
      console.log('[仪表盘] 空间的 agentIds 字段:', data.workspace.agentIds)
      
      currentWorkspace.value = data.workspace
      // 直接使用空间的 agentIds，空就空着
      workspaceAgents.value = data.workspace.agentIds || []
      console.log('[仪表盘] 最终设置的 workspaceAgents:', workspaceAgents.value)
    } else {
      // 空间不存在，清除 localStorage
      console.log('[仪表盘] 空间不存在')
      localStorage.removeItem('currentWorkspace')
      currentWorkspace.value = null
      workspaceAgents.value = []
    }
  } catch (err) {
    console.error('[仪表盘] 获取空间失败:', err)
    workspaceAgents.value = []
  }
}

// 跳转到空间管理
const goToWorkspaceManagement = () => {
  router.push('/workspaces')
}

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

// 智能体独立状态（动态从API获取）
const agentStatus = ref({})

// ========== 拖拽相关 ==========
const workspaceCanvas = ref(null)
const draggingKey = ref('')
const dragStartPos = ref({ x: 0, y: 0 })
const stationStartPos = ref({ x: 0, y: 0 })
const showConnections = ref(true)
const isActuallyDragging = ref(false) // 是否真的发生了拖拽（移动距离超过阈值）
const DRAG_THRESHOLD = 5 // 拖拽阈值（像素）

// 工作站位置状态
const stationPositions = ref({})

// 初始化位置（从localStorage恢复）
const initPositions = () => {
  const saved = localStorage.getItem('workspace_positions_v2')  // 使用新key避免旧数据冲突
  if (saved) {
    try {
      stationPositions.value = JSON.parse(saved)
    } catch {
      stationPositions.value = {}
    }
  } else {
    stationPositions.value = {}
  }
}

// 保存位置到localStorage
const savePositions = () => {
  localStorage.setItem('workspace_positions_v2', JSON.stringify(stationPositions.value))
}

// 获取工作站样式
const getStationStyle = (agentId) => {
  console.log('[仪表盘] getStationStyle agentId:', agentId)
  console.log('[仪表盘] stationPositions:', JSON.stringify(stationPositions.value))
  
  // 如果已有位置，直接返回
  if (stationPositions.value[agentId]) {
    const pos = stationPositions.value[agentId]
    console.log('[仪表盘] 使用已存储位置:', pos)
    return {
      left: `${pos.x}px`,
      top: `${pos.y}px`
    }
  }
  
  // 新智能体：根据已有数量计算位置（网格排列）
  const existingCount = Object.keys(stationPositions.value).length
  const cols = 3  // 每行3个
  const row = Math.floor(existingCount / cols)
  const col = existingCount % cols
  const newPos = {
    x: 20 + col * 220,
    y: 20 + row * 200
  }
  
  console.log('[仪表盘] 计算新位置:', newPos, 'existingCount:', existingCount)
  
  // 保存新位置
  stationPositions.value[agentId] = newPos
  savePositions()
  
  return {
    left: `${newPos.x}px`,
    top: `${newPos.y}px`
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
  // 连接线功能暂时禁用，因为智能体现在是动态的
  // 未来可以根据智能体的输入输出关系动态生成连接线
  return []
})

// 重置位置
const resetPositions = () => {
  stationPositions.value = {}
  savePositions()
}

// 智能体数据统计（动态从API获取）
const agentStats = ref({})

// 当前选中的智能体（用于筛选日志）
const selectedAgentKey = ref('')
const activeTab = ref('config') // config, logs, data
const agentDetail = ref({})
const isEditing = ref(false)
const editForm = ref({})
const availableModels = ref([])
const dataList = ref([])
const dataLoading = ref(false)

// 新建智能体
const showAddAgentModal = ref(false)
const newAgent = ref({
  name: '',
  description: '',
  type: 'processor'
})

let refreshTimer = null

// 智能体配置（从后端获取）
const agentConfigs = ref({})

// 获取智能体配置
const fetchAgentConfigs = async () => {
  try {
    const res = await fetch(`${API_URL}/agents`)
    const data = await res.json()
    if (data.success && data.agents) {
      // 按 id 建立索引
      const configs = {}
      data.agents.forEach(agent => {
        if (agent.id) {
          configs[agent.id] = agent
        }
      })
      agentConfigs.value = configs
    }
  } catch (err) {
    console.error('获取智能体配置失败:', err)
  }
}

// 默认图标（统一使用机器人图标）
const defaultIcon = '🤖'

// 智能体工作站列表（根据当前空间过滤）
const agentWorkstations = computed(() => {
  console.log('[仪表盘] ========== computed 重新计算 ==========')
  console.log('[仪表盘] currentWorkspace:', currentWorkspace.value?.name)
  console.log('[仪表盘] workspaceAgents:', workspaceAgents.value)
  console.log('[仪表盘] workspaceAgents.length:', workspaceAgents.value.length)
  console.log('[仪表盘] agentConfigs keys:', Object.keys(agentConfigs.value))
  
  // 直接使用 workspaceAgents（现在是 agentIds），空就是空
  const agentIds = workspaceAgents.value
  
  console.log('[仪表盘] 显示的智能体IDs:', agentIds)
  
  const result = agentIds.map(agentId => {
    const status = agentStatus.value[agentId] || { status: 'idle' }
    const stats = agentStats.value[agentId]
    const config = agentConfigs.value[agentId]
    console.log('[仪表盘] 智能体', agentId, '配置:', config)
    const wsStatus = status.status === 'running' ? 'running' :
                     status.status === 'failed' ? 'failed' :
                     status.status === 'idle' && status.lastRun ? 'success' : 'idle'
    
    return {
      id: agentId,
      icon: defaultIcon,
      name: config?.name || agentId,
      type: config?.type || 'processor',
      status: wsStatus,
      currentTask: status.currentTask,
      stats: stats
    }
  })
  
  console.log('[仪表盘] 最终工作站列表长度:', result.length)
  return result
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

// 获取箭头颜色（保留用于未来可能的流水线展示）
const getArrowColor = (status) => {
  if (status === 'success' || status === 'running') return '#667eea'
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

// 创建智能体
const createAgent = async () => {
  if (!newAgent.value.name) return
  
  try {
    const res = await fetch(`${API_URL}/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newAgent.value.name,
        description: newAgent.value.description,
        type: newAgent.value.type,
        prompt: '请配置智能体的提示词...',
        modelId: 'ollama-qwen',
        temperature: 0.7,
        maxTokens: 4096,
        enabled: true
      })
    })
    const data = await res.json()
    if (data.success) {
      const agentId = data.agent.id
      
      // 如果当前有选中空间，将智能体添加到空间
      if (currentWorkspace.value) {
        const updatedAgentIds = [...workspaceAgents.value, agentId]
        await fetch(`${API_URL}/workspaces/${currentWorkspace.value.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentIds: updatedAgentIds })
        })
      }
      
      showAddAgentModal.value = false
      newAgent.value = { name: '', description: '', type: 'processor' }
      fetchAgentConfigs()
      fetchAgentStatus()
      fetchCurrentWorkspace() // 刷新当前空间
      alert('智能体创建成功！')
    } else {
      alert('创建失败: ' + data.error)
    }
  } catch (err) {
    console.error('创建智能体失败:', err)
    alert('创建失败')
  }
}

// 智能体更新回调
const onAgentUpdated = () => {
  fetchAgentConfigs()
  fetchAgentStats()
}

// 智能体删除回调
const onAgentDeleted = () => {
  selectedAgentKey.value = ''
  fetchAgentConfigs()
  fetchAgentStatus()
  fetchAgentStats()
}

// 获取显示名称
const getAgentDisplayName = (key) => {
  // 优先使用配置中的名称
  if (agentConfigs.value[key]?.name) {
    return agentConfigs.value[key].name
  }
  // 默认名称
  const map = {
    demand: '需求管理',
    output: '卡片输出'
  }
  return map[key] || key
}

// 获取智能体图标
const getAgentIcon = (key) => {
  const map = {
    demand: '📋',
    organizer: '🔍',
    architect: '🌳',
    planner: '📐',
    generator: '🎨',
    output: '📤'
  }
  return map[key] || '🤖'
}

onMounted(() => {
  initPositions() // 初始化工作站位置
  checkBackendHealth()
  fetchWorkflows()
  fetchDemandStats()
  fetchDashboardStats()
  fetchCurrentWorkspace() // 获取当前空间
  fetchAgentConfigs() // 获取智能体配置（名称等）
  fetchAgentStatus()
  fetchAgentStats()
  
  refreshTimer = setInterval(() => {
    fetchDemandStats()
    fetchCurrentWorkspace() // 定期刷新当前空间
    fetchAgentConfigs() // 定期刷新配置
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

.workspace-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.workspace-info h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.workspace-meta {
  padding: 4px 12px;
  background: #f0f5ff;
  color: #667eea;
  border-radius: 12px;
  font-size: 13px;
}

.switch-btn {
  padding: 8px 16px;
  background: white;
  color: #666;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.switch-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.add-btn {
  padding: 8px 16px;
  background: white;
  color: #667eea;
  border: 1px solid #667eea;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.add-btn:hover {
  background: #667eea;
  color: white;
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
  overflow: auto;
  user-select: none;
}

.empty-workspace {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #999;
}

.empty-workspace .empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-workspace p {
  font-size: 16px;
  margin-bottom: 20px;
}

.add-agent-empty-btn {
  padding: 10px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.add-agent-empty-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
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

/* 新建智能体弹窗 */
.add-agent-modal {
  background: white;
  border-radius: 12px;
  width: 480px;
  max-width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #f0f0f0;
}

.btn-cancel {
  padding: 8px 20px;
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-confirm {
  padding: 8px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-confirm:disabled {
  background: #d9d9d9;
  cursor: not-allowed;
}

.form-row {
  margin-bottom: 16px;
}

.form-row label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  color: #333;
}

.form-row .required {
  color: #ff4d4f;
}

.form-input, .form-textarea, .form-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.form-input:focus, .form-textarea:focus, .form-select:focus {
  border-color: #667eea;
  outline: none;
}
</style>