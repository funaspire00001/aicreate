import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import agentRoutes from './routes/agents.js';
import dashboardRoutes from './routes/dashboard.js';
import modelsRoutes from './routes/models.js';
import workspaceRoutes from './routes/workspaces.js';
import skillsRoutes from './routes/skills.js';
import syncTasksRoutes from './routes/syncTasks.js';
import agentLogsRoutes from './routes/agentLogs.js';
import dataManagerRoutes from './routes/dataManager.js';

import { startAgentScheduler, getSchedulerStatus } from './services/agentScheduler.js';
import { initializeAgentDataTables } from './services/agentDataService.js';
import CollectionMeta from './models/CollectionMeta.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/aicard';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 核心路由
app.use('/api/agents', agentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/sync-tasks', syncTasksRoutes);
app.use('/api/agent-logs', agentLogsRoutes);
app.use('/api/data', dataManagerRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  const uptime = process.uptime();
  const mem = process.memoryUsage();

  const fmt = (s) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}天 ${h}时 ${m}分`;
    if (h > 0) return `${h}时 ${m}分`;
    return `${m}分 ${Math.floor(s % 60)}秒`;
  };

  res.json({
    success: true,
    data: {
      status: 'running',
      uptime: Math.floor(uptime),
      uptimeFormatted: fmt(uptime),
      memory: {
        used: Math.round(mem.heapUsed / 1024 / 1024),
        total: Math.round(mem.heapTotal / 1024 / 1024),
        rss: Math.round(mem.rss / 1024 / 1024)
      },
      scheduler: getSchedulerStatus(),
      timestamp: new Date().toISOString()
    }
  });
});

// 连接 MongoDB 并启动
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB 连接成功');

    // 初始化集合元数据
    const metaCount = await CollectionMeta.countDocuments();
    if (metaCount === 0) {
      await CollectionMeta.create({
        name: 'collectionmetas',
        displayName: '集合元数据',
        category: '核心模块',
        order: 0
      });
    }

    // 初始化智能体成果表
    try {
      const tableResults = await initializeAgentDataTables();
      if (tableResults.length > 0) {
        console.log(`[初始化] 成果表: ${tableResults.length} 个`);
      }
    } catch (err) {
      console.error('[初始化] 成果表初始化失败:', err.message);
    }

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);

      // 启动智能体独立调度循环
      startAgentScheduler().catch(err => {
        console.error('[Scheduler] 启动失败:', err.message);
      });
    });
  })
  .catch((err) => {
    console.error('MongoDB 连接失败:', err);
    process.exit(1);
  });

export default app;
