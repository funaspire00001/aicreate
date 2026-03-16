<template>
  <div class="workflow-management">
    <div class="page-header">
      <h1>工作流管理</h1>
      <button class="add-workflow-btn" @click="showAddModal = true">
        <span class="plus-icon">+</span>
        新建工作流
      </button>
    </div>

    <!-- 工作流列表 -->
    <div class="workflows-list">
      <div 
        v-for="workflow in workflows" 
        :key="workflow.id"
        class="workflow-card"
      >
        <div class="workflow-header">
          <div class="workflow-info">
            <h3>{{ workflow.name }}</h3>
            <p class="workflow-description">{{ workflow.description || '无描述' }}</p>
          </div>
          <div class="workflow-actions">
            <button class="action-btn run-btn" @click="runWorkflow(workflow.id)">
              ▶ 运行
            </button>
            <button class="action-btn history-btn" @click="showExecutionHistory(workflow)">
              历史
            </button>
            <button class="action-btn edit-btn" @click="editWorkflow(workflow)">
              编辑
            </button>
            <button class="action-btn delete-btn" @click="deleteWorkflow(workflow.id)">
              删除
            </button>
          </div>
        </div>

        <div class="workflow-details">
          <div class="detail-row">
            <span class="detail-label">状态：</span>
            <span :class="['workflow-status', workflow.enabled ? 'enabled' : 'disabled']">
              {{ workflow.enabled ? '启用' : '禁用' }}
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">步骤数：</span>
            <span class="detail-value">{{ workflow.steps?.length || 0 }} 步</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">触发方式：</span>
            <span class="detail-value">{{ getTriggerType(workflow.trigger) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">最后运行：</span>
            <span class="detail-value">{{ formatTime(workflow.lastRun) }}</span>
          </div>
          <div class="detail-row" v-if="workflow.lastStatus">
            <span class="detail-label">执行状态：</span>
            <span :class="['execution-status', workflow.lastStatus]">
              {{ getStatusText(workflow.lastStatus) }}
            </span>
          </div>
        </div>

        <div class="workflow-steps">
          <h4>工作流步骤</h4>
          <div class="steps-container">
            <div 
              v-for="(step, index) in workflow.steps" 
              :key="index"
              class="step-item"
            >
              <div class="step-number">{{ index + 1 }}</div>
                              <div class="step-content">
                              <div class="step-name">{{ step.name }}</div>
                              <div class="step-agent">{{ step.agentName || step.agent }}</div>
                            </div>              <div v-if="index < workflow.steps.length - 1" class="step-arrow">→</div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="workflows.length === 0" class="empty-state">
        <p>暂无工作流，点击右上角按钮创建</p>
      </div>
    </div>

    <!-- 新建/编辑工作流模态框 -->
    <div v-if="showAddModal || showEditModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ showEditModal ? '编辑工作流' : '新建工作流' }}</h2>
          <button class="close-btn" @click="closeModal">&times;</button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="saveWorkflow">
            <div class="form-group">
              <label for="workflow-name">工作流名称</label>
              <input 
                type="text" 
                id="workflow-name" 
                v-model="formData.name" 
                required
              >
            </div>

            <div class="form-group">
              <label for="workflow-description">描述</label>
              <textarea 
                id="workflow-description" 
                v-model="formData.description"
                rows="3"
              ></textarea>
            </div>

            <div class="form-group">
              <label for="workflow-trigger">触发方式</label>
              <select 
                id="workflow-trigger" 
                v-model="formData.trigger" 
                required
              >
                <option value="manual">手动触发</option>
                <option value="webhook">Webhook</option>
                <option value="schedule">定时任务</option>
                <option value="event">事件触发</option>
              </select>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  v-model="formData.enabled"
                >
                启用工作流
              </label>
            </div>

            <div class="form-group">
              <label>工作流步骤</label>
              <div class="steps-editor">
                <div 
                  v-for="(step, index) in formData.steps" 
                  :key="index"
                  class="step-editor-item"
                >
                  <div class="step-header">
                    <span class="step-number">{{ index + 1 }}</span>
                    <button 
                      type="button" 
                      class="remove-step-btn"
                      @click="removeStep(index)"
                    >
                      ×
                    </button>
                  </div>
                  <div class="step-form">
                    <input 
                      type="text" 
                      v-model="step.name" 
                      placeholder="步骤名称"
                      required
                    >
                    <select 
                      v-model="step.agentId" 
                      required
                      @change="onAgentSelect(step)"
                    >
                      <option value="">选择智能体</option>
                      <option 
                        v-for="agent in availableAgents" 
                        :key="agent.id"
                        :value="agent.id"
                      >
                        {{ agent.name }} ({{ agent.role }})
                      </option>
                    </select>
                    <textarea 
                      v-model="step.prompt" 
                      placeholder="步骤提示词"
                      rows="2"
                    ></textarea>
                  </div>
                </div>
                <button 
                  type="button" 
                  class="add-step-btn"
                  @click="addStep"
                >
                  + 添加步骤
                </button>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn cancel-btn" @click="closeModal">
                取消
              </button>
              <button type="submit" class="btn save-btn">
                {{ showEditModal ? '保存修改' : '创建工作流' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- 执行历史模态框 -->
    <div v-if="showHistoryModal" class="modal-overlay">
      <div class="modal-content history-modal">
        <div class="modal-header">
          <h2>执行历史 - {{ selectedWorkflow?.name }}</h2>
          <button class="close-btn" @click="closeHistoryModal">&times;</button>
        </div>

        <div class="modal-body">
          <div v-if="loadingHistory" class="loading-state">
            加载中...
          </div>
          
          <div v-else-if="executionHistory.length === 0" class="empty-state">
            暂无执行记录
          </div>
          
          <div v-else class="history-list">
            <div 
              v-for="execution in executionHistory" 
              :key="execution.id"
              class="history-item"
              @click="showExecutionDetail(execution)"
            >
              <div class="history-header">
                <span :class="['status-badge', execution.status]">
                  {{ getStatusText(execution.status) }}
                </span>
                <span class="history-time">{{ formatTime(execution.startTime) }}</span>
              </div>
              <div class="history-info">
                <div class="info-row">
                  <span class="info-label">输入：</span>
                  <span class="info-value">{{ truncateText(execution.input, 50) }}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">耗时：</span>
                  <span class="info-value">{{ execution.duration || 0 }}ms</span>
                </div>
                <div class="info-row">
                  <span class="info-label">步骤：</span>
                  <span class="info-value">
                    {{ execution.steps?.filter(s => s.status === 'success').length || 0 }}/{{ execution.steps?.length || 0 }} 完成
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 执行详情模态框 -->
    <div v-if="showDetailModal" class="modal-overlay" @click.self="closeDetailModal">
      <div class="modal-content detail-modal">
        <div class="modal-header">
          <h2>执行详情</h2>
          <button class="close-btn" @click="closeDetailModal">&times;</button>
        </div>

        <div class="modal-body" v-if="selectedExecution">
          <div class="detail-section">
            <h3>基本信息</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">执行ID：</span>
                <span class="info-value">{{ selectedExecution.id }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">状态：</span>
                <span :class="['status-badge', selectedExecution.status]">
                  {{ getStatusText(selectedExecution.status) }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">开始时间：</span>
                <span class="info-value">{{ formatTime(selectedExecution.startTime) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">结束时间：</span>
                <span class="info-value">{{ formatTime(selectedExecution.endTime) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">总耗时：</span>
                <span class="info-value">{{ selectedExecution.duration || 0 }}ms</span>
              </div>
              <div class="info-item">
                <span class="info-label">触发方式：</span>
                <span class="info-value">{{ selectedExecution.triggeredBy || 'manual' }}</span>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <h3>输入内容</h3>
            <div class="code-block">
              {{ formatInput(selectedExecution.input) }}
            </div>
          </div>

          <div class="detail-section">
            <h3>步骤执行详情</h3>
            <div class="steps-detail">
              <div 
                v-for="(step, index) in selectedExecution.steps" 
                :key="index"
                class="step-detail-item"
              >
                <div class="step-header-row">
                  <span class="step-num">{{ index + 1 }}</span>
                  <span class="step-title">{{ step.name }}</span>
                  <span :class="['step-status', step.status]">
                    {{ getStatusText(step.status) }}
                  </span>
                  <span class="step-duration" v-if="step.duration">{{ step.duration }}ms</span>
                </div>
                <div class="step-info" v-if="step.agentName">
                  <span class="info-label">智能体：</span>
                  <span class="info-value">{{ step.agentName }}</span>
                </div>
                <div class="step-info" v-if="step.error">
                  <span class="info-label error">错误：</span>
                  <span class="info-value error">{{ step.error }}</span>
                </div>
                <div class="step-output" v-if="step.output">
                  <div class="output-header" @click="toggleStepOutput(index)">
                    <span>输出内容</span>
                    <span class="toggle-icon">{{ expandedSteps.includes(index) ? '▼' : '▶' }}</span>
                  </div>
                  <div class="output-content" v-if="expandedSteps.includes(index)">
                    {{ step.output }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="detail-section" v-if="selectedExecution.output">
            <h3>最终输出</h3>
            <div class="code-block">
              {{ truncateText(selectedExecution.output, 500) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const workflows = ref([])
const availableAgents = ref([])
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingWorkflowId = ref(null)

// 执行历史相关
const showHistoryModal = ref(false)
const showDetailModal = ref(false)
const selectedWorkflow = ref(null)
const executionHistory = ref([])
const selectedExecution = ref(null)
const loadingHistory = ref(false)
const expandedSteps = ref([])

const formData = ref({
  name: '',
  description: '',
  trigger: 'manual',
  enabled: true,
  steps: []
})

const fetchWorkflows = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/workflows')
    const data = await response.json()
    if (data.success) {
      workflows.value = data.workflows || []
    }
  } catch (error) {
    console.error('获取工作流列表失败:', error)
  }
}

const fetchAgents = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/agents')
    const data = await response.json()
    if (data.success) {
      availableAgents.value = data.agents || []
    }
  } catch (error) {
    console.error('获取智能体列表失败:', error)
  }
}

const saveWorkflow = async () => {
  try {
    const url = showEditModal.value 
      ? `http://localhost:3001/api/workflows/${editingWorkflowId.value}`
      : 'http://localhost:3001/api/workflows'
    
    const method = showEditModal.value ? 'PUT' : 'POST'
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData.value)
    })
    
    const data = await response.json()
    if (data.success) {
      await fetchWorkflows()
      closeModal()
    }
  } catch (error) {
    console.error('保存工作流失败:', error)
  }
}

const editWorkflow = (workflow) => {
  editingWorkflowId.value = workflow.id
  formData.value = { ...workflow }
  showEditModal.value = true
}

const deleteWorkflow = async (workflowId) => {
  if (confirm('确定要删除这个工作流吗？')) {
    try {
      const response = await fetch(`http://localhost:3001/api/workflows/${workflowId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        await fetchWorkflows()
      }
    } catch (error) {
      console.error('删除工作流失败:', error)
    }
  }
}

const runWorkflow = async (workflowId) => {
  try {
    const response = await fetch(`http://localhost:3001/api/workflows/${workflowId}/run`, {
      method: 'POST'
    })
    const data = await response.json()
    if (data.success) {
      alert('工作流已启动')
    }
  } catch (error) {
    console.error('运行工作流失败:', error)
    alert('工作流启动失败')
  }
}

const addStep = () => {
  formData.value.steps.push({
    name: '',
    agentId: '',
    agentName: '',
    prompt: ''
  })
}

const removeStep = (index) => {
  formData.value.steps.splice(index, 1)
}

const onAgentSelect = (step) => {
  const agent = availableAgents.value.find(a => a.id === step.agentId)
  if (agent) {
    step.agentName = agent.name
  }
}

const getTriggerType = (trigger) => {
  const types = {
    manual: '手动触发',
    webhook: 'Webhook',
    schedule: '定时任务',
    event: '事件触发'
  }
  return types[trigger] || trigger
}

const formatTime = (time) => {
  if (!time) return '从未运行'
  return new Date(time).toLocaleString('zh-CN')
}

const closeModal = () => {
  showAddModal.value = false
  showEditModal.value = false
  editingWorkflowId.value = null
  formData.value = {
    name: '',
    description: '',
    trigger: 'manual',
    enabled: true,
    steps: []
  }
}

// 执行历史相关函数
const showExecutionHistory = async (workflow) => {
  selectedWorkflow.value = workflow
  showHistoryModal.value = true
  loadingHistory.value = true
  executionHistory.value = []
  
  try {
    const response = await fetch(`http://localhost:3001/api/workflows/${workflow.id}/executions`)
    const data = await response.json()
    if (data.success) {
      executionHistory.value = data.executions || []
    }
  } catch (error) {
    console.error('获取执行历史失败:', error)
  } finally {
    loadingHistory.value = false
  }
}

const closeHistoryModal = () => {
  showHistoryModal.value = false
  selectedWorkflow.value = null
  executionHistory.value = []
}

const showExecutionDetail = async (execution) => {
  try {
    const response = await fetch(`http://localhost:3001/api/workflows/execution/${execution.id}`)
    const data = await response.json()
    if (data.success) {
      selectedExecution.value = data.execution
      expandedSteps.value = []
      showDetailModal.value = true
    }
  } catch (error) {
    console.error('获取执行详情失败:', error)
  }
}

const closeDetailModal = () => {
  showDetailModal.value = false
  selectedExecution.value = null
  expandedSteps.value = []
}

const toggleStepOutput = (index) => {
  const idx = expandedSteps.value.indexOf(index)
  if (idx > -1) {
    expandedSteps.value.splice(idx, 1)
  } else {
    expandedSteps.value.push(index)
  }
}

const getStatusText = (status) => {
  const statusMap = {
    pending: '等待中',
    running: '执行中',
    success: '成功',
    failed: '失败'
  }
  return statusMap[status] || status
}

const truncateText = (text, maxLength = 100) => {
  if (!text) return ''
  const str = typeof text === 'object' ? JSON.stringify(text) : text
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str
}

const formatInput = (input) => {
  if (!input) return ''
  if (typeof input === 'object') {
    return JSON.stringify(input, null, 2)
  }
  return input
}

onMounted(async () => {
  await fetchWorkflows()
  await fetchAgents()
})
</script>

<style scoped>
.workflow-management {
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
  font-weight: 600;
}

.add-workflow-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.add-workflow-btn:hover {
  background: #40a9ff;
}

.plus-icon {
  font-size: 16px;
  font-weight: bold;
}

.workflows-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.workflow-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid #f0f0f0;
}

.workflow-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.workflow-info h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
}

.workflow-description {
  margin: 0;
  font-size: 14px;
  color: #666;
  line-height: 1.4;
}

.workflow-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  padding: 4px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s;
}

.run-btn:hover {
  border-color: #52c41a;
  color: #52c41a;
}

.edit-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.delete-btn:hover {
  border-color: #ff4d4f;
  color: #ff4d4f;
}

.workflow-details {
  margin-bottom: 16px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 6px;
}

.detail-row {
  display: flex;
  margin-bottom: 8px;
  font-size: 14px;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-label {
  width: 100px;
  color: #999;
  flex-shrink: 0;
}

.detail-value {
  color: #333;
  font-weight: 500;
}

.workflow-status {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.workflow-status.enabled {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.workflow-status.disabled {
  background: #fff1f0;
  color: #ff4d4f;
  border: 1px solid #ffccc7;
}

.workflow-steps {
  margin-top: 16px;
}

.workflow-steps h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.steps-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.step-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #1890ff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.step-content {
  flex: 1;
}

.step-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.step-agent {
  font-size: 12px;
  color: #999;
}

.step-arrow {
  color: #d9d9d9;
  font-size: 16px;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  color: #999;
  background: #fafafa;
  border-radius: 8px;
  border: 2px dashed #e8e8e8;
}

/* 模态框样式 */
.modal-overlay {
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

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 700px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.3s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: normal;
}

.steps-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.step-editor-item {
  background: #f9f9f9;
  border-radius: 6px;
  padding: 16px;
  border: 1px solid #e8e8e8;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.step-editor-item .step-number {
  background: #1890ff;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.remove-step-btn {
  background: none;
  border: none;
  color: #ff4d4f;
  cursor: pointer;
  font-size: 18px;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-step-btn:hover {
  background: #fff1f0;
  border-radius: 4px;
}

.step-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-form input,
.step-form select,
.step-form textarea {
  padding: 6px 10px;
  font-size: 13px;
}

.add-step-btn {
  padding: 8px 16px;
  background: #f0f5ff;
  color: #1890ff;
  border: 1px dashed #1890ff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.add-step-btn:hover {
  background: #1890ff;
  color: white;
  border-style: solid;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #f0f0f0;
  margin-top: 20px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.cancel-btn {
  background: white;
  color: #333;
}

.cancel-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.save-btn {
  background: #1890ff;
  color: white;
  border-color: #1890ff;
}

.save-btn:hover {
  background: #40a9ff;
  border-color: #40a9ff;
}

/* 执行历史按钮 */
.history-btn:hover {
  border-color: #722ed1;
  color: #722ed1;
}

/* 执行状态 */
.execution-status {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.execution-status.success {
  background: #f6ffed;
  color: #52c41a;
}

.execution-status.failed {
  background: #fff1f0;
  color: #ff4d4f;
}

.execution-status.running {
  background: #e6f7ff;
  color: #1890ff;
}

/* 历史模态框 */
.history-modal {
  max-width: 800px;
}

.loading-state {
  text-align: center;
  padding: 40px;
  color: #999;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  background: #f9f9f9;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #e8e8e8;
}

.history-item:hover {
  background: #f0f5ff;
  border-color: #1890ff;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.status-badge {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.success {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.status-badge.failed {
  background: #fff1f0;
  color: #ff4d4f;
  border: 1px solid #ffccc7;
}

.status-badge.running {
  background: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
}

.status-badge.pending {
  background: #f5f5f5;
  color: #999;
  border: 1px solid #d9d9d9;
}

.history-time {
  font-size: 12px;
  color: #999;
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-row {
  display: flex;
  font-size: 13px;
}

.info-label {
  color: #999;
  width: 60px;
  flex-shrink: 0;
}

.info-value {
  color: #333;
}

/* 执行详情模态框 */
.detail-modal {
  max-width: 900px;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section h3 {
  margin: 0 0 12px 0;
  font-size: 15px;
  font-weight: 600;
  color: #333;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: center;
  font-size: 13px;
}

.info-item .info-label {
  color: #999;
  width: 80px;
  flex-shrink: 0;
}

.info-item .info-value {
  color: #333;
}

.code-block {
  background: #f5f5f5;
  border-radius: 6px;
  padding: 12px;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}

.steps-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-detail-item {
  background: #fafafa;
  border-radius: 6px;
  padding: 12px;
  border: 1px solid #e8e8e8;
}

.step-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.step-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #1890ff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}

.step-title {
  font-weight: 500;
  flex: 1;
}

.step-status {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.step-status.success {
  background: #f6ffed;
  color: #52c41a;
}

.step-status.failed {
  background: #fff1f0;
  color: #ff4d4f;
}

.step-status.running {
  background: #e6f7ff;
  color: #1890ff;
}

.step-status.pending {
  background: #f5f5f5;
  color: #999;
}

.step-duration {
  font-size: 12px;
  color: #999;
}

.step-info {
  font-size: 13px;
  margin-bottom: 4px;
}

.step-info .info-label.error {
  color: #ff4d4f;
}

.step-info .info-value.error {
  color: #ff4d4f;
}

.step-output {
  margin-top: 8px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f0f0f0;
  cursor: pointer;
  font-size: 13px;
  color: #666;
}

.output-header:hover {
  background: #e6e6e6;
}

.toggle-icon {
  font-size: 10px;
}

.output-content {
  padding: 12px;
  background: #fff;
  font-family: monospace;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 300px;
  overflow-y: auto;
}
</style>