<template>
  <div class="workspace-management">
    <div class="page-header">
      <h1>空间管理</h1>
      <button @click="showCreateModal = true" class="create-btn">+ 创建空间</button>
    </div>

    <!-- 空间列表 -->
    <div class="workspace-list">
      <div v-for="ws in workspaces" :key="ws.id" class="workspace-card">
        <div class="card-header">
          <h3>{{ ws.name }}</h3>
          <div class="card-actions">
            <button @click="editWorkspace(ws)" class="btn-icon" title="编辑">✏️</button>
            <button @click="deleteWorkspace(ws)" class="btn-icon danger" title="删除">🗑️</button>
          </div>
        </div>
        <p class="card-desc">{{ ws.description || '暂无描述' }}</p>
        <div class="card-meta">
          <span class="meta-item">
            <span class="meta-icon">🤖</span>
            {{ ws.agentIds?.length || 0 }} 个智能体
          </span>
          <span class="meta-item">
            <span class="meta-icon">📅</span>
            {{ formatDate(ws.createdAt) }}
          </span>
        </div>
        <div class="card-agents" v-if="ws.agentIds?.length">
          <span v-for="agentId in ws.agentIds.slice(0, 4)" :key="agentId" class="agent-tag">
            {{ getAgentName(agentId) }}
          </span>
          <span v-if="ws.agentIds.length > 4" class="agent-more">
            +{{ ws.agentIds.length - 4 }}
          </span>
        </div>
        <button @click="openWorkspace(ws)" class="open-btn">进入空间 →</button>
      </div>

      <!-- 空状态 -->
      <div v-if="workspaces.length === 0" class="empty-state">
        <div class="empty-icon">🏢</div>
        <h3>暂无空间</h3>
        <p>创建一个空间来组织你的智能体</p>
        <button @click="showCreateModal = true" class="create-btn">创建第一个空间</button>
      </div>
    </div>

    <!-- 创建/编辑空间弹窗 -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ editingWorkspace ? '编辑空间' : '创建空间' }}</h2>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <label>空间名称 <span class="required">*</span></label>
            <input v-model="formData.name" class="form-input" placeholder="输入空间名称" />
          </div>
          <div class="form-row">
            <label>描述</label>
            <textarea v-model="formData.description" class="form-textarea" placeholder="输入空间描述"></textarea>
          </div>
          <div class="form-row">
            <label>选择智能体</label>
            <div class="agent-select">
              <label v-for="agent in availableAgents" :key="agent.id" class="agent-checkbox">
                <input type="checkbox" :value="agent.id" v-model="formData.agentIds" />
                <span class="agent-name">{{ agent.name }}</span>
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeModal" class="btn-cancel">取消</button>
          <button @click="saveWorkspace" class="btn-confirm" :disabled="!formData.name">
            {{ editingWorkspace ? '保存' : '创建' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const API_URL = 'http://localhost:3001/api'

const workspaces = ref([])
const availableAgents = ref([])
const showCreateModal = ref(false)
const editingWorkspace = ref(null)
const formData = ref({
  name: '',
  description: '',
  agentIds: []
})

// 获取空间列表
const fetchWorkspaces = async () => {
  try {
    console.log('[空间管理] 开始获取空间列表...')
    const res = await fetch(`${API_URL}/workspaces`)
    const data = await res.json()
    console.log('[空间管理] API返回:', data)
    if (data.success) {
      workspaces.value = data.workspaces
      console.log('[空间管理] 空间列表:', workspaces.value)
    }
  } catch (err) {
    console.error('获取空间失败:', err)
  }
}

// 获取可用智能体
const fetchAgents = async () => {
  try {
    console.log('[空间管理] 开始获取智能体列表...')
    const res = await fetch(`${API_URL}/agents`)
    const data = await res.json()
    console.log('[空间管理] API返回:', data)
    if (data.success) {
      availableAgents.value = data.agents.map(a => ({
        id: a.id,
        name: a.name
      }))
      console.log('[空间管理] 处理后的智能体列表:', availableAgents.value)
    }
  } catch (err) {
    console.error('获取智能体失败:', err)
  }
}

// 获取智能体名称
const getAgentName = (agentId) => {
  const agent = availableAgents.value.find(a => a.id === agentId)
  return agent?.name || agentId
}

// 格式化日期
const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('zh-CN')
}

// 编辑空间
const editWorkspace = (ws) => {
  editingWorkspace.value = ws
  formData.value = {
    name: ws.name,
    description: ws.description || '',
    agentIds: ws.agentIds || []
  }
  showCreateModal.value = true
}

// 删除空间
const deleteWorkspace = async (ws) => {
  if (ws.isDefault) {
    alert('默认空间不能删除')
    return
  }
  if (!confirm(`确定要删除空间「${ws.name}」吗？`)) return
  
  try {
    const res = await fetch(`${API_URL}/workspaces/${ws.id}`, {
      method: 'DELETE'
    })
    const data = await res.json()
    if (data.success) {
      await fetchWorkspaces()
    } else {
      alert(data.error || '删除失败')
    }
  } catch (err) {
    console.error('删除空间失败:', err)
    alert('删除失败')
  }
}

// 保存空间
const saveWorkspace = async () => {
  if (!formData.value.name) return
  
  try {
    if (editingWorkspace.value) {
      // 编辑
      const res = await fetch(`${API_URL}/workspaces/${editingWorkspace.value.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.value.name,
          description: formData.value.description,
          agentIds: formData.value.agentIds
        })
      })
      const data = await res.json()
      if (data.success) {
        await fetchWorkspaces()
      } else {
        alert(data.error || '保存失败')
      }
    } else {
      // 新建
      const res = await fetch(`${API_URL}/workspaces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.value.name,
          description: formData.value.description,
          agentIds: formData.value.agentIds
        })
      })
      const data = await res.json()
      if (data.success) {
        await fetchWorkspaces()
      } else {
        alert(data.error || '创建失败')
      }
    }
    closeModal()
  } catch (err) {
    console.error('保存空间失败:', err)
    alert('保存失败')
  }
}

// 关闭弹窗
const closeModal = () => {
  showCreateModal.value = false
  editingWorkspace.value = null
  formData.value = { name: '', description: '', agentIds: [] }
}

// 进入空间（跳转到仪表盘）
const openWorkspace = (ws) => {
  // 存储当前空间ID，仪表盘根据此加载对应智能体
  localStorage.setItem('currentWorkspace', ws.id)
  router.push('/')
}

onMounted(() => {
  fetchWorkspaces()
  fetchAgents()
})
</script>

<style scoped>
.workspace-management {
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  font-weight: 600;
}

.create-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.create-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.workspace-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.workspace-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.3s;
}

.workspace-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.card-header h3 {
  font-size: 18px;
  font-weight: 600;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: #f5f5f5;
}

.btn-icon.danger:hover {
  background: #fff1f0;
}

.card-desc {
  color: #666;
  font-size: 14px;
  margin-bottom: 16px;
  line-height: 1.5;
}

.card-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #999;
}

.meta-icon {
  font-size: 14px;
}

.card-agents {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.agent-tag {
  padding: 4px 10px;
  background: #f0f5ff;
  color: #1890ff;
  border-radius: 12px;
  font-size: 12px;
}

.agent-more {
  padding: 4px 10px;
  background: #f5f5f5;
  color: #999;
  border-radius: 12px;
  font-size: 12px;
}

.open-btn {
  width: 100%;
  padding: 10px;
  background: #f5f7fa;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
  color: #667eea;
  cursor: pointer;
  transition: all 0.3s;
}

.open-btn:hover {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 20px;
  margin-bottom: 8px;
}

.empty-state p {
  color: #999;
  margin-bottom: 24px;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 520px;
  max-width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h2 {
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
}

.modal-body {
  padding: 20px;
}

.form-row {
  margin-bottom: 16px;
}

.form-row label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  color: #333;
}

.required {
  color: #ff4d4f;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.agent-select {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
  background: #fafafa;
  border-radius: 6px;
}

.agent-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.agent-checkbox input {
  cursor: pointer;
}

.agent-name {
  font-size: 13px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #f0f0f0;
}

.btn-cancel {
  padding: 8px 20px;
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-confirm {
  padding: 8px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-confirm:disabled {
  background: #d9d9d9;
  cursor: not-allowed;
}
</style>
