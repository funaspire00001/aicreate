<template>
  <div id="app">
    <nav class="navbar">
      <div class="logo">AI Card Manager</div>
      <div class="nav-links">
        <router-link to="/">仪表盘</router-link>
        <router-link to="/feedback">用户需求</router-link>
        <router-link to="/local-cards">卡片管理</router-link>
      </div>
    </nav>
    <main class="main-content">
      <router-view />
    </main>
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

.navbar {
  background: white;
  padding: 0 24px;
  height: 60px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  position: sticky;
  top: 0;
  z-index: 100;
}

.logo {
  font-size: 18px;
  font-weight: 600;
  color: #667eea;
}

.nav-links {
  display: flex;
  gap: 8px;
  margin-left: 40px;
}

.nav-links a {
  padding: 8px 16px;
  color: #666;
  text-decoration: none;
  border-radius: 6px;
  transition: all 0.2s;
}

.nav-links a:hover {
  background: #f5f7fa;
  color: #667eea;
}

.nav-links a.router-link-active {
  background: #667eea;
  color: white;
}

.main-content {
  min-height: calc(100vh - 60px);
}
</style>