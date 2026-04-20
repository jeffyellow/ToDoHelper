import { getDb } from './init.js'
import { generateUuid } from './uuid.js'

export async function selectAllTasks() {
  const db = await getDb()
  return db.select('SELECT * FROM tasks WHERE deleted = 0 OR deleted IS NULL ORDER BY created_at DESC')
}

export async function insertTask({ title, startDate, dueDate, priority, tag }) {
  const db = await getDb()
  const localUuid = generateUuid()
  const updatedAt = new Date().toISOString()
  const result = await db.execute(
    'INSERT INTO tasks (title, start_date, due_date, priority, tag, local_uuid, updated_at, sync_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [title, startDate ?? null, dueDate ?? null, priority ?? 1, tag ?? null, localUuid, updatedAt, 'pending']
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
