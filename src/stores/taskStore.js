import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { selectAllTasks, insertTask, updateTask, deleteTask } from '../db/taskQueries.js'
import { getPendingTasks, markTasksSynced, getLastSyncAt, setLastSyncAt, upsertTaskByUuid } from '../db/syncQueries.js'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref([])
  const filterTag = ref('')
  const searchQuery = ref('')
  const activeFilter = ref('active') // 'active' | 'pending' | 'completed'
  const syncStatus = ref('idle') // 'idle' | 'syncing' | 'error' | 'offline'

  const todayStr = () => new Date().toISOString().slice(0, 10)

  const incompleteTasks = computed(() =>
    tasks.value.filter((t) => !t.completed)
  )

  const completedTasks = computed(() =>
    tasks.value.filter((t) => t.completed)
  )

  const filteredTasks = computed(() => {
    let result = tasks.value
    if (activeFilter.value === 'active') {
      result = result.filter((t) => !t.completed && (!t.start_date || t.start_date <= todayStr()))
    } else if (activeFilter.value === 'pending') {
      result = result.filter((t) => !t.completed && t.start_date && t.start_date > todayStr())
    } else if (activeFilter.value === 'completed') {
      result = result.filter((t) => t.completed)
    }
    if (filterTag.value) {
      result = result.filter((t) => t.tag === filterTag.value)
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter((t) => t.title.toLowerCase().includes(q))
    }
    return result
  })

  const floatTasks = computed(() => {
    return tasks.value
      .filter((t) => !t.completed)
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority
        return new Date(a.created_at) - new Date(b.created_at)
      })
  })

  const allTags = computed(() => {
    const set = new Set(tasks.value.map((t) => t.tag).filter(Boolean))
    return Array.from(set)
  })

  async function loadTasks() {
    tasks.value = await selectAllTasks()
  }

  async function triggerSync() {
    if (syncStatus.value === 'syncing') return
    syncStatus.value = 'syncing'
    try {
      const pending = await getPendingTasks()
      const lastSyncAt = await getLastSyncAt()
      const result = await invoke('sync_tasks', { pendingTasks: pending, lastSyncAt })
      for (const task of result.pulled_tasks) {
        await upsertTaskByUuid(task)
      }
      if (pending.length > 0) {
        await markTasksSynced(pending.map((t) => t.id))
      }
      if (result.pulled_tasks.length > 0) {
        await loadTasks()
      }
      await setLastSyncAt(result.new_last_sync_at)
      syncStatus.value = 'idle'
    } catch (e) {
      console.error('Sync failed:', e)
      const msg = e?.message || String(e)
      if (msg.includes('未连接') || msg.includes('未登录')) {
        syncStatus.value = 'offline'
      } else {
        syncStatus.value = 'error'
      }
    }
  }

  async function addTask({ title, startDate, dueDate, priority = 1, tag }) {
    await insertTask({ title, startDate, dueDate, priority, tag })
    await loadTasks()
    triggerSync().catch(console.error)
  }

  async function updateTaskById(id, payload) {
    await updateTask(id, payload)
    await loadTasks()
    triggerSync().catch(console.error)
  }

  async function toggleComplete(id) {
    const task = tasks.value.find((t) => t.id === id)
    if (!task) return
    const completed = task.completed ? 0 : 1
    const completedAt = completed ? new Date().toISOString() : null
    await updateTask(id, { completed, completedAt })
    await loadTasks()
    triggerSync().catch(console.error)
  }

  async function removeTask(id) {
    await deleteTask(id)
    await loadTasks()
    triggerSync().catch(console.error)
  }

  function setFilterTag(tag) {
    filterTag.value = tag
  }

  function setSearchQuery(q) {
    searchQuery.value = q
  }

  function setActiveFilter(filter) {
    activeFilter.value = filter
  }

  return {
    tasks,
    filterTag,
    searchQuery,
    activeFilter,
    syncStatus,
    incompleteTasks,
    completedTasks,
    filteredTasks,
    floatTasks,
    allTags,
    loadTasks,
    triggerSync,
    addTask,
    updateTaskById,
    toggleComplete,
    removeTask,
    setFilterTag,
    setSearchQuery,
    setActiveFilter,
  }
})
