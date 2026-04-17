import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { selectAllTasks, insertTask, updateTask, deleteTask } from '../db/taskQueries.js'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref([])
  const filterTag = ref('')
  const searchQuery = ref('')
  const activeFilter = ref('active') // 'active' | 'pending' | 'completed'

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

  async function addTask({ title, startDate, dueDate, priority = 1, tag }) {
    await insertTask({ title, startDate, dueDate, priority, tag })
    await loadTasks()
  }

  async function updateTaskById(id, payload) {
    await updateTask(id, payload)
    await loadTasks()
  }

  async function toggleComplete(id) {
    const task = tasks.value.find((t) => t.id === id)
    if (!task) return
    const completed = task.completed ? 0 : 1
    const completedAt = completed ? new Date().toISOString() : null
    await updateTask(id, { completed, completedAt })
    await loadTasks()
  }

  async function removeTask(id) {
    await deleteTask(id)
    await loadTasks()
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
    incompleteTasks,
    completedTasks,
    filteredTasks,
    floatTasks,
    allTags,
    loadTasks,
    addTask,
    updateTaskById,
    toggleComplete,
    removeTask,
    setFilterTag,
    setSearchQuery,
    setActiveFilter,
  }
})
