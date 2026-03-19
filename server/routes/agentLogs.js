import express from 'express';
import AgentLog from '../models/AgentLog.js';

const router = express.Router();

// 获取日志列表
router.get('/', async (req, res) => {
  try {
    const { agentId, type, status, traceId, limit = 100, skip = 0 } = req.query;
    
    const filter = {};
    if (agentId) filter.agentId = agentId;
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (traceId) filter.traceId = traceId;
    
    const logs = await AgentLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    const total = await AgentLog.countDocuments(filter);
    
    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单条日志
router.get('/:id', async (req, res) => {
  try {
    const log = await AgentLog.findOne({ id: req.params.id });
    if (!log) {
      return res.status(404).json({ success: false, error: '日志不存在' });
    }
    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建日志
router.post('/', async (req, res) => {
  try {
    const log = new AgentLog({
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...req.body
    });
    await log.save();
    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 批量创建日志
router.post('/batch', async (req, res) => {
  try {
    const { logs } = req.body;
    const timestamp = Date.now();
    
    const logsToInsert = logs.map((log, index) => ({
      id: `log-${timestamp}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      ...log
    }));
    
    await AgentLog.insertMany(logsToInsert);
    res.json({ success: true, count: logsToInsert.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取链路追踪日志
router.get('/trace/:traceId', async (req, res) => {
  try {
    const logs = await AgentLog.find({ traceId: req.params.traceId })
      .sort({ createdAt: 1 });
    
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取日志统计
router.get('/stats/summary', async (req, res) => {
  try {
    const { agentId, startTime, endTime } = req.query;
    
    const matchStage = {};
    if (agentId) matchStage.agentId = agentId;
    if (startTime || endTime) {
      matchStage.createdAt = {};
      if (startTime) matchStage.createdAt.$gte = new Date(startTime);
      if (endTime) matchStage.createdAt.$lte = new Date(endTime);
    }
    
    const [byType, byStatus, total] = await Promise.all([
      AgentLog.aggregate([
        { $match: matchStage },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]),
      AgentLog.aggregate([
        { $match: matchStage },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      AgentLog.countDocuments(matchStage)
    ]);
    
    res.json({
      success: true,
      data: {
        total,
        byType: byType.reduce((acc, t) => { acc[t._id] = t.count; return acc; }, {}),
        byStatus: byStatus.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {})
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 清理过期日志
router.delete('/cleanup', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(days));
    
    const result = await AgentLog.deleteMany({ createdAt: { $lt: cutoff } });
    
    res.json({
      success: true,
      data: { deletedCount: result.deletedCount }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
