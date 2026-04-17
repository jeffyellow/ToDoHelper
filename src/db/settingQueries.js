import { getDb } from './init.js'

export async function getSetting(key) {
  const db = await getDb()
  const rows = await db.select('SELECT value FROM app_settings WHERE key = ?', [key])
  return rows[0]?.value ?? null
}

export async function setSetting(key, value) {
  const db = await getDb()
  await db.execute(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  )
}
