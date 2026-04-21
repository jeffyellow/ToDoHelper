# 钉钉 Webhook 定时推送实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 ToDoHelper 应用中增加钉钉机器人 Webhook 定时推送功能，包含配置界面和定时调度。

**Architecture:** 纯前端方案，利用 Vue `onMounted` 中的 `setInterval` 每分钟检查推送时间。配置存储复用现有 SQLite `app_settings` 键值表。使用原生 `fetch` 发送钉钉 Webhook 请求。

**Tech Stack:** Vue 3 + Vite + Pinia + SQLite (tauri-plugin-sql) + 浏览器 fetch API

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/stores/settingStore.js` | 修改 | 新增 `getWebhookConfig()` 和 `saveWebhookConfig()` 方法，读写 SQLite 中 webhook 配置 |
| `src/components/WebhookConfigModal.vue` | 创建 | 配置弹窗：URL 输入、启用开关、时间列表（添加/删除/排序）、测试推送 |
| `src/components/TopBar.vue` | 修改 | 右上角新增铃铛图标按钮，点击 emit `openWebhookConfig` 事件 |
| `src/App.vue` | 修改 | 集成 WebhookConfigModal，启动 `setInterval` 定时检查，实现推送逻辑 |

---

## Task 1: settingStore 新增 webhook 配置方法

**Files:**
- Modify: `src/stores/settingStore.js`

**Context:** `settingStore.js` 已有 `getSetting` 和 `setSetting` 的 import（第 4 行）。需要在 store 的 return 对象中新增两个方法。

- [ ] **Step 1: 添加 getWebhookConfig 方法**

在 `settingStore.js` 中 `return` 语句之前，新增：

```js
  async function getWebhookConfig() {
    return {
      url: await getSetting('dingtalk_webhook_url'),
      times: await getSetting('dingtalk_push_times'),
      enabled: (await getSetting('dingtalk_enabled')) !== 'false',
    }
  }

  async function saveWebhookConfig({ url, times, enabled }) {
    await setSetting('dingtalk_webhook_url', url)
    await setSetting('dingtalk_push_times', times)
    await setSetting('dingtalk_enabled', String(enabled))
  }
```

- [ ] **Step 2: 暴露新方法到 return 对象**

在 `return` 对象末尾新增两个字段：

```js
    getWebhookConfig,
    saveWebhookConfig,
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/settingStore.js
git commit -m "feat(store): add webhook config read/write methods"
```

---

## Task 2: 创建 WebhookConfigModal 组件

**Files:**
- Create: `src/components/WebhookConfigModal.vue`

**Context:** 参考 `DatabaseConfigModal.vue` 的模态框样式和结构。复用 `.modal-backdrop`、`.modal`、`.form`、`.btn-primary`、`.btn-secondary` 等样式类名。使用 `lucide-vue-next` 的 `Bell`、`X`、`Plus` 图标。

- [ ] **Step 1: 创建组件文件**

完整代码写入 `src/components/WebhookConfigModal.vue`：

```vue
<script setup>
import { ref, watch, computed } from 'vue'
import { useSettingStore } from '../stores/settingStore.js'
import { Bell, X, Plus } from 'lucide-vue-next'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])

const settingStore = useSettingStore()

const isLoading = ref(false)
const testResult = ref('')
const error = ref('')

const url = ref('')
const enabled = ref(true)
const times = ref([])
const newTime = ref('')

watch(() => props.open, async (open) => {
  if (open) {
    error.value = ''
    testResult.value = ''
    newTime.value = ''
    const cfg = await settingStore.getWebhookConfig()
    url.value = cfg.url || ''
    enabled.value = cfg.enabled
    if (cfg.times) {
      times.value = cfg.times.split(',').map(t => t.trim()).filter(Boolean).sort()
    } else {
      times.value = []
    }
  }
})

const sortedTimes = computed(() => [...times.value].sort())

function addTime() {
  if (!newTime.value) return
  if (!times.value.includes(newTime.value)) {
    times.value.push(newTime.value)
  }
  newTime.value = ''
}

function removeTime(t) {
  times.value = times.value.filter(item => item !== t)
}

async function testPush() {
  if (!url.value.trim()) {
    error.value = '请先填写 Webhook 地址'
    return
  }
  isLoading.value = true
  error.value = ''
  testResult.value = ''
  try {
    const resp = await fetch(url.value.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msgtype: 'markdown',
        markdown: {
          title: '任务提醒测试',
          text: '## 🔔 测试推送\n\n这是一条测试消息，如果收到说明 Webhook 配置正确。',
        },
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (resp.ok) {
      testResult.value = '测试推送成功'
    } else {
      error.value = `测试推送失败：HTTP ${resp.status}`
    }
  } catch (e) {
    error.value = '测试推送失败：' + (e?.message || String(e))
  } finally {
    isLoading.value = false
  }
}

async function saveConfig() {
  if (!url.value.trim()) {
    error.value = 'Webhook 地址不能为空'
    return
  }
  if (times.value.length === 0) {
    error.value = '请至少添加一个推送时间'
    return
  }
  isLoading.value = true
  error.value = ''
  try {
    await settingStore.saveWebhookConfig({
      url: url.value.trim(),
      times: times.value.join(','),
      enabled: enabled.value,
    })
    emit('close')
  } catch (e) {
    error.value = '保存失败：' + (e?.message || String(e))
  } finally {
    isLoading.value = false
  }
}

function onBackdrop(e) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click="onBackdrop">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">钉钉推送设置</h3>
        <button class="icon-btn close-btn" @click="$emit('close')" title="关闭">
          <X :size="18" />
        </button>
      </div>

      <div class="form">
        <label class="toggle-label">
          <input v-model="enabled" type="checkbox" />
          <span>启用定时推送</span>
        </label>

        <label>
          Webhook 地址
          <input v-model="url" type="url" placeholder="https://oapi.dingtalk.com/robot/send?access_token=xxx" />
        </label>

        <div class="times-section">
          <div class="times-header">
            <span>推送时间</span>
            <span class="hint">可添加多个时间点，每天定时推送</span>
          </div>
          <div class="times-list">
            <div v-for="t in sortedTimes" :key="t" class="time-tag">
              <Bell :size="14" />
              <span>{{ t }}</span>
              <button class="time-remove" @click="removeTime(t)" title="删除">
                <X :size="14" />
              </button>
            </div>
          </div>
          <div class="time-add">
            <input v-model="newTime" type="time" />
            <button class="btn-secondary btn-small" @click="addTime">
              <Plus :size="16" />
              添加时间
            </button>
          </div>
        </div>

        <p v-if="testResult" class="success">{{ testResult }}</p>
        <p v-if="error" class="error">{{ error }}</p>

        <div class="modal-actions">
          <button class="btn-secondary" :disabled="isLoading" @click="testPush">
            {{ isLoading ? '发送中...' : '测试推送' }}
          </button>
          <button class="btn-secondary" @click="$emit('close')">取消</button>
          <button
            class="btn-primary"
            :disabled="isLoading"
            @click="saveConfig"
          >
            保存
          </button>
        </div>
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
  z-index: 200;
}
.modal {
  width: 480px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--bg);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.close-btn:hover {
  background: var(--surface-hover);
}
.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}
.form input[type="url"],
.form input[type="time"] {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 14px;
}
.form input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.2);
}
.toggle-label {
  flex-direction: row !important;
  align-items: center;
  gap: 10px !important;
  cursor: pointer;
}
.toggle-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary);
  cursor: pointer;
}
.times-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.times-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: var(--text-secondary);
}
.hint {
  font-size: 12px;
  color: var(--text-tertiary);
}
.times-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.time-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--color-primary-subtle);
  color: var(--text-primary);
  font-size: 13px;
}
.time-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
}
.time-remove:hover {
  background: var(--surface-hover);
  color: var(--color-danger);
}
.time-add {
  display: flex;
  align-items: center;
  gap: 8px;
}
.time-add input[type="time"] {
  width: 120px;
}
.btn-small {
  padding: 6px 12px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.success {
  color: #22c55e;
  font-size: 13px;
  margin: 0;
}
.error {
  color: #ef4444;
  font-size: 13px;
  margin: 0;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
.btn-secondary {
  padding: 8px 16px;
  border-radius: 12px;
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
  border-radius: 12px;
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
.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WebhookConfigModal.vue
git commit -m "feat(ui): add WebhookConfigModal component for DingTalk settings"
```

---

## Task 3: TopBar 添加铃铛按钮

**Files:**
- Modify: `src/components/TopBar.vue`

**Context:** 当前 `TopBar.vue` 第 1-2 行导入图标，第 9 行定义 emits，第 23-32 行是 actions 区域。

- [ ] **Step 1: 导入铃铛图标并添加 emit**

修改导入语句，将 `Search, PictureInPicture, Database` 改为 `Search, PictureInPicture, Database, Bell`：

```js
import { Search, PictureInPicture, Database, Bell } from 'lucide-vue-next'
```

修改 `defineEmits`，添加 `openWebhookConfig`：

```js
const emit = defineEmits(['enterFloat', 'update:searchQuery', 'openDbConfig', 'openWebhookConfig'])
```

- [ ] **Step 2: 添加铃铛按钮**

在 actions 区域的 "数据库连接" 按钮之前（或之后）插入铃铛按钮：

```vue
      <button class="icon-btn" @click="emit('openWebhookConfig')" title="钉钉推送设置">
        <Bell :size="20" />
      </button>
```

actions 区域修改后应如下：

```vue
    <div class="actions">
      <SyncStatus :status="taskStore.syncStatus" />
      <ThemeToggle />
      <button class="icon-btn" @click="emit('openWebhookConfig')" title="钉钉推送设置">
        <Bell :size="20" />
      </button>
      <button class="icon-btn" @click="emit('openDbConfig')" title="数据库连接">
        <Database :size="20" />
      </button>
      <button class="icon-btn" @click="emit('enterFloat')" title="悬浮窗">
        <PictureInPicture :size="20" />
      </button>
    </div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TopBar.vue
git commit -m "feat(ui): add bell button to TopBar for webhook config"
```

---

## Task 4: App.vue 集成定时推送

**Files:**
- Modify: `src/App.vue`

**Context:** `App.vue` 当前导入了 `MainView`、`FloatView`、`DatabaseConfigModal`、`AuthModal`、`useSettingStore`、`useTaskStore`、`initDb`、`invoke`。需要新增 `WebhookConfigModal` 导入、`getSetting` 导入，以及定时推送逻辑。

- [ ] **Step 1: 导入 WebhookConfigModal 和 getSetting**

在 `App.vue` 的 script setup 顶部添加导入：

```js
import WebhookConfigModal from './components/WebhookConfigModal.vue'
import { getSetting, setSetting } from './db/settingQueries.js'
```

- [ ] **Step 2: 添加 showWebhookConfig ref**

在 `showAuth` ref 之后添加：

```js
const showWebhookConfig = ref(false)
```

- [ ] **Step 3: 添加推送逻辑**

在 `onAuthSuccess` 函数之后添加以下代码：

```js
/* ---------- 钉钉定时推送 ---------- */

function buildPushPayload() {
  const today = new Date().toISOString().slice(0, 10)
  const upcomingCutoff = new Date()
  upcomingCutoff.setDate(upcomingCutoff.getDate() + 3)
  const cutoffStr = upcomingCutoff.toISOString().slice(0, 10)

  const active = taskStore.tasks
    .filter(t => !t.completed)
    .sort((a, b) => b.priority - a.priority)

  const upcoming = taskStore.tasks
    .filter(t => !t.completed && t.start_date && t.start_date >= today && t.start_date <= cutoffStr)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  return { active, upcoming }
}

function formatMarkdown({ active, upcoming }) {
  let text = '## 🔔 任务提醒\n\n'

  text += `### 正在执行（${active.length}个）\n`
  if (active.length === 0) {
    text += '> 暂无正在执行的任务\n'
  } else {
    for (const t of active) {
      const priorityLabel = t.priority === 1 ? '**高优**' : (t.priority === 2 ? '中优' : '低优')
      const due = t.due_date ? `（截止：${t.due_date}）` : ''
      text += `- [ ] ${priorityLabel} ${t.title}${due}\n`
    }
  }

  text += '\n'
  text += `### 即将开始（${upcoming.length}个）\n`
  if (upcoming.length === 0) {
    text += '> 未来三天内没有即将开始的任务\n'
  } else {
    for (const t of upcoming) {
      text += `- 📅 ${t.start_date}：${t.title}\n`
    }
  }

  return text
}

async function sendDingTalk(url, payload) {
  const markdownText = formatMarkdown(payload)
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'markdown',
      markdown: { title: '任务提醒', text: markdownText },
    }),
    signal: AbortSignal.timeout(5000),
  })
}

async function checkPush() {
  const config = await settingStore.getWebhookConfig()
  if (!config.enabled || !config.url) return

  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const times = (config.times || '').split(',').map(t => t.trim()).filter(Boolean)
  if (!times.includes(currentTime)) return

  // 防重：同一分钟不重复推送
  const lastPushKey = `dingtalk_last_push_${currentTime.replace(':', '')}`
  const lastPushDate = await getSetting(lastPushKey)
  const today = now.toISOString().slice(0, 10)
  if (lastPushDate === today) return

  const tasks = buildPushPayload()
  if (tasks.active.length === 0 && tasks.upcoming.length === 0) return

  try {
    await sendDingTalk(config.url, tasks)
    await setSetting(lastPushKey, today)
  } catch (e) {
    console.error('DingTalk push failed:', e)
  }
}
```

- [ ] **Step 4: 在 onMounted 中启动定时器**

修改 `onMounted` 函数，在末尾添加定时器：

```js
onMounted(async () => {
  try {
    await initDb()
    await settingStore.init()
    await taskStore.loadTasks()
    await settingStore.restoreSession()
    if (settingStore.isLoggedIn) {
      taskStore.triggerSync().catch(console.error)
    }

    // 启动钉钉定时推送检查器
    const CHECK_INTERVAL = 60_000 // 每分钟检查一次
    const timer = setInterval(checkPush, CHECK_INTERVAL)
    checkPush() // 立即检查一次

    // 组件卸载时清理（虽然 App.vue 通常不会卸载，但好习惯）
    // 注意：在 Tauri 中 App.vue 是根组件，通常不需要 onUnmounted
  } catch (e) {
    console.error('App initialization failed:', e)
    alert('初始化失败：' + (e?.message || String(e)))
  }
})
```

- [ ] **Step 5: 在模板中挂载 WebhookConfigModal**

在 `AuthModal` 之后添加：

```vue
  <WebhookConfigModal
    :open="showWebhookConfig"
    @close="showWebhookConfig = false"
  />
```

- [ ] **Step 6: 连接 TopBar 事件**

修改 `MainView` 的模板，添加 `@open-webhook-config` 事件：

```vue
  <MainView
    v-if="!settingStore.isFloat"
    @enter-float="enterFloat"
    @open-db-config="showDbConfig = true"
    @open-auth="showAuth = true"
    @open-webhook-config="showWebhookConfig = true"
  />
```

- [ ] **Step 7: Commit**

```bash
git add src/App.vue
git commit -m "feat(app): integrate DingTalk scheduled push with timer and webhook modal"
```

---

## Task 5: 构建与测试验证

**Files:** 无（验证步骤）

- [ ] **Step 1: 运行前端测试**

```bash
npm run test:run
```

预期：现有测试全部通过。本次改动未修改 store 的核心逻辑，不应破坏现有测试。

- [ ] **Step 2: 运行前端构建**

```bash
npm run build
```

预期：构建成功，无 TypeScript/Vite 错误。

- [ ] **Step 3: 运行 Tauri 构建**

```bash
npm run tauri build
```

预期：Rust 编译成功（本次未修改 Rust 代码，应无任何变化）。

- [ ] **Step 4: Commit（如果测试全部通过）**

```bash
git commit --allow-empty -m "chore: verify build and tests pass after DingTalk webhook feature"
```

---

## Spec 覆盖检查

| Spec 要求 | 实现任务 | 状态 |
|-----------|----------|------|
| 右上角铃铛按钮打开配置界面 | Task 3 (TopBar) + Task 4 (App.vue 挂载) | ✅ |
| 配置界面：Webhook URL 输入 | Task 2 (WebhookConfigModal) | ✅ |
| 配置界面：启用/禁用开关 | Task 2 (enabled checkbox) | ✅ |
| 配置界面：多个推送时间（添加/删除/排序） | Task 2 (times list + input[type=time]) | ✅ |
| 测试推送按钮 | Task 2 (testPush) | ✅ |
| 配置存储到 SQLite app_settings | Task 1 (settingStore) | ✅ |
| 每分钟定时检查 | Task 4 (setInterval in App.vue onMounted) | ✅ |
| 时间匹配时触发推送 | Task 4 (checkPush) | ✅ |
| 防重机制 | Task 4 (dingtalk_last_push_HHMM) | ✅ |
| Markdown 消息格式 | Task 4 (formatMarkdown) | ✅ |
| 正在执行 = 所有未完成 | Task 4 (buildPushPayload active filter) | ✅ |
| 即将开始 = start_date 未来3天内 | Task 4 (buildPushPayload upcoming filter) | ✅ |
| 空任务跳过推送 | Task 4 (checkPush return early) | ✅ |
| fetch 5秒超时 | Task 2 + Task 4 (AbortSignal.timeout(5000)) | ✅ |
| 网络错误静默失败 | Task 4 (try/catch console.error) | ✅ |

---

## Placeholder 扫描

- [x] 无 TBD / TODO
- [x] 无 "implement later"
- [x] 无 "add appropriate error handling"
- [x] 每个任务包含完整代码
- [x] 每个任务包含具体命令和预期输出
- [x] 方法名和属性名在所有任务中一致

## 类型一致性检查

- `getWebhookConfig` / `saveWebhookConfig` — Task 1 定义，Task 2 和 Task 4 消费 ✅
- `dingtalk_webhook_url` / `dingtalk_push_times` / `dingtalk_enabled` — Task 1 读写，Spec 一致 ✅
- `dingtalk_last_push_{HHMM}` — Task 4 读写 ✅
- `buildPushPayload` 返回 `{ active, upcoming }` — Task 4 定义和使用一致 ✅
- `sendDingTalk(url, payload)` — Task 4 定义，参数类型一致 ✅
