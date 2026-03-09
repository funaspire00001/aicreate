<template>
  <div 
    class="card-bg"
    :style="componentStyle"
  >
    <!-- 背景图片 -->
    <img 
      v-if="hasBackgroundImage"
      :src="getImageUrl(backgroundImageSrc)"
      class="background-image"
      alt=""
      @error="handleImageError"
    />
    
    <!-- 插槽：用于放置子组件 -->
    <slot></slot>
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

const componentStyle = computed(() => {
  return mergeComponentStyles(props.component)
})

const hasBackgroundImage = computed(() => {
  return !!(props.component?.metadata?.src || props.component?.metadata?.image)
})

const backgroundImageSrc = computed(() => {
  return props.component?.metadata?.src || props.component?.metadata?.image || ''
})

// 获取图片 URL（只支持 http 网络图片或本地 base64 图片）
function getImageUrl(src) {
  if (!src) return ''
  
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

function handleImageError(event) {
  console.warn('[CardBg] 图片加载失败:', event.target.src)
}
</script>

<style scoped>
.card-bg {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.background-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
  pointer-events: none;
}
</style>
