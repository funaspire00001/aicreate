<template>
  <div class="page">
    <div class="page-header">
      <h1>订阅任务</h1>
      <div class="header-actions">
        <button @click="triggerAll" class="btn-outline">全部触发</button>
        <button @click="load" class="btn-outline">刷新</button>
      </div>
    </div>

    <!-- 统计 -->
    <div class="stats-bar" v-if="stats.total > 0">
      <div class="stat">总计 <b>{{ stats.total }}</b></div>
      <div class="stat" v-for="(v, k) in stats.byStatus" :key="k">
        <span :class="k">{{ k }}</span> <b>{{ v.count }}</b> (读取 {{ v.totalRead || 0 }})
      </div>
    </div>

    <!-- 列表 -->
    <div class="task-table">
      <table>
        <thead>
          <tr>
            <th>订阅方</th>
            <th>数据源</th>
            <th>源集合</th>
            <th>状态</th>
            <th>水位线</th>
            <th>已读取</th>
            <th>上次运行</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in tasks" :key="t._id">
            <td class="mono">{{ agentName(t.subscriberAgentId) }}</td>
            <td class="mono">{{ agentName(t.sourceAgentId) }}</td>
            <td class="mono small">{{ t.sourceCollection }}</td>
            <td>
              <span class="st-badge" :class="t.lastStatus">{{ t.lastStatus }}</span>
              <span v-if="t.retryCount > 0" class="retry-info">重试 {{ t.retryCount }}/{{ t.maxRetries }}</span>
            </td>
            <td class="small">{{ fmtTime(t.lastReadWatermark || t.lastSyncWatermark) }}</td>
            <td>{{ t.totalReadCount || t.totalSyncCount || 0 }}</td>
            <td class="small">{{ fmtTime(t.lastRunAt) }}</td>
            <td class="actions">
              <button @click="trigger(t)" class="btn-xs">触发</button>
              <button @click="resetRetry(t)" class="btn-xs" v-if="t.lastStatus === 'fail'">重置</button>
              <button @click="del(t)" class="btn-xs danger">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="tasks.length === 0" class="empty">暂无订阅任务</div>
    </div>

    <!-- 失败详情 -->
    <div class="fail-section" v-if="stats.recentFailures?.length > 0">
      <h3>最近失败</h3>
      <div v-for="f in stats.recentFailures" :key="f._id" class="fail-item">
        <span class="mono">{{ agentName(f.subscriberAgentId) }} ← {{ agentName(f.sourceAgentId) }}</span>
        <span class="fail-msg">{{ f.errorMsg }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { syncTasksApi, agentsApi } from '../api'

const tasks = ref([])
const stats = ref({})
const agentMap = ref({})

const agentName = (id) => agentMap.value[id] || id
const fmtTime = (t) => t ? new Date(t).toLocaleString('zh-CN') : '-'

const load = async () => {
  const [t, s, a] = await Promise.all([
    syncTasksApi.list(),
    syncTasksApi.stats(),
    agentsApi.list()
  ])
  tasks.value = t.data || []
  stats.value = s.data || {}
  const map = {}
  ;(a.data || []).forEach(ag => { map[ag.id] = ag.name })
  agentMap.value = map
}

const trigger = async (t) => {
  await syncTasksApi.trigger(t._id)
  await load()
}

const triggerAll = async () => {
  await syncTasksApi.triggerAll()
  await load()
}

const resetRetry = async (t) => {
  await syncTasksApi.resetRetry(t._id)
  await load()
}

const del = async (t) => {
  if (!confirm('确定删除此订阅任务？')) return
  await syncTasksApi.delete(t._id)
  await load()
}

onMounted(load)
</script>

<style scoped>
.page { max-width: 1200px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h1 { font-size: 22px; font-weight: 600; }
.header-actions { display: flex; gap: 8px; }
.btn-outline { padding: 7px 16px; border: 1px solid #d1d5db; background: white; border-radius: 6px; font-size: 13px; cursor: pointer; }
.btn-outline:hover { border-color: #667eea; color: #667eea; }

.stats-bar { display: flex; gap: 20px; background: white; border-radius: 10px; padding: 14px 20px; margin-bottom: 16px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); font-size: 13px; color: #666; }
.stats-bar b { color: #333; }
.stats-bar .success { color: #16a34a; }
.stats-bar .fail { color: #ef4444; }
.stats-bar .pending { color: #d97706; }

.task-table { background: white; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); overflow: hidden; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { background: #f9fafb; padding: 10px 14px; text-align: left; font-weight: 600; color: #555; border-bottom: 1px solid #e5e7eb; }
td { padding: 10px 14px; border-bottom: 1px solid #f3f4f6; }
.mono { font-family: monospace; font-size: 12px; }
.small { font-size: 12px; color: #888; }

.st-badge { display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 11px; background: #f3f4f6; color: #6b7280; }
.st-badge.success { background: #dcfce7; color: #16a34a; }
.st-badge.fail { background: #fee2e2; color: #dc2626; }
.st-badge.processing { background: #dbeafe; color: #2563eb; }
.st-badge.pending { background: #fef3c7; color: #d97706; }
.retry-info { font-size: 11px; color: #d97706; margin-left: 6px; }

.actions { display: flex; gap: 6px; }
.btn-xs { padding: 3px 10px; border: 1px solid #d1d5db; background: white; border-radius: 4px; font-size: 12px; cursor: pointer; }
.btn-xs:hover { border-color: #667eea; color: #667eea; }
.btn-xs.danger:hover { border-color: #ef4444; color: #ef4444; }

.empty { text-align: center; color: #999; padding: 40px; font-size: 14px; }

.fail-section { margin-top: 20px; background: white; border-radius: 12px; padding: 16px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.fail-section h3 { font-size: 15px; margin-bottom: 12px; }
.fail-item { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f5f5f5; font-size: 13px; }
.fail-msg { color: #ef4444; flex: 1; }
</style>
