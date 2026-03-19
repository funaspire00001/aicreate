<template>
  <div class="page">
    <div class="page-header">
      <h1>智能体管理</h1>
      <button @click="openCreate" class="btn-primary">+ 创建智能体</button>
    </div>

    <!-- 列表 -->
    <div class="agent-list">
      <div v-for="a in agents" :key="a.id" class="agent-card" :class="{ disabled: !a.enabled }">
        <div class="ac-top">
          <div>
            <h3>{{ a.name }}</h3>
            <p class="ac-desc">{{ a.description || '暂无描述' }}</p>
          </div>
          <span class="ac-state" :class="a.status?.state">{{ stateText(a.status?.state) }}</span>
        </div>

        <div class="ac-tags">
          <span class="tag" v-if="a.ai?.modelId">{{ a.ai.modelId }}</span>
          <span class="tag" v-if="a.outputSchema?.collectionName">{{ a.outputSchema.collectionName }}</span>
          <span class="tag sub" v-for="s in a.subscriptions" :key="s.agentId">← {{ agentName(s.agentId) }}</span>
        </div>

        <div class="ac-stats">
          <span>总运行 <b>{{ a.stats?.totalRuns || 0 }}</b></span>
          <span>成功 <b class="green">{{ a.stats?.successRuns || 0 }}</b></span>
          <span>失败 <b class="red">{{ a.stats?.failedRuns || 0 }}</b></span>
          <span v-if="a.schedule?.interval">间隔 <b>{{ (a.schedule.interval / 1000).toFixed(0) }}s</b></span>
        </div>

        <div class="ac-actions">
          <button @click="openEdit(a)" class="btn-sm">编辑</button>
          <button @click="toggleAgent(a)" class="btn-sm" :class="a.enabled ? 'orange' : 'green'">{{ a.enabled ? '禁用' : '启用' }}</button>
          <button @click="delAgent(a)" class="btn-sm danger">删除</button>
        </div>
      </div>
    </div>

    <div v-if="agents.length === 0" class="empty">暂无智能体</div>

    <!-- 编辑弹窗 -->
    <div v-if="showModal" class="modal-mask" @click.self="showModal = false">
      <div class="modal wide">
        <div class="modal-head">
          <h2>{{ isNew ? '创建智能体' : '编辑智能体' }}</h2>
          <button @click="showModal = false" class="close">&times;</button>
        </div>
        <div class="modal-body scroll">
          <!-- 基础 -->
          <fieldset><legend>基础信息</legend>
            <div class="row2">
              <div class="field"><label>名称 <span class="req">*</span></label><input v-model="form.name" /></div>
              <div class="field"><label>工作空间</label>
                <select v-model="form.workspaceId">
                  <option value="">无</option>
                  <option v-for="w in allWorkspaces" :key="w.id" :value="w.id">{{ w.name }}</option>
                </select>
              </div>
            </div>
            <div class="field"><label>描述</label><textarea v-model="form.description" rows="2"></textarea></div>
          </fieldset>

          <!-- AI -->
          <fieldset><legend>AI 配置</legend>
            <div class="row2">
              <div class="field"><label>模型</label><input v-model="form.ai.modelId" placeholder="如 ollama-qwen" /></div>
              <div class="field"><label>温度</label><input v-model.number="form.ai.temperature" type="number" step="0.1" min="0" max="2" /></div>
            </div>
            <div class="field"><label>提示词</label><textarea v-model="form.ai.prompt" rows="4" placeholder="系统提示词"></textarea></div>
          </fieldset>

          <!-- 成果表 -->
          <fieldset><legend>成果表</legend>
            <div class="field"><label>集合名</label><input v-model="form.outputSchema.collectionName" placeholder="自动生成: agent_data_{id}" /></div>
          </fieldset>

          <!-- 订阅 -->
          <fieldset><legend>数据订阅</legend>
            <div v-for="(sub, idx) in form.subscriptions" :key="idx" class="sub-row">
              <select v-model="sub.agentId">
                <option value="">选择智能体</option>
                <option v-for="a in otherAgents" :key="a.id" :value="a.id">{{ a.name }}</option>
              </select>
              <input v-model="sub.collectionName" placeholder="集合名" />
              <button @click="form.subscriptions.splice(idx, 1)" class="btn-x">&times;</button>
            </div>
            <button @click="form.subscriptions.push({ agentId: '', collectionName: '', watermarkField: 'updatedAt' })" class="btn-add">+ 添加订阅</button>
          </fieldset>

          <!-- 调度 -->
          <fieldset><legend>调度配置</legend>
            <div class="row3">
              <div class="field"><label>启用调度</label><input type="checkbox" v-model="form.schedule.enabled" /></div>
              <div class="field"><label>间隔(ms)</label><input v-model.number="form.schedule.interval" type="number" /></div>
              <div class="field"><label>批大小</label><input v-model.number="form.schedule.batchSize" type="number" /></div>
            </div>
          </fieldset>
        </div>
        <div class="modal-foot">
          <button @click="showModal = false" class="btn-cancel">取消</button>
          <button @click="save" class="btn-primary" :disabled="!form.name">{{ isNew ? '创建' : '保存' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { agentsApi, workspacesApi } from '../api'

const agents = ref([])
const allWorkspaces = ref([])
const showModal = ref(false)
const isNew = ref(true)
const editId = ref(null)

const emptyForm = () => ({
  name: '', description: '', workspaceId: '',
  ai: { enabled: true, modelId: '', prompt: '', temperature: 0.7, maxTokens: 4096 },
  schedule: { enabled: true, interval: 30000, batchSize: 10, maxRetries: 3 },
  outputSchema: { collectionName: '' },
  subscriptions: [], skillIds: [], enabled: true
})

const form = ref(emptyForm())

const stateText = (s) => ({ idle: '空闲', running: '运行中', error: '异常' }[s] || '空闲')
const agentName = (id) => agents.value.find(a => a.id === id)?.name || id
const otherAgents = computed(() => agents.value.filter(a => a.id !== editId.value))

const load = async () => {
  const [ag, ws] = await Promise.all([agentsApi.list(), workspacesApi.list()])
  agents.value = ag.data || []
  allWorkspaces.value = (ws.data || []).map(w => ({ id: w.id, name: w.name }))
}

const openCreate = () => {
  isNew.value = true
  editId.value = null
  form.value = emptyForm()
  showModal.value = true
}

const openEdit = (a) => {
  isNew.value = false
  editId.value = a.id
  form.value = {
    name: a.name,
    description: a.description || '',
    workspaceId: a.workspaceId || '',
    ai: { ...a.ai },
    schedule: { ...a.schedule },
    outputSchema: { collectionName: a.outputSchema?.collectionName || '' },
    subscriptions: (a.subscriptions || []).map(s => ({ ...s })),
    skillIds: [...(a.skillIds || [])],
    enabled: a.enabled
  }
  showModal.value = true
}

const save = async () => {
  if (!form.value.name) return
  const payload = {
    ...form.value,
    subscriptions: form.value.subscriptions.filter(s => s.agentId)
  }
  if (isNew.value) {
    await agentsApi.create(payload)
  } else {
    await agentsApi.update(editId.value, payload)
  }
  showModal.value = false
  await load()
}

const toggleAgent = async (a) => {
  await agentsApi.update(a.id, { enabled: !a.enabled })
  await load()
}

const delAgent = async (a) => {
  if (!confirm(`确定删除「${a.name}」？`)) return
  await agentsApi.delete(a.id)
  await load()
}

onMounted(load)
</script>

<style scoped>
.page { max-width: 1200px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.page-header h1 { font-size: 22px; font-weight: 600; }

.btn-primary { padding: 9px 20px; background: #667eea; color: white; border: none; border-radius: 8px; font-size: 14px; cursor: pointer; }
.btn-primary:hover { background: #5a6fd6; }
.btn-primary:disabled { background: #c5c5c5; cursor: not-allowed; }

.agent-list { display: flex; flex-direction: column; gap: 14px; }
.agent-card { background: white; border-radius: 12px; padding: 18px 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); transition: box-shadow 0.2s; }
.agent-card:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.1); }
.agent-card.disabled { opacity: 0.55; }

.ac-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
.ac-top h3 { font-size: 16px; font-weight: 600; }
.ac-desc { font-size: 13px; color: #888; margin-top: 2px; }
.ac-state { font-size: 12px; padding: 3px 10px; border-radius: 12px; background: #f3f4f6; color: #6b7280; white-space: nowrap; }
.ac-state.running { background: #dbeafe; color: #2563eb; }
.ac-state.error { background: #fee2e2; color: #dc2626; }

.ac-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.tag { padding: 3px 10px; border-radius: 10px; font-size: 12px; background: #f0f5ff; color: #3b82f6; }
.tag.sub { background: #fef3c7; color: #92400e; }

.ac-stats { display: flex; gap: 18px; font-size: 13px; color: #666; margin-bottom: 12px; }
.ac-stats b { font-weight: 600; color: #333; }
.ac-stats .green { color: #16a34a; }
.ac-stats .red { color: #ef4444; }

.ac-actions { display: flex; gap: 8px; }
.btn-sm { padding: 5px 14px; border: 1px solid #d1d5db; background: white; border-radius: 6px; font-size: 13px; cursor: pointer; }
.btn-sm:hover { border-color: #667eea; color: #667eea; }
.btn-sm.green { border-color: #16a34a; color: #16a34a; }
.btn-sm.orange { border-color: #d97706; color: #d97706; }
.btn-sm.danger { border-color: #ef4444; color: #ef4444; }
.btn-sm.danger:hover { background: #ef4444; color: white; }

.empty { text-align: center; color: #999; padding: 48px; font-size: 15px; }

/* Modal */
.modal-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: white; border-radius: 14px; width: 560px; max-width: 94vw; }
.modal.wide { width: 680px; }
.modal-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f0f0f0; }
.modal-head h2 { font-size: 17px; }
.close { background: none; border: none; font-size: 22px; cursor: pointer; color: #999; }
.modal-body { padding: 20px; }
.modal-body.scroll { max-height: 65vh; overflow-y: auto; }
.modal-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid #f0f0f0; }
.btn-cancel { padding: 8px 18px; background: #f5f5f5; border: 1px solid #d9d9d9; border-radius: 6px; cursor: pointer; font-size: 14px; }

fieldset { border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; margin-bottom: 16px; }
legend { font-size: 13px; font-weight: 600; color: #667eea; padding: 0 6px; }

.field { margin-bottom: 12px; }
.field label { display: block; margin-bottom: 4px; font-size: 13px; color: #555; }
.req { color: #ef4444; }
.field input[type="text"], .field input[type="number"], .field input:not([type]), .field textarea, .field select { width: 100%; padding: 8px 10px; border: 1px solid #d9d9d9; border-radius: 6px; font-size: 13px; }
.field input:focus, .field textarea:focus, .field select:focus { border-color: #667eea; outline: none; }
.field textarea { resize: vertical; font-family: monospace; }

.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.row3 { display: grid; grid-template-columns: auto 1fr 1fr; gap: 12px; align-items: end; }

.sub-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
.sub-row select, .sub-row input { flex: 1; padding: 7px 10px; border: 1px solid #d9d9d9; border-radius: 6px; font-size: 13px; }
.btn-x { background: none; border: none; color: #ef4444; font-size: 18px; cursor: pointer; padding: 0 4px; }
.btn-add { padding: 6px 14px; border: 1px dashed #d1d5db; background: white; border-radius: 6px; font-size: 13px; color: #667eea; cursor: pointer; }
.btn-add:hover { border-color: #667eea; }
</style>
