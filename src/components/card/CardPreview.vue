<template>
  <div 
    class="card-preview-wrapper" 
    :class="previewClass"
    :style="wrapperStyle"
  >
    <div v-if="!parsedFace" class="no-data">
      <p>暂无卡片数据</p>
    </div>
    
    <CardBg
      v-else-if="parsedFace.background"
      :component="parsedFace.background"
      :style="cardBgStyle"
    >
      <!-- 渲染子组件 -->
      <template v-if="parsedFace.components">
        <template v-for="component in parsedFace.components" :key="component.id">
          <CardText
            v-if="component.type === 'text'"
            :component="component"
            class="card-component"
          />
          <CardImage
            v-else-if="component.type === 'image'"
            :component="component"
            class="card-component"
          />
          <CardGeometry
            v-else-if="component.type === 'geometry'"
            :component="component"
            class="card-component"
          />
          <CardDivider
            v-else-if="component.type === 'divider'"
            :component="component"
            class="card-component"
          />
        </template>
      </template>
    </CardBg>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { getCardFace, getCardFrontFace } from '../../utils/cardHelper.js'
import CardBg from './CardBg.vue'
import CardText from './CardText.vue'
import CardImage from './CardImage.vue'
import CardGeometry from './CardGeometry.vue'
import CardDivider from './CardDivider.vue'

const props = defineProps({
  // 卡片数据
  cardData: {
    type: Object,
    default: null
  },
  // 面键名（front/back）
  faceKey: {
    type: String,
    default: 'front'
  },
  // 缩放比例
  scale: {
    type: Number,
    default: 1
  },
  // 预览类名
  previewClass: {
    type: String,
    default: ''
  },
  // 缩放原点
  scaleOrigin: {
    type: String,
    default: 'center center'
  }
})

// 解析后的 face 数据
const parsedFace = ref(null)

// 计算包装器样式
const wrapperStyle = computed(() => {
  return {
    transform: `scale(${props.scale})`,
    transformOrigin: props.scaleOrigin
  }
})

// 计算 CardBg 组件样式
const cardBgStyle = computed(() => {
  if (!parsedFace.value?.background?.layout) {
    return {}
  }
  return {
    width: parsedFace.value.background.layout.width,
    height: parsedFace.value.background.layout.height
  }
})

// 更新解析的 face 数据
function updateParsedFace() {
  const { cardData, faceKey } = props

  if (!cardData) {
    parsedFace.value = null
    return
  }

  try {
    let face = faceKey === 'front' 
      ? getCardFrontFace(cardData) 
      : getCardFace(cardData, faceKey)
    
    parsedFace.value = face
    
  } catch (error) {
    console.error('[CardPreview] 解析卡片数据失败:', error)
    parsedFace.value = null
  }
}

// 监听数据变化
watch(() => [props.cardData, props.faceKey], () => {
  updateParsedFace()
}, { immediate: true, deep: true })

onMounted(() => {
  updateParsedFace()
})
</script>

<style scoped>
.card-preview-wrapper {
  position: static;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  min-height: 200px;
}

.no-data {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 80px;
  width: 200px;
  background: #f5f5f5;
  border-radius: 8px;
  color: #999;
  font-size: 14px;
}

.card-component {
  position: absolute;
  z-index: 1;
}
</style>
