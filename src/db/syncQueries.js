import { getDb } from './init.js'

export async function getPendingTasks(userId) {
  const db = await getDb()
  if (!userId) return []
  return db.select("SELECT id, local_uuid, title, completed, start_date, due_date, priority, tag, created_at, completed_at, updated_at, deleted FROM tasks WHERE sync_state = 'pending' AND user_id = ?", [userId])
}

export async function markTasksSynced(ids) {
  if (ids.length === 0) return
  const db = await getDb()
  const placeholders = ids.map(() => '?').join(',')
  await db.execute(`UPDATE tasks SET sync_state = 'synced' WHERE id IN (${placeholders})`, ids)
}

export async function getLastSyncAt(userId) {
  const db = await getDb()
  const key = `last_sync_at_${userId}`
  const rows = await db.select('SELECT value FROM app_settings WHERE key = ?', [key])
  return rows[0]?.value ?? null
}

export async function setLastSyncAt(value, userId) {
  const db = await getDb()
  const key = `last_sync_at_${userId}`
  await db.execute(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  )
}

export async function cleanupDeletedTasks(userId) {
  const db = await getDb()
  if (!userId) return
  await db.execute("DELETE FROM tasks WHERE deleted = 1 AND sync_state = 'synced' AND user_id = ?", [userId])
}

export async function upsertTaskByUuid(task, userId) {
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
        deleted = 0,
        sync_state = 'synced'
       WHERE local_uuid = ?`,
      [
        task.title,
        task.completed ? 1 : 0,
        task.start_date ?? null,
        task.due_date ?? null,
        task.priority ?? 1,
        task.tag ?? null,
        task.created_at ?? null,
        task.completed_at ?? null,
        task.updated_at,
        task.local_uuid,
      ]
    )
  } else {
    await db.execute(
      `INSERT INTO tasks (local_uuid, title, completed, start_date, due_date, priority, tag, created_at, completed_at, updated_at, deleted, sync_state, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'synced', ?)`,
      [
        task.local_uuid,
        task.title,
        task.completed ? 1 : 0,
        task.start_date ?? null,
        task.due_date ?? null,
        task.priority ?? 1,
        task.tag ?? null,
        task.created_at ?? null,
        task.completed_at ?? null,
        task.updated_at,
        userId,
      ]
    )
  }
}
