<template>
  <div 
    class="card-text"
    :class="[textTypeClass, writingModeClass]"
    :style="componentStyle"
  >
    <!-- 背景图片 -->
    <img 
      v-if="hasBackgroundImage"
      :src="backgroundImageSrc"
      class="text-background-image"
      alt=""
    />
    
    <!-- 文本内容 -->
    <div class="text-content" :style="textContentStyle">
      <span v-if="displayText" class="text-display">{{ displayText }}</span>
      <span v-else class="placeholder-text">{{ placeholderText }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { mergeComponentStyles } from '../../utils/cardHelper.js'

const props = defineProps({
  component: {
    type: Object,
    required: true
  }
})

// 获取文本内容
const displayText = computed(() => {
  return props.component.metadata?.text || ''
})

// 占位文本
const placeholderText = computed(() => {
  return props.component.metadata?.placeholder || '点击编辑文字'
})

// 文本类型
const textType = computed(() => {
  return props.component.metadata?.textType || 'body'
})

// 文本类型类名
const textTypeClass = computed(() => {
  return `text-type-${textType.value}`
})

// 书写模式
const writingMode = computed(() => {
  return props.component.style?.writingMode || 'horizontal-tb'
})

// 书写模式类名
const writingModeClass = computed(() => {
  if (writingMode.value === 'vertical-rl' || writingMode.value === 'vertical-lr') {
    return 'vertical-text'
  }
  return 'horizontal-text'
})

// 组件样式
const componentStyle = computed(() => {
  return mergeComponentStyles(props.component)
})

// 文本内容样式
const textContentStyle = computed(() => {
  const style = { ...props.component.style }
  delete style.background
  delete style.width
  delete style.height
  
  const textAlign = style.textAlign || (textType.value === 'title' ? 'center' : 'left')
  
  return {
    ...style,
    textAlign: textAlign
  }
})

// 背景图片
const hasBackgroundImage = computed(() => {
  return !!(props.component.metadata?.src || props.component.metadata?.image)
})

const backgroundImageSrc = computed(() => {
  return props.component.metadata?.src || props.component.metadata?.image || ''
})
</script>

<style scoped>
.card-text {
  position: relative;
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.text-background-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}

.text-content {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 8px;
  box-sizing: border-box;
  word-wrap: break-word;
  overflow-wrap: break-word;
  flex-wrap: wrap;
  overflow: visible;
}

.text-display {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  display: block;
  width: 100%;
  line-height: 1.5;
  text-align: inherit;
  flex: 1 1 100%;
  min-width: 0;
}

.placeholder-text {
  display: block;
  width: 100%;
  line-height: 1.5;
  text-align: inherit;
  flex: 1 1 100%;
  min-width: 0;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
  color: #999;
}

/* 横版文字 */
.horizontal-text {
  writing-mode: horizontal-tb;
}

/* 竖版文字 */
.vertical-text {
  writing-mode: vertical-rl;
  text-orientation: upright;
}

/* 文本类型样式 */
.text-type-title {
  font-weight: 600;
  text-align: center;
}

.text-type-body {
  text-align: left;
}

.text-type-content {
  text-align: left;
}
</style>
