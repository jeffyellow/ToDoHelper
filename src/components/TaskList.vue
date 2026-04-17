<script setup>
import { useTaskStore } from '../stores/taskStore.js'
import TaskItem from './TaskItem.vue'

const taskStore = useTaskStore()
const emit = defineEmits(['editTask'])
</script>

<template>
  <div class="task-list">
    <div v-if="taskStore.filteredTasks.length" class="list">
      <TaskItem
        v-for="task in taskStore.filteredTasks"
        :key="task.id"
        :task="task"
        @toggle="taskStore.toggleComplete"
        @edit="emit('editTask', $event)"
        @delete="taskStore.removeTask"
      />
    </div>
    <div v-else class="empty">
      <p v-if="taskStore.tasks.length">没有找到匹配的任务。</p>
      <p v-else>暂无任务，点击右下角添加。</p>
    </div>
  </div>
</template>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty {
  text-align: center;
  color: var(--text-tertiary);
  padding: 48px 0;
}
</style>
