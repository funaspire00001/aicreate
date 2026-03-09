/**
 * 定时任务服务 - 定时检测用户需求并生成卡片
 */
import { generateCard } from './aiService.js';
import { getPendingFeedback, updateFeedbackStatus, publishCardDraft } from './cardService.js';
import { updateState, addLog, getState } from './stateStore.js';
import dotenv from 'dotenv';

dotenv.config();

// 配置
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '30000'); // 默认 30 秒

let timer = null;
let isRunning = false;

/**
 * 启动定时任务
 */
export function startScheduler() {
  if (timer) {
    console.log('[scheduler] 定时任务已在运行中');
    return;
  }

  console.log(`[scheduler] 启动定时任务，间隔 ${CHECK_INTERVAL / 1000} 秒`);
  
  // 立即执行一次
  processPendingFeedback();
  
  // 设置定时器
  timer = setInterval(processPendingFeedback, CHECK_INTERVAL);
}

/**
 * 停止定时任务
 */
export function stopScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[scheduler] 定时任务已停止');
    updateState({ isProcessing: false, currentStep: 'stopped' });
  }
}

/**
 * 获取调度器状态
 */
export function getSchedulerStatus() {
  return {
    isRunning: timer !== null,
    interval: CHECK_INTERVAL,
    ...getState()
  };
}

/**
 * 处理待处理的反馈
 */
async function processPendingFeedback() {
  // 防止重复执行
  if (isRunning) {
    addLog('上一次处理尚未完成，跳过本次执行', 'warn');
    return;
  }

  isRunning = true;

  try {
    // 步骤 1: 获取待处理反馈
    updateState({ currentStep: 'fetching', isProcessing: true });
    addLog('开始获取待处理反馈...');

    const pendingList = await getPendingFeedback(10);
    
    if (!pendingList || pendingList.length === 0) {
      updateState({ 
        totalPending: 0, 
        isProcessing: false, 
        currentStep: 'idle',
        currentFeedback: null 
      });
      addLog('没有待处理的反馈');
      return;
    }

    updateState({ totalPending: pendingList.length });
    addLog(`获取到 ${pendingList.length} 条待处理反馈`, 'success');

    // 处理每一条反馈（一次只处理一条）
    for (const feedback of pendingList) {
      try {
        await processSingleFeedback(feedback);
        
        // 处理成功后更新计数
        const state = getState();
        updateState({ processedCount: state.processedCount + 1 });
        
      } catch (error) {
        addLog(`处理反馈 ${feedback.feedbackId} 失败: ${error.message}`, 'error');
        
        // 记录错误但继续处理下一条
        updateState({ 
          stats: {
            ...getState().stats,
            lastError: error.message
          }
        });
      }
    }

  } catch (error) {
    addLog(`处理过程出错: ${error.message}`, 'error');
    updateState({ 
      isProcessing: false, 
      currentStep: 'error',
      stats: {
        ...getState().stats,
        lastError: error.message
      }
    });
  } finally {
    isRunning = false;
    updateState({ isProcessing: false, currentStep: 'idle', currentFeedback: null });
  }
}

/**
 * 处理单条反馈
 */
async function processSingleFeedback(feedback) {
  const { feedbackId, feedbackType, content, resourceId } = feedback;

  updateState({ 
    currentFeedback: feedback,
    currentStep: 'generating'
  });
  addLog(`开始处理反馈: ${feedbackId}, 类型: ${feedbackType}`);

  // 根据反馈类型构建需求描述
  const requirement = buildRequirement(feedback);
  addLog(`需求描述: ${requirement.slice(0, 50)}...`);

  // 步骤 2: 调用 AI 生成卡片
  updateState({ currentStep: 'generating' });
  addLog('调用 AI 生成卡片...');

  const cardData = await generateCard(requirement);
  addLog('AI 生成卡片完成', 'success');

  // 步骤 3: 发布卡片草稿
  updateState({ currentStep: 'publishing' });
  addLog('发布卡片草稿到 onepage...');

  const publishResult = await publishCardDraft(cardData, feedback);
  addLog(`卡片发布成功: ${publishResult.cardId}`, 'success');

  // 步骤 4: 更新反馈状态
  updateState({ currentStep: 'updating' });
  addLog('更新反馈状态为 PROCESSED...');

  await updateFeedbackStatus(feedbackId, 'PROCESSED');
  addLog(`反馈 ${feedbackId} 处理完成`, 'success');

  // 更新统计
  const state = getState();
  updateState({
    stats: {
      ...state.stats,
      todayTotal: state.stats.todayTotal + 1,
      todaySuccess: state.stats.todaySuccess + 1,
      totalGenerated: state.stats.totalGenerated + 1
    }
  });

  return publishResult;
}

/**
 * 根据反馈构建需求描述
 */
function buildRequirement(feedback) {
  const { feedbackType, content, resourceId, catalog } = feedback;

  switch (feedbackType) {
    case 'SUGGESTION':
      // 建议类型：直接使用用户建议内容
      return `请根据以下用户建议生成一张卡片：\n${content}`;

    case 'CARD':
      // 卡片反馈：根据反馈类型优化卡片
      const catalogDesc = {
        'contentError': '内容有误',
        'hardToUnderstand': '难以理解',
        'other': '其他问题'
      };
      return `用户对卡片 ${resourceId} 反馈了"${catalogDesc[catalog] || '问题'}"，请生成一张改进后的卡片。具体说明：${content || '无具体说明'}`;

    case 'CARD_SET':
      // 卡册反馈：根据反馈补充卡片
      const setCatalogDesc = {
        'contentError': '内容有误',
        'categoryUnreasonable': '分类不合理',
        'needMoreCards': '需要更多卡片',
        'other': '其他问题'
      };
      return `用户对卡册 ${resourceId} 反馈了"${setCatalogDesc[catalog] || '问题'}"，请生成一张补充卡片。具体说明：${content || '无具体说明'}`;

    default:
      return content || '生成一张通用知识卡片';
  }
}

export default {
  startScheduler,
  stopScheduler,
  getSchedulerStatus
};
