# 设计方案：登录/数据库配置流程重构

## 背景

当前 `DatabaseConfigModal.vue` 同时处理 MySQL 连接配置和登录/注册两个职责，耦合度高。用户要求将两者拆分为独立弹窗，Sidebar 左下角展示登录状态并支持点击登录，右上角保留数据库连接配置入口。登录状态需要在应用重启后自动恢复。

## 设计目标

1. 登录状态和数据库配置分离，职责清晰
2. 应用启动后自动恢复上一次登录状态
3. 登录成功后支持手动触发同步
4. 数据库配置弹窗保留密码和测试连接功能

## 整体架构

将当前的 `DatabaseConfigModal` 拆分为两个独立弹窗，新增登录状态持久化机制：

| 组件 | 职责 |
|---|---|
| `DatabaseConfigModal.vue` | 纯数据库连接配置（host/port/数据库名/MySQL用户名/**MySQL密码**）→ 测试连接 → 保存 |
| `AuthModal.vue` | 纯登录/注册（app用户名/app密码）→ 成功后将 token 持久化到本地 |
| `Sidebar.vue` | 左下角移除"数据库连接"，改为：**登录状态指示器** + **手动同步按钮** |
| `TopBar.vue` | 保留数据库连接按钮 |

## 数据流

### 1. 应用启动自动恢复流程

```
App.vue onMounted
  ↓
读取 app_settings：mysql_host, mysql_port, mysql_database, mysql_username, mysql_password_enc
读取 app_settings：auth_token, auth_user_id, auth_username
  ↓
if 所有配置存在:
  decrypt_password(mysql_password_enc) → 明文密码
  invoke('restore_session', { config, token, userId, username })
  ↓
  Rust 创建连接池 → verify_token → 写入 AppState → 返回成功
  ↓
  syncStatus = 'idle'（在线）
else:
  syncStatus = 'offline'（未连接）
```

### 2. 数据库配置弹窗流程（右上角）

```
点击"数据库连接"按钮
  ↓
DatabaseConfigModal 打开
  ↓
自动填充：host/port/数据库名/MySQL用户名（已保存的值）
  ↓
MySQL密码输入框（空白，需用户重新输入）
  ↓
点击"测试连接"
  ↓
invoke('test_mysql_connection', { config含密码 })
  ↓
弹窗提示"连接成功"或"连接失败：xxx"（不跳转）
  ↓
点击"保存"
  ↓
encrypt_password(密码) → mysql_password_enc 存 SQLite
host/port/数据库名/MySQL用户名 明文存 SQLite
  ↓
尝试 restore_session（如果已有 token）
```

### 3. 登录弹窗流程（左下角点击登录状态）

```
点击"未登录"或"在线（用户名）"
  ↓
AuthModal 打开
  ↓
自动填充：已保存的 host/port/数据库名/MySQL用户名（只读展示）
  ↓
输入 app 用户名 + app 密码
  ↓
点击登录/注册
  ↓
invoke('login_user'/'register_user')
  ↓
成功：
  - token 存 SQLite（auth_token, auth_user_id, auth_username）
  - encrypt_password(MySQL密码) → 保存到 mysql_password_enc
  - 连接池写入 AppState
  - syncStatus = 'idle'
  - 触发一次自动同步
```

### 4. 手动同步流程（左下角同步按钮）

```
syncStatus === 'idle'（已登录）
  ↓
点击"手动同步"按钮
  ↓
invoke('sync_tasks', { payload: { pendingTasks, lastSyncAt } })
  ↓
成功：syncStatus 闪烁 "同步成功" 后回到 idle
失败：syncStatus = 'error'
```

### 5. 登出流程

```
点击登录状态下的"退出登录"
  ↓
清除 SQLite：auth_token, auth_user_id, auth_username
Rust 清空 AppState.current_user
连接池保留（因为配置还在）
  ↓
syncStatus = 'offline'
```

## 数据模型变更

### SQLite `app_settings` 表新增键

| key | 说明 |
|---|---|
| `mysql_password_enc` | AES 加密后的 MySQL 密码 |
| `auth_token` | JWT token |
| `auth_user_id` | 用户 ID |
| `auth_username` | 用户名 |

### AppState 结构不变

```rust
pub struct AppState {
    pub mysql_pool: Mutex<Option<sqlx::MySqlPool>>,
    pub current_user: Mutex<Option<UserSession>>,
    pub jwt_secret: String,
}
```

## 错误处理与边界情况

### 自动恢复失败

- **token 过期**：`restore_session` 返回特定错误码 → 前端提示"登录已过期，请重新登录" → 打开 AuthModal
- **MySQL 连接失败**：`syncStatus = 'error'` → 用户可点击"同步错误"图标查看详情
- **缺少配置项**：不做任何恢复，显示 `offline` 状态

### 手动同步

- **同步中重复点击**：直接忽略（已有 `syncStatus === 'syncing'` 判断）
- **同步时 token 过期**：直接报错，用户重新登录即可

### 数据库配置弹窗

- 密码输入框始终空白（不反显加密密码）
- 用户只填了密码没点"保存"就关闭 → 密码不保存
- 测试连接需要密码 → 没填密码则提示"请输入密码"

## 组件与文件变更清单

### 新增组件

- `AuthModal.vue` — 登录/注册弹窗
- `ConnectionStatus.vue` — 登录状态指示器（Sidebar 中使用）

### 修改组件

- `Sidebar.vue` — 左下角替换为登录状态 + 同步按钮
- `TopBar.vue` — 数据库连接按钮保留
- `DatabaseConfigModal.vue` — 移除登录/注册步骤，改为纯配置 + 测试连接

### 修改 Rust

- `lib.rs` — 新增 `restore_session`、`encrypt_password`、`decrypt_password` 命令
- `auth.rs` — 不需要改动（已有 token 生成/验证逻辑）

### 修改 JS/Store

- `settingStore.js` — 新增 `loadAuthSession`、`saveAuthSession`、`clearAuthSession` 方法
- `taskStore.js` — `triggerSync` 已存在，可能需要添加成功/失败的 toast 提示

## 推荐方案

方案一：加密持久化密码，应用启动自动恢复登录

- 数据库配置弹窗保存 host/port/数据库名/MySQL用户名/**MySQL密码**（加密存储）
- 应用启动时自动读取解密，恢复连接池和登录会话
- 用户体验最好，完全贴合"保持登录状态"的需求
