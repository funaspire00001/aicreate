<template>
  <div id="app">
    <div class="app-container">
      <nav class="sidebar">
        <div class="sidebar-header">
          <div class="logo">AI Creator Space</div>
        </div>
        <div class="nav-links">
          <router-link to="/" class="nav-item">
            <span class="nav-icon">📊</span>
            <span class="nav-text">仪表盘</span>
          </router-link>
          
          <div class="nav-group-title">AI 能力</div>
          <router-link to="/workspaces" class="nav-item">
            <span class="nav-icon">🏢</span>
            <span class="nav-text">空间管理</span>
          </router-link>
          <router-link to="/agents" class="nav-item">
            <span class="nav-icon">👥</span>
            <span class="nav-text">智能体管理</span>
          </router-link>
          <router-link to="/models" class="nav-item">
            <span class="nav-icon">🤖</span>
            <span class="nav-text">模型管理</span>
          </router-link>
          <router-link to="/skills" class="nav-item">
            <span class="nav-icon">✨</span>
            <span class="nav-text">技能配置</span>
          </router-link>
          
          <div class="nav-group-title">业务</div>
          <router-link to="/demands" class="nav-item">
            <span class="nav-icon">📝</span>
            <span class="nav-text">需求管理</span>
          </router-link>
          <router-link to="/feedback" class="nav-item">
            <span class="nav-icon">💬</span>
            <span class="nav-text">用户反馈</span>
          </router-link>
          <router-link to="/local-cards" class="nav-item">
            <span class="nav-icon">🃏</span>
            <span class="nav-text">卡片管理</span>
          </router-link>
          
          <div class="nav-group-title">系统</div>
          <router-link to="/data" class="nav-item">
            <span class="nav-icon">🗄️</span>
            <span class="nav-text">数据管理</span>
          </router-link>
        </div>
      </nav>
      <main class="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: #f5f7fa;
  color: #333;
}

#app {
  width: 100%;
  min-height: 100vh;
}

.app-container {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  background: white;
  box-shadow: 2px 0 8px rgba(0,0,0,0.05);
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  z-index: 100;
  overflow-y: auto;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid #f0f2f5;
}

.logo {
  font-size: 18px;
  font-weight: 600;
  color: #667eea;
}

.nav-links {
  padding: 16px 0;
}

.nav-group-title {
  padding: 16px 24px 8px;
  font-size: 11px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 12px 24px;
  color: #666;
  text-decoration: none;
  transition: all 0.2s;
  border-radius: 0 20px 20px 0;
  margin: 0 16px;
}

.nav-item:hover {
  background: #f5f7fa;
  color: #667eea;
}

.nav-item.router-link-active {
  background: #667eea;
  color: white;
  font-weight: 500;
}

.nav-icon {
  font-size: 18px;
  margin-right: 12px;
  width: 24px;
  text-align: center;
}

.nav-text {
  font-size: 14px;
}

.main-content {
  flex: 1;
  margin-left: 240px;
  min-height: 100vh;
  padding: 24px;
}
</style>