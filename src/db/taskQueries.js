import { getDb } from './init.js'

export async function selectAllTasks() {
  const db = await getDb()
  return db.select('SELECT * FROM tasks ORDER BY created_at DESC')
}

export async function insertTask({ title, startDate, dueDate, priority, tag }) {
  const db = await getDb()
  const result = await db.execute(
    'INSERT INTO tasks (title, start_date, due_date, priority, tag) VALUES (?, ?, ?, ?, ?)',
    [title, startDate ?? null, dueDate ?? null, priority ?? 1, tag ?? null]
  )
  return result.lastInsertId
}

export async function updateTask(id, { title, completed, startDate, dueDate, priority, tag, completedAt }) {
  const db = await getDb()
  await db.execute(
    `UPDATE tasks SET
      title = COALESCE(?, title),
      completed = COALESCE(?, completed),
      start_date = COALESCE(?, start_date),
      due_date = COALESCE(?, due_date),
      priority = COALESCE(?, priority),
      tag = COALESCE(?, tag),
      completed_at = COALESCE(?, completed_at)
     WHERE id = ?`,
    [title ?? null, completed ?? null, startDate ?? null, dueDate ?? null, priority ?? null, tag ?? null, completedAt ?? null, id]
  )
}

export async function deleteTask(id) {
  const db = await getDb()
  await db.execute('DELETE FROM tasks WHERE id = ?', [id])
}
