<template>
  <div class="sync-task-management">
    <div class="header">
      <div>
        <h1>同步任务管理</h1>
        <p class="subtitle">管理智能体间的数据同步任务</p>
      </div>
      <div class="header-actions">
        <button class="trigger-btn" @click="triggerAllSync" :disabled="syncing">
          {{ syncing ? '同步中...' : '立即同步全部' }}
        </button>
        <button class="add-btn" @click="openAddModal">
          <span>+</span> 创建同步任务
        </button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total || 0 }}</div>
        <div class="stat-label">总任务数</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">{{ stats.byStatus?.success?.count || 0 }}</div>
        <div class="stat-label">成功</div>
      </div>
      <div class="stat-card pending">
        <div class="stat-value">{{ stats.byStatus?.pending?.count || 0 }}</div>
        <div class="stat-label">待执行</div>
      </div>
      <div class="stat-card fail">
        <div class="stat-value">{{ stats.byStatus?.fail?.count || 0 }}</div>
        <div class="stat-label">失败</div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="error-message">
      {{ error }}
      <button class="close-btn" @click="error = ''">×</button>
    </div>

    <!-- 任务列表 -->
    <div class="tasks-section">
      <div class="section-header">
        <h2>同步任务列表</h2>
        <div class="filter-buttons">
          <button
            :class="['filter-btn', { active: statusFilter === 'all' }]"
            @click="statusFilter = 'all'"
          >全部</button>
          <button
            :class="['filter-btn', { active: statusFilter === 'success' }]"
            @click="statusFilter = 'success'"
          >成功</button>
          <button
            :class="['filter-btn', { active: statusFilter === 'pending' }]"
            @click="statusFilter = 'pending'"
          >待执行</button>
          <button
            :class="['filter-btn', { active: statusFilter === 'fail' }]"
            @click="statusFilter = 'fail'"
          >失败</button>
        </div>
      </div>

      <div v-if="loading" class="loading-state">
        <p>加载中...</p>
      </div>

      <div v-else-if="filteredTasks.length === 0" class="empty-state">
        <p>暂无同步任务，点击"创建同步任务"添加新任务</p>
      </div>

      <div v-else class="tasks-grid">
        <div
          v-for="task in filteredTasks"
          :key="task._id"
          class="task-card"
          :class="task.lastStatus"
        >
          <div class="task-header">
            <div class="task-info">
              <h3 class="task-title">
                {{ task.consumerAgentId }} ← {{ task.producerAgentId }}
              </h3>
              <span class="task-collection">{{ task.sourceCollection }}</span>
            </div>
            <div class="task-status">
              <span class="status-badge" :class="task.lastStatus">
                {{ getStatusText(task.lastStatus) }}
              </span>
            </div>
          </div>

          <div class="task-details">
            <div class="detail-item">
              <span class="detail-label">上次同步:</span>
              <span class="detail-value">{{ formatDate(task.lastRunAt) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">同步条数:</span>
              <span class="detail-value">{{ task.lastSyncCount || 0 }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">水位线:</span>
              <span class="detail-value">{{ formatDate(task.lastSyncWatermark) }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">累计同步:</span>
              <span class="detail-value">{{ task.totalSyncCount || 0 }}</span>
            </div>
            <div v-if="task.retryCount > 0" class="detail-item warning">
              <span class="detail-label">重试次数:</span>
              <span class="detail-value">{{ task.retryCount }}/{{ task.maxRetries }}</span>
            </div>
            <div v-if="task.errorMsg" class="detail-item error">
              <span class="detail-label">错误信息:</span>
              <span class="detail-value">{{ task.errorMsg }}</span>
            </div>
          </div>

          <div class="task-actions">
            <button class="action-btn primary" @click="triggerSync(task)" :disabled="syncing">
              立即同步
            </button>
            <button v-if="task.retryCount > 0" class="action-btn secondary" @click="resetRetry(task)">
              重置重试
            </button>
            <button class="action-btn danger" @click="deleteTask(task)">
              删除
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建任务弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2>创建同步任务</h2>
          <button class="close-btn" @click="closeModal">×</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>消费者智能体 ID *</label>
            <input v-model="formData.consumerAgentId" type="text" placeholder="接收数据的智能体ID" />
          </div>

          <div class="form-group">
            <label>生产者智能体 ID *</label>
            <input v-model="formData.producerAgentId" type="text" placeholder="提供数据的智能体ID" />
          </div>

          <div class="form-group">
            <label>数据源表名 *</label>
            <input v-model="formData.sourceCollection" type="text" placeholder="如: demands, keypoints" />
          </div>

          <div class="form-group">
            <label>最大重试次数</label>
            <input v-model.number="formData.maxRetries" type="number" min="1" max="10" />
          </div>
        </div>

        <div class="modal-footer">
          <button class="action-btn secondary" @click="closeModal">取消</button>
          <button class="action-btn primary" @click="saveTask" :disabled="saving">
            {{ saving ? '创建中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const API_BASE = '/api/sync-tasks'

// 数据
const tasks = ref([])
const stats = ref({})
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const syncing = ref(false)

// 过滤
const statusFilter = ref('all')

// 弹窗
const showModal = ref(false)
const formData = ref({
  consumerAgentId: '',
  producerAgentId: '',
  sourceCollection: '',
  maxRetries: 3
})

// 计算属性
const filteredTasks = computed(() => {
  if (statusFilter.value === 'all') return tasks.value
  return tasks.value.filter(t => t.lastStatus === statusFilter.value)
})

// 方法
const getStatusText = (status) => {
  const map = {
    pending: '待执行',
    success: '成功',
    fail: '失败',
    processing: '执行中'
  }
  return map[status] || status
}

const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

// 获取任务列表
const fetchTasks = async () => {
  loading.value = true
  error.value = ''

  try {
    const [tasksRes, statsRes] = await Promise.all([
      axios.get(API_BASE),
      axios.get(`${API_BASE}/stats/summary`)
    ])

    if (tasksRes.data.success) {
      tasks.value = tasksRes.data.data
    }
    if (statsRes.data.success) {
      stats.value = statsRes.data.data
    }
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    loading.value = false
  }
}

// 打开弹窗
const openAddModal = () => {
  formData.value = {
    consumerAgentId: '',
    producerAgentId: '',
    sourceCollection: '',
    maxRetries: 3
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

// 创建任务
const saveTask = async () => {
  if (!formData.value.consumerAgentId || !formData.value.producerAgentId || !formData.value.sourceCollection) {
    error.value = '请填写所有必填字段'
    return
  }

  saving.value = true
  error.value = ''

  try {
    const response = await axios.post(API_BASE, formData.value)
    if (response.data.success) {
      closeModal()
      fetchTasks()
    } else {
      error.value = response.data.error
    }
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    saving.value = false
  }
}

// 触发单个同步
const triggerSync = async (task) => {
  try {
    syncing.value = true
    const response = await axios.post(`${API_BASE}/${task._id}/trigger`)
    if (response.data.success) {
      fetchTasks()
    } else {
      error.value = response.data.error
    }
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    syncing.value = false
  }
}

// 触发全部同步
const triggerAllSync = async () => {
  try {
    syncing.value = true
    const response = await axios.post(`${API_BASE}/trigger-all`)
    if (response.data.success) {
      fetchTasks()
    } else {
      error.value = response.data.error
    }
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  } finally {
    syncing.value = false
  }
}

// 重置重试计数
const resetRetry = async (task) => {
  try {
    await axios.post(`${API_BASE}/${task._id}/reset-retry`)
    fetchTasks()
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  }
}

// 删除任务
const deleteTask = async (task) => {
  if (!confirm(`确定要删除此同步任务吗？`)) return

  try {
    await axios.delete(`${API_BASE}/${task._id}`)
    fetchTasks()
  } catch (err) {
    error.value = err.response?.data?.error || err.message
  }
}

onMounted(() => {
  fetchTasks()
})
</script>

<style scoped>
.sync-task-management {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

h1 {
  margin: 0 0 8px 0;
  color: #333;
}

.subtitle {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

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

.add-btn:hover {
  background: #5a6fd6;
}

.trigger-btn {
  padding: 10px 20px;
  background: #52c41a;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.trigger-btn:hover:not(:disabled) {
  background: #389e0d;
}

.trigger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  text-align: center;
  border-top: 3px solid #667eea;
}

.stat-card.success {
  border-top-color: #52c41a;
}

.stat-card.pending {
  border-top-color: #faad14;
}

.stat-card.fail {
  border-top-color: #f5222d;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 14px;
  color: #666;
}

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

.tasks-section {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-header h2 {
  font-size: 18px;
  color: #333;
  margin: 0;
}

.filter-buttons {
  display: flex;
  gap: 8px;
}

.filter-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 20px;
  background: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.filter-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.filter-btn.active {
  background: #667eea;
  border-color: #667eea;
  color: white;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 48px;
  color: #999;
}

.tasks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 16px;
}

.task-card {
  background: #fafafa;
  border-radius: 12px;
  padding: 20px;
  border-left: 4px solid #ddd;
}

.task-card.success {
  border-left-color: #52c41a;
}

.task-card.pending {
  border-left-color: #faad14;
}

.task-card.fail {
  border-left-color: #f5222d;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.task-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: #333;
}

.task-collection {
  font-size: 12px;
  color: #666;
  font-family: monospace;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.success {
  background: #f6ffed;
  color: #52c41a;
}

.status-badge.pending {
  background: #fffbe6;
  color: #faad14;
}

.status-badge.fail {
  background: #fff1f0;
  color: #f5222d;
}

.status-badge.processing {
  background: #e6f7ff;
  color: #1890ff;
}

.task-details {
  margin-bottom: 16px;
}

.detail-item {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}

.detail-item.warning .detail-value {
  color: #faad14;
  font-weight: 500;
}

.detail-item.error .detail-value {
  color: #f5222d;
}

.detail-label {
  color: #999;
  min-width: 70px;
}

.detail-value {
  color: #333;
}

.task-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.action-btn.primary {
  background: #667eea;
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  background: #5a6fd6;
}

.action-btn.secondary {
  background: #f0f0f0;
  color: #666;
}

.action-btn.secondary:hover {
  background: #e0e0e0;
}

.action-btn.danger {
  background: #ff4d4f;
  color: white;
}

.action-btn.danger:hover {
  background: #ff7875;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Modal */
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

.modal {
  background: white;
  border-radius: 16px;
  width: 480px;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
}

.modal-header .close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 0;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #667eea;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #eee;
}
</style>
