# Float View & Filter Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 ToDoHelper 的 5 个体验问题：新增 `start_date` 字段实现进行中/未开始/已完成筛选、悬浮窗背景透明（文字清晰）、悬浮窗可勾选完成并隐藏、编辑器每次打开强制清空、悬浮窗按优先级排序展示。

**Architecture:** 在 SQLite 数据层新增 `start_date` 列并在前端编辑器和列表中贯通；任务 Store 新增状态筛选，Sidebar 从 tag 筛切换为状态筛；悬浮窗通过 Rust 设置窗口透明 + 前端 CSS 变量控制背景不透明度；悬浮窗任务列表增加 mini checkbox 和优先级展示。

**Tech Stack:** Vue 3 + Pinia + Tauri v2 + SQLite (`@tauri-apps/plugin-sql`) + Vitest

---

## File Structure

**数据层**
- `src/db/init.js` — 检测并添加 `start_date` 列
- `src/db/taskQueries.js` — `insertTask` / `updateTask` / `selectAllTasks` 增加 `start_date` 参数

**状态层**
- `src/stores/taskStore.js` — 新增 `activeFilter` 与按状态筛选逻辑；新增 `floatTasks` computed（悬浮窗专用）
- `src/stores/__tests__/taskStore.test.js` — 补充 `start_date` 与 `activeFilter` 测试

**组件层**
- `src/components/TaskEditor.vue` — 新增"开始日期"输入框，保存时带上 `startDate`
- `src/components/Sidebar.vue` — 筛选项替换为"进行中 / 未开始 / 已完成"，绑定 `activeFilter`
- `src/components/TaskList.vue` — 直接展示 `filteredTasks`，移除 incomplete/completed 分段
- `src/views/MainView.vue` — 修复 `openEditor` 连续调用不清空的问题
- `src/views/FloatView.vue` — CSS 变量绑定背景透明度
- `src/components/FloatTaskList.vue` — 展示 `floatTasks`，加 checkbox + `PriorityBadge` + 按优先级排序
- `src/components/FloatControls.vue` — 滑块改为"背景透明度"描述，emit 值直接改 CSS 变量

**Rust 层**
- `src-tauri/src/lib.rs` — `set_float_mode` 里增加 `window.set_transparent(true)`（Tauri 2 API）

---

### Task 1: Database schema migration and queries

**Files:**
- Modify: `src/db/init.js`
- Modify: `src/db/taskQueries.js`
- Test: `src/stores/__tests__/taskStore.test.js`

- [ ] **Step 1: Write failing test for start_date filtering**

```javascript
// In src/stores/__tests__/taskStore.test.js, add after existing tests
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '../taskStore.js'
import { initDb } from '../../db/init.js'

describe('taskStore with start_date', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await initDb()
  })

  it('activeFilter pending excludes future start_date', async () => {
    const store = useTaskStore()
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    await store.addTask({ title: 'Today', startDate: today })
    await store.addTask({ title: 'Tomorrow', startDate: tomorrow })
    store.activeFilter = 'pending'
    expect(store.filteredTasks.map(t => t.title)).toEqual(['Tomorrow'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/stores/__tests__/taskStore.test.js`
Expected: FAIL (startDate not supported, activeFilter not defined)

- [ ] **Step 3: Update initDb to add start_date column**

Modify `src/db/init.js`:

```javascript
export async function initDb() {
  const database = await getDb()
  await database.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      start_date TEXT,
      due_date TEXT,
      priority INTEGER DEFAULT 1,
      tag TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    )
  `)
  const cols = await database.select("PRAGMA table_info(tasks)")
  const hasStartDate = cols.some(c => c.name === 'start_date')
  if (!hasStartDate) {
    await database.execute('ALTER TABLE tasks ADD COLUMN start_date TEXT')
  }
  await database.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `)
}
```

- [ ] **Step 4: Update taskQueries for start_date**

Modify `src/db/taskQueries.js`:

```javascript
export async function selectAllTasks() {
  const db = await getDb()
  return db.select('SELECT * FROM tasks ORDER BY created_at DESC')
}

export async function insertTask({ title, startDate, dueDate, priority, tag }) {
  const db = await getDb()
  const result = await db.execute(
    'INSERT INTO tasks (title, start_date, due_date, priority, tag) VALUES (?, ?, ?, ?, ?)',
    [title, startDate ?? null, dueDate ?? null, priority ?? 1, tag ?? null]
  )
  return result.lastInsertId
}

export async function updateTask(id, { title, completed, startDate, dueDate, priority, tag, completedAt }) {
  const db = await getDb()
  await db.execute(
    `UPDATE tasks SET
      title = COALESCE(?, title),
      completed = COALESCE(?, completed),
      start_date = COALESCE(?, start_date),
      due_date = COALESCE(?, due_date),
      priority = COALESCE(?, priority),
      tag = COALESCE(?, tag),
      completed_at = COALESCE(?, completed_at)
     WHERE id = ?`,
    [title ?? null, completed ?? null, startDate ?? null, dueDate ?? null, priority ?? null, tag ?? null, completedAt ?? null, id]
  )
}
```

- [ ] **Step 5: Run test again**

Run: `npm run test:run -- src/stores/__tests__/taskStore.test.js`
Expected: still FAIL (taskStore not updated yet)

---

### Task 2: Update taskStore with activeFilter and floatTasks

**Files:**
- Modify: `src/stores/taskStore.js`
- Modify: `src/stores/__tests__/taskStore.test.js`
- Modify: `src/stores/__tests__/settingStore.test.js` (ensure no regression)

- [ ] **Step 1: Add tests for activeFilter and floatTasks**

In `src/stores/__tests__/taskStore.test.js`, append:

```javascript
  it('filters active tasks (no future start_date)', async () => {
    const store = useTaskStore()
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    await store.addTask({ title: 'Active', startDate: today })
    await store.addTask({ title: 'Future', startDate: tomorrow })
    await store.addTask({ title: 'NoStart' })
    store.activeFilter = 'active'
    expect(store.filteredTasks.map(t => t.title).sort()).toEqual(['Active', 'NoStart'])
  })

  it('floatTasks excludes completed and sorts by priority desc then created_at asc', async () => {
    const store = useTaskStore()
    await store.addTask({ title: 'Low', priority: 0 })
    await store.addTask({ title: 'High', priority: 2 })
    await store.addTask({ title: 'Mid', priority: 1 })
    const ids = store.tasks.map(t => t.id)
    await store.toggleComplete(ids[2])
    expect(store.floatTasks.map(t => t.title)).toEqual(['High', 'Low'])
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/stores/__tests__/taskStore.test.js`
Expected: FAIL (activeFilter / floatTasks missing)

- [ ] **Step 3: Implement taskStore changes**

Replace `src/stores/taskStore.js` with:

```javascript
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
    filteredTasks.value.filter((t) => !t.completed)
  )

  const completedTasks = computed(() =>
    filteredTasks.value.filter((t) => t.completed)
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/stores/__tests__/taskStore.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/init.js src/db/taskQueries.js src/stores/taskStore.js src/stores/__tests__/taskStore.test.js
git commit -m "feat(taskStore): add start_date, activeFilter and floatTasks"
```

---

### Task 3: TaskEditor add start_date field

**Files:**
- Modify: `src/components/TaskEditor.vue`

- [ ] **Step 1: Add start_date input and save it**

Replace `src/components/TaskEditor.vue` `<script setup>` with:

```javascript
import { ref, watch } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'

const props = defineProps({ open: Boolean, task: Object })
const emit = defineEmits(['close'])

const taskStore = useTaskStore()

const title = ref('')
const startDate = ref('')
const dueDate = ref('')
const priority = ref(1)
const tag = ref('')

watch(() => props.task, (t) => {
  if (t) {
    title.value = t.title
    startDate.value = t.start_date || ''
    dueDate.value = t.due_date || ''
    priority.value = t.priority
    tag.value = t.tag || ''
  } else {
    title.value = ''
    startDate.value = ''
    dueDate.value = ''
    priority.value = 1
    tag.value = ''
  }
}, { immediate: true })

async function save() {
  const payload = {
    title: title.value,
    startDate: startDate.value || undefined,
    dueDate: dueDate.value || undefined,
    priority: Number(priority.value),
    tag: tag.value || undefined,
  }
  try {
    if (props.task) {
      await taskStore.updateTaskById(props.task.id, payload)
    } else {
      await taskStore.addTask(payload)
    }
    emit('close')
  } catch (e) {
    console.error('Save task failed:', e)
    alert('保存失败：' + e.message)
  }
}

function onBackdrop(e) {
  if (e.target === e.currentTarget) emit('close')
}
```

- [ ] **Step 2: Add start date to template**

In the `<div class="form">`, insert before the due_date label:

```html
        <label>
          开始日期
          <input v-model="startDate" type="date" />
        </label>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TaskEditor.vue
git commit -m "feat(TaskEditor): add start_date field"
```

---

### Task 4: Sidebar switch to status filters

**Files:**
- Modify: `src/components/Sidebar.vue`

- [ ] **Step 1: Replace tag filters with status filters**

Replace `src/components/Sidebar.vue` with:

```vue
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
  border-radius: 8px;
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Sidebar.vue
git commit -m "feat(Sidebar): switch to active/pending/completed filters"
```

---

### Task 5: TaskList show filteredTasks directly

**Files:**
- Modify: `src/components/TaskList.vue`

- [ ] **Step 1: Simplify to single filteredTasks list**

Replace `src/components/TaskList.vue` with:

```vue
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TaskList.vue
git commit -m "refactor(TaskList): show filteredTasks directly"
```

---

### Task 6: Fix MainView openEditor reset bug

**Files:**
- Modify: `src/views/MainView.vue`

- [ ] **Step 1: Import nextTick and fix openEditor**

Replace the `<script setup>` block in `src/views/MainView.vue` with:

```javascript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/views/MainView.vue
git commit -m "fix(MainView): force reset TaskEditor on every open"
```

---

### Task 7: Rust float window transparency

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Enable window transparency in set_float_mode**

Modify `src-tauri/src/lib.rs`:

```rust
use tauri::{command, generate_context, generate_handler, Builder, WebviewWindow};

#[command]
fn set_float_mode(window: WebviewWindow) -> Result<(), String> {
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: 300.0,
            height: 400.0,
        }))
        .map_err(|e| e.to_string())?;
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    window.set_decorations(false).map_err(|e| e.to_string())?;
    window.set_transparent(true).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
fn set_main_mode(window: WebviewWindow) -> Result<(), String> {
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: 900.0,
            height: 600.0,
        }))
        .map_err(|e| e.to_string())?;
    window.set_always_on_top(false).map_err(|e| e.to_string())?;
    window.set_decorations(true).map_err(|e| e.to_string())?;
    window.set_transparent(false).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(generate_handler![set_float_mode, set_main_mode])
        .run(generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat(rust): enable window transparency for float mode"
```

---

### Task 8: Float view background opacity via CSS variable

**Files:**
- Modify: `src/views/FloatView.vue`
- Modify: `src/components/FloatControls.vue`

- [ ] **Step 1: Use CSS variable for background opacity**

Replace `src/views/FloatView.vue` `<script setup>` with:

```javascript
import { watch } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import FloatTaskList from '../components/FloatTaskList.vue'
import FloatControls from '../components/FloatControls.vue'
import { useSettingStore } from '../stores/settingStore.js'

const settingStore = useSettingStore()
const emit = defineEmits(['exitFloat'])

function applyBgOpacity(val) {
  const opacity = val / 100
  document.documentElement.style.setProperty('--float-bg-opacity', String(opacity))
}

watch(() => settingStore.floatAlwaysOnTop, async (val) => {
  await getCurrentWindow().setAlwaysOnTop(val)
}, { immediate: true })

watch(() => settingStore.floatOpacity, async (val) => {
  applyBgOpacity(val)
}, { immediate: true })
```

Replace `<style scoped>` with:

```css
.float-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: rgba(var(--bg-rgb, 255, 255, 255), var(--float-bg-opacity, 0.85));
  backdrop-filter: blur(8px);
}
.float-header {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
  app-region: drag;
}
```

- [ ] **Step 2: Update FloatControls label and emit behavior**

Modify `src/components/FloatControls.vue`:

In template, change the label span:
```html
<span class="label">背景透明度</span>
```

And remove the `@opacityChange` / `$emit` logic entirely — just keep:
```html
<input type="range" min="70" max="100" :value="settingStore.floatOpacity" @input="onOpacityChange" />
```

In script, change `onOpacityChange` to:

```javascript
function onOpacityChange(e) {
  const val = parseInt(e.target.value, 10)
  settingStore.setFloatOpacity(val)
  const opacity = val / 100
  document.documentElement.style.setProperty('--float-bg-opacity', String(opacity))
}
```

Also remove `const emit = defineEmits(['exitFloat', 'opacityChange'])` → keep only `const emit = defineEmits(['exitFloat'])`.

- [ ] **Step 3: Commit**

```bash
git add src/views/FloatView.vue src/components/FloatControls.vue
git commit -m "feat(float): CSS-based background opacity with blur"
```

---

### Task 9: FloatTaskList with checkbox, priority, and sorting

**Files:**
- Modify: `src/components/FloatTaskList.vue`

- [ ] **Step 1: Implement new float task list UI**

Replace `src/components/FloatTaskList.vue` with:

```vue
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
  border-radius: 8px;
  background: var(--surface);
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
  border-radius: 4px;
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
  font-size: 13px;
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
  font-size: 11px;
  color: var(--text-secondary);
}
.empty {
  text-align: center;
  padding: 24px 0;
  font-size: 13px;
  color: var(--text-tertiary);
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FloatTaskList.vue
git commit -m "feat(FloatTaskList): checkbox, priority badge, priority sorting"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run all unit tests**

Run: `npm run test:run`
Expected: all tests PASS (including existing tests)

- [ ] **Step 2: Build Rust backend**

Run: `cd src-tauri && cargo build -j 1`
Expected: SUCCESS with no errors

- [ ] **Step 3: Final commit if any remaining changes**

```bash
git add .
git commit -m "chore: finalize float and filter redesign"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] 左侧筛选进行中/未开始/已完成 → Task 2 (taskStore), Task 4 (Sidebar), Task 5 (TaskList)
- [x] 悬浮窗透明度（文字清晰） → Task 7 (Rust), Task 8 (CSS)
- [x] 悬浮窗任务可勾选完成并隐藏 → Task 9 (FloatTaskList) + Task 2 (floatTasks computed)
- [x] 新增任务标题每次清空 → Task 6 (MainView)
- [x] 悬浮窗展示优先级并高→低排序 → Task 2 (floatTasks computed), Task 9 (PriorityBadge)

**Placeholder scan:**
- None. All steps include exact code and commands.

**Type consistency:**
- `startDate` used uniformly across TaskEditor, taskQueries, taskStore test.
- `activeFilter` values `'active' | 'pending' | 'completed'` consistent everywhere.
- `setFloatOpacity` remains `number` 70–100.
