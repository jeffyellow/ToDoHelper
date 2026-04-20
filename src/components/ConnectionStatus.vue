<script setup>
import { ref } from 'vue'
import { LogIn, LogOut, RefreshCw } from 'lucide-vue-next'
import { useSettingStore } from '../stores/settingStore.js'
import { useTaskStore } from '../stores/taskStore.js'

const settingStore = useSettingStore()
const taskStore = useTaskStore()
const emit = defineEmits(['openAuth'])

const syncSuccess = ref(false)

async function onSync() {
  if (taskStore.syncStatus === 'syncing') return
  try {
    await taskStore.triggerSync()
    syncSuccess.value = true
    setTimeout(() => { syncSuccess.value = false }, 2000)
  } catch (e) {
    console.error('Manual sync failed:', e)
  }
}

async function onLogout() {
  await settingStore.logout()
}
</script>

<template>
  <div class="connection-status">
    <button
      v-if="settingStore.isLoggedIn"
      class="status-btn sync-btn"
      :class="{ success: syncSuccess }"
      :disabled="taskStore.syncStatus === 'syncing'"
      @click="onSync"
      title="手动同步"
    >
      <RefreshCw :size="14" :class="{ spinning: taskStore.syncStatus === 'syncing' }" />
      <span>{{ syncSuccess ? '同步成功' : (taskStore.syncStatus === 'syncing' ? '同步中...' : '同步') }}</span>
    </button>

    <button
      class="status-btn"
      :class="{ online: settingStore.isLoggedIn }"
      @click="settingStore.isLoggedIn ? onLogout() : emit('openAuth')"
      :title="settingStore.isLoggedIn ? '点击退出登录' : '点击登录'"
    >
      <LogIn v-if="!settingStore.isLoggedIn" :size="14" />
      <LogOut v-else :size="14" />
      <span>
        {{ settingStore.isLoggedIn ? settingStore.currentUser : '未登录' }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.connection-status {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  border-top: 1px solid var(--border);
}
.status-btn {
  height: 32px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.status-btn:hover {
  background: var(--surface-hover);
}
.status-btn.online {
  color: #22c55e;
}
.status-btn.online:hover {
  background: rgba(34, 197, 94, 0.1);
}
.status-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.sync-btn.success {
  color: #22c55e;
}
.spinning {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
