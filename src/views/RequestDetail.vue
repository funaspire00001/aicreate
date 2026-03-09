<template>
  <div class="request-detail">
    <router-link to="/requests" class="back-link">← 返回列表</router-link>
    
    <div v-if="loading" class="loading">加载中...</div>
    
    <div v-else-if="request">
      <h1>需求详情</h1>
      
      <!-- 基本信息 -->
      <div class="section">
        <div class="info-row">
          <label>需求ID:</label>
          <span>{{ request.id }}</span>
        </div>
        <div class="info-row">
          <label>用户ID:</label>
          <span>{{ request.userId || '-' }}</span>
        </div>
        <div class="info-row">
          <label>来源:</label>
          <span>{{ request.source || '-' }}</span>
        </div>
        <div class="info-row">
          <label>状态:</label>
          <span :class="['status', request.status]">{{ request.status }}</span>
        </div>
        <div class="info-row">
          <label>创建时间:</label>
          <span>{{ formatTime(request.createdAt) }}</span>
        </div>
      </div>

      <!-- 需求内容 -->
      <div class="section">
        <h2>需求内容</h2>
        <div class="requirement-text">{{ request.requirement }}</div>
      </div>

      <!-- 分析结果 -->
      <div class="section" v-if="request.analysis">
        <h2>需求分析</h2>
        <pre>{{ JSON.stringify(request.analysis, null, 2) }}</pre>
      </div>

      <!-- 智能体执行步骤 -->
      <div class="section" v-if="agentRuns.length > 0">
        <h2>执行流程</h2>
        <div class="agent-flow">
          <div class="agent-step" v-for="(run, index) in agentRuns" :key="run.id">
            <div class="step-header">
              <span class="step-num">{{ index + 1 }}</span>
              <span class="agent-name">{{ run.agentName }}</span>
              <span :class="['status', run.status]">{{ run.status }}</span>
              <span class="duration">{{ run.duration }}ms</span>
            </div>
            <div class="step-content" v-if="run.output">
              <details>
                <summary>查看输出</summary>
                <pre>{{ JSON.stringify(run.output, null, 2) }}</pre>
              </details>
            </div>
          </div>
        </div>
      </div>

      <!-- 生成的卡片 -->
      <div class="section" v-if="request.cardId">
        <h2>生成的卡片</h2>
        <div class="card-info">
          <div class="info-row">
            <label>卡片ID:</label>
            <span>{{ request.cardId }}</span>
          </div>
          <router-link :to="`/cards/${request.cardId}`">查看卡片详情</router-link>
        </div>
      </div>
    </div>

    <div v-else class="empty">未找到需求记录</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const loading = ref(true)
const request = ref(null)
const agentRuns = ref([])

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const fetchDetail = async () => {
  try {
    const id = route.params.id
    const res = await fetch(`http://localhost:3001/api/requests/${id}`)
    const data = await res.json()
    if (data.success) {
      request.value = data.data
      agentRuns.value = data.agentRuns || []
    }
  } catch (error) {
    console.error('获取详情失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDetail()
})
</script>

<style scoped>
.request-detail {
  padding: 20px;
  max-width: 900px;
}

.back-link {
  display: inline-block;
  margin-bottom: 20px;
  color: #667eea;
  text-decoration: none;
}

.section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.section h2 {
  margin-bottom: 16px;
  font-size: 16px;
  color: #333;
}

.info-row {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.info-row:last-child {
  border-bottom: none;
}

.info-row label {
  width: 100px;
  color: #999;
}

.requirement-text {
  font-size: 16px;
  line-height: 1.6;
  color: #333;
}

.status {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.status.success {
  background: #e6f7ee;
  color: #52c41a;
}

.status.pending {
  background: #fff7e6;
  color: #fa8c16;
}

.status.failed {
  background: #fff1f0;
  color: #f5222d;
}

pre {
  background: #f9f9f9;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 12px;
}

.agent-flow {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.agent-step {
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
}

.step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9f9f9;
}

.step-num {
  width: 24px;
  height: 24px;
  background: #667eea;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.agent-name {
  font-weight: 500;
}

.duration {
  margin-left: auto;
  color: #999;
  font-size: 12px;
}

.step-content {
  padding: 12px;
}

details summary {
  cursor: pointer;
  color: #667eea;
}

.loading, .empty {
  text-align: center;
  padding: 60px;
  color: #999;
}
</style>
