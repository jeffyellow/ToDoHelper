<script setup>
import { watch, onMounted, onUnmounted } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import FloatTaskList from '../components/FloatTaskList.vue'
import FloatControls from '../components/FloatControls.vue'
import { useSettingStore } from '../stores/settingStore.js'

const settingStore = useSettingStore()
const emit = defineEmits(['exitFloat'])

function applyBgOpacity(val) {
  const opacity = val / 100
  document.documentElement.style.setProperty('--float-bg-opacity', String(opacity))
}

watch(() => settingStore.floatAlwaysOnTop, async (val) => {
  await getCurrentWindow().setAlwaysOnTop(val)
}, { immediate: true })

watch(() => settingStore.floatOpacity, async (val) => {
  applyBgOpacity(val)
}, { immediate: true })

onMounted(() => {
  document.body.style.background = 'transparent'
})

onUnmounted(() => {
  document.body.style.background = ''
})
</script>

<template>
  <div class="float-view">
    <div class="float-header">待办事项</div>
    <FloatTaskList />
    <FloatControls @exit-float="emit('exitFloat')" />
  </div>
</template>

<style scoped>
.float-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: rgba(var(--bg-rgb, 255, 247, 237), var(--float-bg-opacity, 0.85));
  backdrop-filter: blur(8px);
}
.float-header {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
  app-region: drag;
}
</style>
