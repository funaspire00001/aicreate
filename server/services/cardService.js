/**
 * 卡片服务 - 发布卡片到 onepage 云函数
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 加载 server 目录下的 .env 文件
dotenv.config({ path: join(__dirname, '../.env') });

// 云函数配置
const CLOUD_FUNCTION_URL = process.env.CLOUD_FUNCTION_URL || 'https://cloud1-7gu1xbq6f103fb30.api.tcloudbasegateway.com/v1/functions/admin';
const CLOUD_FUNCTION_API_KEY = process.env.CLOUD_FUNCTION_API_KEY;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || 'u_1929514037151424513';

/**
 * 调用云函数的通用方法
 */
async function callCloudFunction(action, data = {}) {
  if (!CLOUD_FUNCTION_API_KEY) {
    throw new Error('CLOUD_FUNCTION_API_KEY 未配置');
  }

  const response = await fetch(CLOUD_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLOUD_FUNCTION_API_KEY}`
    },
    body: JSON.stringify({
      action,
      data,
      userInfo: {
        userId: ADMIN_USER_ID  // 使用管理员 ID
      }
    })
  });

  if (!response.ok) {
    throw new Error(`云函数调用失败: ${response.status}`);
  }

  return response.json();
}

/**
 * 发布卡片草稿到 onepage
 * @param {Object} cardData - 卡片数据
 * @param {Object} feedback - 原始反馈信息
 * @returns {Promise<Object>} 发布结果
 */
export async function publishCardDraft(cardData, feedback) {
  try {
    // 根据反馈类型生成卡片名称
    const cardName = generateCardName(feedback);

    // 调用 card.create 接口，状态设为 DRAFT
    const result = await callCloudFunction('card.create', {
      userId: 'ai_system',  // AI 系统生成的卡片
      cardName: cardName,
      cardData: cardData.cardData || cardData,
      cardType: 'NORMAL',
      catalog: 'ai_generated',
      isPrivate: false,
      status: 'DRAFT',  // 发布为草稿
      recommendLevel: 1
    });

    if (result.code !== 0) {
      throw new Error(result.message || '创建卡片失败');
    }

    return {
      success: true,
      cardId: result.data?.cardId,
      cardName: cardName
    };

  } catch (error) {
    console.error('[cardService] 发布卡片失败:', error);
    throw error;
  }
}

/**
 * 根据反馈生成卡片名称
 */
function generateCardName(feedback) {
  const { feedbackType, content, resourceId } = feedback;

  // 使用当前日期作为前缀
  const dateStr = new Date().toISOString().slice(0, 10);

  // 根据反馈类型生成名称
  if (feedbackType === 'SUGGESTION' && content) {
    // 使用建议内容的前 20 个字符
    const title = content.slice(0, 20).replace(/\n/g, ' ');
    return `AI生成_${dateStr}_${title}...`;
  }

  if (feedbackType === 'CARD') {
    return `AI生成_${dateStr}_卡片优化_${resourceId || 'unknown'}`;
  }

  if (feedbackType === 'CARD_SET') {
    return `AI生成_${dateStr}_卡册补充_${resourceId || 'unknown'}`;
  }

  return `AI生成_${dateStr}`;
}

/**
 * 更新反馈状态
 * @param {string} feedbackId - 反馈 ID
 * @param {string} status - 状态：PENDING / PROCESSED
 */
export async function updateFeedbackStatus(feedbackId, status) {
  try {
    const result = await callCloudFunction('feedback.updateStatus', {
      feedbackId,
      status
    });

    if (result.code !== 0) {
      throw new Error(result.message || '更新反馈状态失败');
    }

    return result;
  } catch (error) {
    console.error('[cardService] 更新反馈状态失败:', error);
    throw error;
  }
}

/**
 * 获取待处理的反馈列表
 * @param {number} limit - 最大返回数量
 */
export async function getPendingFeedback(limit = 10) {
  try {
    const result = await callCloudFunction('feedback.getList', {
      status: 'PENDING',
      pageSize: limit
    });

    if (result.code !== 0) {
      throw new Error(result.message || '获取反馈列表失败');
    }

    return result.data?.list || [];
  } catch (error) {
    console.error('[cardService] 获取反馈列表失败:', error);
    throw error;
  }
}

/**
 * 获取所有反馈列表
 * @param {Object} params - 查询参数
 */
export async function getFeedbackList(params = {}) {
  try {
    const result = await callCloudFunction('feedback.getList', {
      status: params.status || '',
      pageSize: params.pageSize || 20,
      pageNum: params.pageNum || 1,
      feedbackType: params.feedbackType || ''
    });

    if (result.code !== 0) {
      throw new Error(result.message || '获取反馈列表失败');
    }

    return {
      list: result.data?.list || [],
      total: result.data?.total || 0,
      pageNum: result.data?.pageNum || 1,
      pageSize: result.data?.pageSize || 20
    };
  } catch (error) {
    console.error('[cardService] 获取反馈列表失败:', error);
    throw error;
  }
}

export default {
  publishCardDraft,
  updateFeedbackStatus,
  getPendingFeedback,
  getFeedbackList
};
