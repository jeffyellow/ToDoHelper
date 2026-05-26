<script setup>
import { useTaskStore } from '../stores/taskStore.js'
import ConnectionStatus from './ConnectionStatus.vue'

const taskStore = useTaskStore()
const emit = defineEmits(['openAuth'])
const filters = [
  { label: '进行中', key: 'active' },
  { label: '未开始', key: 'pending' },
  { label: '已完成', key: 'completed' },
]
</script>

<template>
  <aside class="sidebar">
    <div class="logo">ToDoHelper</div>
    <nav class="nav">
      <button
        v-for="f in filters"
        :key="f.key"
        class="nav-item"
        :class="{ active: taskStore.activeFilter === f.key }"
        @click="taskStore.setActiveFilter(f.key)"
      >
        {{ f.label }}
      </button>
    </nav>

    <section class="tag-filter">
      <div class="tag-filter-header">
        <span>标签筛选</span>
        <button
          class="clear-btn"
          :disabled="!taskStore.selectedTags.length"
          @click="taskStore.clearSelectedTags()"
        >清空</button>
      </div>
      <label
        v-for="tag in taskStore.tagOptions"
        :key="tag"
        class="tag-option"
      >
        <input
          type="checkbox"
          :checked="taskStore.selectedTags.includes(tag)"
          @change="taskStore.toggleSelectedTag(tag)"
        />
        <span>{{ tag }}</span>
      </label>
    </section>

    <div class="spacer" />
    <ConnectionStatus @open-auth="emit('openAuth')" />
  </aside>
</template>

<style scoped>
.sidebar {
  width: 220px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 16px;
  display: flex;
  flex-direction: column;
}
.logo {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
}
.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nav-item {
  height: 36px;
  padding: 0 12px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.nav-item:hover {
  background: var(--surface-hover);
}
.nav-item.active {
  background: var(--color-primary-subtle);
  color: var(--color-primary-hover);
}
.tag-filter {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.tag-filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-secondary);
}
.clear-btn {
  border: none;
  background: transparent;
  color: var(--color-primary-hover);
  font-size: 12px;
  cursor: pointer;
}
.clear-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tag-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-primary);
  cursor: pointer;
}
.spacer {
  flex: 1;
}
</style>
