<template>
  <div class="knowledge-base">
    <h1>知识库管理</h1>
    
    <!-- 操作栏 -->
    <div class="toolbar">
      <div class="filters">
        <select v-model="filters.subject">
          <option value="">全部学科</option>
          <option v-for="s in subjects" :key="s._id" :value="s._id">{{ s._id }}</option>
        </select>
        <input v-model="filters.keyword" placeholder="搜索知识点..." @keyup.enter="fetchKnowledge" />
      </div>
      <button class="btn-add" @click="showAddModal = true">+ 添加知识点</button>
    </div>

    <!-- 统计 -->
    <div class="stats">
      <span>共 {{ pagination.total }} 条知识点</span>
    </div>

    <!-- 列表 -->
    <div class="knowledge-list">
      <div class="knowledge-item" v-for="item in knowledgeList" :key="item.id" @click="goDetail(item.id)">
        <div class="item-header">
          <span class="subject">{{ item.subject }}</span>
          <span class="category">{{ item.category }}</span>
          <span class="usage">使用 {{ item.metadata?.usageCount || 0 }} 次</span>
        </div>
        <div class="topic">{{ item.topic }}</div>
        <div class="points-count">{{ item.knowledgePoints?.length || 0 }} 个知识点</div>
      </div>
      <div v-if="knowledgeList.length === 0" class="empty">暂无知识点</div>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="pagination.pages > 1">
      <button :disabled="pagination.page <= 1" @click="changePage(-1)">上一页</button>
      <span>{{ pagination.page }} / {{ pagination.pages }}</span>
      <button :disabled="pagination.page >= pagination.pages" @click="changePage(1)">下一页</button>
    </div>

    <!-- 添加弹窗 -->
    <div class="modal" v-if="showAddModal" @click.self="showAddModal = false">
      <div class="modal-content">
        <h2>添加知识点</h2>
        <form @submit.prevent="addKnowledge">
          <div class="form-group">
            <label>学科:</label>
            <input v-model="newKnowledge.subject" required placeholder="如：数学" />
          </div>
          <div class="form-group">
            <label>分类:</label>
            <input v-model="newKnowledge.category" required placeholder="如：小学5年级" />
          </div>
          <div class="form-group">
            <label>主题:</label>
            <input v-model="newKnowledge.topic" required placeholder="如：分数" />
          </div>
          <div class="form-group">
            <label>知识点:</label>
            <textarea v-model="knowledgePointsText" placeholder="每行一个知识点，格式：问题|答案" rows="4"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" @click="showAddModal = false">取消</button>
            <button type="submit" class="btn-primary">添加</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { knowledgeApi } from '../api'

const router = useRouter()

const knowledgeList = ref([])
const subjects = ref([])
const filters = ref({
  subject: '',
  keyword: ''
})
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  pages: 0
})

const showAddModal = ref(false)
const newKnowledge = ref({
  subject: '',
  category: '',
  topic: ''
})
const knowledgePointsText = ref('')

const fetchKnowledge = async () => {
  try {
    const data = await knowledgeApi.list({
      page: pagination.value.page,
      limit: pagination.value.limit,
      ...filters.value
    })
    if (data.success) {
      knowledgeList.value = data.data
      pagination.value = data.pagination
    }
  } catch (error) {
    console.error('获取知识库失败:', error)
  }
}

const fetchStats = async () => {
  try {
    const data = await knowledgeApi.stats()
    if (data.success) {
      subjects.value = data.data.subjects
    }
  } catch (error) {
    console.error('获取统计失败:', error)
  }
}

const changePage = (delta) => {
  pagination.value.page += delta
  fetchKnowledge()
}

const goDetail = (id) => {
  router.push(`/knowledge/${id}`)
}

const addKnowledge = async () => {
  try {
    // 解析知识点
    const points = knowledgePointsText.value
      .split('\n')
      .filter(line => line.trim())
      .map((line, index) => {
        const [question, answer] = line.split('|')
        return {
          question: question?.trim() || '',
          answer: answer?.trim() || '',
          difficulty: '中等'
        }
      })
      .filter(p => p.question && p.answer)

    const data = await knowledgeApi.create({
      ...newKnowledge.value,
      knowledgePoints: points
    })
    
    if (data.success) {
      showAddModal.value = false
      newKnowledge.value = { subject: '', category: '', topic: '' }
      knowledgePointsText.value = ''
      fetchKnowledge()
      fetchStats()
    }
  } catch (error) {
    console.error('添加知识点失败:', error)
  }
}

onMounted(() => {
  fetchKnowledge()
  fetchStats()
})
</script>

<style scoped>
.knowledge-base {
  padding: 20px;
}

h1 {
  margin-bottom: 24px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.filters {
  display: flex;
  gap: 12px;
}

.filters select,
.filters input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.filters input {
  width: 200px;
}

.btn-add {
  padding: 8px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.stats {
  margin-bottom: 16px;
  color: #999;
  font-size: 14px;
}

.knowledge-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.knowledge-item {
  background: white;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.knowledge-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.item-header {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.subject {
  background: #667eea;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.category {
  background: #f0f0f0;
  color: #666;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.usage {
  margin-left: auto;
  color: #999;
  font-size: 12px;
}

.topic {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #333;
}

.points-count {
  color: #999;
  font-size: 14px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.pagination button {
  padding: 8px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal {
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
  padding: 24px;
  width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-content h2 {
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-sizing: border-box;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}

.form-actions button {
  padding: 8px 20px;
  border-radius: 6px;
  cursor: pointer;
}

.btn-primary {
  background: #667eea;
  color: white;
  border: none;
}

.empty {
  text-align: center;
  color: #999;
  padding: 60px;
  grid-column: 1 / -1;
}
</style>
