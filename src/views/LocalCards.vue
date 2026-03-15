<template>
  <div class="local-cards">
    <!-- 头部统计 -->
    <div class="header">
      <div class="title-section">
        <h1>本地卡片管理</h1>
        <p class="subtitle">AI 生成的卡片暂存于此，确认后发布到云端</p>
      </div>
      
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">总卡片</span>
        </div>
        <div class="stat-item local">
          <span class="stat-value">{{ stats.local }}</span>
          <span class="stat-label">待发布</span>
        </div>
        <div class="stat-item published">
          <span class="stat-value">{{ stats.published }}</span>
          <span class="stat-label">已发布</span>
        </div>
      </div>
    </div>
    
    <!-- 筛选 -->
    <div class="filter-bar">
      <div class="filter-tabs">
        <button 
          :class="['filter-tab', { active: currentStatus === '' }]"
          @click="changeStatus('')"
        >
          全部
        </button>
        <button 
          :class="['filter-tab', { active: currentStatus === 'local' }]"
          @click="changeStatus('local')"
        >
          待发布
        </button>
        <button 
          :class="['filter-tab', { active: currentStatus === 'published' }]"
          @click="changeStatus('published')"
        >
          已发布
        </button>
      </div>
    </div>
    
    <!-- 卡片列表 -->
    <div class="cards-section">
      <div v-if="loading" class="loading">
        <span>加载中...</span>
      </div>
      
      <div v-else-if="cards.length === 0" class="empty-state">
        <p>暂无卡片</p>
      </div>
      
      <div v-else class="cards-grid">
        <div 
          v-for="card in cards" 
          :key="card.cardId" 
          class="card-item"
          :class="{ published: card.status === 'published' }"
        >
          <!-- 卡片预览 -->
          <div class="card-preview-area" @click="openDetail(card)">
            <CardPreview 
              v-if="card.cardData"
              :cardData="card.cardData"
              :scale="0.4"
            />
            <div v-else class="no-preview">
              <span>暂无预览</span>
            </div>
          </div>
          
          <div class="card-info">
            <div class="card-header">
              <span :class="['status-badge', card.status]">
                {{ card.status === 'local' ? '待发布' : '已发布' }}
              </span>
              <span class="card-time">{{ formatDate(card.createdAt) }}</span>
            </div>
            
            <h3 class="card-theme">{{ card.theme || '未命名' }}</h3>
            
            <div class="card-meta">
              <span class="meta-item">
                {{ card.model }} · {{ formatDuration(card.totalDuration) }}
              </span>
            </div>
            
            <div class="card-actions">
              <button 
                class="btn btn-preview"
                @click.stop="openDetail(card)"
              >
                详情
              </button>
              <button 
                v-if="card.status === 'local'"
                class="btn btn-publish"
                @click.stop="publishCard(card)"
                :disabled="publishingId === card.cardId"
              >
                {{ publishingId === card.cardId ? '发布中...' : '发布' }}
              </button>
              <span v-else class="published-info">
                {{ card.publishedCardName }}
              </span>
              <button 
                class="btn btn-delete"
                @click.stop="deleteCard(card)"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 分页 -->
      <div v-if="total > pageSize" class="pagination">
        <button 
          class="page-btn"
          :disabled="page <= 1"
          @click="changePage(page - 1)"
        >
          上一页
        </button>
        <span class="page-info">{{ page }} / {{ totalPages }}</span>
        <button 
          class="page-btn"
          :disabled="page >= totalPages"
          @click="changePage(page + 1)"
        >
          下一页
        </button>
      </div>
    </div>
    
    <!-- 详情弹窗 -->
    <div v-if="showDetail" class="detail-modal" @click.self="closeDetail">
      <div class="detail-content">
        <div class="detail-header">
          <h3>{{ detailData?.theme }}</h3>
          <button class="close-btn" @click="closeDetail">×</button>
        </div>
        <div class="detail-body">
          <!-- 左侧：卡片预览 -->
          <div class="detail-preview">
            <CardPreview 
              v-if="detailData?.cardData"
              :cardData="detailData.cardData"
              :scale="0.6"
            />
          </div>
          
          <!-- 右侧：信息 -->
          <div class="detail-info">
            <div class="info-section">
              <h4>基本信息</h4>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">状态</span>
                  <span :class="['status-badge', detailData?.status]">
                    {{ detailData?.status === 'local' ? '待发布' : '已发布' }}
                  </span>
                </div>
                <div class="info-item">
                  <span class="info-label">模型</span>
                  <span class="info-value">{{ detailData?.model }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">耗时</span>
                  <span class="info-value">{{ formatDuration(detailData?.totalDuration) }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">创建时间</span>
                  <span class="info-value">{{ formatDateTime(detailData?.createdAt) }}</span>
                </div>
              </div>
            </div>
            
            <div class="info-section">
              <h4>需求分析</h4>
              <pre class="info-json">{{ formatJson(detailData?.analysis) }}</pre>
            </div>
            
            <div class="info-section">
              <h4>设计方案</h4>
              <pre class="info-json">{{ formatJson(detailData?.design) }}</pre>
            </div>
            
            <div class="info-section">
              <h4>生成步骤</h4>
              <div class="steps-list">
                <div 
                  v-for="step in detailData?.steps" 
                  :key="step.step" 
                  class="step-item"
                >
                  <span class="step-num">步骤{{ step.step }}</span>
                  <span class="step-name">{{ step.name }}</span>
                  <span class="step-duration">{{ step.duration }}ms</span>
                  <span :class="['step-status', step.success ? 'success' : 'failed']">
                    {{ step.success ? '✓' : '✗' }}
                  </span>
                </div>
              </div>
            </div>
            
            <!-- 卡片JSON -->
            <div class="info-section">
              <h4 class="clickable-header" @click="showJson = !showJson">
                <span>卡片JSON</span>
                <span class="toggle-icon">{{ showJson ? '▼' : '▶' }}</span>
              </h4>
              <div v-if="showJson" class="json-viewer">
                <pre>{{ formatJson(detailData?.cardData) }}</pre>
              </div>
            </div>
          </div>
        </div>
        
        <div class="detail-footer">
          <button 
            v-if="detailData?.status === 'local'"
            class="btn btn-publish"
            @click="publishCard(detailData)"
            :disabled="publishingId === detailData?.cardId"
          >
            {{ publishingId === detailData?.cardId ? '发布中...' : '发布到云端' }}
          </button>
          <span v-else class="published-label">
            已发布: {{ detailData?.publishedCardName }}
          </span>
          <button class="btn btn-delete" @click="deleteCard(detailData)">
            删除卡片
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { localCardsApi } from '../api';
import CardPreview from '../components/card/CardPreview.vue';

// 数据
const cards = ref([]);
const stats = ref({ total: 0, local: 0, published: 0 });
const loading = ref(false);
const currentStatus = ref('');
const page = ref(1);
const pageSize = ref(12);
const total = ref(0);

// 详情
const showDetail = ref(false);
const detailData = ref(null);
const showJson = ref(false);

// 发布状态
const publishingId = ref(null);

// 计算属性
const totalPages = computed(() => Math.ceil(total.value / pageSize.value));

// 方法
const fetchCards = async () => {
  loading.value = true;
  try {
    const res = await localCardsApi.list({
      status: currentStatus.value,
      page: page.value,
      pageSize: pageSize.value
    });
    
    if (res.success) {
      cards.value = res.data.list;
      total.value = res.data.total;
    }
  } catch (error) {
    console.error('获取卡片列表失败:', error);
  } finally {
    loading.value = false;
  }
};

const fetchStats = async () => {
  try {
    const res = await localCardsApi.stats();
    if (res.success) {
      stats.value = res.data;
    }
  } catch (error) {
    console.error('获取统计失败:', error);
  }
};

const changeStatus = (status) => {
  currentStatus.value = status;
  page.value = 1;
  fetchCards();
};

const changePage = (newPage) => {
  page.value = newPage;
  fetchCards();
};

const openDetail = async (card) => {
  try {
    const res = await localCardsApi.get(card.cardId);
    if (res.success) {
      detailData.value = res.data;
      showDetail.value = true;
    }
  } catch (error) {
    console.error('获取卡片详情失败:', error);
  }
};

const closeDetail = () => {
  showDetail.value = false;
  detailData.value = null;
};

const publishCard = async (card) => {
  if (!confirm(`确定要发布卡片「${card.theme}」到云端吗？`)) {
    return;
  }
  
  publishingId.value = card.cardId;
  try {
    const res = await localCardsApi.publish(card.cardId);
    if (res.success) {
      // 更新本地数据
      const index = cards.value.findIndex(c => c.cardId === card.cardId);
      if (index !== -1) {
        cards.value[index] = { ...cards.value[index], ...res.data };
      }
      // 更新详情数据
      if (detailData.value?.cardId === card.cardId) {
        detailData.value = { ...detailData.value, ...res.data };
      }
      fetchStats();
      alert(`发布成功！云端卡片: ${res.data.publishedCardName}`);
    } else {
      alert('发布失败: ' + (res.error || '未知错误'));
    }
  } catch (error) {
    console.error('发布卡片失败:', error);
    alert('发布失败: ' + error.message);
  } finally {
    publishingId.value = null;
  }
};

const deleteCard = async (card) => {
  if (!confirm(`确定要删除卡片「${card.theme}」吗？此操作不可恢复。`)) {
    return;
  }
  
  try {
    const res = await localCardsApi.delete(card.cardId);
    if (res.success) {
      cards.value = cards.value.filter(c => c.cardId !== card.cardId);
      total.value--;
      fetchStats();
      closeDetail();
    } else {
      alert('删除失败: ' + (res.error || '未知错误'));
    }
  } catch (error) {
    console.error('删除卡片失败:', error);
    alert('删除失败: ' + error.message);
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN');
};

const formatDuration = (ms) => {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  return `${minutes}m ${remainSeconds}s`;
};

const formatJson = (data) => {
  if (!data) return 'null';
  try {
    return JSON.stringify(data, null, 2);
  } catch (e) {
    return String(data);
  }
};

// 生命周期
onMounted(() => {
  fetchCards();
  fetchStats();
});
</script>

<style scoped>
.local-cards {
  max-width: 100%;
  margin: 0;
  padding: 24px;
}

/* 头部 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  color: white;
}

.title-section h1 {
  font-size: 28px;
  margin: 0 0 8px 0;
}

.subtitle {
  margin: 0;
  opacity: 0.9;
  font-size: 14px;
}

.stats-bar {
  display: flex;
  gap: 24px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 12px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
}

.stat-label {
  font-size: 12px;
  opacity: 0.9;
}

/* 筛选 */
.filter-bar {
  margin-bottom: 20px;
}

.filter-tabs {
  display: flex;
  gap: 8px;
}

.filter-tab {
  padding: 8px 20px;
  border: none;
  background: #f5f5f5;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all 0.2s;
}

.filter-tab:hover {
  background: #eee;
}

.filter-tab.active {
  background: #667eea;
  color: white;
}

/* 卡片网格 */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.card-item {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s, box-shadow 0.2s;
}

.card-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.card-item.published {
  border-left: 4px solid #10b981;
}

.card-preview-area {
  height: 160px;
  background: #f8f9fa;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
  overflow: visible;
}

.no-preview {
  color: #999;
  font-size: 14px;
}

.card-info {
  padding: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.status-badge.local {
  background: #fef3c7;
  color: #d97706;
}

.status-badge.published {
  background: #d1fae5;
  color: #059669;
}

.card-time {
  color: #999;
  font-size: 11px;
}

.card-theme {
  font-size: 15px;
  color: #333;
  margin: 0 0 8px 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  font-size: 12px;
  color: #888;
  margin-bottom: 12px;
}

.card-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-preview {
  background: #f3f4f6;
  color: #374151;
}

.btn-preview:hover {
  background: #e5e7eb;
}

.btn-publish {
  background: #667eea;
  color: white;
}

.btn-publish:hover:not(:disabled) {
  background: #5b67c5;
}

.btn-publish:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-delete {
  background: #fee2e2;
  color: #dc2626;
}

.btn-delete:hover {
  background: #fecaca;
}

.published-info {
  font-size: 11px;
  color: #059669;
  padding: 6px 12px;
}

/* 分页 */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 32px;
}

.page-btn {
  padding: 8px 20px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  color: #666;
}

.page-btn:hover:not(:disabled) {
  background: #f5f5f5;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  color: #666;
}

/* 详情弹窗 */
.detail-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.detail-content {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 1200px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #f9fafb;
  border-bottom: 1px solid #eee;
}

.detail-header h3 {
  margin: 0;
  font-size: 20px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: #f5f5f5;
  border-radius: 8px;
  cursor: pointer;
  font-size: 20px;
  color: #666;
}

.close-btn:hover {
  background: #eee;
}

.detail-body {
  padding: 24px;
  overflow-y: auto;
  display: flex;
  gap: 24px;
  align-items: stretch;
}

.detail-preview {
  flex-shrink: 0;
  width: 380px;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: visible;
  background: #f8f9fa;
  border-radius: 12px;
  padding: 24px;
}

.detail-info {
  align-items: stretch;
  min-width: 0;
}

.info-section {
  margin-bottom: 20px;
}

.info-section h4 {
  margin: 0 0 12px 0;
  color: #667eea;
  font-size: 14px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-label {
  color: #999;
  font-size: 12px;
}

.info-value {
  color: #333;
  font-size: 13px;
}

.info-json {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 11px;
  line-height: 1.5;
  max-height: 200px;
  overflow-y: auto;
}

.clickable-header {
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  user-select: none;
}

.clickable-header:hover {
  color: #667eea;
}

.toggle-icon {
  font-size: 12px;
  transition: transform 0.2s;
}

.json-viewer {
  background: #1e1e1e;
  border-radius: 8px;
  padding: 16px;
  margin-top: 12px;
  overflow: auto;
  max-height: 400px;
}

.json-viewer pre {
  margin: 0;
  color: #d4d4d4;
  font-family: "Monaco", "Menlo", "Consolas", monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 8px;
  font-size: 13px;
}

.step-num {
  color: #667eea;
  font-weight: 500;
}

.step-name {
  align-items: stretch;
}

.step-duration {
  color: #999;
  font-size: 12px;
}

.step-status.success {
  color: #10b981;
}

.step-status.failed {
  color: #ef4444;
}

.detail-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  background: #f9fafb;
  border-top: 1px solid #eee;
}

.published-label {
  color: #059669;
  font-size: 14px;
}

/* 状态 */
.loading {
  text-align: center;
  padding: 60px;
  color: #666;
}

.empty-state {
  text-align: center;
  padding: 60px;
  color: #999;
}

@media (max-width: 768px) {
  .detail-body {
    flex-direction: column;
  }
  
  .detail-preview {
    width: 100%;
    height: 200px;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>