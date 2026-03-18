import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { Database, Resource } from '@adminjs/mongoose';
import mongoose from 'mongoose';

// 导入所有模型
import Agent from '../models/Agent.js';
import Demand from '../models/Demand.js';
import LocalCard from '../models/LocalCard.js';
import Knowledge from '../models/Knowledge.js';
import Request from '../models/Request.js';
import StepLog from '../models/StepLog.js';
import AgentRun from '../models/AgentRun.js';
import Workspace from '../models/Workspace.js';

// 注册 Mongoose 适配器
AdminJS.registerAdapter({ Database, Resource });

/**
 * 创建 AdminJS 实例
 */
export const createAdminRouter = async () => {
  const admin = new AdminJS({
    resources: [
      {
        resource: Agent,
        options: {
          navigation: { name: '核心模块', icon: 'User' },
          listProperties: ['id', 'name', 'type', 'modelId', 'enabled', 'createdAt'],
          filterProperties: ['type', 'enabled', 'modelId'],
          editProperties: ['name', 'type', 'description', 'ai', 'schedule', 'enabled'],
          showProperties: ['id', 'name', 'type', 'description', 'ai', 'schedule', 'enabled', 'createdAt', 'updatedAt'],
        },
      },
      {
        resource: Demand,
        options: {
          navigation: { name: '核心模块', icon: 'Document' },
          listProperties: ['id', 'theme', 'status', 'source', 'priority', 'createdAt'],
          filterProperties: ['status', 'source', 'priority'],
        },
      },
      {
        resource: LocalCard,
        options: {
          navigation: { name: '卡片管理', icon: 'Card' },
          listProperties: ['cardId', 'theme', 'status', 'model', 'createdAt'],
          filterProperties: ['status', 'model'],
        },
      },
      {
        resource: Knowledge,
        options: {
          navigation: { name: '知识库', icon: 'Book' },
          listProperties: ['id', 'subject', 'topic', 'createdAt'],
        },
      },
      {
        resource: Request,
        options: {
          navigation: { name: '执行记录', icon: 'List' },
          listProperties: ['id', 'requirement', 'status', 'source', 'createdAt'],
          filterProperties: ['status', 'source'],
        },
      },
      {
        resource: StepLog,
        options: {
          navigation: { name: '执行记录', icon: 'Logs' },
          listProperties: ['taskId', 'stepName', 'model', 'success', 'createdAt'],
          filterProperties: ['success', 'model'],
        },
      },
      {
        resource: AgentRun,
        options: {
          navigation: { name: '执行记录', icon: 'Activity' },
          listProperties: ['agentName', 'status', 'createdAt'],
          filterProperties: ['status', 'agentName'],
        },
      },
      {
        resource: Workspace,
        options: {
          navigation: { name: '核心模块', icon: 'Layer' },
          listProperties: ['id', 'name', 'description', 'isDefault', 'createdAt'],
          filterProperties: ['isDefault'],
          editProperties: ['name', 'description', 'agents', 'isDefault'],
        },
      },
    ],
    rootPath: '/admin',
    branding: {
      companyName: 'AI Card Manager',
      softwareBrothers: false,
      logo: false,
      favicon: false,
      theme: {
        colors: {
          primary100: '#667eea',
          primary80: '#5a67d8',
          primary60: '#4c51bf',
          primary40: '#434190',
          primary20: '#3c366b',
          accent: '#667eea',
          bg: '#f5f7fa',
        },
      },
    },
    locale: {
      language: 'zh',
      translations: {
        messages: {
          loginWelcome: 'AI Card Manager 管理后台',
        },
        labels: {
          navigation: {
            '核心模块': '核心模块',
            '执行记录': '执行记录',
            '卡片管理': '卡片管理',
            '知识库': '知识库',
          },
        },
      },
    },
  });

  // 创建路由（无登录验证，适合本地开发）
  const router = AdminJSExpress.buildRouter(admin);
  
  return { admin, router };
};

export default createAdminRouter;
