import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import { useTaskStore } from '../taskStore.js'

vi.mock('../../db/taskQueries.js', () => ({
  selectAllTasks: vi.fn(),
  insertTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}))

vi.mock('../../db/syncQueries.js', () => ({
  getPendingTasks: vi.fn(),
  markTasksSynced: vi.fn(),
  getLastSyncAt: vi.fn(),
  setLastSyncAt: vi.fn(),
  upsertTaskByUuid: vi.fn(),
  cleanupDeletedTasks: vi.fn(),
}))

vi.mock('../../db/settingQueries.js', () => ({
  hasMysqlConfig: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('../settingStore.js', () => ({
  useSettingStore: vi.fn(() => ({
    currentUser: { userId: 1, username: 'test' },
    isLoggedIn: true,
    lastUserId: null,
  })),
}))

import { selectAllTasks, insertTask, updateTask, deleteTask } from '../../db/taskQueries.js'
import { getPendingTasks, getLastSyncAt } from '../../db/syncQueries.js'
import { hasMysqlConfig } from '../../db/settingQueries.js'
import { invoke } from '@tauri-apps/api/core'

describe('taskStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    getPendingTasks.mockResolvedValue([])
    getLastSyncAt.mockResolvedValue(null)
    hasMysqlConfig.mockResolvedValue(false)
    invoke.mockResolvedValue({ pulled_tasks: [], new_last_sync_at: '2026-01-01 00:00:00' })
  })

  it('加载任务并拆分为未完成/已完成', async () => {
    selectAllTasks.mockResolvedValue([
      { id: 1, title: 'A', completed: 0 },
      { id: 2, title: 'B', completed: 1 },
    ])
    const store = useTaskStore()
    await store.loadTasks()
    expect(store.tasks.length).toBe(2)
    expect(store.incompleteTasks.length).toBe(1)
    expect(store.completedTasks.length).toBe(1)
  })

  it('添加任务并持久化', async () => {
    insertTask.mockResolvedValue(3)
    selectAllTasks.mockResolvedValue([{ id: 3, title: 'New', completed: 0 }])
    const store = useTaskStore()
    await store.addTask({ title: 'New' })
    expect(insertTask).toHaveBeenCalledWith({ title: 'New', startDate: undefined, dueDate: undefined, priority: 1, tag: undefined, userId: 1 })
    expect(store.tasks[0].title).toBe('New')
  })

  it('切换完成状态并设置 completed_at', async () => {
    selectAllTasks.mockResolvedValue([{ id: 1, title: 'A', completed: 0 }])
    const store = useTaskStore()
    await store.loadTasks()
    await store.toggleComplete(1)
    expect(updateTask).toHaveBeenCalledWith(1, expect.objectContaining({ completed: 1, completedAt: expect.any(String) }))
  })

  it('activeFilter pending excludes future start_date', async () => {
    const store = useTaskStore()
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    selectAllTasks.mockResolvedValue([
      { id: 1, title: 'Today', completed: 0, start_date: today },
      { id: 2, title: 'Tomorrow', completed: 0, start_date: tomorrow },
    ])
    await store.loadTasks()
    store.activeFilter = 'pending'
    expect(store.filteredTasks.map(t => t.title)).toEqual(['Tomorrow'])
  })

  it('activeFilter active excludes future start_date', async () => {
    const store = useTaskStore()
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    selectAllTasks.mockResolvedValue([
      { id: 1, title: 'Active', completed: 0, start_date: today },
      { id: 2, title: 'Future', completed: 0, start_date: tomorrow },
      { id: 3, title: 'NoStart', completed: 0, start_date: null },
    ])
    await store.loadTasks()
    store.activeFilter = 'active'
    expect(store.filteredTasks.map(t => t.title).sort()).toEqual(['Active', 'NoStart'])
  })

  it('floatTasks excludes completed and sorts by priority desc then created_at asc', async () => {
    const store = useTaskStore()
    selectAllTasks.mockResolvedValue([
      { id: 1, title: 'Low', completed: 0, priority: 0, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, title: 'High', completed: 0, priority: 2, created_at: '2026-01-02T00:00:00Z' },
      { id: 3, title: 'Mid', completed: 0, priority: 1, created_at: '2026-01-03T00:00:00Z' },
    ])
    await store.loadTasks()
    selectAllTasks.mockResolvedValue([
      { id: 1, title: 'Low', completed: 0, priority: 0, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, title: 'High', completed: 0, priority: 2, created_at: '2026-01-02T00:00:00Z' },
      { id: 3, title: 'Mid', completed: 1, priority: 1, created_at: '2026-01-03T00:00:00Z' },
    ])
    await store.toggleComplete(3)
    expect(store.floatTasks.map(t => t.title)).toEqual(['High', 'Low'])
  })

  it('supports multi tag filter in main list', async () => {
    const store = useTaskStore()
    selectAllTasks.mockResolvedValue([
      { id: 1, title: 'Work', completed: 0, tag: '工作', priority: 1, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, title: 'Study', completed: 0, tag: '学习', priority: 1, created_at: '2026-01-02T00:00:00Z' },
      { id: 3, title: 'Life', completed: 0, tag: '生活', priority: 1, created_at: '2026-01-03T00:00:00Z' },
    ])
    await store.loadTasks()
    store.setSelectedTags(['工作', '学习'])
    expect(store.filteredTasks.map((t) => t.title).sort()).toEqual(['Study', 'Work'])
  })

  it('does not filter by tag when selectedTags is empty', async () => {
    const store = useTaskStore()
    selectAllTasks.mockResolvedValue([
      { id: 1, title: 'Work', completed: 0, tag: '工作', priority: 1, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, title: 'Life', completed: 0, tag: '生活', priority: 1, created_at: '2026-01-02T00:00:00Z' },
    ])
    await store.loadTasks()
    store.setSelectedTags([])
    expect(store.filteredTasks.map((t) => t.title).sort()).toEqual(['Life', 'Work'])
  })

  it('applies same tag filter to floatTasks', async () => {
    const store = useTaskStore()
    selectAllTasks.mockResolvedValue([
      { id: 1, title: 'Work High', completed: 0, tag: '工作', priority: 2, created_at: '2026-01-02T00:00:00Z' },
      { id: 2, title: 'Life', completed: 0, tag: '生活', priority: 1, created_at: '2026-01-01T00:00:00Z' },
      { id: 3, title: 'Work Done', completed: 1, tag: '工作', priority: 2, created_at: '2026-01-03T00:00:00Z' },
      { id: 4, title: 'Work Low', completed: 0, tag: '工作', priority: 0, created_at: '2026-01-01T00:00:00Z' },
    ])
    await store.loadTasks()
    store.setSelectedTags(['工作'])
    expect(store.floatTasks.map((t) => t.title)).toEqual(['Work High', 'Work Low'])
  })

  it('treats non-enum tags as 其他 for filtering', async () => {
    const store = useTaskStore()
    selectAllTasks.mockResolvedValue([
      { id: 1, title: 'Legacy Tag', completed: 0, tag: '出差', priority: 1, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, title: 'Other Tag', completed: 0, tag: '其他', priority: 1, created_at: '2026-01-02T00:00:00Z' },
    ])
    await store.loadTasks()
    store.setSelectedTags(['其他'])
    expect(store.filteredTasks.map((t) => t.title).sort()).toEqual(['Legacy Tag', 'Other Tag'])
  })
})
