<template>
  <div class="card-list">
    <header class="page-header">
      <h1>卡片列表</h1>
      <router-link to="/cards/create" class="btn btn-primary">
        创建卡片
      </router-link>
    </header>

    <div v-if="cardStore.cards.length === 0" class="empty-state">
      <p>暂无卡片，请创建您的第一个卡片</p>
    </div>

    <div v-else class="cards-grid">
      <div 
        v-for="card in cardStore.cards" 
        :key="card.id" 
        class="card-item"
        @click="goToDetail(card.id)"
      >
        <div class="card-content">
          <h3>{{ card.title || '未命名卡片' }}</h3>
          <p>{{ card.description || '暂无描述' }}</p>
        </div>
        <div class="card-footer">
          <span class="card-date">{{ formatDate(card.createdAt) }}</span>
          <button @click.stop="deleteCard(card.id)" class="btn-delete">
            删除
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useCardStore } from '../stores/cardStore'

const router = useRouter()
const cardStore = useCardStore()

const goToDetail = (id) => {
  router.push(`/cards/${id}`)
}

const deleteCard = (id) => {
  if (confirm('确定要删除这个卡片吗？')) {
    cardStore.removeCard(id)
  }
}

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.card-list {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 24px;
  color: #2c3e50;
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: #3498db;
  color: white;
  border: none;
  cursor: pointer;
}

.btn-primary:hover {
  background: #2980b9;
}

.empty-state {
  text-align: center;
  padding: 60px;
  color: #999;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.card-item {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.card-item:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}

.card-content h3 {
  font-size: 18px;
  color: #2c3e50;
  margin-bottom: 8px;
}

.card-content p {
  color: #666;
  font-size: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.card-date {
  color: #999;
  font-size: 12px;
}

.btn-delete {
  padding: 4px 12px;
  background: #fee;
  color: #e74c3c;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.btn-delete:hover {
  background: #fdd;
}
</style>
