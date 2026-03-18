<template>
  <div class="skill-page">
    <div class="page-header">
      <h1>技能配置</h1>
      <button @click="showAddModal = true" class="btn-add">+ 添加技能</button>
    </div>
    
    <!-- 分类筛选 -->
    <div class="filter-bar">
      <button 
        v-for="cat in categories" 
        :key="cat"
        :class="['filter-btn', { active: selectedCategory === cat }]"
        @click="selectedCategory = selectedCategory === cat ? '' : cat"
      >
        {{ cat }}
      </button>
    </div>
    
    <!-- 技能列表 -->
    <div class="skill-grid">
      <div v-for="skill in filteredSkills" :key="skill.id" class="skill-card">
        <div class="skill-header">
          <span class="skill-category">{{ skill.category }}</span>
          <div class="skill-actions">
            <button @click="editSkill(skill)" class="btn-icon">✏️</button>
            <button @click="deleteSkill(skill.id)" class="btn-icon">🗑️</button>
          </div>
        </div>
        <h3 class="skill-name">{{ skill.name }}</h3>
        <p class="skill-desc">{{ skill.description }}</p>
        <div class="skill-tags">
          <span v-for="tag in skill.tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>
    </div>
    
    <div v-if="filteredSkills.length === 0" class="empty-tip">
      暂无技能，点击上方"添加技能"创建
    </div>
    
    <!-- 添加/编辑弹窗 -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2>{{ editingSkill ? '编辑技能' : '添加技能' }}</h2>
          <button @click="closeModal" class="close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>技能名称</label>
            <input v-model="form.name" placeholder="如：信息提取" class="form-input" />
          </div>
          <div class="form-group">
            <label>分类</label>
            <select v-model="form.category" class="form-select">
              <option value="">选择分类</option>
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="form.description" placeholder="技能描述" class="form-textarea" rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>标签（逗号分隔）</label>
            <input v-model="form.tagsInput" placeholder="如：文本处理,分析" class="form-input" />
          </div>
          <div class="form-group">
            <label>预设 Prompt</label>
            <textarea v-model="form.prompt" placeholder="可选的预设提示词" class="form-textarea" rows="4"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button @click="closeModal" class="btn-cancel">取消</button>
          <button @click="saveSkill" class="btn-save">保存</button>
        </div>
      </div>
    </div>
    
    <!-- 智能体技能分配 -->
    <div class="agent-section">
      <h2>智能体技能分配</h2>
      <div class="agent-list">
        <div v-for="agent in agents" :key="agent.id" class="agent-card">
          <div class="agent-header">
            <span class="agent-name">{{ agent.name }}</span>
            <span class="agent-role">{{ agent.role }}</span>
          </div>
          <div class="agent-skills">
            <span v-for="cap in agent.capabilities" :key="cap" class="skill-tag">{{ cap }}</span>
            <button @click="assignSkill(agent)" class="btn-assign">+ 添加</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const API_URL = 'http://localhost:3001/api'

const agents = ref([])
const skills = ref([])
const selectedCategory = ref('')
const showAddModal = ref(false)
const editingSkill = ref(null)

const form = ref({
  name: '',
  category: '',
  description: '',
  tagsInput: '',
  prompt: ''
})

const categories = ['信息处理', '知识构建', '内容生成', '分析推理', '视觉设计', '质量检查', '其他']

// 从 localStorage 加载技能
const loadSkills = () => {
  const stored = localStorage.getItem('agentSkills')
  if (stored) {
    skills.value = JSON.parse(stored)
  } else {
    // 默认技能
    skills.value = [
      { id: '1', name: '信息提取', category: '信息处理', description: '从文本中提取关键信息点', tags: ['文本分析', '关键点'], prompt: '' },
      { id: '2', name: '知识建模', category: '知识构建', description: '构建知识体系架构', tags: ['结构设计', '逻辑分析'], prompt: '' },
      { id: '3', name: '卡片生成', category: '内容生成', description: '生成知识卡片JSON', tags: ['JSON', '视觉设计'], prompt: '' },
      { id: '4', name: '质量检查', category: '质量检查', description: '检查输出质量', tags: ['验证', '审核'], prompt: '' }
    ]
    saveSkillsToStorage()
  }
}

const saveSkillsToStorage = () => {
  localStorage.setItem('agentSkills', JSON.stringify(skills.value))
}

const filteredSkills = computed(() => {
  if (!selectedCategory.value) return skills.value
  return skills.value.filter(s => s.category === selectedCategory.value)
})

const fetchAgents = async () => {
  try {
    const res = await fetch(`${API_URL}/agents`)
    const data = await res.json()
    if (data.success) {
      agents.value = data.agents
    }
  } catch (err) {
    console.error('获取智能体失败:', err)
  }
}

const editSkill = (skill) => {
  editingSkill.value = skill
  form.value = {
    name: skill.name,
    category: skill.category,
    description: skill.description,
    tagsInput: skill.tags.join(', '),
    prompt: skill.prompt || ''
  }
  showAddModal.value = true
}

const deleteSkill = (id) => {
  if (!confirm('确定删除这个技能?')) return
  skills.value = skills.value.filter(s => s.id !== id)
  saveSkillsToStorage()
}

const closeModal = () => {
  showAddModal.value = false
  editingSkill.value = null
  form.value = { name: '', category: '', description: '', tagsInput: '', prompt: '' }
}

const saveSkill = () => {
  if (!form.value.name || !form.value.category) {
    alert('请填写名称和分类')
    return
  }
  
  const skill = {
    id: editingSkill.value?.id || Date.now().toString(),
    name: form.value.name,
    category: form.value.category,
    description: form.value.description,
    tags: form.value.tagsInput.split(',').map(t => t.trim()).filter(t => t),
    prompt: form.value.prompt
  }
  
  if (editingSkill.value) {
    const idx = skills.value.findIndex(s => s.id === editingSkill.value.id)
    if (idx !== -1) skills.value[idx] = skill
  } else {
    skills.value.push(skill)
  }
  
  saveSkillsToStorage()
  closeModal()
}

const assignSkill = async (agent) => {
  // 显示可选技能列表
  const skillNames = skills.value.map(s => s.name)
  const choice = prompt(`选择技能（输入名称）:\n${skillNames.join('\n')}`)
  if (choice && !agent.capabilities.includes(choice)) {
    try {
      const res = await fetch(`${API_URL}/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capabilities: [...agent.capabilities, choice]
        })
      })
      const data = await res.json()
      if (data.success) {
        agent.capabilities.push(choice)
      }
    } catch (err) {
      console.error('更新失败:', err)
    }
  }
}

onMounted(() => {
  loadSkills()
  fetchAgents()
})
</script>

<style scoped>
.skill-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h1 {
  margin: 0;
  font-size: 20px;
}

.btn-add {
  background: #1890ff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.filter-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 6px 12px;
  border: 1px solid #d9d9d9;
  background: white;
  border-radius: 16px;
  cursor: pointer;
  font-size: 12px;
}

.filter-btn.active {
  background: #1890ff;
  color: white;
  border-color: #1890ff;
}

.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 40px;
}

.skill-card {
  background: white;
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.skill-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.skill-category {
  background: #e6f7ff;
  color: #1890ff;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
}

.skill-actions {
  display: flex;
  gap: 4px;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
}

.skill-name {
  margin: 0 0 8px 0;
  font-size: 15px;
}

.skill-desc {
  color: #666;
  font-size: 12px;
  margin: 0 0 12px 0;
}

.skill-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tag {
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: #666;
}

.empty-tip {
  text-align: center;
  color: #999;
  padding: 40px;
}

/* 弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 500px;
  max-width: 90%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.modal-header h2 {
  margin: 0;
  font-size: 16px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #333;
}

.form-input, .form-select, .form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 13px;
}

.form-textarea {
  resize: vertical;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #f0f0f0;
}

.btn-cancel {
  padding: 8px 16px;
  border: 1px solid #d9d9d9;
  background: white;
  border-radius: 6px;
  cursor: pointer;
}

.btn-save {
  padding: 8px 16px;
  border: none;
  background: #1890ff;
  color: white;
  border-radius: 6px;
  cursor: pointer;
}

/* 智能体技能分配 */
.agent-section {
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

.agent-section h2 {
  font-size: 16px;
  margin-bottom: 16px;
}

.agent-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.agent-card {
  background: white;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}

.agent-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.agent-name {
  font-weight: 600;
  font-size: 13px;
}

.agent-role {
  color: #999;
  font-size: 11px;
}

.agent-skills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.skill-tag {
  background: #f6ffed;
  color: #52c41a;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.btn-assign {
  background: #f0f0f0;
  border: none;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}
</style>