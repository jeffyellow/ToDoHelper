# 默认隐藏数据库配置按钮 + 快捷键显示 + SyncStatus 点击测连

## 背景

ToDoHelper 目前的数据库连接配置按钮始终显示在 TopBar 中，且首次使用需要手动填写。本设计实现以下目标：
1. 默认隐藏数据库连接配置入口，减少普通用户的视觉干扰。
2. 设置一组默认的 MySQL 连接参数，应用首次启动时自动写入本地 SQLite。
3. 通过隐藏快捷键 `Shift + Ctrl + F12` 临时显示/隐藏配置按钮。
4. 点击 TopBar 的 `SyncStatus` 小圆圈即可测试数据库连接并弹窗反馈结果。

## 默认配置

| 字段 | 值 |
|---|---|
| 主机地址 | 47.100.164.234 |
| 端口 | 3306 |
| 数据库名 | todohelper |
| MySQL 用户名 | root |
| MySQL 密码 | hjf@19941121 |

## 数据层：默认配置自动初始化

### 位置

`App.vue` 的 `onMounted` 生命周期。

### 流程

1. 在 `initDb()` 和 `settingStore.init()` 之后，调用 `hasMysqlConfig()` 检查 SQLite 中是否已存在 MySQL 配置。
2. 若不存在，调用 `saveMysqlConfig()` 写入默认 host、port、database、username。
3. 调用 Rust 命令 `encrypt_password` 对默认密码进行加密，再通过 `saveEncryptedPassword()` 存入 SQLite。
4. 随后继续执行原有的 `restoreSession()` 流程，此时默认配置已就绪，可正常自动登录并同步。

### 边界情况

- 若用户之前已手动保存过配置，则 `hasMysqlConfig()` 返回 true，不会覆盖现有配置。
- 密码始终通过 Rust 加密后存储，符合现有安全策略。

## UI 层：数据库配置按钮默认隐藏

### 状态管理

在 `App.vue` 中新增响应式状态：

```js
const showDbConfigBtn = ref(false)
```

通过 prop 向下传递到 `MainView`，再传递到 `TopBar`。

### TopBar.vue 改动

- 数据库配置按钮（`<button>` + `<Database>` 图标）改为条件渲染：`v-if="showDbConfigBtn"`。
- 接收新的 prop `showDbConfigBtn: Boolean`。

### 快捷键监听

在 `App.vue` 的 `onMounted` 中注册全局 `keydown` 监听：

- 当 `event.shiftKey && event.ctrlKey && event.key === 'F12'` 时，切换 `showDbConfigBtn.value = !showDbConfigBtn.value`。
- 在组件卸载前移除监听器，防止内存泄漏。

## 交互层：SyncStatus 点击测试数据库连接

### SyncStatus.vue 改动

#### 新增行为

1. 为 `sync-status` 根元素绑定 `@click="onTestConnection"`。
2. 样式上增加 `cursor: pointer` 和 hover 高亮，提示可点击。
3. `title` 属性更新为 `"点击测试数据库连接"`。

#### onTestConnection 流程

1. 调用 `getMysqlConfig()` 获取已保存的 MySQL 配置（含默认配置）。
2. 调用 `getEncryptedPassword()` 获取加密后的密码。
3. 若加密密码存在，调用 Rust `decrypt_password` 解密。
4. 调用 Rust `test_mysql_connection` 发送完整配置对象进行测试。
5. 成功：弹窗 `alert('数据库连接正常')`。
6. 失败：弹窗 `alert('数据库连接失败：' + (e.message || String(e)))`。

#### 边界情况

- 若用户尚未保存密码（理论上默认配置已自动写入），弹窗提示未配置密码。
- 测试期间可添加 loading 状态避免重复点击，但考虑到操作极快，可暂不加复杂状态。

## 不变的部分

- `DatabaseConfigModal.vue`：无需改动。打开时通过 `getMysqlConfig()` 自动读取已保存的默认配置。
- `Sidebar.vue` / `ConnectionStatus.vue`：不受影响。
- Rust 后端：已有 `test_mysql_connection`、`encrypt_password`、`decrypt_password` 命令，无需新增或修改。

## 依赖关系

```
App.vue
  ├─ onMounted
  │   ├─ initDb()
  │   ├─ settingStore.init()
  │   ├─ hasMysqlConfig() ──否──> saveMysqlConfig() + saveEncryptedPassword()
  │   ├─ settingStore.restoreSession()
  │   └─ keydown listener (Shift+Ctrl+F12 -> toggle showDbConfigBtn)
  │
  ├─ MainView (prop: showDbConfigBtn)
  │   └─ TopBar (prop: showDbConfigBtn -> v-if 数据库配置按钮)
  │
  └─ SyncStatus (点击 -> onTestConnection)
```

## 测试要点

1. **首次启动**：删除 SQLite 后启动应用，检查 `app_settings` 表中是否自动写入了默认 MySQL 配置和密码。
2. **配置不覆盖**：再次启动，确认现有配置未被重置为默认值。
3. **按钮隐藏**：默认状态下 TopBar 中看不到数据库配置按钮。
4. **快捷键显示**：按下 `Shift + Ctrl + F12`，按钮出现；再次按下，按钮消失。
5. **连接测试**：点击 `SyncStatus`，弹窗显示"数据库连接正常"或具体的失败原因。
