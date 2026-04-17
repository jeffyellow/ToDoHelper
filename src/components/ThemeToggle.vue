<script setup>
import { Sun, Moon } from 'lucide-vue-next'
import { useSettingStore } from '../stores/settingStore.js'

const store = useSettingStore()
</script>

<template>
  <button class="theme-toggle" @click="store.toggleTheme" aria-label="切换主题">
    <Sun v-if="store.theme === 'dark'" :size="20" />
    <Moon v-else :size="20" />
  </button>
</template>

<style scoped>
.theme-toggle {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.theme-toggle:hover {
  background: var(--surface-hover);
}
</style>
