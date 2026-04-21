<script setup>
import { Search, PictureInPicture, Database, Bell } from 'lucide-vue-next'
import ThemeToggle from './ThemeToggle.vue'
import SyncStatus from './SyncStatus.vue'
import { useTaskStore } from '../stores/taskStore.js'

const taskStore = useTaskStore()
defineProps({ searchQuery: String, showDbConfigBtn: Boolean })
const emit = defineEmits(['enterFloat', 'update:searchQuery', 'openDbConfig', 'openWebhookConfig'])
</script>

<template>
  <header class="top-bar">
    <div class="search">
      <Search :size="18" class="search-icon" />
      <input
        type="text"
        placeholder="搜索任务..."
        :value="searchQuery"
        @input="$emit('update:searchQuery', $event.target.value)"
      />
    </div>
    <div class="actions">
      <SyncStatus :status="taskStore.syncStatus" />
      <ThemeToggle />
      <button class="icon-btn" @click="emit('openWebhookConfig')" title="钉钉推送设置">
        <Bell :size="20" />
      </button>
      <button
        v-if="showDbConfigBtn"
        class="icon-btn"
        @click="emit('openDbConfig')"
        title="数据库连接"
      >
        <Database :size="20" />
      </button>
      <button class="icon-btn" @click="emit('enterFloat')" title="悬浮窗">
        <PictureInPicture :size="20" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  height: 56px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  gap: 16px;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}
.search input {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text-primary);
  width: 260px;
  font-size: 14px;
}
.search input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.2);
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover {
  background: var(--surface-hover);
}
</style>
