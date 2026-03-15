<template>
  <div class="feedback-list">
    <div class="page-header">
      <h1>用户需求</h1>
      <div class="filters">
        <select v-model="filters.status" @change="fetchFeedbacks">
          <option value="">全部状态</option>
          <option value="PENDING">待处理</option>
          <option value="PROCESSING">处理中</option>
          <option value="PROCESSED">已处理</option>
        </select>
        <select v-model="filters.feedbackType" @change="fetchFeedbacks">
          <option value="">全部类型</option>
          <option value="CARD">卡片反馈</option>
          <option value="CARD_SET">卡册反馈</option>
          <option value="SUGGESTION">新需求</option>
        </select>
        <button class="refresh-btn" @click="fetchFeedbacks" :disabled="loading">
          {{ loading ? '刷新中...' : '刷新' }}
        </button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-value">{{ stats.total }}</span>
        <span class="stat-label">总需求</span>
      </div>
      <div class="stat-item pending">
        <span class="stat-value">{{ stats.pending }}</span>
        <span class="stat-label">待处理</span>
      </div>
      <div class="stat-item processed">
        <span class="stat-value">{{ stats.processed }}</span>
        <span class="stat-label">已处理</span>
      </div>
    </div>

    <!-- 反馈列表 -->
    <div class="feedback-table">
      <div class="table-header">
        <span class="col-id">ID</span>
        <span class="col-type">类型</span>
        <span class="col-content">内容</span>
        <span class="col-status">状态</span>
        <span class="col-time">时间</span>
        <span class="col-action">操作</span>
      </div>

      <div v-if="loading" class="loading">加载中...</div>

      <div v-else-if="feedbacks.length === 0" class="empty">暂无数据</div>

      <div v-else class="table-body">
        <div
          v-for="item in feedbacks"
          :key="item.feedbackId"
          class="table-row"
          :class="{ highlight: item.status === 'PENDING' }"
        >
          <span class="col-id">{{ item.feedbackId?.slice(-8) }}</span>
          <span class="col-type">
            <span class="type-tag" :class="item.feedbackType?.toLowerCase()">
              {{ getTypeText(item.feedbackType) }}
            </span>
          </span>
          <span class="col-content">
            <span class="content-text" :title="item.content">
              {{ item.content?.slice(0, 50) }}{{ item.content?.length > 50 ? '...' : '' }}
            </span>
            <span v-if="item.catalog" class="catalog-tag">{{ item.catalog }}</span>
          </span>
          <span class="col-status">
            <span class="status-tag" :class="item.status?.toLowerCase()">
              {{ getStatusText(item.status) }}
            </span>
          </span>
          <span class="col-time">{{ formatTime(item.createdAt) }}</span>
          <span class="col-action">
            <button
              v-if="item.status === 'PENDING'"
              class="action-btn process"
              @click="handleProcess(item)"
              :disabled="processing === item.feedbackId"
            >
              {{ processing === item.feedbackId ? '处理中...' : '处理' }}
            </button>
            <span v-else class="processed-text">已完成</span>
          </span>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="totalPages > 1">
      <button
        :disabled="pageNum === 1"
        @click="changePage(pageNum - 1)"
      >
        上一页
      </button>
      <span class="page-info">{{ pageNum }} / {{ totalPages }}</span>
      <button
        :disabled="pageNum === totalPages"
        @click="changePage(pageNum + 1)"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { feedbackApi, dashboardApi } from '../api'

const feedbacks = ref([])
const loading = ref(false)
const processing = ref(null)
const pageNum = ref(1)
const pageSize = ref(20)
const total = ref(0)

const filters = reactive({
  status: '',
  feedbackType: ''
})

const stats = reactive({
  total: 0,
  pending: 0,
  processed: 0
})

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const getTypeText = (type) => {
  const map = {
    'CARD': '卡片',
    'CARD_SET': '卡册',
    'SUGGESTION': '需求'
  }
  return map[type] || type
}

const getStatusText = (status) => {
  const map = {
    'PENDING': '待处理',
    'PROCESSING': '处理中',
    'PROCESSED': '已处理'
  }
  return map[status] || status
}

const formatTime = (time) => {
  if (!time) return '-'
  const date = new Date(time)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const fetchFeedbacks = async () => {
  loading.value = true
  try {
    const data = await feedbackApi.list({
      status: filters.status,
      feedbackType: filters.feedbackType,
      pageNum: pageNum.value,
      pageSize: pageSize.value
    })

    if (data.success) {
      feedbacks.value = data.data.list || []
      total.value = data.data.total || 0

      // 计算统计
      updateStats()
    }
  } catch (err) {
    console.error('获取反馈列表失败:', err)
  } finally {
    loading.value = false
  }
}

const updateStats = () => {
  stats.total = total.value
  stats.pending = feedbacks.value.filter(f => f.status === 'PENDING').length
  stats.processed = feedbacks.value.filter(f => f.status === 'PROCESSED').length
}

const changePage = (page) => {
  pageNum.value = page
  fetchFeedbacks()
}

const handleProcess = async (item) => {
  processing.value = item.feedbackId
  try {
    // 调用创作接口
    const data = await dashboardApi.createCard({
      theme: item.content,
      model: 'ollama-qwen'
    })

    if (data.success) {
      // 更新反馈状态
      await feedbackApi.updateStatus(item.feedbackId, { status: 'PROCESSED' })
      fetchFeedbacks()
    }
  } catch (err) {
    console.error('处理失败:', err)
    alert('处理失败: ' + err.message)
  } finally {
    processing.value = null
  }
}

onMounted(() => {
  fetchFeedbacks()
})
</script>

<style scoped>
.feedback-list {
  padding: 20px;
  margin: 0;
  max-width: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  color: #333;
}

.filters {
  display: flex;
  gap: 12px;
}

.filters select {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.refresh-btn {
  padding: 8px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.refresh-btn:hover:not(:disabled) {
  background: #5a6fd6;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.stats-row {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 32px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.stat-item.pending {
  border-top: 3px solid #fa8c16;
}

.stat-item.processed {
  border-top: 3px solid #52c41a;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #333;
}

.stat-label {
  font-size: 14px;
  color: #999;
  margin-top: 4px;
}

.feedback-table {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  overflow: hidden;
}

.table-header {
  display: flex;
  padding: 16px;
  background: #f9f9f9;
  font-weight: 500;
  color: #666;
  font-size: 14px;
}

.table-body {
  max-height: 600px;
  overflow-y: auto;
}

.table-row {
  display: flex;
  padding: 16px;
  border-bottom: 1px solid #eee;
  align-items: center;
}

.table-row:hover {
  background: #fafafa;
}

.table-row.highlight {
  background: #fffbe6;
}

.col-id {
  width: 80px;
  font-family: monospace;
  color: #999;
  font-size: 12px;
}

.col-type {
  width: 80px;
}

.col-content {
  flex: 1;
  padding: 0 16px;
}

.col-status {
  width: 80px;
}

.col-time {
  width: 120px;
  color: #999;
  font-size: 13px;
}

.col-action {
  width: 100px;
  text-align: right;
}

.type-tag {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.type-tag.card {
  background: #e6f7ff;
  color: #1890ff;
}

.type-tag.card_set {
  background: #f6ffed;
  color: #52c41a;
}

.type-tag.suggestion {
  background: #fff7e6;
  color: #fa8c16;
}

.status-tag {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status-tag.pending {
  background: #fff7e6;
  color: #fa8c16;
}

.status-tag.processing {
  background: #e6f7ff;
  color: #1890ff;
}

.status-tag.processed {
  background: #f6ffed;
  color: #52c41a;
}

.content-text {
  color: #333;
  font-size: 14px;
}

.catalog-tag {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 6px;
  background: #f0f0f0;
  border-radius: 4px;
  font-size: 11px;
  color: #666;
}

.action-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.action-btn.process {
  background: #667eea;
  color: white;
}

.action-btn.process:hover:not(:disabled) {
  background: #5a6fd6;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.processed-text {
  color: #52c41a;
  font-size: 13px;
}

.loading, .empty {
  padding: 60px;
  text-align: center;
  color: #999;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.pagination button {
  padding: 8px 20px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
}

.pagination button:hover:not(:disabled) {
  border-color: #667eea;
  color: #667eea;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #666;
}
</style>
