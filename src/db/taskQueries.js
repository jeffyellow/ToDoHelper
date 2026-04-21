import { getDb } from './init.js'
import { generateUuid } from './uuid.js'

export async function selectAllTasks(userId) {
  const db = await getDb()
  if (userId) {
    return db.select('SELECT * FROM tasks WHERE user_id = ? AND (deleted = 0 OR deleted IS NULL) ORDER BY created_at DESC', [userId])
  }
  return db.select("SELECT * FROM tasks WHERE user_id IS NULL AND (deleted = 0 OR deleted IS NULL) ORDER BY created_at DESC")
}

export async function assignUserIdToNullTasks(userId) {
  const db = await getDb()
  if (!userId) return
  await db.execute(
    "UPDATE tasks SET user_id = ?, sync_state = 'pending' WHERE user_id IS NULL",
    [userId]
  )
}

export async function insertTask({ title, startDate, dueDate, priority, tag, userId }) {
  const db = await getDb()
  const localUuid = generateUuid()
  const updatedAt = new Date().toISOString()
  const result = await db.execute(
    'INSERT INTO tasks (title, start_date, due_date, priority, tag, local_uuid, updated_at, sync_state, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [title, startDate ?? null, dueDate ?? null, priority ?? 1, tag ?? null, localUuid, updatedAt, 'pending', userId]
  )
  return result.lastInsertId
}

export async function updateTask(id, { title, completed, startDate, dueDate, priority, tag, completedAt }) {
  const db = await getDb()
  const updatedAt = new Date().toISOString()
  await db.execute(
    `UPDATE tasks SET
      title = COALESCE(?, title),
      completed = COALESCE(?, completed),
      start_date = COALESCE(?, start_date),
      due_date = COALESCE(?, due_date),
      priority = COALESCE(?, priority),
      tag = COALESCE(?, tag),
      completed_at = COALESCE(?, completed_at),
      updated_at = ?,
      sync_state = 'pending'
     WHERE id = ?`,
    [title ?? null, completed ?? null, startDate ?? null, dueDate ?? null, priority ?? null, tag ?? null, completedAt ?? null, updatedAt, id]
  )
}

export async function deleteTask(id) {
  const db = await getDb()
  const updatedAt = new Date().toISOString()
  await db.execute(
    "UPDATE tasks SET deleted = 1, updated_at = ?, sync_state = 'pending' WHERE id = ?",
    [updatedAt, id]
  )
}
