import Database from '@tauri-apps/plugin-sql'

let db = null

export async function getDb() {
  if (!db) {
    db = await Database.load('sqlite:todo.db')
  }
  return db
}

function generateUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export async function initDb() {
  const database = await getDb()
  await database.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      start_date TEXT,
      due_date TEXT,
      priority INTEGER DEFAULT 1,
      tag TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    )
  `)
  const cols = await database.select('PRAGMA table_info(tasks)')
  const colNames = cols.map((c) => c.name)

  if (!colNames.includes('start_date')) {
    await database.execute('ALTER TABLE tasks ADD COLUMN start_date TEXT')
  }
  if (!colNames.includes('updated_at')) {
    await database.execute("ALTER TABLE tasks ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))")
  }
  if (!colNames.includes('sync_state')) {
    await database.execute("ALTER TABLE tasks ADD COLUMN sync_state TEXT DEFAULT 'synced'")
  }
  if (!colNames.includes('local_uuid')) {
    await database.execute('ALTER TABLE tasks ADD COLUMN local_uuid TEXT')
  }

  const tasksWithoutUuid = await database.select('SELECT id FROM tasks WHERE local_uuid IS NULL')
  for (const task of tasksWithoutUuid) {
    const uuid = generateUuid()
    await database.execute('UPDATE tasks SET local_uuid = ? WHERE id = ?', [uuid, task.id])
  }

  await database.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `)
}
