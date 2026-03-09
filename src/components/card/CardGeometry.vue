<template>
  <div 
    class="card-geometry"
    :style="componentStyle"
  >
    <!-- 背景图片 -->
    <img 
      v-if="hasBackgroundImage"
      :src="backgroundImageSrc"
      class="geometry-image"
      alt=""
    />
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

// 组件样式
const componentStyle = computed(() => {
  return mergeComponentStyles(props.component)
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
.card-geometry {
  position: relative;
  box-sizing: border-box;
}

.geometry-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}
</style>
