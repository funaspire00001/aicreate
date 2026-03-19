import express from 'express';
import mongoose from 'mongoose';
import CollectionMeta from '../models/CollectionMeta.js';
import Agent from '../models/Agent.js';

const router = express.Router();

// 管理表列表
const MANAGEMENT_TABLES = [
  'collectionmetas',
  'workspaces',
  'agents',
  'models',
  'skills',
  'agentsynctasks'
];

// 日志表列表
const LOG_TABLES = [
  'agentlogs',
  'agentruns',
  'steplogs',
  'agent_inputs',
  'agent_outputs',
  'requests'
];

// 智能体数据表列表
const AGENT_DATA_TABLES = [
  'demands',
  'keypoints',
  'knowledgetrees',
  'knowledges',
  'cardplans',
  'localcards'
];

// 根据表名判断分类
function getTableCategory(name) {
  if (name === 'collectionmetas') return '总表';
  if (MANAGEMENT_TABLES.includes(name)) return '管理表';
  if (LOG_TABLES.includes(name)) return '日志表';
  if (AGENT_DATA_TABLES.includes(name)) return '智能体数据';
  return '其他';
}

// 根据分类获取排序值
function getCategoryOrder(category) {
  const order = { '总表': 0, '管理表': 1, '智能体数据': 2, '日志表': 3, '其他': 99 };
  return order[category] || 99;
}

// 获取所有集合
router.get('/collections', async (req, res) => {
  try {
    // 获取所有智能体
    const agents = await Agent.find({ enabled: true }).select('id name').lean();
    const agentMap = {};
    agents.forEach(a => { agentMap[a.id] = a.name; });
    
    // 从数据库获取所有元数据
    const metaList = await CollectionMeta.find().lean();
    const metaMap = {};
    metaList.forEach(m => {
      metaMap[m.name] = m;
    });
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // 检查新集合，自动创建元数据；同时更新已有集合的分类
    for (const name of collectionNames) {
      const category = getTableCategory(name);
      const order = getCategoryOrder(category);
      
      if (!metaMap[name]) {
        // 新集合，创建元数据
        const newMeta = await CollectionMeta.create({
          name,
          displayName: name,
          category,
          order
        });
        metaMap[name] = newMeta;
        console.log(`[数据管理] 发现新集合: ${name}，分类: ${category}`);
      } else if (metaMap[name].category !== category) {
        // 已有集合，更新分类
        await CollectionMeta.updateOne(
          { name },
          { $set: { category, order } }
        );
        metaMap[name].category = category;
        metaMap[name].order = order;
        console.log(`[数据管理] 更新集合分类: ${name} -> ${category}`);
      }
    }
    
    // 获取每个集合的统计信息
    const stats = await Promise.all(
      collectionNames.map(async (name) => {
        const count = await mongoose.connection.db.collection(name).countDocuments();
        const meta = metaMap[name] || { displayName: name, category: getTableCategory(name), order: 99, agentIds: [] };
        return {
          name,
          displayName: meta.displayName,
          category: meta.category,
          order: meta.order,
          count,
          agentIds: meta.agentIds || []
        };
      })
    );
    
    // 1. 总表（只有 collectionmetas）
    const summaryCollections = stats.filter(s => s.category === '总表');
    
    // 2. 管理表
    const managementCollections = stats
      .filter(s => s.category === '管理表')
      .sort((a, b) => a.order - b.order);
    
    // 3. 智能体数据表 - 按智能体分组
    const agentCollections = {};
    const unassignedAgentData = [];
    
    stats.filter(s => s.category === '智能体数据').forEach(col => {
      if (col.agentIds && col.agentIds.length > 0) {
        col.agentIds.forEach(agentId => {
          if (!agentCollections[agentId]) {
            agentCollections[agentId] = {
              id: agentId,
              name: agentMap[agentId] || agentId,
              collections: []
            };
          }
          agentCollections[agentId].collections.push(col);
        });
      } else {
        unassignedAgentData.push(col);
      }
    });
    
    // 4. 日志表
    const logCollections = stats
      .filter(s => s.category === '日志表')
      .sort((a, b) => a.order - b.order);
    
    // 5. 其他
    const otherCollections = stats.filter(s => s.category === '其他');
    
    res.json({
      success: true,
      summaryCollections,
      managementCollections,
      agentCollections: Object.values(agentCollections),
      unassignedAgentData,
      logCollections,
      otherCollections,
      agents: agents.map(a => ({ id: a.id, name: a.name }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取集合数据
router.get('/collections/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { page = 1, limit = 20, search = '' } = req.query;
    
    const collection = mongoose.connection.db.collection(name);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 构建搜索条件
    let query = {};
    if (search) {
      // 尝试在字符串字段中搜索
      query = { $or: [] };
      // 获取一个文档来检查字段类型
      const sample = await collection.findOne();
      if (sample) {
        Object.keys(sample).forEach(key => {
          if (typeof sample[key] === 'string') {
            query.$or.push({ [key]: { $regex: search, $options: 'i' } });
          }
        });
      }
      if (query.$or.length === 0) {
        query = {};
      }
    }
    
    const data = await collection
      .find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ _id: -1 })
      .toArray();
    
    const total = await collection.countDocuments(query);
    
    res.json({
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单条记录
router.get('/collections/:name/:id', async (req, res) => {
  try {
    const { name, id } = req.params;
    const collection = mongoose.connection.db.collection(name);
    
    let query = {};
    // 尝试作为 ObjectId 查询
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: new mongoose.Types.ObjectId(id) };
    } else {
      // 尝试作为普通 id 字段查询
      query = { $or: [{ id }, { _id: id }] };
    }
    
    const doc = await collection.findOne(query);
    
    if (!doc) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    
    res.json({ success: true, data: doc });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新记录
router.put('/collections/:name/:id', async (req, res) => {
  try {
    const { name, id } = req.params;
    const updateData = req.body;
    
    const collection = mongoose.connection.db.collection(name);
    
    let query = {};
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: new mongoose.Types.ObjectId(id) };
    } else {
      query = { $or: [{ id }, { _id: id }] };
    }
    
    // 移除不可修改的字段
    delete updateData._id;
    delete updateData.__v;
    
    const result = await collection.updateOne(
      query,
      { $set: { ...updateData, updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除记录
router.delete('/collections/:name/:id', async (req, res) => {
  try {
    const { name, id } = req.params;
    const collection = mongoose.connection.db.collection(name);
    
    let query = {};
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: new mongoose.Types.ObjectId(id) };
    } else {
      query = { $or: [{ id }, { _id: id }] };
    }
    
    const result = await collection.deleteOne(query);
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取集合统计
router.get('/collections/:name/stats', async (req, res) => {
  try {
    const { name } = req.params;
    const collection = mongoose.connection.db.collection(name);
    
    const count = await collection.countDocuments();
    const size = await collection.stats();
    
    res.json({
      success: true,
      stats: {
        count,
        size: size.size,
        avgObjSize: size.avgObjSize || 0,
        storageSize: size.storageSize || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
