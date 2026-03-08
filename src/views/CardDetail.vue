<template>
  <div class="card-detail">
    <div v-if="!card" class="not-found">
      <p>卡片不存在</p>
      <router-link to="/cards" class="btn">返回列表</router-link>
    </div>

    <div v-else class="detail-content">
      <header class="page-header">
        <div class="header-left">
          <h1>{{ card.title || '未命名卡片' }}</h1>
          <div class="meta">
            <span class="date">创建于：{{ formatDate(card.createdAt) }}</span>
            <span v-if="card.tags?.length" class="tags">
              <span v-for="tag in card.tags" :key="tag" class="tag">
                {{ tag }}
              </span>
            </span>
          </div>
        </div>
        <div class="header-actions">
          <button @click="regenerate" class="btn btn-secondary">
            重新生成
          </button>
          <button @click="deleteCard" class="btn btn-danger">
            删除
          </button>
        </div>
      </header>

      <section class="section">
        <h2>描述</h2>
        <p>{{ card.description || '暂无描述' }}</p>
      </section>

      <section class="section">
        <h2>内容</h2>
        <div class="content-box">
          {{ card.content || '暂无内容' }}
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCardStore } from '../stores/cardStore'

const route = useRoute()
const router = useRouter()
const cardStore = useCardStore()

const card = computed(() => {
  return cardStore.getCardById(route.params.id)
})

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}

const regenerate = () => {
  alert('对接 OpenClaw 重新生成内容')
}

const deleteCard = () => {
  if (confirm('确定要删除这个卡片吗？')) {
    cardStore.removeCard(route.params.id)
    router.push('/cards')
  }
}
</script>

<style scoped>
.card-detail {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 20px;
}

.not-found {
  text-align: center;
  padding: 60px;
  color: #999;
}

.not-found .btn {
  display: inline-block;
  margin-top: 16px;
  padding: 10px 20px;
  background: #3498db;
  color: white;
  text-decoration: none;
  border-radius: 8px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #eee;
}

.header-left h1 {
  font-size: 28px;
  color: #2c3e50;
  margin-bottom: 12px;
}

.meta {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.date {
  color: #999;
  font-size: 14px;
}

.tags {
  display: flex;
  gap: 8px;
}

.tag {
  padding: 4px 12px;
  background: #e8f4fc;
  color: #3498db;
  border-radius: 16px;
  font-size: 12px;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: white;
  color: #3498db;
  border: 1px solid #3498db;
}

.btn-secondary:hover {
  background: #f0f8ff;
}

.btn-danger {
  background: white;
  color: #e74c3c;
  border: 1px solid #e74c3c;
}

.btn-danger:hover {
  background: #fef0f0;
}

.section {
  margin-bottom: 32px;
}

.section h2 {
  font-size: 18px;
  color: #2c3e50;
  margin-bottom: 12px;
}

.section p {
  color: #666;
  line-height: 1.8;
}

.content-box {
  background: white;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  white-space: pre-wrap;
  line-height: 1.8;
}
</style>
