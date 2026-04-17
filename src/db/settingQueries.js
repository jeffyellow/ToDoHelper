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

export async function hasMysqlConfig() {
  const db = await getDb()
  const rows = await db.select("SELECT value FROM app_settings WHERE key = 'mysql_host'")
  return rows[0]?.value != null
}

// MySQL password is intentionally not persisted locally.
// It is passed from the UI to Rust on a per-request basis.
export async function saveMysqlConfig({ host, port, database, username }) {
  const db = await getDb()
  await db.execute(
    "INSERT INTO app_settings (key, value) VALUES ('mysql_host', ?), ('mysql_port', ?), ('mysql_database', ?), ('mysql_username', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [host, String(port), database, username]
  )
}

export async function getMysqlConfig() {
  const db = await getDb()
  const rows = await db.select("SELECT key, value FROM app_settings WHERE key IN ('mysql_host', 'mysql_port', 'mysql_database', 'mysql_username')")
  const map = {}
  for (const r of rows) {
    map[r.key] = r.value
  }
  return {
    host: map.mysql_host || '',
    port: map.mysql_port ? parseInt(map.mysql_port, 10) : 3306,
    database: map.mysql_database || '',
    username: map.mysql_username || '',
  }
}
