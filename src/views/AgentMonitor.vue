<template>
  <div class="agent-monitor">
    <h1>智能体监控</h1>
    
    <!-- 概览 -->
    <div class="overview">
      <div class="stat-card" v-for="agent in agentStats" :key="agent.agentName">
        <div class="agent-name">{{ agent.agentName }}</div>
        <div class="stat-row">
          <span class="stat-label">调用次数</span>
          <span class="stat-value">{{ agent.totalCalls }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">成功率</span>
          <span class="stat-value success">{{ agent.successRate }}%</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">平均耗时</span>
          <span class="stat-value">{{ agent.avgDuration }}ms</span>
        </div>
      </div>
    </div>

    <!-- 最近运行 -->
    <div class="section">
      <h2>最近运行记录</h2>
      <div class="runs-list">
        <div class="run-item" v-for="run in recentRuns" :key="run.id">
          <div class="run-header">
            <span class="agent-name">{{ run.agentName }}</span>
            <span :class="['status', run.status]">{{ run.status }}</span>
            <span class="time">{{ formatTime(run.startTime) }}</span>
          </div>
          <div class="run-meta">
            <span>耗时: {{ run.duration }}ms</span>
            <span v-if="run.requestId">需求: {{ run.requestId }}</span>
          </div>
          <div class="run-error" v-if="run.error">
            <strong>错误:</strong> {{ run.error }}
          </div>
        </div>
        <div v-if="recentRuns.length === 0" class="empty">暂无运行记录</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const agentStats = ref([])
const recentRuns = ref([])

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const fetchData = async () => {
  try {
    const res = await fetch('http://localhost:3001/api/agents/stats')
    const data = await res.json()
    if (data.success) {
      agentStats.value = data.stats || []
      recentRuns.value = data.recentRuns || []
    }
  } catch (error) {
    console.error('获取智能体数据失败:', error)
  }
}

onMounted(() => {
  fetchData()
  setInterval(fetchData, 10000)
})
</script>

<style scoped>
.agent-monitor {
  padding: 20px;
}

h1 {
  margin-bottom: 24px;
}

.overview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.stat-card .agent-name {
  font-weight: 500;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.stat-label {
  color: #999;
  font-size: 14px;
}

.stat-value {
  font-weight: 500;
}

.stat-value.success {
  color: #52c41a;
}

.section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.section h2 {
  margin-bottom: 16px;
  font-size: 16px;
}

.runs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.run-item {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 12px;
}

.run-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.run-header .agent-name {
  font-weight: 500;
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

.time {
  margin-left: auto;
  color: #999;
  font-size: 12px;
}

.run-meta {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #666;
}

.run-error {
  margin-top: 8px;
  padding: 8px;
  background: #fff1f0;
  border-radius: 4px;
  font-size: 14px;
  color: #f5222d;
}

.empty {
  text-align: center;
  color: #999;
  padding: 40px;
}
</style>
