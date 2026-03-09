import express from 'express';
import LocalCard from '../models/LocalCard.js';
import { publishCardDraft } from '../services/cardService.js';
import { addLog } from '../services/stateStore.js';

const router = express.Router();

/**
 * GET /api/local-cards
 * 获取本地卡片列表
 */
router.get('/', async (req, res) => {
  const { status, page = 1, pageSize = 20 } = req.query;
  
  const query = {};
  if (status && ['local', 'published'].includes(status)) {
    query.status = status;
  }
  
  try {
    const total = await LocalCard.countDocuments(query);
    const cards = await LocalCard.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(parseInt(pageSize))
      .select("-analysis -design -steps")
    
    res.json({
      success: true,
      data: {
        list: cards,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/local-cards/stats/summary
 * 获取卡片统计
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const total = await LocalCard.countDocuments();
    const local = await LocalCard.countDocuments({ status: 'local' });
    const published = await LocalCard.countDocuments({ status: 'published' });
    
    res.json({
      success: true,
      data: {
        total,
        local,
        published
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/local-cards/:cardId
 * 获取单个卡片详情
 */
router.get('/:cardId', async (req, res) => {
  const { cardId } = req.params;
  
  try {
    const card = await LocalCard.findOne({ cardId });
    
    if (!card) {
      return res.status(404).json({
        success: false,
        message: '卡片不存在'
      });
    }
    
    res.json({
      success: true,
      data: card
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/local-cards/:cardId/publish
 * 发布卡片到云端
 */
router.post('/:cardId/publish', async (req, res) => {
  const { cardId } = req.params;
  
  try {
    const card = await LocalCard.findOne({ cardId });
    
    if (!card) {
      return res.status(404).json({
        success: false,
        message: '卡片不存在'
      });
    }
    
    if (card.status === 'published') {
      return res.status(400).json({
        success: false,
        message: '卡片已发布'
      });
    }
    
    addLog('info', `正在发布卡片到云端: ${cardId}`);
    
    const feedback = {
      feedbackType: 'SUGGESTION',
      content: card.theme,
      resourceId: null
    };
    
    const publishResult = await publishCardDraft(card.cardData, feedback);
    
    // 更新本地卡片状态
    card.status = 'published';
    card.publishedAt = new Date();
    card.publishedCardId = publishResult.cardId;
    card.publishedCardName = publishResult.cardName;
    await card.save();
    
    addLog('success', `卡片发布成功: ${publishResult.cardName}`);
    
    res.json({
      success: true,
      data: {
        cardId: card.cardId,
        status: card.status,
        publishedCardId: card.publishedCardId,
        publishedCardName: card.publishedCardName
      }
    });
    
  } catch (error) {
    addLog('error', `发布卡片失败: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/local-cards/:cardId
 * 删除本地卡片
 */
router.delete('/:cardId', async (req, res) => {
  const { cardId } = req.params;
  
  try {
    const card = await LocalCard.findOne({ cardId });
    
    if (!card) {
      return res.status(404).json({
        success: false,
        message: '卡片不存在'
      });
    }
    
    await LocalCard.deleteOne({ cardId });
    
    addLog('info', `卡片已删除: ${cardId}`);
    
    res.json({
      success: true,
      message: '卡片已删除'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
