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
  const rows = await db.select(
    "SELECT key, value FROM app_settings WHERE key IN ('mysql_host', 'mysql_username')"
  )
  const host = rows.find(r => r.key === 'mysql_host')?.value
  const username = rows.find(r => r.key === 'mysql_username')?.value
  return host != null && username != null
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

export async function saveEncryptedPassword(encrypted) {
  const db = await getDb()
  await db.execute(
    "INSERT INTO app_settings (key, value) VALUES ('mysql_password_enc', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [encrypted]
  )
}

export async function getEncryptedPassword() {
  const db = await getDb()
  const rows = await db.select("SELECT value FROM app_settings WHERE key = 'mysql_password_enc'")
  return rows[0]?.value ?? null
}

export async function saveAuthSession({ token, userId, username }) {
  const db = await getDb()
  await db.execute(
    "INSERT INTO app_settings (key, value) VALUES ('auth_token', ?), ('auth_user_id', ?), ('auth_username', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [token, String(userId), username]
  )
}

export async function getAuthSession() {
  const db = await getDb()
  const rows = await db.select("SELECT key, value FROM app_settings WHERE key IN ('auth_token', 'auth_user_id', 'auth_username')")
  const map = {}
  for (const r of rows) {
    map[r.key] = r.value
  }
  return {
    token: map.auth_token || null,
    userId: map.auth_user_id ? parseInt(map.auth_user_id, 10) : null,
    username: map.auth_username || null,
  }
}

export async function clearAuthSession() {
  const db = await getDb()
  await db.execute(
    "DELETE FROM app_settings WHERE key IN ('auth_token', 'auth_user_id', 'auth_username')"
  )
}

export async function clearEncryptedPassword() {
  const db = await getDb()
  await db.execute(
    "DELETE FROM app_settings WHERE key = 'mysql_password_enc'"
  )
}
