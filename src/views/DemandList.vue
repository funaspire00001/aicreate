<template>
  <div class="demand-list">
    <div class="page-header">
      <h1>需求管理</h1>
      <button class="add-btn" @click="showAddModal = true">
        <span>+</span> 新建需求
      </button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">总需求</div>
      </div>
      <div class="stat-card pending">
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">待处理</div>
      </div>
      <div class="stat-card processing">
        <div class="stat-value">{{ stats.processing }}</div>
        <div class="stat-label">处理中</div>
      </div>
      <div class="stat-card completed">
        <div class="stat-value">{{ stats.completed }}</div>
        <div class="stat-label">已完成</div>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="filters">
      <select v-model="filterStatus" @change="fetchDemands">
        <option value="">全部状态</option>
        <option value="pending">待处理</option>
        <option value="processing">处理中</option>
        <option value="completed">已完成</option>
        <option value="failed">失败</option>
      </select>
      <select v-model="filterSource" @change="fetchDemands">
        <option value="">全部来源</option>
        <option value="manual">手动输入</option>
        <option value="web">网页</option>
        <option value="feedback">反馈</option>
        <option value="import">导入</option>
      </select>
    </div>

    <!-- 需求列表 -->
    <div class="demands-list">
      <div 
        v-for="demand in demands" 
        :key="demand.id"
        class="demand-card"
      >
        <div class="demand-header">
          <div class="demand-info">
            <h3>{{ demand.theme }}</h3>
            <div class="demand-meta">
              <span :class="['status-badge', demand.status]">
                {{ getStatusText(demand.status) }}
              </span>
              <span class="source">{{ getSourceText(demand.source) }}</span>
              <span class="time">{{ formatTime(demand.createdAt) }}</span>
            </div>
          </div>
          <div class="demand-actions">
            <button 
              v-if="demand.status === 'pending'"
              class="action-btn run-btn" 
              @click="runWorkflow(demand)"
              :disabled="runningId === demand.id"
            >
              {{ runningId === demand.id ? '运行中...' : '▶ 执行' }}
            </button>
            <button class="action-btn edit-btn" @click="editDemand(demand)">
              编辑
            </button>
            <button class="action-btn delete-btn" @click="deleteDemand(demand.id)">
              删除
            </button>
          </div>
        </div>

        <div class="demand-content" v-if="demand.content">
          {{ demand.content }}
        </div>

        <!-- 执行结果展示 -->
        <div class="demand-result" v-if="demand.status === 'completed'">
          <div class="result-item" v-if="demand.cardCount > 0">
            <span class="label">生成卡片：</span>
            <span class="value">{{ demand.cardCount }} 张</span>
          </div>
          <div class="result-item" v-if="demand.knowledgeTree">
            <span class="label">知识体系：</span>
            <span class="value">已构建</span>
          </div>
        </div>

        <!-- 错误信息 -->
        <div class="error-message" v-if="demand.status === 'failed' && demand.errorMessage">
          {{ demand.errorMessage }}
        </div>
      </div>

      <div v-if="demands.length === 0" class="empty-state">
        暂无需求，点击右上角按钮创建
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="pagination.pages > 1">
      <button 
        :disabled="pagination.page <= 1" 
        @click="changePage(pagination.page - 1)"
      >
        上一页
      </button>
      <span>{{ pagination.page }} / {{ pagination.pages }}</span>
      <button 
        :disabled="pagination.page >= pagination.pages" 
        @click="changePage(pagination.page + 1)"
      >
        下一页
      </button>
    </div>

    <!-- 新建/编辑模态框 -->
    <div v-if="showAddModal || showEditModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ showEditModal ? '编辑需求' : '新建需求' }}</h2>
          <button class="close-btn" @click="closeModal">&times;</button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="saveDemand">
            <div class="form-group">
              <label>主题 *</label>
              <input 
                type="text" 
                v-model="formData.theme" 
                placeholder="输入主题，如：人工智能最新进展"
                required
              >
            </div>

            <div class="form-group">
              <label>详细内容</label>
              <textarea 
                v-model="formData.content" 
                placeholder="输入详细描述、关键信息..."
                rows="4"
              ></textarea>
            </div>

            <div class="form-group">
              <label>标签</label>
              <input 
                type="text" 
                v-model="formData.tagsInput" 
                placeholder="用逗号分隔多个标签"
              >
            </div>

            <div class="form-group">
              <label>优先级</label>
              <select v-model="formData.priority">
                <option value="low">低</option>
                <option value="normal">普通</option>
                <option value="high">高</option>
              </select>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn cancel-btn" @click="closeModal">
                取消
              </button>
              <button type="submit" class="btn save-btn">
                {{ showEditModal ? '保存' : '创建' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'

const demands = ref([])
const stats = reactive({
  total: 0,
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0
})
const filterStatus = ref('')
const filterSource = ref('')
const pagination = reactive({
  page: 1,
  limit: 20,
  total: 0,
  pages: 0
})

const showAddModal = ref(false)
const showEditModal = ref(false)
const runningId = ref(null)

const formData = ref({
  theme: '',
  content: '',
  tagsInput: '',
  priority: 'normal'
})

const fetchDemands = async () => {
  try {
    const params = new URLSearchParams({
      page: pagination.page,
      limit: pagination.limit
    })
    if (filterStatus.value) params.append('status', filterStatus.value)
    if (filterSource.value) params.append('source', filterSource.value)
    
    const response = await fetch(`http://localhost:3001/api/demands?${params}`)
    const data = await response.json()
    if (data.success) {
      demands.value = data.demands
      pagination.total = data.pagination.total
      pagination.pages = data.pagination.pages
    }
  } catch (error) {
    console.error('获取需求列表失败:', error)
  }
}

const fetchStats = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/demands/stats/overview')
    const data = await response.json()
    if (data.success) {
      Object.assign(stats, data.stats)
    }
  } catch (error) {
    console.error('获取统计失败:', error)
  }
}

const saveDemand = async () => {
  try {
    const tags = formData.value.tagsInput
      ? formData.value.tagsInput.split(',').map(t => t.trim()).filter(t => t)
      : []
    
    const payload = {
      theme: formData.value.theme,
      content: formData.value.content,
      tags,
      priority: formData.value.priority
    }
    
    let url = 'http://localhost:3001/api/demands'
    let method = 'POST'
    
    if (showEditModal.value) {
      url += `/${editingId.value}`
      method = 'PUT'
    }
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    const data = await response.json()
    if (data.success) {
      await fetchDemands()
      await fetchStats()
      closeModal()
    }
  } catch (error) {
    console.error('保存需求失败:', error)
    alert('保存失败: ' + error.message)
  }
}

let editingId = null

const editDemand = (demand) => {
  editingId = demand.id
  formData.value = {
    theme: demand.theme,
    content: demand.content || '',
    tagsInput: demand.tags?.join(', ') || '',
    priority: demand.priority
  }
  showEditModal.value = true
}

const deleteDemand = async (id) => {
  if (confirm('确定要删除这个需求吗？')) {
    try {
      const response = await fetch(`http://localhost:3001/api/demands/${id}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        await fetchDemands()
        await fetchStats()
      }
    } catch (error) {
      console.error('删除需求失败:', error)
    }
  }
}

const runWorkflow = async (demand) => {
  runningId.value = demand.id
  
  try {
    // 更新需求状态为处理中
    await fetch(`http://localhost:3001/api/demands/${demand.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'processing' })
    })
    
    await fetchDemands()
    await fetchStats()
    
    // 调用工作流执行
    const response = await fetch('http://localhost:3001/api/workflows/knowledge-card-flow/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: {
          demandId: demand.id,
          theme: demand.theme,
          content: demand.content,
          tags: demand.tags
        }
      })
    })
    
    const data = await response.json()
    if (data.success) {
      alert('工作流已启动，请在执行历史中查看进度')
      // 刷新列表
      setTimeout(() => {
        fetchDemands()
        fetchStats()
      }, 2000)
    } else {
      alert('启动失败: ' + data.error)
    }
  } catch (error) {
    console.error('执行工作流失败:', error)
    alert('执行失败: ' + error.message)
  } finally {
    runningId.value = null
  }
}

const closeModal = () => {
  showAddModal.value = false
  showEditModal.value = false
  editingId = null
  formData.value = {
    theme: '',
    content: '',
    tagsInput: '',
    priority: 'normal'
  }
}

const changePage = (page) => {
  pagination.page = page
  fetchDemands()
}

const getStatusText = (status) => {
  const map = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    failed: '失败'
  }
  return map[status] || status
}

const getSourceText = (source) => {
  const map = {
    manual: '手动输入',
    web: '网页',
    feedback: '反馈',
    import: '导入'
  }
  return map[source] || source
}

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

onMounted(() => {
  fetchDemands()
  fetchStats()
})
</script>

<style scoped>
.demand-list {
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

.add-btn {
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
}

.add-btn:hover {
  background: #40a9ff;
}

/* 统计卡片 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: #333;
}

.stat-card.pending .stat-value { color: #faad14; }
.stat-card.processing .stat-value { color: #1890ff; }
.stat-card.completed .stat-value { color: #52c41a; }

.stat-label {
  font-size: 14px;
  color: #999;
  margin-top: 4px;
}

/* 筛选 */
.filters {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.filters select {
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
}

/* 需求列表 */
.demands-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.demand-card {
  background: white;
  border-radius: 8px;
  padding: 16px 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.demand-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.demand-info h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.demand-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 12px;
  color: #999;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.status-badge.pending { background: #fffbe6; color: #faad14; }
.status-badge.processing { background: #e6f7ff; color: #1890ff; }
.status-badge.completed { background: #f6ffed; color: #52c41a; }
.status-badge.failed { background: #fff1f0; color: #ff4d4f; }

.demand-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 4px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 12px;
}

.run-btn {
  border-color: #52c41a;
  color: #52c41a;
}

.run-btn:hover:not(:disabled) {
  background: #52c41a;
  color: white;
}

.run-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.edit-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.delete-btn:hover {
  border-color: #ff4d4f;
  color: #ff4d4f;
}

.demand-content {
  margin-top: 12px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 6px;
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

.demand-result {
  margin-top: 12px;
  display: flex;
  gap: 24px;
  font-size: 13px;
}

.result-item .label {
  color: #999;
}

.result-item .value {
  color: #52c41a;
  font-weight: 500;
}

.error-message {
  margin-top: 12px;
  padding: 12px;
  background: #fff1f0;
  border-radius: 6px;
  color: #ff4d4f;
  font-size: 13px;
}

.empty-state {
  text-align: center;
  padding: 60px;
  color: #999;
  background: #fafafa;
  border-radius: 8px;
  border: 2px dashed #e8e8e8;
}

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 模态框 */
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
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
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
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
}

.btn {
  padding: 8px 20px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.cancel-btn {
  background: white;
  border: 1px solid #d9d9d9;
}

.save-btn {
  background: #1890ff;
  border: none;
  color: white;
}

.save-btn:hover {
  background: #40a9ff;
}
</style>
