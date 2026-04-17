import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSetting, setSetting } from '../db/settingQueries.js'

export const useSettingStore = defineStore('setting', () => {
  const theme = ref('light')
  const floatOpacity = ref(95)
  const floatAlwaysOnTop = ref(true)
  const isFloat = ref(false)

  async function init() {
    const savedTheme = await getSetting('theme')
    theme.value = savedTheme || 'light'
    document.documentElement.setAttribute('data-theme', theme.value)

    const savedOpacity = await getSetting('floatOpacity')
    if (savedOpacity !== null) floatOpacity.value = parseInt(savedOpacity, 10)

    const savedAlwaysOnTop = await getSetting('floatAlwaysOnTop')
    if (savedAlwaysOnTop !== null) floatAlwaysOnTop.value = savedAlwaysOnTop === 'true'
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

  return {
    theme,
    floatOpacity,
    floatAlwaysOnTop,
    isFloat,
    init,
    toggleTheme,
    setFloatOpacity,
    setFloatAlwaysOnTop,
  }
})
