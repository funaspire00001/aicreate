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

          <div class="nav-group-title">核心</div>
          <router-link to="/workspaces" class="nav-item">
            <span class="nav-icon">🏢</span>
            <span class="nav-text">空间管理</span>
          </router-link>
          <router-link to="/agents" class="nav-item">
            <span class="nav-icon">🤖</span>
            <span class="nav-text">智能体管理</span>
          </router-link>
          <router-link to="/models" class="nav-item">
            <span class="nav-icon">🧠</span>
            <span class="nav-text">模型管理</span>
          </router-link>
          <router-link to="/skills" class="nav-item">
            <span class="nav-icon">✨</span>
            <span class="nav-text">技能配置</span>
          </router-link>

          <div class="nav-group-title">运维</div>
          <router-link to="/sync-tasks" class="nav-item">
            <span class="nav-icon">🔄</span>
            <span class="nav-text">订阅任务</span>
          </router-link>
          <router-link to="/agent-logs" class="nav-item">
            <span class="nav-icon">📋</span>
            <span class="nav-text">运行日志</span>
          </router-link>
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
  width: 220px;
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
  padding: 24px 20px;
  border-bottom: 1px solid #f0f2f5;
}

.logo {
  font-size: 17px;
  font-weight: 600;
  color: #667eea;
}

.nav-links {
  padding: 12px 0;
}

.nav-group-title {
  padding: 16px 20px 6px;
  font-size: 11px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  color: #555;
  text-decoration: none;
  transition: all 0.15s;
  margin: 2px 10px;
  border-radius: 8px;
}

.nav-item:hover {
  background: #f0f2f5;
  color: #667eea;
}

.nav-item.router-link-exact-active {
  background: #667eea;
  color: white;
  font-weight: 500;
}

.nav-icon {
  font-size: 16px;
  margin-right: 10px;
  width: 22px;
  text-align: center;
}

.nav-text {
  font-size: 13.5px;
}

.main-content {
  flex: 1;
  margin-left: 220px;
  min-height: 100vh;
  padding: 24px;
}
</style>
