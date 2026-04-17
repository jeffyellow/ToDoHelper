<script setup>
import PriorityBadge from './PriorityBadge.vue'
import TagChip from './TagChip.vue'

const props = defineProps({
  task: { type: Object, required: true },
})
const emit = defineEmits(['toggle', 'edit', 'delete'])
</script>

<template>
  <div class="task-item" :class="{ completed: task.completed }">
    <label class="checkbox">
      <input
        type="checkbox"
        :checked="task.completed"
        @change="emit('toggle', task.id)"
      />
      <span class="checkmark" />
    </label>
    <div class="task-body">
      <div class="task-title">{{ task.title }}</div>
      <div class="task-meta">
        <PriorityBadge :priority="task.priority" />
        <span v-if="task.due_date" class="due-date">{{ task.due_date }}</span>
        <TagChip v-if="task.tag" :tag="task.tag" />
      </div>
    </div>
    <div class="task-actions">
      <button class="ghost-btn" @click="emit('edit', task)">编辑</button>
      <button class="ghost-btn danger" @click="emit('delete', task.id)">删除</button>
    </div>
  </div>
</template>

<style scoped>
.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  background: var(--surface);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
  transition: transform 150ms ease-out, box-shadow 150ms ease-out;
}
.task-item:hover {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}
.task-item.completed .task-title {
  text-decoration: line-through;
  color: var(--text-tertiary);
}
.checkbox {
  position: relative;
  width: 20px;
  height: 20px;
  cursor: pointer;
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
  border-radius: 8px;
  transition: background 150ms ease-out, border-color 150ms ease-out;
}
.checkbox input:checked + .checkmark {
  background: var(--color-success);
  border-color: var(--color-success);
}
.checkbox input:checked + .checkmark::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 4px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.task-body {
  flex: 1;
  min-width: 0;
}
.task-title {
  font-size: 16px;
  color: var(--text-primary);
  margin-bottom: 4px;
}
.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.due-date {
  font-size: 12px;
  color: var(--text-secondary);
}
.task-actions {
  display: flex;
  gap: 4px;
}
.ghost-btn {
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  border-radius: 10px;
}
.ghost-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.ghost-btn.danger:hover {
  color: var(--color-danger);
}
</style>
