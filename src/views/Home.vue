<template>
  <div class="home">
    <header class="header">
      <h1>AI 卡片管理系统</h1>
      <p class="subtitle">管理您的 AI 创作内容</p>
    </header>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">{{ cardStore.cards.length }}</div>
        <div class="stat-label">总卡片数</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ recentCards }}</div>
        <div class="stat-label">本周新增</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">-</div>
        <div class="stat-label">AI 对接状态</div>
      </div>
    </div>

    <div class="actions">
      <router-link to="/cards/create" class="btn btn-primary">
        创建新卡片
      </router-link>
      <router-link to="/cards" class="btn btn-secondary">
        查看全部卡片
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useCardStore } from '../stores/cardStore'

const cardStore = useCardStore()

const recentCards = computed(() => {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  return cardStore.cards.filter(card => 
    new Date(card.createdAt) > weekAgo
  ).length
})
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;
}

.header {
  text-align: center;
  margin-bottom: 40px;
}

.header h1 {
  font-size: 32px;
  color: #2c3e50;
  margin-bottom: 8px;
}

.subtitle {
  color: #666;
  font-size: 16px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 40px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.stat-value {
  font-size: 36px;
  font-weight: 600;
  color: #3498db;
  margin-bottom: 8px;
}

.stat-label {
  color: #666;
  font-size: 14px;
}

.actions {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.btn {
  padding: 12px 24px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover {
  background: #2980b9;
}

.btn-secondary {
  background: white;
  color: #3498db;
  border: 2px solid #3498db;
}

.btn-secondary:hover {
  background: #f0f8ff;
}
</style>
