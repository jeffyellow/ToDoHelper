# 钉钉 Webhook 定时推送设计

## 需求概述

在 ToDoHelper 桌面应用运行时，定时通过钉钉机器人 Webhook 推送当前"正在执行"和"即将开始"的任务信息。

- **正在执行**：`completed = 0` 的所有未完成任务（按优先级排序）。
- **即将开始**：`completed = 0` 且 `start_date` 在"今天 ~ 今天+3天"范围内的任务。

## 架构设计（纯前端方案）

所有逻辑都在前端 Vue 层完成，Rust 后端零改动，无需新增依赖。

```
TopBar.vue (+铃铛按钮) ──▶ WebhookConfigModal (配置界面)
                                │
                                ▼
                        settingStore.js (配置读写)
                                │
                                ▼
                        SQLite app_settings (持久化)
                                ▲
                                │
                        App.vue (setInterval 定时检查)
                                │
                                ▼
                        fetch(钉钉 Webhook) + Markdown 消息体
```

### 核心改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src/components/TopBar.vue` | 修改 | 右上角新增铃铛图标按钮 |
| `src/components/WebhookConfigModal.vue` | 新增 | Webhook 配置弹窗 |
| `src/stores/settingStore.js` | 修改 | 新增 webhook 配置状态和持久化方法 |
| `src/App.vue` | 修改 | 启动时启停定时推送检查器 |

## 配置存储

复用现有 SQLite `app_settings` 键值表，无需新增表或改 schema。

| key | 类型 | 说明 |
|-----|------|------|
| `dingtalk_webhook_url` | string | 钉钉机器人 Webhook URL |
| `dingtalk_push_times` | string | 逗号分隔的 HH:MM 列表，如 `"09:00,14:00,18:00"` |
| `dingtalk_enabled` | `"true"` / `"false"` | 总开关，默认 `"true"` |
| `dingtalk_last_push_{HHMM}` | string | 防重键，值为 `"YYYY-MM-DD"`，表示该时间点今日已推送过 |

### settingStore 新增方法

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

## 定时器调度逻辑（App.vue）

```js
const CHECK_INTERVAL = 60_000 // 每分钟检查一次

onMounted(() => {
  const timer = setInterval(checkPush, CHECK_INTERVAL)
  checkPush() // 立即检查一次
  onUnmounted(() => clearInterval(timer))
})

async function checkPush() {
  const config = await settingStore.getWebhookConfig()
  if (!config.enabled || !config.url) return

  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const times = config.times.split(',').map(t => t.trim()).filter(Boolean)
  if (!times.includes(currentTime)) return

  // 防重：同一分钟不重复推送
  const lastPushKey = `dingtalk_last_push_${currentTime.replace(':', '')}`
  const lastPushDate = await getSetting(lastPushKey)
  const today = now.toISOString().slice(0, 10)
  if (lastPushDate === today) return

  const tasks = await buildPushPayload()
  if (tasks.active.length === 0 && tasks.upcoming.length === 0) return // 空任务跳过

  await sendDingTalk(config.url, tasks)
  await setSetting(lastPushKey, today)
}
```

## 推送消息格式（Markdown）

```markdown
## 🔔 任务提醒

### 正在执行（3个）
- [ ] **高优** 完成设计文档（截止：2026-04-22）
- [ ] 代码评审（截止：2026-04-21）
- [ ] 测试用例编写（截止：2026-04-25）

### 即将开始（2个）
- 📅 2026-04-21：部署上线
- 📅 2026-04-23：用户验收测试
```

**字段映射**：
- 任务标题 → `title`
- 截止时间 → `due_date`
- 优先级显示：1=高优, 2=中优, 3=低优（优先级为 1 时才加粗标注）
- 即将开始的任务按 `start_date` 分组/排序

## 配置界面（WebhookConfigModal）

### UI 布局

```
┌─────────────────────────────────────────────┐
│  ×   钉钉推送设置                              │
├─────────────────────────────────────────────┤
│                                             │
│  [✓] 启用定时推送                             │
│                                             │
│  Webhook 地址                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ https://oapi.dingtalk.com/robot/...     │  │
│  └─────────────────────────────────────────┘  │
│                                             │
│  推送时间（可多选）                            │
│  ┌─────────────┐  ┌─────────────┐           │
│  │  09:00  [×] │  │  14:00  [×] │           │
│  └─────────────┘  └─────────────┘           │
│  ┌─────────────┐                            │
│  │  18:00  [×] │  [+ 添加时间]               │
│  └─────────────┘                            │
│                                             │
│  [测试推送]         [取消]      [保存]         │
│                                             │
└─────────────────────────────────────────────┘
```

### 交互说明

- 使用 `<input type="time">` 选择时间点，格式 `HH:MM`。
- 每个时间点右侧有删除按钮（小 ×）。
- **添加时间**：弹出时间选择器，确认后添加到列表，列表按时间升序自动排序。
- **保存**：验证 URL 非空、至少一个时间点，写入 SQLite，关闭模态框。
- **测试推送**：立即发送一次测试消息（内容包含"测试推送"），根据返回结果 toast 提示成功/失败。
- 样式复用现有设计系统（圆角 12px、边框 `var(--border)`、主色调 `#fb923c` 等）。
- 参考现有 `DatabaseConfigModal.vue` 和 `AuthModal.vue` 的模态框实现模式。

## 错误处理策略

| 场景 | 处理方式 |
|------|----------|
| Webhook URL 为空/无效 | 保存时阻止，UI 提示必填 |
| 无推送时间点 | 保存时阻止，UI 提示至少添加一个 |
| fetch 网络错误（离线） | 静默失败，console.error |
| 钉钉返回非 200 | 记录错误码，静默失败 |
| 同一分钟多次触发 | `dingtalk_last_push_{HHMM}` 键值防重 |
| 推送超时 | 5 秒超时，超时不阻塞，静默失败 |
| 正在执行和即将开始均为空 | **跳过本次推送，不发消息** |

## 数据获取

复用现有 `taskStore` 的 `tasks` ref，在 `App.vue` 的推送逻辑中直接读取：

```js
function buildPushPayload() {
  const today = new Date().toISOString().slice(0, 10)
  const upcomingCutoff = new Date()
  upcomingCutoff.setDate(upcomingCutoff.getDate() + 3)
  const cutoffStr = upcomingCutoff.toISOString().slice(0, 10)

  const active = tasks.value
    .filter(t => !t.completed)
    .sort((a, b) => b.priority - a.priority)

  const upcoming = tasks.value
    .filter(t => !t.completed && t.start_date && t.start_date >= today && t.start_date <= cutoffStr)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  return { active, upcoming }
}
```

## 测试要点

1. **配置保存/读取**：修改 webhook URL 和推送时间后重启应用，配置是否正确恢复。
2. **定时触发**：将系统时间手动调整到配置的时间点，验证推送触发。
3. **防重机制**：同一时间点不重复推送。
4. **空任务跳过**：所有任务已完成时，该时间点不发送消息。
5. **测试推送**：点击"测试推送"按钮，验证钉钉收到消息且 UI 显示成功提示。
6. **离线容错**：断开网络后推送静默失败，不阻塞应用。

## 依赖

无需新增任何前端或 Rust 依赖。使用浏览器原生 `fetch` 发送 HTTP 请求。

## 范围边界

- 不处理应用关闭后的后台推送（应用最小化/隐藏时，前端 JS 仍在运行，定时器正常工作）。
- 不支持钉钉加签（secret），仅支持带 access_token 的普通 Webhook URL。
- 推送时间点为每天固定时间，不支持按星期分别设置。
- 仅推送 Markdown 文本消息，不支持 actionCard、feedCard 等高级卡片格式。
