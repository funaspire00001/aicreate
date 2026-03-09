import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// 云函数配置
const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL || 'https://cloud1-7gu1xbq6f103fb30.service.tcloudbase.com/admin';
const CLOUD_FUNCTION_API_KEY = process.env.CLOUD_FUNCTION_API_KEY;

// 调用云函数的通用方法
async function callCloudFunction(action, data = {}) {
  const response = await fetch(CLOUD_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLOUD_FUNCTION_API_KEY}`
    },
    body: JSON.stringify({ action, data })
  });
  
  return response.json();
}

// 获取反馈列表
router.get('/', async (req, res) => {
  try {
    const { feedbackType, status, pageNumber = 1, pageSize = 20 } = req.query;
    
    const result = await callCloudFunction('feedback.getList', {
      feedbackType,
      status,
      pageNumber: parseInt(pageNumber),
      pageSize: parseInt(pageSize)
    });
    
    res.json(result);
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
    
    const result = await callCloudFunction('feedback.updateStatus', {
      feedbackId,
      status
    });
    
    res.json(result);
  } catch (error) {
    console.error('更新反馈状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
