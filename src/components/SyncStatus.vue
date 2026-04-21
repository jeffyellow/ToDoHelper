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

<template>
  <div
    class="sync-status"
    :title="labels[status]?.text + '（点击测试数据库连接）'"
    @click="onTestConnection"
  >
    <span class="icon">{{ labels[status]?.icon }}</span>
  </div>
</template>

<style scoped>
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
.icon {
  font-size: 14px;
  line-height: 1;
}
</style>
