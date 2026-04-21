import { defineStore } from 'pinia'
import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getSetting, setSetting } from '../db/settingQueries.js'
import {
  getMysqlConfig,
  getEncryptedPassword,
  getAuthSession,
  saveAuthSession,
  clearAuthSession,
  clearEncryptedPassword,
  saveEncryptedPassword,
} from '../db/settingQueries.js'

export const useSettingStore = defineStore('setting', () => {
  const theme = ref('light')
  const floatOpacity = ref(95)
  const floatAlwaysOnTop = ref(true)
  const isFloat = ref(false)
  const isLoggedIn = ref(false)
  const currentUser = ref(null)
  const lastUserId = ref(null)

  async function init() {
    const savedTheme = await getSetting('theme')
    theme.value = savedTheme || 'light'
    document.documentElement.setAttribute('data-theme', theme.value)

    const savedOpacity = await getSetting('floatOpacity')
    if (savedOpacity !== null) floatOpacity.value = parseInt(savedOpacity, 10)

    const savedAlwaysOnTop = await getSetting('floatAlwaysOnTop')
    if (savedAlwaysOnTop !== null) floatAlwaysOnTop.value = savedAlwaysOnTop === 'true'
  }

  async function restoreSession() {
    const mysqlConfig = await getMysqlConfig()
    const encryptedPw = await getEncryptedPassword()
    const auth = await getAuthSession()

    if (!mysqlConfig.host || !encryptedPw || !auth.token || !auth.userId) {
      isLoggedIn.value = false
      currentUser.value = null
      return
    }

    try {
      const password = await invoke('decrypt_password', { encrypted: encryptedPw })
      const config = { ...mysqlConfig, password }
      await invoke('restore_session', {
        payload: {
          config,
          token: auth.token,
          userId: auth.userId,
          username: auth.username,
        },
      })
      isLoggedIn.value = true
      currentUser.value = { userId: auth.userId, username: auth.username }
      lastUserId.value = auth.userId
    } catch (e) {
      console.error('Session restore failed:', e)
      isLoggedIn.value = false
      currentUser.value = null
      await clearAuthSession()
      await clearEncryptedPassword()
    }
  }

  async function saveSession({ token, userId, username, password }) {
    await saveAuthSession({ token, userId, username })
    const encrypted = await invoke('encrypt_password', { password })
    await saveEncryptedPassword(encrypted)
    isLoggedIn.value = true
    currentUser.value = { userId, username }
    lastUserId.value = userId
  }

  async function logout() {
    if (currentUser.value?.userId) {
      lastUserId.value = currentUser.value.userId
    }
    await clearAuthSession()
    isLoggedIn.value = false
    currentUser.value = null
  }

  async function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme.value)
    await setSetting('theme', theme.value)
  }

  async function setFloatOpacity(value) {
    floatOpacity.value = value
    await setSetting('floatOpacity', String(value))
  }

  async function setFloatAlwaysOnTop(value) {
    floatAlwaysOnTop.value = value
    await setSetting('floatAlwaysOnTop', String(value))
  }

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

  return {
    theme,
    floatOpacity,
    floatAlwaysOnTop,
    isFloat,
    isLoggedIn,
    currentUser,
    init,
    restoreSession,
    saveSession,
    logout,
    toggleTheme,
    setFloatOpacity,
    setFloatAlwaysOnTop,
    getWebhookConfig,
    saveWebhookConfig,
  }
})
