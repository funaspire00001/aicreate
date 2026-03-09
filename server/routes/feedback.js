import express from 'express';
import { getFeedbackList, updateFeedbackStatus } from '../services/cardService.js';

const router = express.Router();

// 获取反馈列表
router.get('/', async (req, res) => {
  try {
    const { feedbackType, status, pageNum = 1, pageSize = 20 } = req.query;

    const result = await getFeedbackList({
      feedbackType,
      status,
      pageNum: parseInt(pageNum),
      pageSize: parseInt(pageSize)
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('获取反馈列表失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新反馈状态
router.put('/:feedbackId/status', async (req, res) => {
  try {
    const { feedbackId } = req.params;
    const { status } = req.body;

    const result = await updateFeedbackStatus(feedbackId, status);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('更新反馈状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
