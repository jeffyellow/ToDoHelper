<script setup>
import { useTaskStore } from '../stores/taskStore.js'

const taskStore = useTaskStore()
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
}
.nav-item:hover {
  background: var(--surface-hover);
}
.nav-item.active {
  background: var(--color-primary-subtle);
  color: var(--color-primary-hover);
}
</style>
