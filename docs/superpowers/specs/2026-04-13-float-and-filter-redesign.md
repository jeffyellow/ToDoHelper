# Float View & Filter Redesign

## Date
2026-04-13

## Overview
修复 ToDoHelper 现存 5 个体验问题：
1. 左侧筛选过于简单，需要按“进行中 / 未开始 / 已完成”区分。
2. 悬浮窗透明度设置不生效。
3. 悬浮窗任务无法勾选完成，且完成后应自动隐藏。
4. 连续点击“+”新建任务时，标题输入框没有清空上次内容。
5. 悬浮窗需要展示任务优先级，并按优先级高→低排列。

## 1. Data Model Changes

### New Column
- `tasks.start_date TEXT` — 任务计划开始日期（ISO 日期，如 `2026-04-15`）。
- `initDb()` 通过 pragma table_info 检测 `start_date` 列是否存在，不存在时执行 `ALTER TABLE tasks ADD COLUMN start_date TEXT` 升级已有数据库。

### Task Editor Changes
- 在“截止日期”上方新增“开始日期”字段（`type="date"`）。
- 新建/编辑时都可修改该字段。

## 2. Main View Filters

Sidebar 筛选项替换为：

| 标签   | 规则（completed = 0 ）                                           |
|--------|------------------------------------------------------------------|
| 进行中 | `completed = 0` 且 (`start_date IS NULL` 或 `start_date <= 今天`) |
| 未开始 | `completed = 0` 且 `start_date > 今天`                            |
| 已完成 | `completed = 1`                                                   |

- 新增 `taskStore.activeFilter`（`'active' | 'pending' | 'completed'`）。
- `filteredTasks` computed 中先按 `activeFilter` 过滤，再叠加 `filterTag` 与 `searchQuery`。
- `TaskList` 不再按 `incompleteTasks / completedTasks` 分两段展示，而是直接展示 `filteredTasks`（因为 Sidebar 已经按状态分好了）。

## 3. Float View Transparency (B)

- **Rust 后端**：`set_float_mode` 中在移除原生标题栏后，启用窗口透明属性（Tauri 2 `WebviewWindow::set_transparent(true)`）。
- **前端**：`FloatView.vue` 根容器背景使用半透明 CSS：
  ```css
  background: rgba(var(--bg-rgb), var(--float-bg-opacity, 0.85));
  backdrop-filter: blur(8px);
  ```
- **控件**：`FloatControls.vue` 的滑块从“整体透明度”改为“背景透明度”（70%–100%）。拖动时修改 CSS 变量 `--float-bg-opacity`，只影响背景层，不影响文字和控件。

## 4. Float Task List UX

`FloatTaskList.vue` 改动：
- **展示范围**：仅展示“进行中”与“未开始”任务，已完成的不在悬浮窗显示。
- **排序**：`priority DESC, created_at ASC`（高优先级在前，同优先级按创建时间从早到晚）。
- **交互**：每条任务左侧放 mini checkbox，点击后调用 `taskStore.toggleComplete(id)`，toggle 为完成后自动从列表消失。
- **信息展示**：任务右侧显示 `PriorityBadge`（高/中/低）+ 截止日期。

## 5. Task Editor Reset

问题根因：`MainView.openEditor()` 连续调用时 `task` 参数两次都是 `null`，`TaskEditor` 的 `watch(() => props.task, ...)` 检测不到变化，因此不进行清空。

修复方式：
- `MainView.vue` 中 `openEditor(task = null)` 改为：
  ```js
  function openEditor(task = null) {
    editingTask.value = null        // 强制触发 watch
    editorOpen.value = false        // 先关闭再打开，确保组件重渲染
    nextTick(() => {
      editingTask.value = task
      editorOpen.value = true
    })
  }
  ```

## Files to Change
- `src/db/init.js`
- `src/db/taskQueries.js`
- `src/stores/taskStore.js`
- `src/components/TaskEditor.vue`
- `src/components/Sidebar.vue`
- `src/components/TaskList.vue`
- `src/views/MainView.vue`
- `src/views/FloatView.vue`
- `src/components/FloatTaskList.vue`
- `src/components/FloatControls.vue`
- `src-tauri/src/lib.rs`
