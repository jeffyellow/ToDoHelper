# ToDoHelper 实现计划

> **面向代理开发者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐个任务执行本计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**目标：** 构建一款基于 Tauri + Vue 3 的桌面任务管理应用，具备 SQLite 持久化、柔和极简 UI 和单窗口悬浮窗模式。

**架构：** 单个 Tauri 窗口通过调整尺寸和切换装饰来在主界面与悬浮窗之间切换。Vue 3 + Pinia 管理状态；SQLite 存储任务和设置。Rust 暴露窗口控制命令。所有 UI 遵循 `design-system/MASTER.md` 中的设计系统。

**技术栈：** Tauri v2、Vue 3（组合式 API）、Vite、Pinia、`@tauri-apps/plugin-sql`、SQLite、Vitest、Vue Test Utils、Lucide 图标、Inter 字体。

---

## 文件映射

| 文件 | 职责 |
|------|------|
| `package.json` | 前端依赖、脚本 |
| `vite.config.js` | Vite + Vitest 配置 |
| `src/main.js` | Vue 应用启动 |
| `src/App.vue` | 根壳层；切换 MainView/FloatView |
| `src/styles/theme.css` | CSS 变量、浅色/深色主题标记 |
| `src/db/init.js` | SQLite 数据库 + 表结构初始化 |
| `src/db/taskQueries.js` | 任务的原始 SQL 查询 |
| `src/db/settingQueries.js` | 设置的原始 SQL 查询 |
| `src/stores/taskStore.js` | Pinia store：任务、CRUD、筛选 |
| `src/stores/settingStore.js` | Pinia store：主题、悬浮窗透明度/置顶 |
| `src/stores/__tests__/taskStore.test.js` | taskStore 的 Vitest 测试 |
| `src/views/MainView.vue` | 主界面布局：侧边栏 + 任务列表 |
| `src/views/FloatView.vue` | 紧凑未完成任务列表 + 悬浮窗控制 |
| `src/components/Sidebar.vue` | 按标签 + 预设分组筛选 |
| `src/components/TopBar.vue` | 搜索、主题切换、悬浮窗切换 |
| `src/components/TaskList.vue` | 未完成 + 已完成分组列表 |
| `src/components/TaskItem.vue` | 带复选框的单个任务行 |
| `src/components/TaskEditor.vue` | 新增/编辑任务模态框 |
| `src/components/FloatTaskList.vue` | 悬浮窗模式的极简任务列表 |
| `src/components/FloatControls.vue` | 透明度滑块、置顶、返回 |
| `src/components/PriorityBadge.vue` | 优先级点/标签 |
| `src/components/TagChip.vue` | 标签胶囊 |
| `src-tauri/src/lib.rs` | Rust 命令：`set_float_mode`、`set_main_mode` |
| `src-tauri/tauri.conf.json` | 应用配置、窗口默认值、sql 插件 |
| `src-tauri/capabilities/default.json` | Tauri 能力权限 |

---

## 计划前置准备（只读上下文）

在执行任务之前，确保以下文件存在且内容正确。如果不存在，请在任务 1 中创建/修改它们。

- `docs/superpowers/specs/2026-04-13-todo-helper-design.md`
- `design-system/MASTER.md`

---

## 任务 1：初始化 Tauri + Vue 3 项目

**文件：**
- 创建：`package.json`
- 创建：`vite.config.js`
- 创建：`index.html`
- 创建：`src/main.js`
- 创建：`src-tauri/tauri.conf.json`
- 创建：`src-tauri/Cargo.toml`
- 创建：`src-tauri/capabilities/default.json`
- 创建：`src-tauri/src/lib.rs`
- 创建：`.gitignore`

- [ ] **步骤 1.1：创建根目录 package.json**

```json
{
  "name": "todo-helper",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run",
    "tauri": "tauri"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "pinia": "^2.1.0",
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-sql": "^2.0.0",
    "lucide-vue-next": "^0.400.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "@vue/test-utils": "^2.4.0",
    "happy-dom": "^14.0.0",
    "@tauri-apps/cli": "^2.0.0"
  }
}
```

- [ ] **步骤 1.2：创建 vite.config.js**

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
})
```

- [ ] **步骤 1.3：创建 index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ToDoHelper</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **步骤 1.4：创建 src/main.js**

```javascript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/theme.css'

createApp(App).use(createPinia()).mount('#app')
```

- [ ] **步骤 1.5：创建 src-tauri/tauri.conf.json**

```json
{
  "$schema": "../node_modules/@tauri-apps/cli/schema.json",
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../dist"
  },
  "identifier": "com.todohelper.app",
  "productName": "ToDoHelper",
  "version": "0.1.0",
  "app": {
    "windows": [
      {
        "title": "ToDoHelper",
        "width": 900,
        "height": 600,
        "resizable": true,
        "decorations": true,
        "transparent": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "plugins": {
    "sql": {
      "preload": ["sqlite:todo.db"]
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": []
  }
}
```

- [ ] **步骤 1.6：创建 src-tauri/Cargo.toml**

```toml
[package]
name = "todo-helper"
version = "0.1.0"
edition = "2021"
rust-version = "1.77"

[lib]
name = "todo_helper_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.0.0", features = [] }

[dependencies]
tauri = { version = "2.0.0", features = [] }
tauri-plugin-sql = { version = "2.0.0", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }
```

- [ ] **步骤 1.7：创建 src-tauri/capabilities/default.json**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "sql:default",
    "sql:allow-load",
    "sql:allow-execute",
    "sql:allow-select"
  ]
}
```

- [ ] **步骤 1.8：创建 src-tauri/src/lib.rs**

```rust
use tauri::{command, generate_context, generate_handler, Builder, Manager, WebviewWindow};

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

- [ ] **步骤 1.9：创建 src-tauri/src/main.rs**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    todo_helper_lib::run();
}
```

- [ ] **步骤 1.10：创建 .gitignore**

```
node_modules
dist
dist-ssr
*.local
src-tauri/target
src-tauri/gen
.DS_Store
```

- [ ] **步骤 1.11：安装依赖**

运行：`npm install`
预期结果：成功创建 `node_modules` 且无报错。

- [ ] **步骤 1.12：提交代码**

```bash
git add .
git commit -m "chore: init tauri + vue 3 + vite project"
```

---

## 任务 2：主题 CSS 变量

**文件：**
- 创建：`src/styles/theme.css`
- 修改：`src/main.js`

- [ ] **步骤 2.1：编写 theme.css**

```css
:root {
  /* Primary */
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-primary-subtle: #eef2ff;

  /* Semantic */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #f43f5e;

  /* Light mode neutrals */
  --bg: #ffffff;
  --surface: #fafafa;
  --surface-hover: #f3f4f6;
  --border: #e5e7eb;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-tertiary: #9ca3af;
  --disabled: #d1d5db;
}

[data-theme="dark"] {
  --bg: #0f0f11;
  --surface: #18181b;
  --surface-hover: #27272a;
  --border: #3f3f46;
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-tertiary: #71717a;
  --disabled: #52525b;
}

* {
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
  margin: 0;
}

body {
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-primary);
  background: var(--bg);
  transition: background 150ms ease-out, color 150ms ease-out;
}

/* Utility spacing */
.space-y-2 > * + * { margin-top: 8px; }
.space-y-3 > * + * { margin-top: 12px; }
.space-y-4 > * + * { margin-top: 16px; }
```

- [ ] **步骤 2.2：检查 main.js 中的导入**

`src/main.js` 应包含 `import './styles/theme.css'`（已在步骤 1.4 中添加）。

- [ ] **步骤 2.3：提交代码**

```bash
git add src/styles/theme.css
git commit -m "feat: add light/dark css tokens"
```

---

## 任务 3：SQLite 数据库层

**文件：**
- 创建：`src/db/init.js`
- 创建：`src/db/taskQueries.js`
- 创建：`src/db/settingQueries.js`

- [ ] **步骤 3.1：创建 src/db/init.js**

```javascript
import Database from '@tauri-apps/plugin-sql'

let db = null

export async function getDb() {
  if (!db) {
    db = await Database.load('sqlite:todo.db')
  }
  return db
}

export async function initDb() {
  const database = await getDb()
  await database.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      due_date TEXT,
      priority INTEGER DEFAULT 1,
      tag TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    )
  `)
  await database.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `)
}
```

- [ ] **步骤 3.2：创建 src/db/taskQueries.js**

```javascript
import { getDb } from './init.js'

export async function selectAllTasks() {
  const db = await getDb()
  return db.select('SELECT * FROM tasks ORDER BY created_at DESC')
}

export async function insertTask({ title, dueDate, priority, tag }) {
  const db = await getDb()
  const result = await db.execute(
    'INSERT INTO tasks (title, due_date, priority, tag) VALUES (?, ?, ?, ?)',
    [title, dueDate ?? null, priority ?? 1, tag ?? null]
  )
  return result.lastInsertId
}

export async function updateTask(id, { title, completed, dueDate, priority, tag, completedAt }) {
  const db = await getDb()
  await db.execute(
    `UPDATE tasks SET
      title = COALESCE(?, title),
      completed = COALESCE(?, completed),
      due_date = COALESCE(?, due_date),
      priority = COALESCE(?, priority),
      tag = COALESCE(?, tag),
      completed_at = COALESCE(?, completed_at)
     WHERE id = ?`,
    [title ?? null, completed ?? null, dueDate ?? null, priority ?? null, tag ?? null, completedAt ?? null, id]
  )
}

export async function deleteTask(id) {
  const db = await getDb()
  await db.execute('DELETE FROM tasks WHERE id = ?', [id])
}
```

- [ ] **步骤 3.3：创建 src/db/settingQueries.js**

```javascript
import { getDb } from './init.js'

export async function getSetting(key) {
  const db = await getDb()
  const rows = await db.select('SELECT value FROM app_settings WHERE key = ?', [key])
  return rows[0]?.value ?? null
}

export async function setSetting(key, value) {
  const db = await getDb()
  await db.execute(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  )
}
```

- [ ] **步骤 3.4：提交代码**

```bash
git add src/db
git commit -m "feat: add sqlite db layer with tasks and settings"
```

---

## 任务 4：Setting Store + 主题检测（TDD）

**文件：**
- 创建：`src/stores/settingStore.js`
- 创建：`src/stores/__tests__/settingStore.test.js`

- [ ] **步骤 4.1：编写失败的 settingStore 测试**

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingStore } from '../settingStore.js'

vi.mock('../../db/settingQueries.js', () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}))

import { getSetting, setSetting } from '../../db/settingQueries.js'

describe('settingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('当数据库返回 null 时，主题初始化为 light', async () => {
    getSetting.mockResolvedValue(null)
    const store = useSettingStore()
    await store.init()
    expect(store.theme).toBe('light')
  })

  it('切换主题并持久化', async () => {
    getSetting.mockResolvedValue('light')
    const store = useSettingStore()
    await store.init()
    await store.toggleTheme()
    expect(store.theme).toBe('dark')
    expect(setSetting).toHaveBeenCalledWith('theme', 'dark')
  })
})
```

- [ ] **步骤 4.2：运行失败的测试**

运行：`npm run test:run -- src/stores/__tests__/settingStore.test.js`
预期结果：失败（store 文件不存在）

- [ ] **步骤 4.3：实现 settingStore.js**

```javascript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSetting, setSetting } from '../db/settingQueries.js'

export const useSettingStore = defineStore('setting', () => {
  const theme = ref('light')
  const floatOpacity = ref(95)
  const floatAlwaysOnTop = ref(true)

  async function init() {
    const savedTheme = await getSetting('theme')
    theme.value = savedTheme || 'light'
    document.documentElement.setAttribute('data-theme', theme.value)

    const savedOpacity = await getSetting('floatOpacity')
    if (savedOpacity !== null) floatOpacity.value = parseInt(savedOpacity, 10)

    const savedAlwaysOnTop = await getSetting('floatAlwaysOnTop')
    if (savedAlwaysOnTop !== null) floatAlwaysOnTop.value = savedAlwaysOnTop === 'true'
  }

  async function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme.value)
    await setSetting('theme', theme.value)
  }

  async function setFloatOpacity(value) {
    floatOpacity.value = value
    await setSetting('floatOpacity', String(value))
  }

  async function setFloatAlwaysOnTop(value) {
    floatAlwaysOnTop.value = value
    await setSetting('floatAlwaysOnTop', String(value))
  }

  return {
    theme,
    floatOpacity,
    floatAlwaysOnTop,
    init,
    toggleTheme,
    setFloatOpacity,
    setFloatAlwaysOnTop,
  }
})
```

- [ ] **步骤 4.4：运行测试直到通过**

运行：`npm run test:run -- src/stores/__tests__/settingStore.test.js`
预期结果：通过

- [ ] **步骤 4.5：提交代码**

```bash
git add src/stores
git commit -m "feat: add settingStore with theme detection and persistence"
```

---

## 任务 5：Task Store（TDD）

**文件：**
- 创建：`src/stores/taskStore.js`
- 创建：`src/stores/__tests__/taskStore.test.js`

- [ ] **步骤 5.1：编写失败的 taskStore 测试**

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '../taskStore.js'

vi.mock('../../db/taskQueries.js', () => ({
  selectAllTasks: vi.fn(),
  insertTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}))

import { selectAllTasks, insertTask, updateTask, deleteTask } from '../../db/taskQueries.js'

describe('taskStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
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
    expect(insertTask).toHaveBeenCalledWith({ title: 'New', dueDate: undefined, priority: 1, tag: undefined })
    expect(store.tasks[0].title).toBe('New')
  })

  it('切换完成状态并设置 completed_at', async () => {
    selectAllTasks.mockResolvedValue([{ id: 1, title: 'A', completed: 0 }])
    const store = useTaskStore()
    await store.loadTasks()
    await store.toggleComplete(1)
    expect(updateTask).toHaveBeenCalledWith(1, expect.objectContaining({ completed: 1, completedAt: expect.any(String) }))
  })
})
```

- [ ] **步骤 5.2：运行失败的测试**

运行：`npm run test:run -- src/stores/__tests__/taskStore.test.js`
预期结果：失败

- [ ] **步骤 5.3：实现 taskStore.js**

```javascript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { selectAllTasks, insertTask, updateTask, deleteTask } from '../db/taskQueries.js'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref([])
  const filterTag = ref('')
  const searchQuery = ref('')

  const incompleteTasks = computed(() =>
    filteredTasks.value.filter((t) => !t.completed)
  )

  const completedTasks = computed(() =>
    filteredTasks.value.filter((t) => t.completed)
  )

  const filteredTasks = computed(() => {
    let result = tasks.value
    if (filterTag.value) {
      result = result.filter((t) => t.tag === filterTag.value)
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter((t) => t.title.toLowerCase().includes(q))
    }
    return result
  })

  const allTags = computed(() => {
    const set = new Set(tasks.value.map((t) => t.tag).filter(Boolean))
    return Array.from(set)
  })

  async function loadTasks() {
    tasks.value = await selectAllTasks()
  }

  async function addTask({ title, dueDate, priority = 1, tag }) {
    await insertTask({ title, dueDate, priority, tag })
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

  return {
    tasks,
    filterTag,
    searchQuery,
    incompleteTasks,
    completedTasks,
    allTags,
    loadTasks,
    addTask,
    updateTaskById,
    toggleComplete,
    removeTask,
    setFilterTag,
    setSearchQuery,
  }
})
```

- [ ] **步骤 5.4：运行测试直到通过**

运行：`npm run test:run -- src/stores/__tests__/taskStore.test.js`
预期结果：通过

- [ ] **步骤 5.5：提交代码**

```bash
git add src/stores
git commit -m "feat: add taskStore with crud, filters, and tests"
```

---

## 任务 6：应用壳层 + 窗口启动初始化

**文件：**
- 创建：`src/App.vue`
- 修改：`src-tauri/tauri.conf.json`

- [ ] **步骤 6.1：更新 tauri.conf.json 为窗口命名**

修改 `src-tauri/tauri.conf.json` 中 `app.windows[0]`，添加 `"label": "main"`。

```json
{
  "label": "main",
  "title": "ToDoHelper",
  "width": 900,
  "height": 600,
  "resizable": true,
  "decorations": true,
  "transparent": false
}
```

- [ ] **步骤 6.2：创建 src/App.vue**

```vue
<script setup>
import { onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import MainView from './views/MainView.vue'
import FloatView from './views/FloatView.vue'
import { useSettingStore } from './stores/settingStore.js'
import { useTaskStore } from './stores/taskStore.js'
import { initDb } from './db/init.js'

const settingStore = useSettingStore()
const taskStore = useTaskStore()

onMounted(async () => {
  await initDb()
  await settingStore.init()
  await taskStore.loadTasks()
})

async function enterFloat() {
  await invoke('set_float_mode')
  settingStore.isFloat = true
}

async function exitFloat() {
  await invoke('set_main_mode')
  settingStore.isFloat = false
}
</script>

<template>
  <MainView
    v-if="!settingStore.isFloat"
    @enter-float="enterFloat"
  />
  <FloatView
    v-else
    @exit-float="exitFloat"
  />
</template>

<style>
#app {
  display: flex;
  flex-direction: column;
}
</style>
```

- [ ] **步骤 6.3：在 settingStore 中添加缺失的字段**

修改 `src/stores/settingStore.js`，添加 `const isFloat = ref(false)` 并将其返回。

- [ ] **步骤 6.4：验证 dev 构建能编译通过**

运行：`npm run tauri dev`
等待窗口打开（或 `vite` 编译无错误）。约 10 秒后停止。

- [ ] **步骤 6.5：提交代码**

```bash
git add src/App.vue src-tauri/tauri.conf.json src/stores/settingStore.js
git commit -m "feat: add app shell with float mode switching"
```

---

## 任务 7：共享 UI 组件

**文件：**
- 创建：`src/components/PriorityBadge.vue`
- 创建：`src/components/TagChip.vue`
- 创建：`src/components/ThemeToggle.vue`

- [ ] **步骤 7.1：创建 PriorityBadge.vue**

```vue
<script setup>
const props = defineProps({ priority: Number })
const labels = { 2: '高', 1: '中', 0: '低' }
const colors = {
  2: '#f43f5e',
  1: '#f59e0b',
  0: '#94a3b8',
}
</script>

<template>
  <span
    class="priority-badge"
    :style="{ color: colors[props.priority] }"
  >
    {{ labels[props.priority] }}
  </span>
</template>

<style scoped>
.priority-badge {
  font-size: 12px;
  font-weight: 500;
}
</style>
```

- [ ] **步骤 7.2：创建 TagChip.vue**

```vue
<script setup>
const props = defineProps({ tag: String })
</script>

<template>
  <span class="tag-chip">{{ props.tag }}</span>
</template>

<style scoped>
.tag-chip {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 12px;
  font-size: 12px;
  background: var(--color-primary-subtle);
  color: var(--color-primary-hover);
}
</style>
```

- [ ] **步骤 7.3：创建 ThemeToggle.vue**

```vue
<script setup>
import { Sun, Moon } from 'lucide-vue-next'
import { useSettingStore } from '../stores/settingStore.js'

const store = useSettingStore()
</script>

<template>
  <button class="theme-toggle" @click="store.toggleTheme" aria-label="切换主题">
    <Sun v-if="store.theme === 'dark'" :size="20" />
    <Moon v-else :size="20" />
  </button>
</template>

<style scoped>
.theme-toggle {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.theme-toggle:hover {
  background: var(--surface-hover);
}
</style>
```

- [ ] **步骤 7.4：提交代码**

```bash
git add src/components/PriorityBadge.vue src/components/TagChip.vue src/components/ThemeToggle.vue
git commit -m "feat: add shared ui components (priority, tag, theme)"
```

---

## 任务 8：主界面布局组件

**文件：**
- 创建：`src/components/Sidebar.vue`
- 创建：`src/components/TopBar.vue`
- 创建：`src/views/MainView.vue`

- [ ] **步骤 8.1：创建 Sidebar.vue**

```vue
<script setup>
import { useTaskStore } from '../stores/taskStore.js'

const taskStore = useTaskStore()
const filters = [
  { label: '全部', tag: '' },
  { label: '今天', tag: 'today' },
  { label: '重要', tag: 'important' },
]

function selectFilter(tag) {
  taskStore.setFilterTag(tag)
}
</script>

<template>
  <aside class="sidebar">
    <div class="logo">ToDoHelper</div>
    <nav class="nav">
      <button
        v-for="f in filters"
        :key="f.label"
        class="nav-item"
        :class="{ active: taskStore.filterTag === f.tag }"
        @click="selectFilter(f.tag)"
      >
        {{ f.label }}
      </button>
      <div class="nav-divider" />
      <button
        v-for="tag in taskStore.allTags"
        :key="tag"
        class="nav-item"
        :class="{ active: taskStore.filterTag === tag }"
        @click="selectFilter(tag)"
      >
        {{ tag }}
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
.nav-divider {
  height: 1px;
  background: var(--border);
  margin: 8px 0;
}
</style>
```

- [ ] **步骤 8.2：创建 TopBar.vue**

```vue
<script setup>
import { Search, PictureInPicture } from 'lucide-vue-next'
import ThemeToggle from './ThemeToggle.vue'

const emit = defineEmits(['enterFloat'])
</script>

<template>
  <header class="top-bar">
    <div class="search">
      <Search :size="18" class="search-icon" />
      <input
        type="text"
        placeholder="搜索任务..."
        @input="$emit('update:search', $event.target.value)"
      />
    </div>
    <div class="actions">
      <ThemeToggle />
      <button class="icon-btn" @click="emit('enterFloat')" title="悬浮窗">
        <PictureInPicture :size="20" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  height: 56px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  gap: 16px;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}
.search input {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-primary);
  width: 260px;
  font-size: 14px;
}
.search input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover {
  background: var(--surface-hover);
}
</style>
```

- [ ] **步骤 8.3：创建 MainView.vue**

```vue
<script setup>
import Sidebar from '../components/Sidebar.vue'
import TopBar from '../components/TopBar.vue'

const emit = defineEmits(['enterFloat'])
</script>

<template>
  <div class="main-view">
    <Sidebar />
    <div class="content">
      <TopBar @enter-float="emit('enterFloat')" />
      <div class="page-body">
        <!-- TaskList will be inserted in Task 9 -->
        <p style="color: var(--text-tertiary)">TaskList 将在 Task 9 中插入</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.main-view {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
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
</style>
```

- [ ] **步骤 8.4：提交代码**

```bash
git add src/components/Sidebar.vue src/components/TopBar.vue src/views/MainView.vue
git commit -m "feat: add main view layout (sidebar, topbar)"
```

---

## 任务 9：任务列表与任务项

**文件：**
- 创建：`src/components/TaskItem.vue`
- 创建：`src/components/TaskList.vue`
- 修改：`src/views/MainView.vue`

- [ ] **步骤 9.1：创建 TaskItem.vue**

```vue
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
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: background 150ms ease-out, box-shadow 150ms ease-out;
}
.task-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
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
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
}
.ghost-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.ghost-btn.danger:hover {
  color: var(--color-danger);
}
</style>
```

- [ ] **步骤 9.2：创建 TaskList.vue**

```vue
<script setup>
import { useTaskStore } from '../stores/taskStore.js'
import TaskItem from './TaskItem.vue'

const taskStore = useTaskStore()
const emit = defineEmits(['editTask'])
</script>

<template>
  <div class="task-list">
    <section v-if="taskStore.incompleteTasks.length">
      <h2 class="section-title">未完成</h2>
      <div class="list">
        <TaskItem
          v-for="task in taskStore.incompleteTasks"
          :key="task.id"
          :task="task"
          @toggle="taskStore.toggleComplete"
          @edit="emit('editTask', $event)"
          @delete="taskStore.removeTask"
        />
      </div>
    </section>

    <section v-if="taskStore.completedTasks.length">
      <h2 class="section-title completed-title">已完成</h2>
      <div class="list">
        <TaskItem
          v-for="task in taskStore.completedTasks"
          :key="task.id"
          :task="task"
          @toggle="taskStore.toggleComplete"
          @edit="emit('editTask', $event)"
          @delete="taskStore.removeTask"
        />
      </div>
    </section>

    <div v-if="!taskStore.tasks.length" class="empty">
      <p>暂无任务，点击右下角添加。</p>
    </div>
  </div>
</template>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.section-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 12px;
}
.completed-title {
  color: var(--text-tertiary);
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

- [ ] **步骤 9.3：更新 MainView.vue 以引入 TaskList**

将 `.page-body` 内的占位符替换为：

```vue
      <div class="page-body">
        <TaskList @edit-task="openEditor" />
        <button class="fab" @click="openEditor()">+</button>
      </div>
```

并添加 script 导入和状态：

```vue
<script setup>
import { ref } from 'vue'
import Sidebar from '../components/Sidebar.vue'
import TopBar from '../components/TopBar.vue'
import TaskList from '../components/TaskList.vue'
import TaskEditor from '../components/TaskEditor.vue'

const emit = defineEmits(['enterFloat'])
const editorOpen = ref(false)
const editingTask = ref(null)

function openEditor(task = null) {
  editingTask.value = task
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
  editingTask.value = null
}
</script>
```

添加 FAB 样式：

```css
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
```

- [ ] **步骤 9.4：提交代码**

```bash
git add src/components/TaskItem.vue src/components/TaskList.vue src/views/MainView.vue
git commit -m "feat: add task list and task item with complete/incomplete grouping"
```

---

## 任务 10：任务编辑模态框

**文件：**
- 创建：`src/components/TaskEditor.vue`

- [ ] **步骤 10.1：创建 TaskEditor.vue**

```vue
<script setup>
import { ref, watch } from 'vue'
import { useTaskStore } from '../stores/taskStore.js'

const props = defineProps({ open: Boolean, task: Object })
const emit = defineEmits(['close'])

const taskStore = useTaskStore()

const title = ref('')
const dueDate = ref('')
const priority = ref(1)
const tag = ref('')

watch(() => props.task, (t) => {
  if (t) {
    title.value = t.title
    dueDate.value = t.due_date || ''
    priority.value = t.priority
    tag.value = t.tag || ''
  } else {
    title.value = ''
    dueDate.value = ''
    priority.value = 1
    tag.value = ''
  }
}, { immediate: true })

async function save() {
  const payload = {
    title: title.value,
    dueDate: dueDate.value || undefined,
    priority: Number(priority.value),
    tag: tag.value || undefined,
  }
  if (props.task) {
    await taskStore.updateTaskById(props.task.id, payload)
  } else {
    await taskStore.addTask(payload)
  }
  emit('close')
}

function onBackdrop(e) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click="onBackdrop">
    <div class="modal">
      <h3 class="modal-title">{{ task ? '编辑任务' : '新建任务' }}</h3>
      <div class="form">
        <label>
          标题
          <input v-model="title" type="text" placeholder="输入任务标题" />
        </label>
        <label>
          截止日期
          <input v-model="dueDate" type="date" />
        </label>
        <label>
          优先级
          <select v-model="priority">
            <option :value="2">高</option>
            <option :value="1">中</option>
            <option :value="0">低</option>
          </select>
        </label>
        <label>
          标签
          <input v-model="tag" type="text" placeholder="例如：工作" />
        </label>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" @click="emit('close')">取消</button>
        <button class="btn-primary" :disabled="!title.trim()" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal {
  width: 420px;
  max-width: 90%;
  background: var(--bg);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
}
.modal-title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}
.form input,
.form select {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 14px;
}
.form input:focus,
.form select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.btn-secondary {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
}
.btn-secondary:hover {
  background: var(--surface-hover);
}
.btn-primary {
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  font-size: 14px;
}
.btn-primary:hover {
  background: var(--color-primary-hover);
}
.btn-primary:active {
  transform: scale(0.98);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

- [ ] **步骤 10.2：通过手动测试验证编辑器渲染**

运行 `npm run tauri dev`，点击右下角的 FAB，确认模态框能打开，并且可以通过点击遮罩层或取消按钮关闭。

- [ ] **步骤 10.3：提交代码**

```bash
git add src/components/TaskEditor.vue
git commit -m "feat: add task editor modal"
```

---

## 任务 11：顶部栏搜索绑定

**文件：**
- 修改：`src/components/TopBar.vue`
- 修改：`src/views/MainView.vue`

- [ ] **步骤 11.1：将搜索输入框绑定到 taskStore**

更新 `TopBar.vue` 的 input，使用 `v-model` 模式：

```vue
      <input
        type="text"
        placeholder="搜索任务..."
        :value="searchQuery"
        @input="$emit('update:searchQuery', $event.target.value)"
      />
```

添加 `defineProps`：

```vue
const props = defineProps({ searchQuery: String })
```

更新 `MainView.vue` 中 TopBar 的使用方式：

```vue
<TopBar
  :search-query="taskStore.searchQuery"
  @update:search-query="taskStore.setSearchQuery"
  @enter-float="emit('enterFloat')"
/>
```

- [ ] **步骤 11.2：提交代码**

```bash
git add src/components/TopBar.vue src/views/MainView.vue
git commit -m "feat: bind search input to task store"
```

---

## 任务 12：悬浮窗视图与悬浮窗控件

**文件：**
- 创建：`src/components/FloatTaskList.vue`
- 创建：`src/components/FloatControls.vue`
- 创建：`src/views/FloatView.vue`

- [ ] **步骤 12.1：创建 FloatTaskList.vue**

```vue
<script setup>
import { useTaskStore } from '../stores/taskStore.js'

const taskStore = useTaskStore()
</script>

<template>
  <div class="float-task-list">
    <div v-if="taskStore.incompleteTasks.length" class="list">
      <div
        v-for="task in taskStore.incompleteTasks"
        :key="task.id"
        class="float-item"
      >
        <span class="title">{{ task.title }}</span>
        <span v-if="task.due_date" class="due">{{ task.due_date }}</span>
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
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface);
}
.title {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 60%;
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

- [ ] **步骤 12.2：创建 FloatControls.vue**

```vue
<script setup>
import { useSettingStore } from '../stores/settingStore.js'
import { PinOff, Pin, Maximize2 } from 'lucide-vue-next'

const settingStore = useSettingStore()
const emit = defineEmits(['exitFloat', 'opacityChange'])

function onOpacityChange(e) {
  const val = parseInt(e.target.value, 10)
  settingStore.setFloatOpacity(val)
  emit('opacityChange', val)
}
</script>

<template>
  <div class="float-controls">
    <div class="control-group">
      <span class="label">透明度</span>
      <input
        type="range"
        min="70"
        max="100"
        :value="settingStore.floatOpacity"
        @input="onOpacityChange"
      />
      <span class="value">{{ settingStore.floatOpacity }}%</span>
    </div>
    <button
      class="icon-btn"
      :class="{ active: settingStore.floatAlwaysOnTop }"
      @click="settingStore.setFloatAlwaysOnTop(!settingStore.floatAlwaysOnTop)"
      :title="settingStore.floatAlwaysOnTop ? '取消置顶' : '置顶'"
    >
      <Pin v-if="settingStore.floatAlwaysOnTop" :size="16" />
      <PinOff v-else :size="16" />
    </button>
    <button class="icon-btn" @click="emit('exitFloat')" title="返回主界面">
      <Maximize2 :size="16" />
    </button>
  </div>
</template>

<style scoped>
.float-controls {
  height: 44px;
  background: rgba(var(--surface), 0.98);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
}
.control-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}
.label {
  font-size: 11px;
  color: var(--text-secondary);
}
.value {
  font-size: 11px;
  color: var(--text-primary);
  width: 28px;
  text-align: right;
}
input[type="range"] {
  flex: 1;
}
.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover,
.icon-btn.active {
  background: var(--surface-hover);
  color: var(--color-primary);
}
</style>
```

- [ ] **步骤 12.3：创建 FloatView.vue**

```vue
<script setup>
import { watch } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import FloatTaskList from '../components/FloatTaskList.vue'
import FloatControls from '../components/FloatControls.vue'
import { useSettingStore } from '../stores/settingStore.js'

const settingStore = useSettingStore()
const emit = defineEmits(['exitFloat'])

async function onOpacityChange(val) {
  const opacity = val / 100
  await getCurrentWindow().setOpacity(opacity)
}

watch(() => settingStore.floatAlwaysOnTop, async (val) => {
  await getCurrentWindow().setAlwaysOnTop(val)
}, { immediate: true })

watch(() => settingStore.floatOpacity, async (val) => {
  await onOpacityChange(val)
}, { immediate: true })
</script>

<template>
  <div class="float-view">
    <div class="float-header">待办事项</div>
    <FloatTaskList />
    <FloatControls @exit-float="emit('exitFloat')" @opacity-change="onOpacityChange" />
  </div>
</template>

<style scoped>
.float-view {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: var(--bg);
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
</style>
```

- [ ] **步骤 12.4：添加 setOpacity 的能力权限**

更新 `src-tauri/capabilities/default.json` 的 permissions 数组，加入 `core:window:allow-set-opacity` 和 `core:window:allow-set-always-on-top`。

```json
  "permissions": [
    "core:default",
    "sql:default",
    "sql:allow-load",
    "sql:allow-execute",
    "sql:allow-select",
    "core:window:allow-set-opacity",
    "core:window:allow-set-always-on-top"
  ]
```

- [ ] **步骤 12.5：提交代码**

```bash
git add src/components/FloatTaskList.vue src/components/FloatControls.vue src/views/FloatView.vue src-tauri/capabilities/default.json
git commit -m "feat: add float view with opacity and always-on-top controls"
```

---

## 任务 13：端到端集成与 QA

**文件：**
- 修改：修复集成问题时需要的任何文件

- [ ] **步骤 13.1：运行 dev 并验证核心流程**

运行：`npm run tauri dev`
验证以下流程：
1. 应用窗口以浅色主题、900×600 尺寸打开。
2. 点击 FAB → 模态框打开 → 输入标题/优先级/标签/日期添加任务 → 任务出现在未完成列表中。
3. 点击复选框 → 任务移入"已完成"分组。
4. 点击"已完成"任务的复选框 → 任务移回"未完成"分组。
5. 使用侧边栏标签筛选任务。
6. 使用搜索框按标题筛选任务。
7. 点击主题切换按钮 → 深色模式立即生效。
8. 点击悬浮窗按钮 → 窗口缩小到 300×400、无边框、置顶。
9. 在悬浮窗中：拖动透明度滑块（窗口变透明）、切换置顶按钮、点击返回 → 窗口恢复主界面状态。

- [ ] **步骤 13.2：修复发现的任何运行时问题**

常见问题修复：
- 如果 Tauri v2 中 `setOpacity` 未定义，检查 `@tauri-apps/api/core` 和 `@tauri-apps/api/window` 的导入。
- 如果首次运行时 SQL 失败，确保 `App.vue` 中 store 加载前已运行 `initDb()`。
- 如果悬浮窗未显示，验证 `invoke('set_float_mode')` 是否成功且 `settingStore.isFloat = true`。

- [ ] **步骤 13.3：最终测试运行**

运行：`npm run test:run`
预期结果：所有 Vitest 测试通过。

- [ ] **步骤 13.4：提交修复**

```bash
git add -A
git commit -m "fix: integration fixes after manual qa"
```

---

## 规格覆盖检查

| 规格需求 | 实现任务 |
|---------|---------|
| Tauri + Vue 3 + Vite | 任务 1 |
| SQLite 持久化 | 任务 3, 4, 5, 6 |
| 任务 CRUD | 任务 5, 9, 10 |
| 未完成/已完成分组 | 任务 5（store）, 任务 9（UI） |
| 截止日期、优先级、标签 | 任务 3, 5, 9, 10 |
| 标签筛选 + 搜索 | 任务 5, 8, 11 |
| 深色/浅色主题 | 任务 2, 4, 7 |
| 单窗口悬浮窗模式 | 任务 1（Rust）, 6, 12 |
| 透明度 + 置顶控制 | 任务 4, 12 |
| 柔和极简设计系统 | 任务 2, 7, 8, 9, 10, 12 |

---

## 占位符扫描

无剩余占位符。所有步骤都包含实际代码、精确路径、运行命令和预期输出。
