<template>
  <div class="data-manager">
    <div class="page-header">
      <h1>数据管理</h1>
      <div class="header-actions">
        <a href="http://localhost:3001/admin" target="_blank" class="admin-link">
          🔗 高级管理 (AdminJS)
        </a>
      </div>
    </div>

    <div class="manager-container">
      <!-- 左侧集合列表 -->
      <div class="collections-panel">
        <div class="panel-header">
          <h3>集合列表</h3>
          <button @click="fetchCollections" class="refresh-btn">刷新</button>
        </div>
        
        <div class="collections-list">
          <div
            v-for="col in collections"
            :key="col.name"
            :class="['collection-item', { active: selectedCollection === col.name }]"
            @click="selectCollection(col.name)"
          >
            <span class="col-name">{{ col.name }}</span>
            <span class="col-count">{{ col.count }}</span>
          </div>
          
          <div v-if="collections.length === 0" class="empty-tip">
            暂无集合
          </div>
        </div>
      </div>

      <!-- 右侧数据列表 -->
      <div class="data-panel">
        <div v-if="!selectedCollection" class="empty-state">
          <p>👈 请选择一个集合</p>
        </div>
        
        <template v-else>
          <div class="panel-header">
            <h3>{{ selectedCollection }}</h3>
            <div class="search-box">
              <input
                v-model="searchText"
                placeholder="搜索..."
                @keyup.enter="searchData"
              />
              <button @click="searchData">搜索</button>
            </div>
          </div>

          <!-- 数据表格 -->
          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th v-for="field in displayFields" :key="field">{{ field }}</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in data" :key="item._id">
                  <td v-for="field in displayFields" :key="field">
                    {{ formatValue(item[field]) }}
                  </td>
                  <td class="actions">
                    <button @click="viewItem(item)" class="btn-view">查看</button>
                    <button @click="editItem(item)" class="btn-edit">编辑</button>
                    <button @click="deleteItem(item)" class="btn-delete">删除</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 分页 -->
          <div class="pagination">
            <button :disabled="pagination.page <= 1" @click="changePage(pagination.page - 1)">
              上一页
            </button>
            <span>第 {{ pagination.page }} / {{ pagination.pages }} 页</span>
            <span>共 {{ pagination.total }} 条</span>
            <button :disabled="pagination.page >= pagination.pages" @click="changePage(pagination.page + 1)">
              下一页
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- 查看详情模态框 -->
    <div v-if="showViewModal" class="modal-overlay" @click.self="showViewModal = false">
      <div class="modal-content view-modal">
        <div class="modal-header">
          <h2>查看详情</h2>
          <button class="close-btn" @click="showViewModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <pre class="json-view">{{ JSON.stringify(viewData, null, 2) }}</pre>
        </div>
      </div>
    </div>

    <!-- 编辑模态框 -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
      <div class="modal-content edit-modal">
        <div class="modal-header">
          <h2>编辑记录</h2>
          <button class="close-btn" @click="showEditModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <textarea v-model="editText" class="edit-textarea"></textarea>
        </div>
        <div class="modal-footer">
          <button @click="showEditModal = false" class="btn-cancel">取消</button>
          <button @click="saveEdit" class="btn-save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const collections = ref([])
const selectedCollection = ref('')
const data = ref([])
const pagination = ref({ page: 1, limit: 20, total: 0, pages: 0 })
const searchText = ref('')

const showViewModal = ref(false)
const showEditModal = ref(false)
const viewData = ref({})
const editText = ref('')
const editingId = ref('')

// 显示的字段（限制数量）
const displayFields = computed(() => {
  if (data.value.length === 0) return []
  const allFields = Object.keys(data.value[0])
  // 过滤掉太长的字段
  const skipFields = ['prompt', 'cardData', 'analysis', 'design', 'contentData']
  return allFields.filter(f => !skipFields.includes(f)).slice(0, 6)
})

const API_URL = 'http://localhost:3001/api/data'

const fetchCollections = async () => {
  try {
    const res = await fetch(`${API_URL}/collections`)
    const result = await res.json()
    if (result.success) {
      collections.value = result.collections
    }
  } catch (err) {
    console.error('获取集合列表失败:', err)
  }
}

const selectCollection = (name) => {
  selectedCollection.value = name
  pagination.value.page = 1
  searchText.value = ''
  fetchData()
}

const fetchData = async () => {
  if (!selectedCollection.value) return
  
  try {
    const params = new URLSearchParams({
      page: pagination.value.page,
      limit: pagination.value.limit,
      search: searchText.value
    })
    
    const res = await fetch(`${API_URL}/collections/${selectedCollection.value}?${params}`)
    const result = await res.json()
    if (result.success) {
      data.value = result.data
      pagination.value = result.pagination
    }
  } catch (err) {
    console.error('获取数据失败:', err)
  }
}

const searchData = () => {
  pagination.value.page = 1
  fetchData()
}

const changePage = (page) => {
  pagination.value.page = page
  fetchData()
}

const formatValue = (value) => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 30) + '...'
  if (typeof value === 'string' && value.length > 30) return value.slice(0, 30) + '...'
  return value
}

const viewItem = (item) => {
  viewData.value = item
  showViewModal.value = true
}

const editItem = (item) => {
  editingId.value = item._id
  editText.value = JSON.stringify(item, null, 2)
  showEditModal.value = true
}

const saveEdit = async () => {
  try {
    const updateData = JSON.parse(editText.value)
    
    const res = await fetch(`${API_URL}/collections/${selectedCollection.value}/${editingId.value}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    })
    
    const result = await res.json()
    if (result.success) {
      showEditModal.value = false
      fetchData()
      alert('保存成功')
    } else {
      alert('保存失败: ' + result.error)
    }
  } catch (err) {
    alert('JSON 格式错误: ' + err.message)
  }
}

const deleteItem = async (item) => {
  if (!confirm('确定要删除这条记录吗？')) return
  
  try {
    const res = await fetch(`${API_URL}/collections/${selectedCollection.value}/${item._id}`, {
      method: 'DELETE'
    })
    
    const result = await res.json()
    if (result.success) {
      fetchData()
      alert('删除成功')
    } else {
      alert('删除失败: ' + result.error)
    }
  } catch (err) {
    alert('删除失败: ' + err.message)
  }
}

onMounted(() => {
  fetchCollections()
})
</script>

<style scoped>
.data-manager {
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
}

.admin-link {
  color: #667eea;
  text-decoration: none;
  font-size: 14px;
}

.admin-link:hover {
  text-decoration: underline;
}

.manager-container {
  display: flex;
  gap: 20px;
  min-height: calc(100vh - 150px);
}

.collections-panel {
  width: 280px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  flex-shrink: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
}

.refresh-btn {
  padding: 4px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 12px;
}

.refresh-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.collections-list {
  padding: 8px;
  max-height: calc(100vh - 250px);
  overflow-y: auto;
}

.collection-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.collection-item:hover {
  background: #f5f7fa;
}

.collection-item.active {
  background: #667eea;
  color: white;
}

.col-name {
  font-size: 14px;
  font-weight: 500;
}

.col-count {
  font-size: 12px;
  padding: 2px 8px;
  background: rgba(0,0,0,0.06);
  border-radius: 10px;
}

.collection-item.active .col-count {
  background: rgba(255,255,255,0.2);
}

.empty-tip {
  text-align: center;
  padding: 40px;
  color: #999;
}

.data-panel {
  flex: 1;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  display: flex;
  flex-direction: column;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 16px;
}

.search-box {
  display: flex;
  gap: 8px;
}

.search-box input {
  padding: 6px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  width: 200px;
}

.search-box button {
  padding: 6px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.data-table-wrapper {
  flex: 1;
  overflow: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
}

.data-table th {
  background: #fafafa;
  font-weight: 600;
  position: sticky;
  top: 0;
}

.data-table tr:hover {
  background: #f9f9f9;
}

.actions {
  display: flex;
  gap: 8px;
}

.actions button {
  padding: 4px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 12px;
}

.btn-view:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.btn-edit:hover {
  border-color: #52c41a;
  color: #52c41a;
}

.btn-delete:hover {
  border-color: #ff4d4f;
  color: #ff4d4f;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  border-top: 1px solid #f0f0f0;
}

.pagination button {
  padding: 6px 16px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination span {
  font-size: 14px;
  color: #666;
}

/* 模态框 */
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
  border-radius: 8px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.view-modal {
  width: 700px;
}

.edit-modal {
  width: 800px;
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
  font-size: 18px;
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
  overflow: auto;
  flex: 1;
}

.json-view {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 6px;
  font-size: 13px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.edit-textarea {
  width: 100%;
  height: 400px;
  padding: 16px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-family: monospace;
  font-size: 13px;
  resize: vertical;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #f0f0f0;
}

.btn-cancel,
.btn-save {
  padding: 8px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-cancel {
  background: white;
  border: 1px solid #d9d9d9;
}

.btn-save {
  background: #667eea;
  color: white;
  border: none;
}
</style>
