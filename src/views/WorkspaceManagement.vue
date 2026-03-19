<template>
  <div class="page">
    <div class="page-header">
      <h1>空间管理</h1>
      <button @click="openModal()" class="btn-primary">+ 创建空间</button>
    </div>

    <div class="ws-grid">
      <div v-for="ws in workspaces" :key="ws.id" class="ws-card">
        <div class="ws-top">
          <h3>{{ ws.name }}</h3>
          <span class="ws-status" :class="ws.status">{{ statusText(ws.status) }}</span>
        </div>
        <p class="ws-desc">{{ ws.description || '暂无描述' }}</p>
        <div class="ws-meta">
          <span>{{ ws.agentIds?.length || 0 }} 个智能体</span>
          <span>{{ fmtDate(ws.createdAt) }}</span>
        </div>
        <div class="ws-agents" v-if="ws.agentIds?.length">
          <span v-for="aid in ws.agentIds.slice(0, 5)" :key="aid" class="agent-tag">{{ agentName(aid) }}</span>
          <span v-if="ws.agentIds.length > 5" class="agent-tag more">+{{ ws.agentIds.length - 5 }}</span>
        </div>
        <div class="ws-actions">
          <button v-if="ws.status === 'paused'" @click="startWorkspace(ws)" class="btn-sm green">启动</button>
          <button v-if="ws.status === 'active'" @click="pauseWorkspace(ws)" class="btn-sm orange">暂停</button>
          <button @click="openModal(ws)" class="btn-sm">编辑</button>
          <button @click="deleteWs(ws)" class="btn-sm danger">删除</button>
        </div>
      </div>

      <div v-if="workspaces.length === 0" class="empty">
        <div class="empty-icon">🏢</div>
        <p>暂无空间，创建一个开始吧</p>
      </div>
    </div>

    <!-- 弹窗 -->
    <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-head">
          <h2>{{ editing ? '编辑空间' : '创建空间' }}</h2>
          <button @click="showModal = false" class="close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="field">
            <label>名称 <span class="req">*</span></label>
            <input v-model="form.name" placeholder="空间名称" />
          </div>
          <div class="field">
            <label>描述</label>
            <textarea v-model="form.description" placeholder="可选" rows="3"></textarea>
          </div>
          <div class="field">
            <label>选择智能体</label>
            <div class="checkbox-grid">
              <label v-for="a in allAgents" :key="a.id" class="ck-item">
                <input type="checkbox" :value="a.id" v-model="form.agentIds" />
                {{ a.name }}
              </label>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button @click="showModal = false" class="btn-cancel">取消</button>
          <button @click="save" class="btn-primary" :disabled="!form.name">{{ editing ? '保存' : '创建' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { workspacesApi, agentsApi } from '../api'

const workspaces = ref([])
const allAgents = ref([])
const showModal = ref(false)
const editing = ref(null)
const form = ref({ name: '', description: '', agentIds: [] })

const statusText = (s) => ({ active: '运行中', paused: '已暂停', archived: '已归档' }[s] || s)
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('zh-CN') : '-'
const agentName = (id) => allAgents.value.find(a => a.id === id)?.name || id

const load = async () => {
  const [ws, ag] = await Promise.all([
    workspacesApi.list(),
    agentsApi.list()
  ])
  workspaces.value = ws.data || []
  allAgents.value = (ag.data || []).map(a => ({ id: a.id, name: a.name }))
}

const openModal = (ws = null) => {
  editing.value = ws
  form.value = ws
    ? { name: ws.name, description: ws.description || '', agentIds: [...(ws.agentIds || [])] }
    : { name: '', description: '', agentIds: [] }
  showModal.value = true
}

const save = async () => {
  if (!form.value.name) return
  if (editing.value) {
    await workspacesApi.update(editing.value.id, form.value)
  } else {
    await workspacesApi.create(form.value)
  }
  showModal.value = false
  await load()
}

const deleteWs = async (ws) => {
  if (!confirm(`确定要删除空间「${ws.name}」吗？`)) return
  await workspacesApi.delete(ws.id)
  await load()
}

const startWorkspace = async (ws) => {
  await workspacesApi.start(ws.id)
  await load()
}

const pauseWorkspace = async (ws) => {
  await workspacesApi.pause(ws.id)
  await load()
}

onMounted(load)
</script>

<style scoped>
.page { max-width: 1200px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.page-header h1 { font-size: 22px; font-weight: 600; }

.btn-primary { padding: 9px 20px; background: #667eea; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; transition: all 0.2s; }
.btn-primary:hover { background: #5a6fd6; }
.btn-primary:disabled { background: #c5c5c5; cursor: not-allowed; }

.ws-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
.ws-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); transition: box-shadow 0.2s; }
.ws-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); }
.ws-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.ws-top h3 { font-size: 17px; font-weight: 600; }
.ws-status { font-size: 12px; padding: 3px 10px; border-radius: 12px; background: #f3f4f6; color: #6b7280; }
.ws-status.active { background: #dcfce7; color: #16a34a; }
.ws-status.paused { background: #fef3c7; color: #d97706; }
.ws-desc { color: #666; font-size: 14px; margin-bottom: 12px; line-height: 1.5; }
.ws-meta { display: flex; gap: 16px; font-size: 13px; color: #999; margin-bottom: 12px; }
.ws-agents { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.agent-tag { padding: 3px 10px; background: #eff6ff; color: #3b82f6; border-radius: 10px; font-size: 12px; }
.agent-tag.more { background: #f3f4f6; color: #999; }

.ws-actions { display: flex; gap: 8px; }
.btn-sm { padding: 6px 14px; border: 1px solid #d1d5db; background: white; border-radius: 6px; font-size: 13px; cursor: pointer; transition: all 0.15s; }
.btn-sm:hover { border-color: #667eea; color: #667eea; }
.btn-sm.green { border-color: #16a34a; color: #16a34a; }
.btn-sm.green:hover { background: #16a34a; color: white; }
.btn-sm.orange { border-color: #d97706; color: #d97706; }
.btn-sm.orange:hover { background: #d97706; color: white; }
.btn-sm.danger { border-color: #ef4444; color: #ef4444; }
.btn-sm.danger:hover { background: #ef4444; color: white; }

.empty { grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #999; }
.empty-icon { font-size: 56px; margin-bottom: 12px; }

/* Modal */
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: white; border-radius: 14px; width: 520px; max-width: 92vw; }
.modal-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; }
.modal-head h2 { font-size: 17px; }
.close { background: none; border: none; font-size: 22px; cursor: pointer; color: #999; }
.modal-body { padding: 20px; }
.modal-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid #f0f0f0; }
.btn-cancel { padding: 8px 18px; background: #f5f5f5; border: 1px solid #d9d9d9; border-radius: 6px; cursor: pointer; font-size: 14px; }

.field { margin-bottom: 16px; }
.field label { display: block; margin-bottom: 5px; font-size: 14px; color: #333; }
.req { color: #ef4444; }
.field input, .field textarea { width: 100%; padding: 9px 12px; border: 1px solid #d9d9d9; border-radius: 6px; font-size: 14px; }
.field input:focus, .field textarea:focus { border-color: #667eea; outline: none; }

.checkbox-grid { display: flex; flex-wrap: wrap; gap: 10px; padding: 10px; background: #fafafa; border-radius: 6px; max-height: 200px; overflow-y: auto; }
.ck-item { display: flex; align-items: center; gap: 5px; font-size: 13px; cursor: pointer; }
</style>
