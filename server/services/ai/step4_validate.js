/**
 * 步骤4：校验修正
 * 验证生成的卡片 JSON 是否符合规范，必要时进行修正
 */

/**
 * 执行校验修正
 * @param {object} cardData - 生成的卡片数据
 * @param {function} callModel - 调用模型的函数（可选，用于智能修正）
 * @returns {Promise<object>} 校验结果
 */
export async function validateCard(cardData, callModel) {
  const startTime = Date.now();
  
  const errors = [];
  const warnings = [];
  
  try {
    // 1. 检查基本结构
    if (!cardData.cardData) {
      errors.push('缺少 cardData 字段');
    }
    
    if (!cardData.cardData?.faces) {
      errors.push('缺少 faces 字段');
    }
    
    // 2. 检查正面
    const front = cardData.cardData?.faces?.front;
    if (front) {
      if (!front.background) {
        errors.push('正面缺少 background');
      }
      if (!front.components || front.components.length === 0) {
        warnings.push('正面没有组件');
      }
    } else {
      errors.push('缺少正面数据');
    }
    
    // 3. 检查背面
    const back = cardData.cardData?.faces?.back;
    if (back) {
      if (!back.background) {
        errors.push('背面缺少 background');
      }
      if (!back.components || back.components.length === 0) {
        errors.push('背面至少需要一个组件');
      }
    } else {
      errors.push('缺少背面数据');
    }
    
    // 4. 检查组件数量
    const frontComponents = front?.components || [];
    const backComponents = back?.components || [];
    const totalComponents = frontComponents.length + backComponents.length;
    
    if (totalComponents > 15) {
      warnings.push(`组件总数 ${totalComponents} 超过 15 个`);
    }
    
    // 5. 检查组件规范
    [...frontComponents, ...backComponents].forEach((comp, index) => {
      // 检查必要字段
      if (!comp.id) {
        errors.push(`组件 ${index} 缺少 id`);
      }
      if (!comp.type) {
        errors.push(`组件 ${index} 缺少 type`);
      }
      if (!comp.layout) {
        errors.push(`组件 ${index} 缺少 layout`);
      }
      
      // 检查 text 组件
      if (comp.type === 'text') {
        if (comp.style?.fontSize) {
          const size = parseInt(comp.style.fontSize);
          if (comp.metadata?.textType === 'title' && size < 40) {
            warnings.push(`标题字号 ${size}px 小于最小值 40px`);
          }
          if (comp.metadata?.textType === 'body' && size < 32) {
            warnings.push(`正文字号 ${size}px 小于最小值 32px`);
          }
        }
      }
      
      // 检查位置是否合理
      if (comp.layout) {
        const left = parseInt(comp.layout.left) || 0;
        const top = parseInt(comp.layout.top) || 0;
        if (left > 580) {
          warnings.push(`组件 ${comp.id} left=${left} 可能超出边界`);
        }
        if (top > 780) {
          warnings.push(`组件 ${comp.id} top=${top} 可能超出边界`);
        }
      }
    });
    
    // 6. 检查 contentData
    if (cardData.contentData) {
      if (!Array.isArray(cardData.contentData)) {
        errors.push('contentData 应为数组');
      } else if (cardData.contentData.length > 12) {
        warnings.push(`contentData 长度 ${cardData.contentData.length} 超过 12`);
      }
    }
    
    // 7. 检查主题
    if (!cardData.theme) {
      warnings.push('缺少 theme 字段');
    } else if (cardData.theme.length > 12) {
      warnings.push(`主题 "${cardData.theme}" 超过 12 字`);
    }
    
    // 8. 尝试自动修正
    let fixedData = cardData;
    if (errors.length > 0 && callModel) {
      // 如果有错误且有模型调用函数，尝试智能修正
      fixedData = await tryAutoFix(cardData, errors, callModel);
    }
    
    const isValid = errors.length === 0;
    
    return {
      success: true,
      output: {
        valid: isValid,
        cardData: fixedData,
        errors,
        warnings,
        fixed: fixedData !== cardData
      },
      duration: Date.now() - startTime
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    };
  }
}

/**
 * 尝试自动修正
 */
async function tryAutoFix(cardData, errors, callModel) {
  // 简单修正逻辑
  let fixed = JSON.parse(JSON.stringify(cardData));
  
  // 确保基本结构存在
  if (!fixed.cardData) {
    fixed.cardData = { faces: { front: {}, back: {} } };
  }
  if (!fixed.cardData.faces) {
    fixed.cardData.faces = { front: {}, back: {} };
  }
  
  // 确保背景存在
  if (!fixed.cardData.faces.front?.background) {
    fixed.cardData.faces.front = fixed.cardData.faces.front || {};
    fixed.cardData.faces.front.background = createDefaultBackground('front');
  }
  if (!fixed.cardData.faces.back?.background) {
    fixed.cardData.faces.back = fixed.cardData.faces.back || {};
    fixed.cardData.faces.back.background = createDefaultBackground('back');
  }
  
  // 确保组件数组存在
  if (!fixed.cardData.faces.front.components) {
    fixed.cardData.faces.front.components = [];
  }
  if (!fixed.cardData.faces.back.components) {
    fixed.cardData.faces.back.components = [];
  }
  
  // 如果背面没有组件，添加一个默认的
  if (fixed.cardData.faces.back.components.length === 0) {
    fixed.cardData.faces.back.components.push({
      id: 'text-back-1',
      type: 'text',
      metadata: { text: '内容', textType: 'body' },
      layout: { left: '50px', top: '100px', width: '500px', height: '600px', zIndex: 10, position: 'absolute' },
      style: { fontSize: '24px', color: '#333333', lineHeight: '1.8' }
    });
  }
  
  return fixed;
}

/**
 * 创建默认背景
 */
function createDefaultBackground(face) {
  return {
    id: `background-${face}-1`,
    type: 'background',
    metadata: { image: '', text: '背景' },
    layout: { width: '600px', height: '800px', left: '0px', top: '0px', zIndex: 1, position: 'relative' },
    style: { 
      background: face === 'front' 
        ? 'linear-gradient(135deg, #667eea, #764ba2)' 
        : '#ffffff',
      borderRadius: '16px'
    }
  };
}

export default {
  name: '校验修正',
  description: '验证卡片 JSON 是否符合规范',
  execute: validateCard
};
