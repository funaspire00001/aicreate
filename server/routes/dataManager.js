import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// 获取所有集合
router.get('/collections', async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // 获取每个集合的统计信息
    const stats = await Promise.all(
      collectionNames.map(async (name) => {
        const count = await mongoose.connection.db.collection(name).countDocuments();
        return { name, count };
      })
    );
    
    res.json({
      success: true,
      collections: stats.sort((a, b) => b.count - a.count)
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
