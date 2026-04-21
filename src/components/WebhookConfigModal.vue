<script setup>
import { ref, watch, computed } from 'vue'
import { useSettingStore } from '../stores/settingStore.js'
import { postJson } from '../utils/http.js'
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
    const resp = await postJson(url.value.trim(), {
      msgtype: 'markdown',
      markdown: {
        title: '任务提醒测试',
        text: '## 🔔 测试推送\n\n这是一条测试消息，如果收到说明 Webhook 配置正确。',
      },
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
