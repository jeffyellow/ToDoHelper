<script setup>
import { useSettingStore } from '../stores/settingStore.js'
import { PinOff, Pin, Maximize2 } from 'lucide-vue-next'

const settingStore = useSettingStore()
const emit = defineEmits(['exitFloat'])

function onOpacityChange(e) {
  const val = parseInt(e.target.value, 10)
  settingStore.setFloatOpacity(val)
  const opacity = val / 100
  document.documentElement.style.setProperty('--float-bg-opacity', String(opacity))
}
</script>

<template>
  <div class="float-controls">
    <div class="control-group">
      <input
        type="range"
        min="30"
        max="100"
        :value="settingStore.floatOpacity"
        @input="onOpacityChange"
      />
      <span class="value">{{ settingStore.floatOpacity }}%</span>
    </div>
    <button
      class="icon-btn"
      :class="{ active: settingStore.floatAlwaysOnTop }"
      @click="settingStore.setFloatAlwaysOnTop(!settingStore.floatAlwaysOnTop)"
      :title="settingStore.floatAlwaysOnTop ? '取消置顶' : '置顶'"
    >
      <Pin v-if="settingStore.floatAlwaysOnTop" :size="16" />
      <PinOff v-else :size="16" />
    </button>
    <button class="icon-btn" @click="emit('exitFloat')" title="返回主界面">
      <Maximize2 :size="16" />
    </button>
  </div>
</template>

<style scoped>
.float-controls {
  height: 44px;
  background: rgba(var(--bg-rgb, 255, 247, 237), var(--float-bg-opacity, 0.85));
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
}
.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}
.value {
  font-size: 11px;
  color: var(--text-primary);
  width: 28px;
  text-align: right;
}
input[type="range"] {
  flex: 1;
}
.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover,
.icon-btn.active {
  background: var(--surface-hover);
  color: var(--color-primary);
}
</style>
