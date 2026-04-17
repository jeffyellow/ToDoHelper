import Database from '@tauri-apps/plugin-sql'

let db = null

export async function getDb() {
  if (!db) {
    db = await Database.load('sqlite:todo.db')
  }
  return db
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
  const hasStartDate = cols.some((c) => c.name === 'start_date')
  if (!hasStartDate) {
    await database.execute('ALTER TABLE tasks ADD COLUMN start_date TEXT')
  }
  await database.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `)
}
