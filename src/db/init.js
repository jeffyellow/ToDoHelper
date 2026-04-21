import Database from '@tauri-apps/plugin-sql'
import { generateUuid } from './uuid.js'

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
  const colNames = cols.map((c) => c.name)

  if (!colNames.includes('start_date')) {
    await database.execute('ALTER TABLE tasks ADD COLUMN start_date TEXT')
  }
  if (!colNames.includes('updated_at')) {
    await database.execute("ALTER TABLE tasks ADD COLUMN updated_at TEXT")
    await database.execute("UPDATE tasks SET updated_at = datetime('now') WHERE updated_at IS NULL")
  }
  if (!colNames.includes('sync_state')) {
    await database.execute("ALTER TABLE tasks ADD COLUMN sync_state TEXT DEFAULT 'synced'")
  }
  if (!colNames.includes('deleted')) {
    await database.execute('ALTER TABLE tasks ADD COLUMN deleted INTEGER DEFAULT 0')
  }
  if (!colNames.includes('local_uuid')) {
    await database.execute('ALTER TABLE tasks ADD COLUMN local_uuid TEXT')
  }
  if (!colNames.includes('user_id')) {
    await database.execute('ALTER TABLE tasks ADD COLUMN user_id INTEGER')
  }

  const tasksWithoutUuid = await database.select('SELECT id FROM tasks WHERE local_uuid IS NULL')
  for (const task of tasksWithoutUuid) {
    const uuid = generateUuid()
    await database.execute('UPDATE tasks SET local_uuid = ? WHERE id = ?', [uuid, task.id])
  }

  // Fix any duplicate local_uuid values before creating unique index
  const duplicateRows = await database.select(
    'SELECT local_uuid FROM tasks WHERE local_uuid IS NOT NULL GROUP BY local_uuid HAVING COUNT(*) > 1'
  )
  for (const row of duplicateRows) {
    const dups = await database.select('SELECT id FROM tasks WHERE local_uuid = ?', [row.local_uuid])
    // Skip the first one, regenerate the rest
    for (let i = 1; i < dups.length; i++) {
      const newUuid = generateUuid()
      await database.execute('UPDATE tasks SET local_uuid = ? WHERE id = ?', [newUuid, dups[i].id])
    }
  }

  const indexes = await database.select('PRAGMA index_list(tasks)')
  const hasUuidIndex = indexes.some((i) => i.name === 'idx_tasks_local_uuid')
  if (!hasUuidIndex) {
    await database.execute('CREATE UNIQUE INDEX idx_tasks_local_uuid ON tasks(local_uuid)')
  }

  await database.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `)
}
