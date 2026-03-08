<template>
  <div class="card-create">
    <header class="page-header">
      <h1>创建新卡片</h1>
    </header>

    <form @submit.prevent="handleSubmit" class="card-form">
      <div class="form-group">
        <label for="title">标题</label>
        <input 
          id="title" 
          v-model="form.title" 
          type="text" 
          placeholder="输入卡片标题"
          required
        />
      </div>

      <div class="form-group">
        <label for="description">描述</label>
        <textarea 
          id="description" 
          v-model="form.description" 
          placeholder="输入卡片描述"
          rows="4"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="content">内容</label>
        <textarea 
          id="content" 
          v-model="form.content" 
          placeholder="输入卡片详细内容（后续对接 OpenClaw 生成内容）"
          rows="8"
        ></textarea>
      </div>

      <div class="form-group">
        <label for="tags">标签</label>
        <input 
          id="tags" 
          v-model="form.tags" 
          type="text" 
          placeholder="输入标签，用逗号分隔"
        />
      </div>

      <div class="form-actions">
        <button type="button" @click="goBack" class="btn btn-secondary">
          取消
        </button>
        <button type="submit" class="btn btn-primary">
          创建卡片
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useCardStore } from '../stores/cardStore'

const router = useRouter()
const cardStore = useCardStore()

const form = reactive({
  title: '',
  description: '',
  content: '',
  tags: ''
})

const handleSubmit = () => {
  const card = {
    title: form.title,
    description: form.description,
    content: form.content,
    tags: form.tags.split(',').map(t => t.trim()).filter(t => t)
  }
  
  cardStore.addCard(card)
  router.push('/cards')
}

const goBack = () => {
  router.back()
}
</script>

<style scoped>
.card-create {
  max-width: 800px;
  margin: 0 auto;
  padding: 40px 20px;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 24px;
  color: #2c3e50;
}

.card-form {
  background: white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #2c3e50;
  margin-bottom: 8px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3498db;
}

.form-group textarea {
  resize: vertical;
}

.form-actions {
  display: flex;
  gap: 16px;
  justify-content: flex-end;
}

.btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary {
  background: white;
  color: #666;
  border: 1px solid #ddd;
}

.btn-secondary:hover {
  background: #f5f5f5;
}

.btn-primary {
  background: #3498db;
  color: white;
  border: none;
}

.btn-primary:hover {
  background: #2980b9;
}
</style>
