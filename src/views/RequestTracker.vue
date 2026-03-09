<template>
  <div class="request-tracker">
    <h1>需求追踪</h1>
    
    <!-- Tab 切换 -->
    <div class="tabs">
      <button 
        :class="['tab', { active: activeTab === 'requests' }]" 
        @click="activeTab = 'requests'"
      >
        需求列表
      </button>
      <button 
        :class="['tab', { active: activeTab === 'feedback' }]" 
        @click="activeTab = 'feedback'; fetchFeedback()"
      >
        用户反馈
        <span v-if="pendingFeedbackCount > 0" class="badge">{{ pendingFeedbackCount }}</span>
      </button>
    </div>

    <!-- 需求列表 -->
    <div v-show="activeTab === 'requests'">
      <!-- 筛选 -->
      <div class="filters">
        <select v-model="filters.status">
          <option value="">全部状态</option>
          <option value="pending">处理中</option>
          <option value="success">成功</option>
          <option value="failed">失败</option>
        </select>
        <select v-model="filters.source">
          <option value="">全部来源</option>
          <option value="feishu">飞书</option>
          <option value="cloud_function">云函数</option>
          <option value="manual">手动</option>
          <option value="feedback">用户反馈</option>
        </select>
        <input v-model="filters.keyword" placeholder="搜索需求..." @keyup.enter="fetchRequests" />
        <button @click="fetchRequests">搜索</button>
      </div>

      <!-- 列表 -->
      <div class="request-list">
        <div class="request-item" v-for="req in requests" :key="req.id" @click="goDetail(req.id)">
          <div class="request-header">
            <span class="time">{{ formatTime(req.createdAt) }}</span>
            <div class="tags">
              <span class="source-tag" :class="req.source">{{ getSourceLabel(req.source) }}</span>
              <span :class="['status', req.status]">{{ getStatusLabel(req.status) }}</span>
            </div>
          </div>
          <div class="requirement">{{ req.requirement }}</div>
          <div class="request-footer">
            <span v-if="req.userId">用户: {{ req.userId }}</span>
            <span v-if="req.cardId">卡片: {{ req.cardId }}</span>
          </div>
        </div>
        <div v-if="requests.length === 0" class="empty">暂无需求记录</div>
      </div>

      <!-- 分页 -->
      <div class="pagination" v-if="pagination.pages > 1">
        <button :disabled="pagination.page <= 1" @click="changePage(-1)">上一页</button>
        <span>{{ pagination.page }} / {{ pagination.pages }}</span>
        <button :disabled="pagination.page >= pagination.pages" @click="changePage(1)">下一页</button>
      </div>
    </div>

    <!-- 用户反馈列表 -->
    <div v-show="activeTab === 'feedback'">
      <!-- 筛选 -->
      <div class="filters">
        <select v-model="feedbackFilters.feedbackType">
          <option value="">全部类型</option>
          <option value="CARD">卡片反馈</option>
          <option value="CARD_SET">卡册反馈</option>
          <option value="SUGGESTION">建议</option>
        </select>
        <select v-model="feedbackFilters.status">
          <option value="">全部状态</option>
          <option value="PENDING">待处理</option>
          <option value="PROCESSED">已处理</option>
        </select>
        <button @click="fetchFeedback">搜索</button>
      </div>

      <!-- 反馈列表 -->
      <div class="request-list">
        <div class="request-item feedback-item" v-for="fb in feedbackList" :key="fb.feedbackId">
          <div class="request-header">
            <span class="time">{{ formatTime(fb.createTime) }}</span>
            <div class="tags">
              <span class="type-tag" :class="fb.feedbackType">{{ getFeedbackTypeLabel(fb.feedbackType) }}</span>
              <span :class="['status', fb.status.toLowerCase()]">{{ fb.status === 'PENDING' ? '待处理' : '已处理' }}</span>
            </div>
          </div>
          <div class="feedback-catalog">
            <span class="catalog-tag">{{ getCatalogLabel(fb.catalog) }}</span>
          </div>
          <div class="requirement">{{ fb.content }}</div>
          <div class="request-footer">
            <span v-if="fb.userId">用户: {{ fb.userId }}</span>
            <span v-if="fb.resourceId">资源: {{ fb.resourceId }}</span>
          </div>
          <div class="feedback-actions" v-if="fb.status === 'PENDING'">
            <button class="btn-primary" @click="createRequestFromFeedback(fb)">生成卡片</button>
          </div>
        </div>
        <div v-if="feedbackList.length === 0" class="empty">暂无用户反馈</div>
      </div>

      <!-- 分页 -->
      <div class="pagination" v-if="feedbackPagination.hasMore">
        <button @click="loadMoreFeedback">加载更多</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { requestsApi, feedbackApi } from '../api'

const router = useRouter()

const activeTab = ref('requests')

const requests = ref([])
const filters = ref({
  status: '',
  source: '',
  keyword: ''
})
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  pages: 0
})

// 用户反馈相关
const feedbackList = ref([])
const pendingFeedbackCount = ref(0)
const feedbackFilters = ref({
  feedbackType: '',
  status: 'PENDING'
})
const feedbackPagination = ref({
  pageNumber: 1,
  pageSize: 20,
  hasMore: false
})

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const getStatusLabel = (status) => {
  const labels = {
    processing: '处理中',
    success: '成功',
    failed: '失败'
  }
  return labels[status] || status
}

const getSourceLabel = (source) => {
  const labels = {
    feishu: '飞书',
    cloud_function: '云函数',
    manual: '手动',
    feedback: '用户反馈'
  }
  return labels[source] || source
}

const getFeedbackTypeLabel = (type) => {
  const labels = {
    CARD: '卡片',
    CARD_SET: '卡册',
    SUGGESTION: '建议'
  }
  return labels[type] || type
}

const getCatalogLabel = (catalog) => {
  const labels = {
    contentError: '内容错误',
    hardToUnderstand: '难以理解',
    needMoreCards: '需要更多卡片',
    suggestion: '建议',
    other: '其他'
  }
  return labels[catalog] || catalog
}

const fetchRequests = async () => {
  try {
    const data = await requestsApi.list({
      page: pagination.value.page,
      limit: pagination.value.limit,
      ...filters.value
    })
    if (data.success) {
      requests.value = data.data
      pagination.value = data.pagination
    }
  } catch (error) {
    console.error('获取需求列表失败:', error)
  }
}

const fetchFeedback = async () => {
  try {
    const data = await feedbackApi.list({
      pageNumber: feedbackPagination.value.pageNumber,
      pageSize: feedbackPagination.value.pageSize,
      ...feedbackFilters.value
    })
    if (data.success) {
      feedbackList.value = data.data.list || []
      feedbackPagination.value.hasMore = data.data.hasMore
    }
  } catch (error) {
    console.error('获取反馈列表失败:', error)
  }
}

const fetchPendingCount = async () => {
  try {
    const data = await feedbackApi.list({
      status: 'PENDING',
      pageSize: 1
    })
    if (data.success) {
      pendingFeedbackCount.value = data.data.total || 0
    }
  } catch (error) {
    console.error('获取待处理反馈数量失败:', error)
  }
}

const loadMoreFeedback = () => {
  feedbackPagination.value.pageNumber++
  fetchFeedback()
}

const createRequestFromFeedback = async (feedback) => {
  try {
    // 创建需求记录
    const data = await requestsApi.create({
      userId: feedback.userId,
      source: 'feedback',
      feedbackId: feedback.feedbackId,
      feedbackType: feedback.feedbackType,
      resourceId: feedback.resourceId,
      requirement: `[用户反馈] ${feedback.content}`
    })
    if (data.success) {
      // 更新反馈状态
      await feedbackApi.updateStatus(feedback.feedbackId, { status: 'PROCESSED' })
      // 刷新列表
      fetchFeedback()
      fetchPendingCount()
      // 跳转到需求详情
      router.push(`/requests/${data.data.id}`)
    }
  } catch (error) {
    console.error('创建需求失败:', error)
  }
}

const changePage = (delta) => {
  pagination.value.page += delta
  fetchRequests()
}

const goDetail = (id) => {
  router.push(`/requests/${id}`)
}

onMounted(() => {
  fetchRequests()
  fetchPendingCount()
})
</script>

<style scoped>
.request-tracker {
  padding: 20px;
}

h1 {
  margin-bottom: 24px;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  border-bottom: 1px solid #eee;
  padding-bottom: 12px;
}

.tab {
  padding: 8px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  color: #666;
  border-radius: 6px 6px 0 0;
  position: relative;
}

.tab.active {
  color: #667eea;
  font-weight: 500;
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: -13px;
  left: 0;
  right: 0;
  height: 2px;
  background: #667eea;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: #f5222d;
  color: white;
  font-size: 11px;
  border-radius: 9px;
  margin-left: 6px;
}

.filters {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.filters select,
.filters input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.filters input {
  flex: 1;
  max-width: 300px;
}

.filters button {
  padding: 8px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.request-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.request-item {
  background: white;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: box-shadow 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.request-item:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.request-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.time {
  color: #999;
  font-size: 14px;
}

.tags {
  display: flex;
  gap: 8px;
}

.source-tag {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  background: #f0f0f0;
  color: #666;
}

.source-tag.feedback {
  background: #fff1f0;
  color: #f5222d;
}

.type-tag {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  background: #e6f7ff;
  color: #1890ff;
}

.type-tag.CARD_SET {
  background: #f6ffed;
  color: #52c41a;
}

.type-tag.SUGGESTION {
  background: #fff7e6;
  color: #fa8c16;
}

.status {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.status.success, .status.processed {
  background: #e6f7ee;
  color: #52c41a;
}

.status.processing, .status.pending {
  background: #fff7e6;
  color: #fa8c16;
}

.status.failed {
  background: #fff1f0;
  color: #f5222d;
}

.requirement {
  font-size: 16px;
  color: #333;
  margin-bottom: 8px;
}

.feedback-catalog {
  margin-bottom: 8px;
}

.catalog-tag {
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 4px;
}

.request-footer {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #999;
}

.feedback-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.btn-primary {
  padding: 6px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-primary:hover {
  background: #5a6fd6;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty {
  text-align: center;
  color: #999;
  padding: 60px;
}
</style>
