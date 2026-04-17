<script setup>
import { useTaskStore } from '../stores/taskStore.js'
import PriorityBadge from './PriorityBadge.vue'

const taskStore = useTaskStore()
</script>

<template>
  <div class="float-task-list">
    <div v-if="taskStore.floatTasks.length" class="list">
      <div
        v-for="task in taskStore.floatTasks"
        :key="task.id"
        class="float-item"
      >
        <label class="checkbox" @click.stop>
          <input
            type="checkbox"
            :checked="task.completed"
            @change="taskStore.toggleComplete(task.id)"
          />
          <span class="checkmark" />
        </label>
        <span class="title">{{ task.title }}</span>
        <div class="meta">
          <PriorityBadge :priority="task.priority" />
          <span v-if="task.due_date" class="due">{{ task.due_date }}</span>
        </div>
      </div>
    </div>
    <div v-else class="empty">暂无待办</div>
  </div>
</template>

<style scoped>
.float-task-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.float-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
.checkbox {
  position: relative;
  width: 16px;
  height: 16px;
  cursor: pointer;
  flex-shrink: 0;
}
.checkbox input {
  opacity: 0;
  width: 0;
  height: 0;
}
.checkmark {
  position: absolute;
  inset: 0;
  border: 1.5px solid var(--text-tertiary);
  border-radius: 6px;
  transition: background 150ms ease-out, border-color 150ms ease-out;
}
.checkbox input:checked + .checkmark {
  background: var(--color-success);
  border-color: var(--color-success);
}
.checkbox input:checked + .checkmark::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 3px;
  height: 6px;
  border: solid white;
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}
.title {
  flex: 1;
  font-size: 15px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.due {
  font-family: "JetBrains Mono", monospace;
  font-size: 13px;
  color: var(--text-secondary);
}
.empty {
  text-align: center;
  padding: 24px 0;
  font-size: 14px;
  color: var(--text-tertiary);
}
</style>
