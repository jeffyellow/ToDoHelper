<script setup>
import { onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import MainView from './views/MainView.vue'
import FloatView from './views/FloatView.vue'
import { useSettingStore } from './stores/settingStore.js'
import { useTaskStore } from './stores/taskStore.js'
import { initDb } from './db/init.js'

const settingStore = useSettingStore()
const taskStore = useTaskStore()

onMounted(async () => {
  try {
    await initDb()
    await settingStore.init()
    await taskStore.loadTasks()
  } catch (e) {
    console.error('App initialization failed:', e)
    alert('初始化失败：' + e.message)
  }
})

async function enterFloat() {
  try {
    await invoke('set_float_mode')
    settingStore.isFloat = true
  } catch (e) {
    console.error('Enter float mode failed:', e)
    alert('切换悬浮窗失败：' + e.message)
  }
}

async function exitFloat() {
  try {
    await invoke('set_main_mode')
    settingStore.isFloat = false
  } catch (e) {
    console.error('Exit float mode failed:', e)
    alert('返回主界面失败：' + e.message)
  }
}
</script>

<template>
  <MainView
    v-if="!settingStore.isFloat"
    @enter-float="enterFloat"
  />
  <FloatView
    v-else
    @exit-float="exitFloat"
  />
</template>

<style>
#app {
  display: flex;
  flex-direction: column;
}
</style>
