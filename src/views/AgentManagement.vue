<template>
  <div class="agent-management">
    <div class="page-header">
      <h1>智能体管理</h1>
      <button class="add-agent-btn" @click="showAddModal = true">
        <span class="plus-icon">+</span>
        新增智能体
      </button>
    </div>

    <!-- 智能体列表 -->
    <div class="agents-list">
      <div 
        v-for="agent in agents" 
        :key="agent.id"
        class="agent-card"
      >
        <div class="agent-header">
          <div class="agent-info">
            <h3>{{ agent.name }}</h3>
            <p class="agent-description">{{ agent.description || '无描述' }}</p>
          </div>
          <div class="agent-actions">
            <button class="action-btn edit-btn" @click="editAgent(agent)">
              编辑
            </button>
            <button class="action-btn delete-btn" @click="deleteAgent(agent.id)">
              删除
            </button>
          </div>
        </div>

        <div class="agent-details">
          <div class="detail-row">
            <span class="detail-label">角色：</span>
            <span class="detail-value">{{ agent.role }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">模型：</span>
            <span class="detail-value">{{ agent.modelId || 'ollama-qwen' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">状态：</span>
            <span :class="['agent-status', agent.enabled ? 'enabled' : 'disabled']">
              {{ agent.enabled ? '启用' : '禁用' }}
            </span>
          </div>
        </div>

        <div class="agent-capabilities">
          <h4>能力</h4>
          <div class="capabilities-tags">
            <span 
              v-for="capability in agent.capabilities" 
              :key="capability"
              class="capability-tag"
            >
              {{ capability }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="agents.length === 0" class="empty-state">
        <p>暂无智能体，点击右上角按钮添加</p>
      </div>
    </div>

    <!-- 新增/编辑智能体模态框 -->
    <div v-if="showAddModal || showEditModal" class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ showEditModal ? '编辑智能体' : '新增智能体' }}</h2>
          <button class="close-btn" @click="closeModal">&times;</button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="saveAgent">
            <div class="form-group">
              <label for="agent-name">智能体名称</label>
              <input 
                type="text" 
                id="agent-name" 
                v-model="formData.name" 
                required
              >
            </div>

            <div class="form-group">
              <label for="agent-role">角色</label>
              <select 
                id="agent-role" 
                v-model="formData.role" 
                required
              >
                <option value="analyst">需求分析师</option>
                <option value="generator">内容生成器</option>
                <option value="designer">卡片设计师</option>
                <option value="reviewer">质量审核员</option>
                <option value="planner">计划协调员</option>
              </select>
            </div>

            <div class="form-group">
              <label for="agent-description">描述</label>
              <textarea 
                id="agent-description" 
                v-model="formData.description"
                rows="3"
              ></textarea>
            </div>

            <div class="form-group">
              <label for="agent-model">模型</label>
              <select 
                id="agent-model" 
                v-model="formData.modelId" 
                required
              >
                <option 
                  v-for="model in availableModels" 
                  :key="model.id"
                  :value="model.id"
                >
                  {{ model.name }} ({{ model.provider }})
                </option>
              </select>
            </div>

            <div class="form-row">
              <div class="form-group half">
                <label for="agent-temperature">温度</label>
                <input 
                  type="number" 
                  id="agent-temperature" 
                  v-model="formData.temperature"
                  min="0"
                  max="2"
                  step="0.1"
                >
              </div>
              <div class="form-group half">
                <label for="agent-maxTokens">最大Token</label>
                <input 
                  type="number" 
                  id="agent-maxTokens" 
                  v-model="formData.maxTokens"
                  min="256"
                  max="32768"
                  step="256"
                >
              </div>
            </div>

            <div class="form-group">
              <label for="agent-prompt">提示词</label>
              <textarea 
                id="agent-prompt" 
                v-model="formData.prompt" 
                rows="6"
                required
              ></textarea>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input 
                  type="checkbox" 
                  v-model="formData.enabled"
                >
                启用智能体
              </label>
            </div>

            <div class="form-group">
              <label>能力</label>
              <div class="capabilities-checklist">
                <label 
                  v-for="capability in availableCapabilities" 
                  :key="capability"
                  class="capability-checkbox"
                >
                  <input 
                    type="checkbox" 
                    :value="capability"
                    v-model="formData.capabilities"
                  >
                  {{ capability }}
                </label>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn cancel-btn" @click="closeModal">
                取消
              </button>
              <button type="submit" class="btn save-btn">
                {{ showEditModal ? '保存修改' : '创建智能体' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { modelsApi } from '../api'

const agents = ref([])
const availableModels = ref([])
const showAddModal = ref(false)
const showEditModal = ref(false)
const editingAgentId = ref(null)

const availableCapabilities = [
  '需求分析',
  '内容生成',
  '卡片设计',
  '质量审核',
  '计划协调',
  '知识检索',
  '多语言支持'
]

const formData = ref({
  name: '',
  role: 'analyst',
  description: '',
  modelId: 'ollama-qwen',
  prompt: '',
  temperature: 0.7,
  maxTokens: 4096,
  enabled: true,
  capabilities: []
})

const fetchAgents = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/agents')
    const data = await response.json()
    if (data.success) {
      agents.value = data.agents || []
    }
  } catch (error) {
    console.error('获取智能体列表失败:', error)
  }
}

const fetchModels = async () => {
  try {
    const response = await modelsApi.list()
    if (response.success) {
      availableModels.value = response.data.models || []
    }
  } catch (error) {
    console.error('获取模型列表失败:', error)
  }
}

const saveAgent = async () => {
  try {
    const url = showEditModal.value 
      ? `http://localhost:3001/api/agents/${editingAgentId.value}`
      : 'http://localhost:3001/api/agents'
    
    const method = showEditModal.value ? 'PUT' : 'POST'
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData.value)
    })
    
    const data = await response.json()
    if (data.success) {
      await fetchAgents()
      closeModal()
    }
  } catch (error) {
    console.error('保存智能体失败:', error)
  }
}

const editAgent = (agent) => {
  editingAgentId.value = agent.id
  formData.value = { ...agent }
  showEditModal.value = true
}

const deleteAgent = async (agentId) => {
  if (confirm('确定要删除这个智能体吗？')) {
    try {
      const response = await fetch(`http://localhost:3001/api/agents/${agentId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        await fetchAgents()
      }
    } catch (error) {
      console.error('删除智能体失败:', error)
    }
  }
}

const closeModal = () => {
  showAddModal.value = false
  showEditModal.value = false
  editingAgentId.value = null
  formData.value = {
    name: '',
    role: 'analyst',
    description: '',
    modelId: 'ollama-qwen',
    prompt: '',
    temperature: 0.7,
    maxTokens: 4096,
    enabled: true,
    capabilities: []
  }
}

onMounted(async () => {
  await fetchAgents()
  await fetchModels()
})
</script>

<style scoped>
.agent-management {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.add-agent-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.add-agent-btn:hover {
  background: #40a9ff;
}

.plus-icon {
  font-size: 16px;
  font-weight: bold;
}

.agents-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.agent-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid #f0f0f0;
}

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.agent-info h3 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
}

.agent-description {
  margin: 0;
  font-size: 14px;
  color: #666;
  line-height: 1.4;
}

.agent-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 4px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s;
}

.edit-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.delete-btn:hover {
  border-color: #ff4d4f;
  color: #ff4d4f;
}

.agent-details {
  margin-bottom: 16px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 6px;
}

.detail-row {
  display: flex;
  margin-bottom: 8px;
  font-size: 14px;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-label {
  width: 80px;
  color: #999;
  flex-shrink: 0;
}

.detail-value {
  color: #333;
  font-weight: 500;
}

.agent-status {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
}

.agent-status.enabled {
  background: #f6ffed;
  color: #52c41a;
  border: 1px solid #b7eb8f;
}

.agent-status.disabled {
  background: #fff1f0;
  color: #ff4d4f;
  border: 1px solid #ffccc7;
}

.agent-capabilities {
  margin-top: 16px;
}

.agent-capabilities h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.capabilities-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.capability-tag {
  padding: 4px 12px;
  background: #f0f5ff;
  color: #1890ff;
  border-radius: 12px;
  font-size: 12px;
  border: 1px solid #d6e4ff;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  color: #999;
  background: #fafafa;
  border-radius: 8px;
  border: 2px dashed #e8e8e8;
}

/* 模态框样式 */
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
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 20px;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-group.half {
  flex: 1;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.3s;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: normal;
}

.capabilities-checklist {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 8px;
}

.capability-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #f0f0f0;
  margin-top: 20px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.cancel-btn {
  background: white;
  color: #333;
}

.cancel-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.save-btn {
  background: #1890ff;
  color: white;
  border-color: #1890ff;
}

.save-btn:hover {
  background: #40a9ff;
  border-color: #40a9ff;
}
</style>