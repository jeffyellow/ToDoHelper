# ToDoHelper 远程 MySQL 同步 + 连接配置窗口 设计文档

## 1. 目标与范围

将 ToDoHelper 的数据存储从纯本地 SQLite 扩展为 **本地 SQLite 缓存 + 远程 MySQL 同步** 的混合架构，并新增一个数据库连接配置窗口，支持：

- 用户自定义 MySQL 服务器连接参数
- 应用内用户注册与登录
- 多用户数据隔离
- 离线可用、联网后自动同步
- 基于时间戳的冲突解决

## 2. 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                        Vue 前端层                           │
│  ┌──────────────┐  ┌─────────────┐  ┌───────────────────┐   │
│  │ DatabaseConfig│  │  taskStore  │  │   UI 组件/视图    │   │
│  │   Modal.vue   │  │             │  │                   │   │
│  └──────┬───────┘  └──────┬──────┘  └───────────────────┘   │
└─────────┼─────────────────┼─────────────────────────────────┘
          │                 │ invoke
          │                 │
          │        ┌────────▼────────┐
          │        │  Tauri 命令层   │
          │        │  register_user  │
          │        │  login_user     │
          │        │  sync_tasks     │
          │        │  test_mysql...  │
          │        └────────┬────────┘
          │                 │
          │        ┌────────▼────────┐
          │        │   Rust 后端层   │
          │        │  mysql_client   │
          │        │  auth (bcrypt)  │
          │        │  sync_engine    │
          │        └────────┬────────┘
          │                 │
          │        ┌────────▼────────┐         ┌──────────────┐
          │        │  本地 SQLite    │         │  远程 MySQL  │
          └───────►│  tasks/app_set  │◄───────►│  users/tasks │
                   └─────────────────┘  sqlx   └──────────────┘
```

### 2.1 前端层职责

- `DatabaseConfigModal.vue`：提供 MySQL 连接配置、用户注册/登录的 UI。
- `taskStore.js`：扩展 `syncStatus`（`idle | syncing | error | offline`），任务变更后触发同步。
- 应用启动时检查是否已有有效配置，没有则自动弹出配置窗口。
- 在 `TopBar.vue` 增加同步状态指示器。

### 2.2 Rust 后端层职责

- `mysql_client.rs`：封装 `sqlx` MySQL 连接池，支持动态连接参数。
- `auth.rs`：注册/登录逻辑，密码使用 `bcrypt` 哈希，登录成功后返回 JWT token。
- `sync.rs`：双向同步引擎，负责本地 SQLite 与远程 MySQL 之间的数据同步和冲突解决。
- `lib.rs`：暴露新的 Tauri 命令给前端调用。

### 2.3 数据层职责

- **本地 SQLite**：保留现有 `tasks` 和 `app_settings` 表，增加 `updated_at` 和 `sync_state` 字段，作为离线缓存和设置存储。
- **远程 MySQL**：新建 `users` 和 `tasks` 表，支持多用户隔离。

## 3. 数据库 Schema

### 3.1 本地 SQLite 变更

```sql
-- 现有 tasks 表新增字段
ALTER TABLE tasks ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE tasks ADD COLUMN sync_state TEXT DEFAULT 'pending'; -- pending | synced
ALTER TABLE tasks ADD COLUMN local_uuid TEXT; -- 用于关联远程任务
```

### 3.2 远程 MySQL 新建表

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(128) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    local_uuid VARCHAR(36) NOT NULL,
    title VARCHAR(255),
    completed BOOLEAN DEFAULT FALSE,
    start_date DATE,
    due_date DATE,
    priority INT,
    tag VARCHAR(64),
    created_at DATETIME,
    completed_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY uk_user_local_uuid (user_id, local_uuid)
);
```

### 3.3 Schema 设计说明

- 本地 SQLite 使用自增 `id`，远程 MySQL 新增 `local_uuid` 字段来唯一标识同一任务在不同设备上的副本。
- 同步时以 `(user_id, local_uuid)` 作为唯一键，避免多设备间 `id` 冲突。
- 冲突解决规则：比较 `updated_at`，时间新者覆盖旧者。

## 4. 同步逻辑

### 4.1 触发时机

| 时机 | 行为 |
|------|------|
| 应用启动 | 如果有有效登录态，自动执行一次全量双向同步 |
| 任务变更 | `taskStore` 增删改完成后，异步触发增量同步 |
| 定时心跳 | 每 30 秒尝试一次轻量同步（仅拉取远程变更） |
| 网络恢复 | 从离线恢复在线时，立即触发一次全量同步 |

### 4.2 增量同步流程

1. 前端把本地 `sync_state = 'pending'` 的任务列表传给 Rust。
2. Rust 将这些任务上传到远程 MySQL，使用 `INSERT ... ON DUPLICATE KEY UPDATE`：
   - 仅当本地 `updated_at >= 远程 updated_at` 时才覆盖。
3. Rust 从 MySQL 拉取该用户下 `updated_at > 上次同步时间` 的远程任务。（上次同步时间存储在本地 `app_settings.last_sync_at` 中。）
4. 对每条远程任务：
   - 若本地存在同名 `local_uuid`：比较 `updated_at`，新者覆盖本地。
   - 若不存在：插入本地 SQLite。
5. 更新本地 `sync_state` 为 `'synced'`。
6. 更新 `app_settings.last_sync_at` 为当前时间。
7. 若本地数据有变化，通知前端 `taskStore` 重新加载。

### 4.3 离线处理

- MySQL 连接失败时，`syncStatus` 变为 `offline`，任务只写本地 SQLite。
- 定时心跳暂停，等待网络恢复。
- 网络恢复后自动补同步。

## 5. UI 组件设计

### 5.1 DatabaseConfigModal.vue

新增模态框组件，包含两个页面：

**连接设置页**
- 输入框：主机地址、端口（默认 3306）、数据库名、MySQL 用户名、MySQL 密码
- 按钮："测试连接"（调用 `test_mysql_connection`）
- 按钮："下一步"

**登录/注册页**
- Tab 切换：登录 / 注册
- 登录：用户名、密码 → 调用 `login_user`
- 注册：用户名、密码、确认密码 → 调用 `register_user`
- 成功后保存 token 和 user_id，关闭模态框进入主界面

**状态与错误**
- 连接测试时显示 spinner
- 错误时显示红色提示文本
- 登录/注册错误时显示对应提示

### 5.2 同步状态指示器

在 `TopBar.vue` 右侧新增同步状态小图标：

| 状态 | 图标 | 含义 |
|------|------|------|
| 在线 | 🟢 | 已连接，最近同步成功 |
| 同步中 | 🔄 | 正在进行同步 |
| 离线 | ⚠️ | 连接失败，使用本地数据 |
| 错误 | 🔴 | 最后一次同步失败，可点击查看详情 |

### 5.3 入口

- 首次启动：无配置时自动弹出 `DatabaseConfigModal`。
- Sidebar 增加"数据库连接"菜单项，点击可手动打开配置窗口。

## 6. 认证流程

### 6.1 注册

```
前端: 用户名 + 密码 + 确认密码
  │
  ▼
Rust: 校验参数 → bcrypt 哈希密码
  │
  ▼
MySQL: INSERT INTO users (username, password_hash)
  │
  ▼
Rust: 生成 JWT token → 返回给前端
```

### 6.2 登录

```
前端: 用户名 + 密码
  │
  ▼
Rust: 查询用户 → bcrypt verify
  │
  ▼
Rust: 生成 JWT token → 返回给前端
```

### 6.3 Token 存储

- JWT token 保存在 Rust 内存中（运行时会话级别）。
- 前端不需要存储 token，每次调用 Rust 命令时 Rust 自动携带。
- 连接配置（主机、端口、数据库名等）保存在本地 SQLite `app_settings` 中。
- MySQL 密码不持久化存储：测试连接和登录时由用户输入，Rust 仅在内存中保留连接池使用。

## 7. 错误处理

| 场景 | 前端行为 | 后端行为 |
|------|----------|----------|
| MySQL 连接失败 | 显示"无法连接到数据库" | 标记 offline，稍后重试 |
| 用户名已存在 | 显示"用户名已被注册" | 返回 409 类错误 |
| 登录密码错误 | 显示"用户名或密码错误" | 返回 401 类错误 |
| 同步冲突 | 无感知，以时间戳为准 | 自动解决，记录日志 |
| 同步过程中断网 | 状态变为 offline | 中止当前同步，保留本地数据 |

## 8. 测试策略

- **Rust 单元测试**：测试 `auth.rs` 的密码哈希和验证逻辑；测试 `sync.rs` 的冲突解决逻辑。
- **集成测试**：在本地启动一个 Docker MySQL 实例，测试完整的注册、登录、同步流程。
- **前端 Vitest**：测试 `taskStore` 中 `syncStatus` 的状态流转；mock Rust 命令测试 `DatabaseConfigModal` 的表单校验。

## 9. 开发顺序建议

1. 修改本地 SQLite Schema（增加 `updated_at`、`sync_state`、`local_uuid`）。
2. 实现 Rust MySQL 客户端和连接测试命令。
3. 实现注册/登录认证命令。
4. 实现 `DatabaseConfigModal.vue` 基础 UI。
5. 实现同步引擎（全量 + 增量）。
6. 在前端集成同步触发和状态指示器。
7. 添加测试和错误处理完善。

## 10. 约束与依赖

- Rust 后端新增依赖：`sqlx`（MySQL 支持）、`bcrypt`、`jsonwebtoken`、`uuid`。
- 前端无需新增大型依赖，主要使用现有 Tauri invoke 机制。
- 目标 MySQL 版本建议 5.7+ 或 8.0+。
