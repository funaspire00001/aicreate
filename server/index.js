import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import knowledgeRoutes from './routes/knowledge.js';
import requestRoutes from './routes/requests.js';
import agentRoutes from './routes/agents.js';
import dashboardRoutes from './routes/dashboard.js';
import feedbackRoutes from './routes/feedback.js';
import statusRoutes from './routes/status.js';
import generateRoutes from './routes/generate.js';
import localCardsRoutes from './routes/localCards.js';
import modelsRoutes from './routes/models.js';
import workflowsRoutes from './routes/workflows.js';
import demandsRoutes from './routes/demands.js';
import dataManagerRoutes from './routes/dataManager.js';
import { createAdminRouter } from './routes/admin.js';

import { startScheduler } from './services/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/aicard';

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 路由
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/local-cards', localCardsRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/workflows', workflowsRoutes);
app.use('/api/demands', demandsRoutes);
app.use('/api/data', dataManagerRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (days > 0) return `${days}天 ${hours}时 ${mins}分`;
    if (hours > 0) return `${hours}时 ${mins}分 ${secs}秒`;
    if (mins > 0) return `${mins}分 ${secs}秒`;
    return `${secs}秒`;
  };
  
  res.json({
    success: true,
    data: {
      status: 'running',
      uptime: Math.floor(uptime),
      uptimeFormatted: formatUptime(uptime),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memoryUsage.rss / 1024 / 1024)
      },
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform
    }
  });
});

// 连接 MongoDB 并启动服务
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB 连接成功');
    
    // 初始化 AdminJS
    try {
      const { admin, router: adminRouter } = await createAdminRouter();
      app.use(admin.options.rootPath, adminRouter);
      console.log(`📊 AdminJS 管理后台: http://localhost:${PORT}${admin.options.rootPath}`);
    } catch (err) {
      console.error('❌ AdminJS 初始化失败:', err);
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
      
      // 启动定时任务
      startScheduler();
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB 连接失败:', err);
    process.exit(1);
  });

export default app;
