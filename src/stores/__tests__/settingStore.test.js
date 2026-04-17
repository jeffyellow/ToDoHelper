import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingStore } from '../settingStore.js'

vi.mock('../../db/settingQueries.js', () => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
}))

import { getSetting, setSetting } from '../../db/settingQueries.js'

describe('settingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('当数据库返回 null 时，主题初始化为 light', async () => {
    getSetting.mockResolvedValue(null)
    const store = useSettingStore()
    await store.init()
    expect(store.theme).toBe('light')
  })

  it('切换主题并持久化', async () => {
    getSetting.mockResolvedValue('light')
    const store = useSettingStore()
    await store.init()
    await store.toggleTheme()
    expect(store.theme).toBe('dark')
    expect(setSetting).toHaveBeenCalledWith('theme', 'dark')
  })
})
