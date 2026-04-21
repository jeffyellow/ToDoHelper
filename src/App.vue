<script setup>
import { onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import MainView from './views/MainView.vue'
import FloatView from './views/FloatView.vue'
import DatabaseConfigModal from './components/DatabaseConfigModal.vue'
import AuthModal from './components/AuthModal.vue'
import WebhookConfigModal from './components/WebhookConfigModal.vue'
import { useSettingStore } from './stores/settingStore.js'
import { useTaskStore } from './stores/taskStore.js'
import { initDb } from './db/init.js'
import { getSetting, setSetting } from './db/settingQueries.js'

const settingStore = useSettingStore()
const taskStore = useTaskStore()
const showDbConfig = ref(false)
const showAuth = ref(false)
const showWebhookConfig = ref(false)

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
  } catch (e) {
    console.error('App initialization failed:', e)
    alert('初始化失败：' + (e?.message || String(e)))
  }
})

async function enterFloat() {
  try {
    await invoke('set_float_mode')
    settingStore.isFloat = true
  } catch (e) {
    console.error('Enter float mode failed:', e)
    alert('切换悬浮窗失败：' + (e?.message || String(e)))
  }
}

async function exitFloat() {
  try {
    await invoke('set_main_mode')
    settingStore.isFloat = false
  } catch (e) {
    console.error('Exit float mode failed:', e)
    alert('返回主界面失败：' + (e?.message || String(e)))
  }
}

function onAuthSuccess() {
  taskStore.triggerSync().catch(console.error)
}

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
  let text = '## \uD83D\uDD14 任务提醒\n\n'

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
      text += `- \uD83D\uDCC5 ${t.start_date}：${t.title}\n`
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
</script>

<template>
  <MainView
    v-if="!settingStore.isFloat"
    @enter-float="enterFloat"
    @open-db-config="showDbConfig = true"
    @open-auth="showAuth = true"
    @open-webhook-config="showWebhookConfig = true"
  />
  <FloatView
    v-else
    @exit-float="exitFloat"
  />
  <DatabaseConfigModal
    :open="showDbConfig"
    @close="showDbConfig = false"
  />
  <AuthModal
    :open="showAuth"
    @close="showAuth = false"
    @logged-in="onAuthSuccess"
  />
  <WebhookConfigModal
    :open="showWebhookConfig"
    @close="showWebhookConfig = false"
  />
</template>

<style>
#app {
  display: flex;
  flex-direction: column;
}
</style>
