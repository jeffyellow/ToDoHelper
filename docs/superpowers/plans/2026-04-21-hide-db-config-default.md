# 默认隐藏数据库配置按钮 + 快捷键显示 + SyncStatus 点击测连 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 默认隐藏数据库连接配置按钮，首次启动自动写入默认 MySQL 配置，通过 `Shift+Ctrl+F12` 切换按钮显示，点击 SyncStatus 测试数据库连接。

**Architecture:** 在 App.vue 的启动流程中插入默认配置初始化（仅当 SQLite 中无配置时），新增 `showDbConfigBtn` 状态通过 prop 传递到 TopBar 条件渲染。全局 keydown 监听器切换该状态。SyncStatus.vue 新增点击事件调用 Rust `test_mysql_connection` 并弹窗反馈。

**Tech Stack:** Vue 3, Pinia, Tauri v2 (Rust), SQLite (tauri-plugin-sql), Vitest

---

## 文件结构

| 文件 | 操作 | 说明 |
|---|---|---|
| `src/App.vue` | 修改 | 默认配置自动初始化、快捷键监听、`showDbConfigBtn` 状态 |
| `src/views/MainView.vue` | 修改 | 接收 `showDbConfigBtn` prop 并传递给 TopBar |
| `src/components/TopBar.vue` | 修改 | 接收 `showDbConfigBtn` prop，条件渲染数据库配置按钮 |
| `src/components/SyncStatus.vue` | 修改 | 点击测试数据库连接、pointer 光标、hover 样式 |

---

### Task 1: App.vue — 默认配置自动初始化

**Files:**
- Modify: `src/App.vue`

**Context:** `App.vue` 的 `onMounted` 目前按顺序执行 `initDb()` → `settingStore.init()` → `taskStore.loadTasks()` → `settingStore.restoreSession()`。需要在 `restoreSession()` **之前**插入默认配置检查：若 SQLite 中无 MySQL 配置，则写入默认值。

默认配置值：
- host: `47.100.164.234`
- port: `3306`
- database: `todohelper`
- username: `root`
- password: `hjf@19941121`

- [ ] **Step 1: 导入新增的 settingQueries 函数**

在 `src/App.vue` 的 `<script setup>` 顶部，将现有的导入：

```js
import { getSetting, setSetting } from './db/settingQueries.js'
```

扩展为：

```js
import { getSetting, setSetting, hasMysqlConfig, saveMysqlConfig, saveEncryptedPassword } from './db/settingQueries.js'
```

- [ ] **Step 2: 在 onMounted 中插入默认配置初始化**

在 `src/App.vue` 的 `onMounted` 中，找到以下代码块：

```js
    await initDb()
    await settingStore.init()
    await taskStore.loadTasks()
    await settingStore.restoreSession()
```

将其替换为：

```js
    await initDb()
    await settingStore.init()
    await taskStore.loadTasks()

    // 首次启动自动写入默认 MySQL 配置
    const hasConfig = await hasMysqlConfig()
    if (!hasConfig) {
      await saveMysqlConfig({
        host: '47.100.164.234',
        port: 3306,
        database: 'todohelper',
        username: 'root',
      })
      const encrypted = await invoke('encrypt_password', { password: 'hjf@19941121' })
      await saveEncryptedPassword(encrypted)
    }

    await settingStore.restoreSession()
```

> **注意：** `invoke` 已经在 `App.vue` 中通过 `import { invoke } from '@tauri-apps/api/core'` 导入，无需重复导入。

- [ ] **Step 3: Commit**

```bash
git add src/App.vue
git commit -m "feat: auto-write default MySQL config on first launch"
```

---

### Task 2: App.vue — 快捷键监听和 showDbConfigBtn 状态

**Files:**
- Modify: `src/App.vue`

**Context:** 需要在 `App.vue` 中维护一个 `showDbConfigBtn` ref，初始为 `false`。通过全局 `keydown` 事件监听 `Shift+Ctrl+F12`，切换该 ref。将 ref 通过 prop 传递给 `MainView`。

- [ ] **Step 1: 新增导入 onBeforeUnmount**

在 `src/App.vue` 的 `<script setup>` 顶部，将：

```js
import { onMounted, ref } from 'vue'
```

替换为：

```js
import { onMounted, onBeforeUnmount, ref } from 'vue'
```

- [ ] **Step 2: 新增 showDbConfigBtn ref 和 keydown handler**

在 `src/App.vue` 的 `<script setup>` 中，找到以下代码：

```js
const showDbConfig = ref(false)
const showAuth = ref(false)
const showWebhookConfig = ref(false)
```

在其后添加：

```js
const showDbConfigBtn = ref(false)

function onKeydown(e) {
  if (e.shiftKey && e.ctrlKey && e.key === 'F12') {
    e.preventDefault()
    showDbConfigBtn.value = !showDbConfigBtn.value
  }
}
```

- [ ] **Step 3: 注册和卸载 keydown 监听器**

在 `onMounted` 的末尾（在 `checkPush()` 调用之后），添加：

```js
    window.addEventListener('keydown', onKeydown)
```

在 `<script setup>` 的末尾（或紧邻 `onMounted` 之后），添加：

```js
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
```

- [ ] **Step 4: 将 showDbConfigBtn 传递给 MainView**

在 `src/App.vue` 的 `<template>` 中，找到：

```vue
  <MainView
    v-if="!settingStore.isFloat"
    @enter-float="enterFloat"
    @open-db-config="showDbConfig = true"
    @open-auth="showAuth = true"
    @open-webhook-config="showWebhookConfig = true"
  />
```

替换为：

```vue
  <MainView
    v-if="!settingStore.isFloat"
    :show-db-config-btn="showDbConfigBtn"
    @enter-float="enterFloat"
    @open-db-config="showDbConfig = true"
    @open-auth="showAuth = true"
    @open-webhook-config="showWebhookConfig = true"
  />
```

- [ ] **Step 5: Commit**

```bash
git add src/App.vue
git commit -m "feat: add Shift+Ctrl+F12 shortcut to toggle db config button"
```

---

### Task 3: MainView.vue — 传递 showDbConfigBtn prop

**Files:**
- Modify: `src/views/MainView.vue`

**Context:** `MainView.vue` 作为 `App.vue` 和 `TopBar.vue` 之间的中间层，需要接收 `showDbConfigBtn` prop 并透传给 `TopBar`。

- [ ] **Step 1: 接收 showDbConfigBtn prop**

在 `src/views/MainView.vue` 的 `<script setup>` 中，找到：

```js
const taskStore = useTaskStore()
const emit = defineEmits(['enterFloat', 'openDbConfig', 'openAuth', 'openWebhookConfig'])
```

在其后添加：

```js
const props = defineProps({ showDbConfigBtn: Boolean })
```

- [ ] **Step 2: 将 prop 传递给 TopBar**

在 `src/views/MainView.vue` 的 `<template>` 中，找到：

```vue
      <TopBar
        :search-query="taskStore.searchQuery"
        @update:search-query="taskStore.setSearchQuery"
        @enter-float="emit('enterFloat')"
        @open-db-config="emit('openDbConfig')"
        @open-webhook-config="emit('openWebhookConfig')"
      />
```

替换为：

```vue
      <TopBar
        :search-query="taskStore.searchQuery"
        :show-db-config-btn="props.showDbConfigBtn"
        @update:search-query="taskStore.setSearchQuery"
        @enter-float="emit('enterFloat')"
        @open-db-config="emit('openDbConfig')"
        @open-webhook-config="emit('openWebhookConfig')"
      />
```

- [ ] **Step 3: Commit**

```bash
git add src/views/MainView.vue
git commit -m "feat: pass showDbConfigBtn prop through MainView to TopBar"
```

---

### Task 4: TopBar.vue — 条件渲染数据库配置按钮

**Files:**
- Modify: `src/components/TopBar.vue`

**Context：** `TopBar.vue` 目前在 actions 区域始终显示数据库配置按钮（`<Database>` 图标）。需要改为仅当 `showDbConfigBtn` 为 `true` 时显示。

- [ ] **Step 1: 接收 showDbConfigBtn prop**

在 `src/components/TopBar.vue` 的 `<script setup>` 中，找到：

```js
defineProps({ searchQuery: String })
```

替换为：

```js
defineProps({ searchQuery: String, showDbConfigBtn: Boolean })
```

- [ ] **Step 2: 条件渲染数据库配置按钮**

在 `src/components/TopBar.vue` 的 `<template>` 中，找到：

```vue
      <button class="icon-btn" @click="emit('openDbConfig')" title="数据库连接">
        <Database :size="20" />
      </button>
```

替换为：

```vue
      <button
        v-if="showDbConfigBtn"
        class="icon-btn"
        @click="emit('openDbConfig')"
        title="数据库连接"
      >
        <Database :size="20" />
      </button>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TopBar.vue
git commit -m "feat: conditionally render db config button based on showDbConfigBtn"
```

---

### Task 5: SyncStatus.vue — 点击测试数据库连接

**Files：**
- Modify: `src/components/SyncStatus.vue`

**Context：** `SyncStatus.vue` 当前仅根据 `syncStatus` 显示一个静态 emoji 图标。需要：
1. 绑定 `@click="onTestConnection"`
2. 添加 `cursor: pointer` 和 hover 效果
3. 更新 `title` 为 `"点击测试数据库连接"`
4. 实现 `onTestConnection`，调用 Rust 测试连接并弹窗

- [ ] **Step 1: 添加导入和 onTestConnection 逻辑**

在 `src/components/SyncStatus.vue` 的 `<script setup>` 顶部，替换整个 `<script setup>` 内容为：

```vue
<script setup>
import { invoke } from '@tauri-apps/api/core'
import { getMysqlConfig, getEncryptedPassword } from '../db/settingQueries.js'

defineProps({ status: String })

const labels = {
  idle: { icon: '🟢', text: '在线' },
  syncing: { icon: '🔄', text: '同步中' },
  error: { icon: '🔴', text: '同步错误' },
  offline: { icon: '⚠️', text: '离线' },
}

async function onTestConnection() {
  try {
    const config = await getMysqlConfig()
    const encryptedPw = await getEncryptedPassword()
    if (!encryptedPw) {
      alert('数据库连接失败：未配置密码')
      return
    }
    const password = await invoke('decrypt_password', { encrypted: encryptedPw })
    await invoke('test_mysql_connection', {
      config: {
        host: config.host,
        port: config.port,
        database: config.database,
        username: config.username,
        password,
      },
    })
    alert('数据库连接正常')
  } catch (e) {
    alert('数据库连接失败：' + (e?.message || String(e)))
  }
}
</script>
```

- [ ] **Step 2: 更新模板和样式**

在 `src/components/SyncStatus.vue` 的 `<template>` 中，找到：

```vue
  <div class="sync-status" :title="labels[status]?.text">
    <span class="icon">{{ labels[status]?.icon }}</span>
  </div>
```

替换为：

```vue
  <div
    class="sync-status"
    :title="labels[status]?.text + '（点击测试数据库连接）'"
    @click="onTestConnection"
  >
    <span class="icon">{{ labels[status]?.icon }}</span>
  </div>
```

在 `<style scoped>` 中，找到：

```css
.sync-status {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: default;
}
```

替换为：

```css
.sync-status {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
}
.sync-status:hover {
  background: var(--surface-hover);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SyncStatus.vue
git commit -m "feat: click SyncStatus to test database connection"
```

---

### Task 6: 回归测试

**Files：**
- Run: 项目测试命令

- [ ] **Step 1: 运行现有测试套件**

```bash
npm run test:run
```

**预期：** 所有现有测试通过。本改动未修改 store 逻辑，不应影响现有测试。

- [ ] **Step 2: 手动验证清单**

由于本改动涉及 UI 交互和 Tauri 后端调用，以下测试需通过 `npm run tauri dev` 进行手动验证：

1. **首次启动写入默认配置：** 删除 `sqlite:todo.db`（或备份后删除），启动应用，检查 `app_settings` 表中是否包含 `mysql_host`、`mysql_port`、`mysql_database`、`mysql_username`、`mysql_password_enc`。
2. **配置不覆盖：** 再次启动，确认现有配置值未被重置为默认值。
3. **按钮默认隐藏：** 启动应用，TopBar 右侧看不到数据库配置按钮（`Database` 图标）。
4. **快捷键显示：** 按下 `Shift + Ctrl + F12`，数据库配置按钮出现；再次按下，按钮消失。
5. **连接测试成功：** 点击 `SyncStatus` 小圆圈（🟢/🔴 等），弹窗显示"数据库连接正常"。
6. **连接测试失败：** 修改配置为错误值（通过快捷键打开配置面板修改），点击 `SyncStatus`，弹窗显示具体的失败原因。

- [ ] **Step 3: Commit（如有测试相关改动）**

若测试有变更则提交，否则无需额外 commit。

---

## 自检

### 1. Spec 覆盖检查

| Spec 要求 | 对应任务 |
|---|---|
| 首次启动自动写入默认 MySQL 配置 | Task 1 |
| 配置不覆盖已有配置 | Task 1 (hasMysqlConfig 检查) |
| 数据库配置按钮默认隐藏 | Task 4 (v-if="showDbConfigBtn") |
| Shift+Ctrl+F12 切换按钮显示 | Task 2 |
| 点击 SyncStatus 测试连接 | Task 5 |
| 成功/失败弹窗反馈 | Task 5 |

**无缺口。**

### 2. Placeholder 扫描

- 无 "TBD"、"TODO"、"implement later"。
- 无 "添加适当错误处理" 等模糊描述。
- 所有代码步骤包含完整代码块。

### 3. 类型一致性检查

- `showDbConfigBtn` 在 App.vue 中为 `ref(false)`，通过 prop 传递时类型为 `Boolean`，在 MainView.vue、TopBar.vue 中均定义为 `Boolean` — 一致。
- `hasMysqlConfig()`、`saveMysqlConfig()`、`saveEncryptedPassword()` 的导入和调用与 `settingQueries.js` 中导出的函数名完全匹配。
- Rust 命令名 `encrypt_password`、`decrypt_password`、`test_mysql_connection` 与现有后端命令一致。
