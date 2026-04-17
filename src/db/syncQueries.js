import { getDb } from './init.js'

export async function getPendingTasks() {
  const db = await getDb()
  return db.select("SELECT id, local_uuid, title, completed, start_date, due_date, priority, tag, created_at, completed_at, updated_at FROM tasks WHERE sync_state = 'pending'")
}

export async function markTasksSynced(ids) {
  if (ids.length === 0) return
  const db = await getDb()
  const placeholders = ids.map(() => '?').join(',')
  await db.execute(`UPDATE tasks SET sync_state = 'synced' WHERE id IN (${placeholders})`, ids)
}

export async function getLastSyncAt() {
  const db = await getDb()
  const rows = await db.select("SELECT value FROM app_settings WHERE key = 'last_sync_at'")
  return rows[0]?.value ?? null
}

export async function setLastSyncAt(value) {
  const db = await getDb()
  await db.execute(
    "INSERT INTO app_settings (key, value) VALUES ('last_sync_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [value]
  )
}

export async function upsertTaskByUuid(task) {
  const db = await getDb()
  const rows = await db.select('SELECT id FROM tasks WHERE local_uuid = ?', [task.local_uuid])
  if (rows.length > 0) {
    await db.execute(
      `UPDATE tasks SET
        title = ?,
        completed = ?,
        start_date = ?,
        due_date = ?,
        priority = ?,
        tag = ?,
        created_at = ?,
        completed_at = ?,
        updated_at = ?,
        sync_state = 'synced'
       WHERE local_uuid = ?`,
      [
        task.title,
        task.completed ? 1 : 0,
        task.start_date ?? null,
        task.due_date ?? null,
        task.priority,
        task.tag ?? null,
        task.created_at ?? null,
        task.completed_at ?? null,
        task.updated_at,
        task.local_uuid,
      ]
    )
  } else {
    await db.execute(
      `INSERT INTO tasks (local_uuid, title, completed, start_date, due_date, priority, tag, created_at, completed_at, updated_at, sync_state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
      [
        task.local_uuid,
        task.title,
        task.completed ? 1 : 0,
        task.start_date ?? null,
        task.due_date ?? null,
        task.priority,
        task.tag ?? null,
        task.created_at ?? null,
        task.completed_at ?? null,
        task.updated_at,
      ]
    )
  }
}
