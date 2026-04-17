<script setup>
import { ref, nextTick } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'
import Sidebar from '../components/Sidebar.vue'
import TopBar from '../components/TopBar.vue'
import TaskList from '../components/TaskList.vue'
import TaskEditor from '../components/TaskEditor.vue'

const taskStore = useTaskStore()
const emit = defineEmits(['enterFloat'])
const editorOpen = ref(false)
const editingTask = ref(null)

function openEditor(task = null) {
  editingTask.value = null
  editorOpen.value = false
  nextTick(() => {
    editingTask.value = task
    editorOpen.value = true
  })
}

function closeEditor() {
  editorOpen.value = false
  editingTask.value = null
}
</script>

<template>
  <div class="main-view">
    <Sidebar />
    <div class="content">
      <TopBar
        :search-query="taskStore.searchQuery"
        @update:search-query="taskStore.setSearchQuery"
        @enter-float="emit('enterFloat')"
      />
      <div class="page-body">
        <TaskList @edit-task="openEditor" />
        <button class="fab" @click="openEditor()">+</button>
      </div>
    </div>
    <TaskEditor :open="editorOpen" :task="editingTask" @close="closeEditor" />
  </div>
</template>

<style scoped>
.main-view {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg);
}
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.page-body {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}
.fab {
  position: fixed;
  right: 32px;
  bottom: 32px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--color-primary);
  color: white;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.fab:hover {
  background: var(--color-primary-hover);
}
.fab:active {
  transform: scale(0.98);
}
</style>
