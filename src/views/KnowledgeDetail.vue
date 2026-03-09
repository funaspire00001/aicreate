<template>
  <div class="knowledge-detail">
    <router-link to="/knowledge" class="back-link">← 返回列表</router-link>
    
    <div v-if="loading" class="loading">加载中...</div>
    
    <div v-else-if="knowledge">
      <div class="header">
        <div>
          <span class="subject">{{ knowledge.subject }}</span>
          <span class="category">{{ knowledge.category }}</span>
        </div>
        <div class="actions">
          <button @click="editMode = !editMode">{{ editMode ? '取消' : '编辑' }}</button>
          <button class="btn-danger" @click="deleteKnowledge">删除</button>
        </div>
      </div>
      
      <h1>{{ knowledge.topic }}</h1>
      
      <div class="meta">
        <span>使用次数: {{ knowledge.metadata?.usageCount || 0 }}</span>
        <span>最后使用: {{ formatTime(knowledge.metadata?.lastUsed) }}</span>
        <span>创建时间: {{ formatTime(knowledge.metadata?.createdAt) }}</span>
      </div>

      <!-- 推荐风格 -->
      <div class="section" v-if="knowledge.recommendStyle">
        <h2>推荐风格</h2>
        <div class="style-grid">
          <div class="style-item" v-for="(value, key) in knowledge.recommendStyle" :key="key">
            <span class="style-label">{{ styleLabels[key] || key }}</span>
            <span class="style-value">{{ value }}</span>
          </div>
        </div>
      </div>

      <!-- 知识点列表 -->
      <div class="section">
        <h2>知识点 ({{ knowledge.knowledgePoints?.length || 0 }})</h2>
        <div class="points-list">
          <div class="point-item" v-for="(point, index) in knowledge.knowledgePoints" :key="point.id">
            <div class="point-header">
              <span class="point-num">{{ index + 1 }}</span>
              <span :class="['difficulty', point.difficulty]">{{ point.difficulty }}</span>
            </div>
            <div class="point-question">{{ point.question }}</div>
            <div class="point-answer">{{ point.answer }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty">未找到知识点</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const knowledge = ref(null)
const editMode = ref(false)

const styleLabels = {
  templateStyle: '风格',
  colorScheme: '配色',
  layoutMode: '布局',
  textTemperament: '文字',
  refinementLevel: '精致度',
  texturePreference: '质感'
}

const formatTime = (time) => {
  if (!time) return '-'
  return new Date(time).toLocaleString('zh-CN')
}

const fetchDetail = async () => {
  try {
    const id = route.params.id
    const res = await fetch(`http://localhost:3001/api/knowledge/${id}`)
    const data = await res.json()
    if (data.success) {
      knowledge.value = data.data
    }
  } catch (error) {
    console.error('获取详情失败:', error)
  } finally {
    loading.value = false
  }
}

const deleteKnowledge = async () => {
  if (!confirm('确定要删除这个知识点吗？')) return
  
  try {
    const res = await fetch(`http://localhost:3001/api/knowledge/${knowledge.value.id}`, {
      method: 'DELETE'
    })
    const data = await res.json()
    if (data.success) {
      router.push('/knowledge')
    }
  } catch (error) {
    console.error('删除失败:', error)
  }
}

onMounted(() => {
  fetchDetail()
})
</script>

<style scoped>
.knowledge-detail {
  padding: 20px;
  max-width: 900px;
}

.back-link {
  display: inline-block;
  margin-bottom: 20px;
  color: #667eea;
  text-decoration: none;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.subject {
  background: #667eea;
  color: white;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 14px;
}

.category {
  background: #f0f0f0;
  color: #666;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 14px;
  margin-left: 8px;
}

.actions {
  display: flex;
  gap: 8px;
}

.actions button {
  padding: 6px 16px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
}

.btn-danger {
  color: #f5222d;
  border-color: #f5222d !important;
}

h1 {
  margin-bottom: 12px;
}

.meta {
  display: flex;
  gap: 24px;
  color: #999;
  font-size: 14px;
  margin-bottom: 24px;
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

.style-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.style-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f9f9f9;
  border-radius: 6px;
}

.style-label {
  color: #999;
}

.style-value {
  font-weight: 500;
}

.points-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.point-item {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 16px;
}

.point-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.point-num {
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

.difficulty {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.difficulty.简单 {
  background: #e6f7ee;
  color: #52c41a;
}

.difficulty.中等 {
  background: #fff7e6;
  color: #fa8c16;
}

.difficulty.困难 {
  background: #fff1f0;
  color: #f5222d;
}

.point-question {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
  color: #333;
}

.point-answer {
  color: #666;
  line-height: 1.6;
}

.loading, .empty {
  text-align: center;
  padding: 60px;
  color: #999;
}
</style>
