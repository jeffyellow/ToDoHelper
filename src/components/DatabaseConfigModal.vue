<script setup>
import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { saveMysqlConfig, getMysqlConfig, saveEncryptedPassword } from '../db/settingQueries.js'
import { useSettingStore } from '../stores/settingStore.js'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close'])

const settingStore = useSettingStore()

const isLoading = ref(false)
const testResult = ref('')
const error = ref('')

const host = ref('')
const port = ref(3306)
const database = ref('')
const mysqlUsername = ref('')
const mysqlPassword = ref('')

watch(() => props.open, async (open) => {
  if (open) {
    error.value = ''
    testResult.value = ''
    const cfg = await getMysqlConfig()
    host.value = cfg.host
    port.value = cfg.port
    database.value = cfg.database
    mysqlUsername.value = cfg.username
    mysqlPassword.value = ''
  }
})

async function testConnection() {
  isLoading.value = true
  error.value = ''
  testResult.value = ''
  try {
    await invoke('test_mysql_connection', {
      config: {
        host: host.value,
        port: port.value,
        database: database.value,
        username: mysqlUsername.value,
        password: mysqlPassword.value,
      }
    })
    testResult.value = '连接成功'
  } catch (e) {
    error.value = '连接失败：' + (e?.message || String(e))
  } finally {
    isLoading.value = false
  }
}

async function saveConfig() {
  isLoading.value = true
  error.value = ''
  try {
    await saveMysqlConfig({
      host: host.value,
      port: port.value,
      database: database.value,
      username: mysqlUsername.value,
    })
    if (mysqlPassword.value) {
      const encrypted = await invoke('encrypt_password', { password: mysqlPassword.value })
      await saveEncryptedPassword(encrypted)
    }
    testResult.value = '配置已保存'
    if (settingStore.isLoggedIn) {
      await settingStore.restoreSession()
    }
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
      <h3 class="modal-title">数据库连接配置</h3>

      <div class="form">
        <label>
          主机地址
          <input v-model="host" type="text" placeholder="例如：localhost" />
        </label>
        <label>
          端口
          <input v-model.number="port" type="number" />
        </label>
        <label>
          数据库名
          <input v-model="database" type="text" />
        </label>
        <label>
          MySQL 用户名
          <input v-model="mysqlUsername" type="text" />
        </label>
        <label>
          MySQL 密码
          <input v-model="mysqlPassword" type="password" placeholder="输入密码以保存" />
        </label>
        <p v-if="testResult" class="success">{{ testResult }}</p>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="$emit('close')">关闭</button>
          <button class="btn-secondary" :disabled="isLoading" @click="testConnection">
            {{ isLoading ? '测试中...' : '测试连接' }}
          </button>
          <button class="btn-primary" :disabled="isLoading || !host.trim() || !database.trim() || !mysqlUsername.trim()" @click="saveConfig">
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
  width: 420px;
  max-width: 90%;
  background: var(--bg);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
}
.modal-title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}
.form input {
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
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
