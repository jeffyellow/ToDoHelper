# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在此代码库中工作提供指导。

## 项目概览

ToDoHelper 是一款桌面端任务管理应用，前端采用 **Vue 3 + Vite**，桌面壳层采用 **Tauri v2（Rust）**。本地数据持久化使用 **SQLite**（通过 `tauri-plugin-sql`），状态管理使用 **Pinia**。

应用包含两种窗口模式：
- **主模式**（`MainView`）：标准可调整大小窗口（900×600），用于完整的任务管理。
- **悬浮模式**（`FloatView`）：紧凑的置顶悬浮窗口（300×400），仅显示未完成任务。

模式切换由 Rust 命令（`set_float_mode` / `set_main_mode`）处理，通过调整 Tauri 窗口的大小和装饰来实现。

## 常用命令

### 前端开发
- `npm run dev` — 启动 Vite 开发服务器，端口为 1420。
- `npm run build` — 构建前端产物到 `dist/` 目录。
- `npm run preview` — 预览生产构建。

### 测试
- `npm run test` — 以 watch 模式运行 Vitest。
- `npm run test:run` — 单次运行 Vitest 并退出。
- 运行单个测试文件：`npm run test -- src/stores/__tests__/taskStore.test.js`

### Tauri 桌面端
- `npm run tauri dev` — 以开发模式启动 Tauri 应用。
- `npm run tauri build` — 构建发布版可执行文件。

## 架构说明

### 前端（`src/`）
- **`main.js`** — 初始化 Vue 应用，安装 Pinia，并导入全局样式（`styles/theme.css`）。
- **`App.vue`** — 根组件。挂载时初始化数据库、设置 store 和任务 store。根据 `settingStore.isFloat` 的值条件渲染 `MainView` 或 `FloatView`。
- **视图（`src/views/`）**
  - `MainView.vue` — 完整 UI，包含侧边栏、顶部栏、任务列表，以及打开 `TaskEditor` 的悬浮操作按钮。
  - `FloatView.vue` — 紧凑的透明视图，带有可拖拽的标题栏（`-webkit-app-region: drag`）和底部控制区。
- **组件（`src/components/`）**
  - `TaskEditor.vue` — 用于新建/编辑任务的模态框。
  - `TaskList.vue` / `TaskItem.vue` — 主视图中的任务渲染。
  - `FloatTaskList.vue` / `FloatControls.vue` — 悬浮视图中的任务渲染和控制。
  - `Sidebar.vue`、`TopBar.vue`、`ThemeToggle.vue`、`PriorityBadge.vue`、`TagChip.vue` — 布局和 UI 基础组件。
- **状态（`src/stores/`）**
  - `taskStore.js` — 保存所有任务、过滤器（活跃/待处理/已完成、标签、搜索）以及 CRUD 操作。每次变更后从数据库重新加载完整任务列表。
  - `settingStore.js` — 保存主题、悬浮窗透明度、置顶状态以及当前视图模式。将设置持久化到 `app_settings` 表中。
- **数据层（`src/db/`）**
  - `init.js` — 通过 `tauri-plugin-sql` 打开 `sqlite:todo.db`，并确保 `tasks` 和 `app_settings` 表存在。
  - `taskQueries.js` — 任务 CRUD 的原始 SQL 封装。
  - `settingQueries.js` — 键值对设置的原始 SQL 封装。
- **样式（`src/styles/theme.css`）** — 浅色/深色主题的 CSS 自定义属性，以及少量间距工具类。

### 后端（`src-tauri/`）
- **`src/main.rs`** — 入口文件，调用库模块。
- **`src/lib.rs`** — 定义两个 Tauri 命令：
  - `set_float_mode` — 缩小窗口、启用置顶、移除窗口装饰。
  - `set_main_mode` — 恢复窗口大小、取消置顶、恢复窗口装饰。
  - 同时注册 `tauri_plugin_sql`，使前端可以访问 SQLite。
- **`tauri.conf.json`** — Tauri v2 配置。前端开发 URL 为 `http://localhost:1420`，构建产物目录为 `../dist`。`sql` 插件预加载 `sqlite:todo.db`。
- **`Cargo.toml`** — 依赖 `tauri = "2.0.0"` 和 `tauri-plugin-sql`（启用 `sqlite` 特性）。

### 数据库结构
SQLite 数据库 `todo.db` 包含两个表：
- `tasks(id, title, completed, start_date, due_date, priority, tag, created_at, completed_at)`
- `app_settings(key PRIMARY KEY, value)`

## 测试方式

- 测试文件与所测代码相邻存放（例如 `src/stores/__tests__/taskStore.test.js`）。
- 测试环境为 `happy-dom`，并启用 Vitest 全局模式。
- Store 测试中通过 mock DB 查询模块（`vi.mock('../../db/taskQueries.js', ...)`）实现无需真实数据库即可运行测试。

## 设计系统

项目级的设计规范、配色方案、排版、间距和组件规则记录在 `design-system/MASTER.md` 中。进行 UI 改动时，请对照该文档核对 token 值、动画规则和悬浮视图的限制条件。
