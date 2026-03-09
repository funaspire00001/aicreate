<template>
  <div 
    class="card-image"
    :style="componentStyle"
  >
    <img 
      v-if="imageSrc"
      :src="getImageUrl(imageSrc)"
      class="image-element"
      :style="imageElementStyle"
      :alt="component.metadata?.alt || '图片'"
      @error="handleImageError"
    />
    <div v-else class="image-placeholder">
      <span>暂无图片</span>
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

// 获取图片路径
const imageSrc = computed(() => {
  return props.component.metadata?.src || ''
})

// 组件样式
const componentStyle = computed(() => {
  return mergeComponentStyles(props.component)
})

// 图片适配模式
const imageFitMode = computed(() => {
  return props.component.metadata?.mode || 'aspectFill'
})

// 根据适配模式计算 img 的 style
const imageElementStyle = computed(() => {
  const mode = imageFitMode.value
  switch (mode) {
    case 'widthFix':
      return { width: '100%', height: 'auto', objectFit: 'contain' }
    case 'heightFix':
      return { width: 'auto', height: '100%', objectFit: 'contain' }
    case 'aspectFit':
      return { objectFit: 'contain' }
    case 'scaleToFill':
      return { objectFit: 'fill' }
    case 'aspectFill':
    default:
      return { objectFit: 'cover' }
  }
})

// 获取图片 URL
function getImageUrl(src) {
  if (!src || src.trim() === '') {
    return ''
  }
  
  // base64 数据 URL，直接返回
  if (src.startsWith('data:image/')) {
    return src
  }
  
  // HTTP/HTTPS URL，直接返回
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src
  }
  
  return src
}

// 处理图片加载失败
function handleImageError(event) {
  console.warn('[CardImage] 图片加载失败:', event.target.src)
  event.target.style.display = 'none'
}
</script>

<style scoped>
.card-image {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}

.image-element {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.image-placeholder {
  width: 100%;
  height: 100%;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  color: #999;
  font-size: 12px;
}
</style>
