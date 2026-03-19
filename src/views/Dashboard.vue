<template>
  <div class="dashboard">
    <div class="page-header">
      <h1>仪表盘</h1>
      <div class="health-badge" :class="health.status">
        <span class="dot"></span>
        {{ health.status === 'running' ? `运行中 · ${health.scheduler?.activeAgents || 0} 个调度` : '连接中...' }}
      </div>
    </div>

    <!-- 概览卡片 -->
    <div class="overview-grid">
      <div class="ov-card">
        <div class="ov-value">{{ overview.agents?.total || 0 }}</div>
        <div class="ov-label">智能体</div>
        <div class="ov-sub">{{ overview.agents?.enabled || 0 }} 启用</div>
      </div>
      <div class="ov-card">
        <div class="ov-value">{{ overview.workspaces?.total || 0 }}</div>
        <div class="ov-label">空间</div>
        <div class="ov-sub">{{ overview.workspaces?.active || 0 }} 活跃</div>
      </div>
      <div class="ov-card">
        <div class="ov-value">{{ overview.syncTasks?.total || 0 }}</div>
        <div class="ov-label">订阅任务</div>
        <div class="ov-sub" :class="{ warn: overview.syncTasks?.failed > 0 }">{{ overview.syncTasks?.failed || 0 }} 失败</div>
      </div>
      <div class="ov-card">
        <div class="ov-value">{{ overview.today?.logs || 0 }}</div>
        <div class="ov-label">今日日志</div>
        <div class="ov-sub" :class="{ warn: overview.today?.errors > 0 }">{{ overview.today?.errors || 0 }} 错误</div>
      </div>
    </div>

    <!-- 智能体状态 -->
    <div class="section-card">
      <h2>智能体运行状态</h2>
      <div class="agent-grid" v-if="agentStats.length > 0">
        <div v-for="a in agentStats" :key="a.id" class="agent-stat-card" :class="a.status?.state">
          <div class="as-header">
            <span class="as-name">{{ a.name }}</span>
            <span class="as-state" :class="a.status?.state">{{ stateText(a.status?.state) }}</span>
          </div>
          <div class="as-numbers">
            <div class="as-num"><span class="n">{{ a.stats?.totalRuns || a.stats?.totalCalls || 0 }}</span><span class="l">总运行</span></div>
            <div class="as-num"><span class="n success">{{ a.stats?.successRuns || a.stats?.successCalls || 0 }}</span><span class="l">成功</span></div>
            <div class="as-num"><span class="n fail">{{ a.stats?.failedRuns || a.stats?.failedCalls || 0 }}</span><span class="l">失败</span></div>
          </div>
        </div>
      </div>
      <div v-else class="empty-tip">暂无智能体数据</div>
    </div>

    <!-- 最近日志 -->
    <div class="section-card">
      <h2>最近活动</h2>
      <div class="log-list" v-if="recentLogs.length > 0">
        <div v-for="log in recentLogs" :key="log._id" class="log-row">
          <span class="log-time">{{ fmtTime(log.createdAt) }}</span>
          <span class="log-status" :class="log.status">{{ log.status }}</span>
          <span class="log-agent">{{ log.agentId }}</span>
          <span class="log-msg">{{ log.message }}</span>
          <span class="log-dur" v-if="log.duration">{{ log.duration }}ms</span>
        </div>
      </div>
      <div v-else class="empty-tip">暂无活动日志</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { dashboardApi, healthApi } from '../api'

const health = ref({})
const overview = ref({})
const agentStats = ref([])
const recentLogs = ref([])

let timer = null

const stateText = (s) => ({ idle: '空闲', running: '运行中', error: '异常' }[s] || s || '空闲')

const fmtTime = (t) => {
  if (!t) return '-'
  const d = new Date(t)
  return `${d.toLocaleDateString('zh-CN')} ${d.toLocaleTimeString('zh-CN')}`
}

const fetchAll = async () => {
  try {
    const [h, d] = await Promise.all([
      healthApi.check().catch(() => ({ data: {} })),
      dashboardApi.get().catch(() => ({ data: {} }))
    ])
    health.value = h.data || {}
    const dd = d.data || {}
    overview.value = dd.overview || {}
    agentStats.value = dd.agentStats || []
    recentLogs.value = dd.recentLogs || []
  } catch { /* ignore */ }
}

onMounted(() => {
  fetchAll()
  timer = setInterval(fetchAll, 10000)
})

onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.dashboard { max-width: 1200px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.page-header h1 { font-size: 22px; font-weight: 600; }

.health-badge { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-size: 13px; background: #f5f5f5; color: #999; }
.health-badge.running { background: #f0fdf4; color: #16a34a; }
.health-badge .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }

.overview-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.ov-card { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.ov-value { font-size: 32px; font-weight: 700; color: #667eea; }
.ov-label { font-size: 13px; color: #666; margin-top: 4px; }
.ov-sub { font-size: 12px; color: #999; margin-top: 4px; }
.ov-sub.warn { color: #ef4444; }

.section-card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.section-card h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }

.agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.agent-stat-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; transition: border-color 0.2s; }
.agent-stat-card.running { border-color: #3b82f6; background: #eff6ff; }
.agent-stat-card.error { border-color: #ef4444; background: #fef2f2; }
.as-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.as-name { font-size: 14px; font-weight: 500; }
.as-state { font-size: 12px; padding: 2px 8px; border-radius: 10px; background: #f3f4f6; color: #6b7280; }
.as-state.running { background: #dbeafe; color: #2563eb; }
.as-state.error { background: #fee2e2; color: #dc2626; }
.as-numbers { display: flex; gap: 16px; }
.as-num { text-align: center; }
.as-num .n { display: block; font-size: 18px; font-weight: 600; color: #333; }
.as-num .n.success { color: #16a34a; }
.as-num .n.fail { color: #ef4444; }
.as-num .l { font-size: 11px; color: #999; }

.log-list { max-height: 400px; overflow-y: auto; }
.log-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f5f5f5; font-size: 13px; }
.log-time { color: #999; font-size: 12px; min-width: 145px; }
.log-status { padding: 2px 8px; border-radius: 8px; font-size: 11px; min-width: 55px; text-align: center; background: #f3f4f6; }
.log-status.success { background: #dcfce7; color: #16a34a; }
.log-status.fail { background: #fee2e2; color: #dc2626; }
.log-status.processing { background: #dbeafe; color: #2563eb; }
.log-agent { color: #667eea; font-size: 12px; min-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-msg { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.log-dur { color: #999; font-size: 12px; }

.empty-tip { text-align: center; color: #999; padding: 32px; font-size: 14px; }
</style>
