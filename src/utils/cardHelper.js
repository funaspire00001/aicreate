/**
 * 卡片数据辅助函数（简化版 - 仅用于预览）
 */

/**
 * 深拷贝对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  return JSON.parse(JSON.stringify(obj))
}

/**
 * 面键常量
 */
export const TEMPLATE_FACE_KEYS = {
  FRONT: 'front',
  BACK: 'back'
}

/**
 * 规范化卡片数据（处理嵌套结构）
 * @param {Object} cardData - 可能嵌套的卡片数据
 * @returns {Object} 规范化后的卡片数据
 */
function normalizeCardData(cardData) {
  if (!cardData) return null
  
  // 处理嵌套结构：{ cardData: { faces: {...} } }
  if (cardData.cardData && cardData.cardData.faces) {
    return cardData.cardData
  }
  
  return cardData
}

/**
 * 获取卡片指定面的数据
 * @param {Object} cardData - 卡片数据对象
 * @param {string} faceKey - 面键名，默认 'front'
 * @returns {Object} face 对象，包含 background 和 components
 */
export function getCardFace(cardData, faceKey = TEMPLATE_FACE_KEYS.FRONT) {
  if (!cardData) {
    return {
      background: null,
      components: []
    }
  }

  // 规范化数据结构
  const normalizedData = normalizeCardData(cardData)

  const faces = normalizedData.faces && typeof normalizedData.faces === 'object' ? normalizedData.faces : {}
  const requestedFace = faces[faceKey]
  
  if (requestedFace) {
    return {
      background: requestedFace.background || null,
      components: Array.isArray(requestedFace.components) ? requestedFace.components : []
    }
  }

  // 如果请求正面但没有，尝试从旧格式兼容
  if (faceKey === TEMPLATE_FACE_KEYS.FRONT) {
    return {
      background: normalizedData.background || null,
      components: Array.isArray(normalizedData.components) ? normalizedData.components : []
    }
  }

  return {
    background: null,
    components: []
  }
}

/**
 * 获取卡片正面数据
 * @param {Object} cardData - 卡片数据对象
 * @returns {Object} face 对象
 */
export function getCardFrontFace(cardData) {
  return getCardFace(cardData, TEMPLATE_FACE_KEYS.FRONT)
}

/**
 * 合并组件样式（layout + style）
 * @param {Object} component - 组件对象
 * @returns {Object} 合并后的样式对象
 */
export function mergeComponentStyles(component) {
  if (!component || typeof component !== 'object') {
    return {}
  }
  
  const layout = component.layout || {}
  const style = component.style || {}
  
  // 合并布局和样式，样式优先级更高
  return {
    ...layout,
    ...style
  }
}