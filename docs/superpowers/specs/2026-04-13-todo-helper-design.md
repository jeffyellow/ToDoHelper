# ToDoHelper 桌面应用设计文档

## 项目定位

一款个人任务管理桌面应用，采用 Tauri + Vue 3 构建，主打轻量、本地优先、视觉优雅。

## UI 与视觉设计

完整的视觉规范见 `design-system/MASTER.md`，核心要点如下：

- **风格：** Soft Minimalism（柔和极简）—— 圆角、呼吸感、低饱和度配色
- **主色调：** Indigo 500 `#6366f1` 作为品牌色，Emerald 500 表示完成，Rose 500 表示高优先级/危险
- **字体：** Inter 为主，JetBrains Mono 用于悬浮窗日期
- **图标：** Lucide（1.5px 线宽），禁止使用 emoji
- **圆角体系：** 卡片 12px、按钮 8px、输入框 6px、模态框 16px
- **动画：** 150–250ms，仅动画 `transform` 和 `opacity`，支持 `prefers-reduced-motion`
- **深浅模式：** 完整双主题，系统偏好自动检测，手动切换按钮位于顶部栏

## 技术栈

- **Tauri v2** + **Vue 3（Composition API）** + **Vite**
- **SQLite** 通过 `@tauri-apps/plugin-sql` 实现本地持久化
- **Pinia** 状态管理
- **原生 CSS Variables** 管理深色/浅色主题，无额外 UI 库依赖

## 核心功能

1. 任务增删改
2. 任务完成状态切换（完成后移入「已完成」分组）
3. 截止日期设置
4. 优先级标记（高/中/低）
5. 标签/分类过滤
6. 深色/浅色主题切换
7. 悬浮窗模式（应用级切换）

## 项目结构

```
src/                  # Vue 前端代码
  components/         # Vue 组件
    Sidebar.vue
    TaskList.vue
    TaskItem.vue
    TaskEditor.vue
    TopBar.vue
    FloatTaskList.vue
    FloatControls.vue
    PriorityBadge.vue
    TagChip.vue
    ThemeToggle.vue
  views/              # 页面级视图
    MainView.vue
    FloatView.vue
  stores/             # Pinia 状态管理
    taskStore.js
    settingStore.js
  db/                 # 数据库初始化与 SQL 封装
    init.js
    taskQueries.js
  styles/             # 全局 CSS + 主题变量
    theme.css
src-tauri/            # Tauri Rust 后端
  src/
    lib.rs            # 窗口状态控制命令
  capabilities/       # Tauri v2 权限配置
```

## 窗口控制策略（核心设计）

应用只有一个 Tauri window，通过 Vue 路由/条件渲染在「主界面」和「悬浮窗」之间切换。

切换时调用 Rust 命令调整窗口属性：

- **主界面 → 悬浮窗**
  - `setSize(300, 400)`
  - `setAlwaysOnTop(true)`
  - `setDecorations(false)`
  - 可选透明度
- **悬浮窗 → 主界面**
  - 恢复默认尺寸（如 900×600）
  - `setAlwaysOnTop(false)`
  - `setDecorations(true)`
  - 恢复不透明

状态由 Pinia 管理，切换时任务列表数据不丢失。

## 数据模型

### `tasks` 表

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | 主键 |
| `title` | TEXT NOT NULL | 任务标题 |
| `completed` | INTEGER DEFAULT 0 | 0=未完成, 1=已完成 |
| `due_date` | TEXT | ISO 8601 日期，可选 |
| `priority` | INTEGER DEFAULT 1 | 0=低, 1=中, 2=高 |
| `tag` | TEXT | 标签名称，可选 |
| `created_at` | TEXT | 创建时间 |
| `completed_at` | TEXT | 完成时间，可选 |

### `app_settings` 表

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | TEXT PK | 配置键 |
| `value` | TEXT | 配置值 |

用于存储主题模式、悬浮窗透明度、置顶状态等。

## 数据流

1. Pinia Store 初始化时从 SQLite 加载所有任务。
2. 用户操作（增删改、切换完成状态）先更新本地 Pinia state，再异步写回 SQLite。
3. `MainView` 中 `TaskList` 用 `computed` 将任务分为 `incompleteTasks` 和 `completedTasks` 两组渲染。
4. `FloatView` 只读取 `incompleteTasks`，按截止日期排序展示精简列表。

## 悬浮窗视图

- `FloatTaskList`：精简任务列表，仅显示未完成任务的核心信息（标题 + 截止日期）。
- `FloatControls`：底部工具栏，包含透明度滑块、总在最前端开关、返回主界面按钮。
- 悬浮窗没有未完成任务时显示「暂无待办」空状态。

## 错误处理

- **SQLite 操作失败：** 所有 DB 操作返回 `Result`，前端通过 `try/catch` 捕获并提示用户，不阻断界面。
- **窗口切换失败：** Rust 命令失败时记录日志，前端保持当前视图不变，避免窗口状态错乱。
- **空状态处理：** 列表为空时显示友好提示。

## 测试策略

- **单元测试：** Vitest 测试 Pinia store 的核心逻辑（过滤、排序、增删改）。
- **组件测试：** Vue Test Utils 测试 `TaskItem`、`TaskEditor` 的交互。
- **集成测试：** 手动验证窗口模式切换、SQLite 持久化、主题切换的端到端流程。
- **E2E 测试（可选）：** 如时间允许，用 Playwright 覆盖主流程。

## 边界与约束

- 单窗口模式：主界面和悬浮窗不能同时存在。
- 数据完全本地存储，不支持云同步（MVP 阶段）。
- 标签为简单字符串，不支持嵌套或颜色自定义（MVP 阶段）。
