<script setup>
import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { saveMysqlConfig, getMysqlConfig } from '../db/settingQueries.js'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close', 'connected'])

const step = ref('connection')
const isLoading = ref(false)
const error = ref('')

const host = ref('')
const port = ref(3306)
const database = ref('')
const mysqlUsername = ref('')
const mysqlPassword = ref('')

const authTab = ref('login')
const appUsername = ref('')
const appPassword = ref('')
const confirmPassword = ref('')

watch(() => props.open, async (open) => {
  if (open) {
    error.value = ''
    step.value = 'connection'
    const cfg = await getMysqlConfig()
    host.value = cfg.host
    port.value = cfg.port
    database.value = cfg.database
    mysqlUsername.value = cfg.username
    mysqlPassword.value = ''
    appUsername.value = ''
    appPassword.value = ''
    confirmPassword.value = ''
  }
})

async function testConnection() {
  isLoading.value = true
  error.value = ''
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
    step.value = 'auth'
  } catch (e) {
    error.value = '无法连接到数据库：' + (e?.message || e)
  } finally {
    isLoading.value = false
  }
}

async function handleAuth() {
  isLoading.value = true
  error.value = ''
  try {
    const config = {
      host: host.value,
      port: port.value,
      database: database.value,
      username: mysqlUsername.value,
      password: mysqlPassword.value,
    }
    if (authTab.value === 'register') {
      if (appPassword.value !== confirmPassword.value) {
        error.value = '两次输入的密码不一致'
        isLoading.value = false
        return
      }
      await invoke('register_user', {
        payload: {
          config,
          appUsername: appUsername.value,
          appPassword: appPassword.value,
        }
      })
    } else {
      await invoke('login_user', {
        payload: {
          config,
          appUsername: appUsername.value,
          appPassword: appPassword.value,
        }
      })
    }
    await saveMysqlConfig({
      host: host.value,
      port: port.value,
      database: database.value,
      username: mysqlUsername.value,
    })
    emit('connected')
    emit('close')
  } catch (e) {
    const prefix = authTab.value === 'register' ? '注册失败：' : '登录失败：'
    error.value = prefix + (e?.message || e)
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
      <h3 class="modal-title">数据库连接</h3>

      <div v-if="step === 'connection'" class="form">
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
          <input v-model="mysqlPassword" type="password" />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="$emit('close')">取消</button>
          <button class="btn-primary" :disabled="isLoading || !host.trim() || !database.trim() || !mysqlUsername.trim()" @click="testConnection">
            {{ isLoading ? '连接中...' : '测试连接' }}
          </button>
        </div>
      </div>

      <div v-else class="form">
        <div class="tabs">
          <button :class="{ active: authTab === 'login' }" @click="authTab = 'login'">登录</button>
          <button :class="{ active: authTab === 'register' }" @click="authTab = 'register'">注册</button>
        </div>
        <label>
          用户名
          <input v-model="appUsername" type="text" />
        </label>
        <label>
          密码
          <input v-model="appPassword" type="password" />
        </label>
        <label v-if="authTab === 'register'">
          确认密码
          <input v-model="confirmPassword" type="password" />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="step = 'connection'">上一步</button>
          <button class="btn-primary" :disabled="isLoading || !appUsername.trim() || !appPassword.trim()" @click="handleAuth">
            {{ isLoading ? '处理中...' : (authTab === 'register' ? '注册' : '登录') }}
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
.tabs {
  display: flex;
  gap: 8px;
}
.tabs button {
  flex: 1;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
}
.tabs button.active {
  background: var(--color-primary-subtle);
  color: var(--color-primary-hover);
  border-color: transparent;
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
