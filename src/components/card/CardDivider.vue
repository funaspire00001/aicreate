<template>
  <div
    class="card-divider"
    :style="componentStyle"
  />
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
</script>

<style scoped>
.card-divider {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}
</style>
