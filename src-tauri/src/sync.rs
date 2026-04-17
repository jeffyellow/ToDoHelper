use serde::{Deserialize, Serialize};
use sqlx::{MySqlPool, Row};

#[derive(Deserialize, Clone)]
pub struct LocalTask {
    pub id: i64,
    pub local_uuid: String,
    pub title: String,
    pub completed: i32,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub priority: i32,
    pub tag: Option<String>,
    pub created_at: Option<String>,
    pub completed_at: Option<String>,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RemoteTask {
    pub local_uuid: String,
    pub title: String,
    pub completed: bool,
    pub start_date: Option<String>,
    pub due_date: Option<String>,
    pub priority: i32,
    pub tag: Option<String>,
    pub created_at: Option<String>,
    pub completed_at: Option<String>,
    pub updated_at: String,
}

pub async fn push_tasks(pool: &MySqlPool, user_id: i32, tasks: &[LocalTask]) -> Result<(), String> {
    for task in tasks {
        sqlx::query(
            r#"
            INSERT INTO tasks (
                user_id, local_uuid, title, completed, start_date, due_date,
                priority, tag, created_at, completed_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                title = IF(VALUES(updated_at) >= updated_at, VALUES(title), title),
                completed = IF(VALUES(updated_at) >= updated_at, VALUES(completed), completed),
                start_date = IF(VALUES(updated_at) >= updated_at, VALUES(start_date), start_date),
                due_date = IF(VALUES(updated_at) >= updated_at, VALUES(due_date), due_date),
                priority = IF(VALUES(updated_at) >= updated_at, VALUES(priority), priority),
                tag = IF(VALUES(updated_at) >= updated_at, VALUES(tag), tag),
                created_at = IF(VALUES(updated_at) >= updated_at, VALUES(created_at), created_at),
                completed_at = IF(VALUES(updated_at) >= updated_at, VALUES(completed_at), completed_at),
                updated_at = IF(VALUES(updated_at) >= updated_at, VALUES(updated_at), updated_at)
            "#
        )
        .bind(user_id)
        .bind(&task.local_uuid)
        .bind(&task.title)
        .bind(task.completed as i8)
        .bind(&task.start_date)
        .bind(&task.due_date)
        .bind(task.priority)
        .bind(&task.tag)
        .bind(&task.created_at)
        .bind(&task.completed_at)
        .bind(&task.updated_at)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub async fn pull_tasks(
    pool: &MySqlPool,
    user_id: i32,
    last_sync_at: Option<&str>,
) -> Result<Vec<RemoteTask>, String> {
    let rows = if let Some(ts) = last_sync_at {
        sqlx::query(
            "SELECT local_uuid, title, completed, start_date, due_date, priority, tag, created_at, completed_at, updated_at
             FROM tasks WHERE user_id = ? AND updated_at > ?"
        )
        .bind(user_id)
        .bind(ts)
        .fetch_all(pool)
        .await
    } else {
        sqlx::query(
            "SELECT local_uuid, title, completed, start_date, due_date, priority, tag, created_at, completed_at, updated_at
             FROM tasks WHERE user_id = ?"
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
    }
    .map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    for row in rows {
        tasks.push(RemoteTask {
            local_uuid: row.try_get("local_uuid").map_err(|e| e.to_string())?,
            title: row.try_get("title").map_err(|e| e.to_string())?,
            completed: row.try_get::<i8, _>("completed").map_err(|e| e.to_string())? != 0,
            start_date: row.try_get("start_date").ok(),
            due_date: row.try_get("due_date").ok(),
            priority: row.try_get("priority").map_err(|e| e.to_string())?,
            tag: row.try_get("tag").ok(),
            created_at: row.try_get("created_at").ok(),
            completed_at: row.try_get("completed_at").ok(),
            updated_at: row.try_get("updated_at").map_err(|e| e.to_string())?,
        });
    }
    Ok(tasks)
}
