# MySQL Sync + Database Config Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add remote MySQL synchronization with local SQLite fallback, plus a database connection configuration modal with in-app user registration and login.

**Architecture:** Rust backend connects directly to MySQL using `sqlx` (non-macro runtime queries to avoid compile-time DB requirements). Auth uses `bcrypt` for password hashing. Sync is bidirectional with timestamp-based conflict resolution. Frontend triggers sync asynchronously after local mutations. A modal handles MySQL connection testing and user auth.

**Tech Stack:** Vue 3, Pinia, Tauri v2, Rust (`sqlx`, `bcrypt`, `jsonwebtoken`, `uuid`, `chrono`), SQLite (local cache), MySQL (remote)

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/db/init.js` | SQLite schema migration: add `updated_at`, `sync_state`, `local_uuid`; backfill UUIDs |
| `src/db/taskQueries.js` | Update `insertTask`/`updateTask` to set `updated_at`, `local_uuid`, `sync_state` |
| `src/db/syncQueries.js` | New: queries for pending tasks, last_sync_at, upsert by UUID, mark synced |
| `src/db/settingQueries.js` | Add `hasMysqlConfig()` helper |
| `src/stores/taskStore.js` | Add `syncStatus`, `triggerSync()`, wire sync into all mutations |
| `src/components/SyncStatus.vue` | Small icon component showing sync state |
| `src/components/DatabaseConfigModal.vue` | Two-step modal: connection test → login/register |
| `src/components/TopBar.vue` | Add `SyncStatus` and db config button |
| `src/components/Sidebar.vue` | Add db config menu item |
| `src/App.vue` | Auto-open config modal on first launch; mount modal |
| `src-tauri/Cargo.toml` | Add Rust dependencies |
| `src-tauri/src/lib.rs` | App state, Tauri commands, command registration |
| `src-tauri/src/mysql_client.rs` | MySQL connection pool creation |
| `src-tauri/src/auth.rs` | Password hashing, JWT generation, register/login queries |
| `src-tauri/src/sync.rs` | Push local tasks to MySQL, pull remote tasks by `updated_at` |
| `src/stores/__tests__/taskStore.test.js` | Update mocks to include `sync_state`/`local_uuid` fields |

---

## Design Notes

- **No soft-delete sync:** Deletions remain local-only for this iteration. The sync engine handles creates and updates.
- **Dynamic MySQL connection:** `sqlx::query` (runtime API) is used instead of `query!` macro so no compile-time database is required.
- **Password handling:** MySQL connection password and app password are passed from frontend to Rust per request. MySQL host/port/database and app username are persisted in `app_settings`.
- **Token storage:** JWT token and session live in Rust memory (`tauri::State`). After app restart, the user must re-authenticate.

---

### Task 1: Migrate SQLite Schema and Update Local Queries

**Files:**
- Modify: `src/db/init.js`
- Modify: `src/db/taskQueries.js`
- Create: `src/db/syncQueries.js`
- Modify: `src/db/settingQueries.js`

- [ ] **Step 1.1: Update `init.js` to add new columns and backfill UUIDs**

Modify `src/db/init.js`:

```javascript
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
```

- [ ] **Step 1.2: Update `taskQueries.js` to write `updated_at`, `local_uuid`, `sync_state`**

Replace `src/db/taskQueries.js`:

```javascript
import { getDb } from './init.js'

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

export async function selectAllTasks() {
  const db = await getDb()
  return db.select('SELECT * FROM tasks ORDER BY created_at DESC')
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
  await db.execute('DELETE FROM tasks WHERE id = ?', [id])
}
```

- [ ] **Step 1.3: Create `syncQueries.js`**

Create `src/db/syncQueries.js`:

```javascript
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
```

- [ ] **Step 1.4: Add `hasMysqlConfig` to `settingQueries.js`**

Append to `src/db/settingQueries.js`:

```javascript
export async function hasMysqlConfig() {
  const db = await getDb()
  const rows = await db.select("SELECT value FROM app_settings WHERE key = 'mysql_host'")
  return rows[0]?.value != null
}
```

- [ ] **Step 1.5: Commit**

```bash
git add src/db/init.js src/db/taskQueries.js src/db/syncQueries.js src/db/settingQueries.js
git commit -m "feat: migrate SQLite schema and add sync queries"
```

---

### Task 2: Add Rust Dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 2.1: Add crates to `Cargo.toml`**

Replace the `[dependencies]` section in `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2.0.0", features = [] }
tauri-plugin-sql = { version = "2.0.0", features = ["sqlite"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sqlx = { version = "0.8", features = ["mysql", "runtime-tokio-native-tls"] }
bcrypt = "0.15"
jsonwebtoken = "9"
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
tokio = { version = "1", features = ["full"] }
```

- [ ] **Step 2.2: Verify lockfile update**

Run:
```bash
cd src-tauri && cargo check
```
Expected: Cargo resolves and downloads dependencies. Output ends with `Finished dev [unoptimized + debuginfo] target(s)` or similar.

- [ ] **Step 2.3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "chore: add sqlx, bcrypt, jwt, uuid, chrono, tokio deps"
```

---

### Task 3: Create Rust MySQL Client Module

**Files:**
- Create: `src-tauri/src/mysql_client.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 3.1: Write `mysql_client.rs`**

Create `src-tauri/src/mysql_client.rs`:

```rust
use sqlx::mysql::MySqlPoolOptions;
use sqlx::MySqlPool;

use crate::MysqlConfig;

pub async fn create_pool(config: &MysqlConfig) -> Result<MySqlPool, String> {
    let url = format!(
        "mysql://{}:{}@{}:{}/{}",
        config.username, config.password, config.host, config.port, config.database
    );
    MySqlPoolOptions::new()
        .max_connections(5)
        .connect(&url)
        .await
        .map_err(|e| e.to_string())
}
```

- [ ] **Step 3.2: Register module in `lib.rs`**

Add at the top of `src-tauri/src/lib.rs` (before existing code):

```rust
mod auth;
mod mysql_client;
mod sync;
```

- [ ] **Step 3.3: Commit**

```bash
git add src-tauri/src/mysql_client.rs src-tauri/src/lib.rs
git commit -m "feat: add Rust MySQL client module"
```

---

### Task 4: Create Rust Auth Module

**Files:**
- Create: `src-tauri/src/auth.rs`
- Modify: `src-tauri/src/lib.rs` (state struct, later)

- [ ] **Step 4.1: Write `auth.rs` with bcrypt + JWT**

Create `src-tauri/src/auth.rs`:

```rust
use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use sqlx::{MySqlPool, Row};

#[derive(Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub user_id: i32,
    pub exp: usize,
}

pub fn hash_password(password: &str) -> Result<String, String> {
    hash(password, DEFAULT_COST).map_err(|e| e.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    verify(password, hash).map_err(|e| e.to_string())
}

pub fn generate_token(user_id: i32, username: &str) -> Result<String, String> {
    let claims = Claims {
        sub: username.to_string(),
        user_id,
        exp: usize::MAX,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(b"todohelper_secret_key"),
    )
    .map_err(|e| e.to_string())
}

pub async fn register_user(pool: &MySqlPool, username: &str, password: &str) -> Result<i32, String> {
    let password_hash = hash_password(password)?;
    let result = sqlx::query("INSERT INTO users (username, password_hash) VALUES (?, ?)")
        .bind(username)
        .bind(password_hash)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(result.last_insert_id() as i32)
}

pub async fn login_user(
    pool: &MySqlPool,
    username: &str,
    password: &str,
) -> Result<(i32, String), String> {
    let row = sqlx::query("SELECT id, password_hash FROM users WHERE username = ?")
        .bind(username)
        .fetch_one(pool)
        .await
        .map_err(|_| "用户名或密码错误".to_string())?;

    let user_id: i32 = row.try_get("id").map_err(|e| e.to_string())?;
    let password_hash: String = row.try_get("password_hash").map_err(|e| e.to_string())?;

    if !verify_password(password, &password_hash)? {
        return Err("用户名或密码错误".to_string());
    }

    let token = generate_token(user_id, username)?;
    Ok((user_id, token))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_and_verify_password() {
        let hash = hash_password("secret123").unwrap();
        assert!(verify_password("secret123", &hash).unwrap());
        assert!(!verify_password("wrong").unwrap());
    }

    #[test]
    fn test_generate_token() {
        let token = generate_token(42, "alice").unwrap();
        assert!(!token.is_empty());
    }
}
```

- [ ] **Step 4.2: Run Rust auth tests**

Run:
```bash
cd src-tauri && cargo test auth::tests -- --nocapture
```
Expected: `running 2 tests`, both `test auth::tests::test_hash_and_verify_password ... ok` and `test auth::tests::test_generate_token ... ok`.

- [ ] **Step 4.3: Commit**

```bash
git add src-tauri/src/auth.rs
git commit -m "feat: add Rust auth module with bcrypt and JWT"
```

---

### Task 5: Create Rust Sync Module

**Files:**
- Create: `src-tauri/src/sync.rs`

- [ ] **Step 5.1: Write `sync.rs` with push and pull logic**

Create `src-tauri/src/sync.rs`:

```rust
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
```

- [ ] **Step 5.2: Commit**

```bash
git add src-tauri/src/sync.rs
git commit -m "feat: add Rust sync engine with push/pull and timestamp conflict resolution"
```

---

### Task 6: Wire Rust Commands and State into `lib.rs`

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 6.1: Replace `lib.rs` with full command set**

Replace `src-tauri/src/lib.rs` entirely:

```rust
mod auth;
mod mysql_client;
mod sync;

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{command, generate_context, generate_handler, Builder, State, WebviewWindow};
use tokio::sync::Mutex;

#[derive(Deserialize)]
pub struct MysqlConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
}

#[derive(Deserialize)]
pub struct RegisterPayload {
    pub config: MysqlConfig,
    pub app_username: String,
    pub app_password: String,
}

#[derive(Deserialize)]
pub struct LoginPayload {
    pub config: MysqlConfig,
    pub app_username: String,
    pub app_password: String,
}

#[derive(Serialize)]
pub struct AuthResult {
    pub token: String,
    pub user_id: i32,
}

#[derive(Serialize)]
pub struct SyncResult {
    pub pulled_tasks: Vec<sync::RemoteTask>,
    pub new_last_sync_at: String,
}

pub struct UserSession {
    pub user_id: i32,
    pub username: String,
    pub token: String,
}

pub struct AppState {
    pub mysql_pool: Mutex<Option<sqlx::MySqlPool>>,
    pub current_user: Mutex<Option<UserSession>>,
}

#[command]
async fn test_mysql_connection(config: MysqlConfig) -> Result<(), String> {
    let pool = mysql_client::create_pool(&config).await?;
    pool.close().await;
    Ok(())
}

#[command]
async fn register_user(
    payload: RegisterPayload,
    state: State<'_, Arc<AppState>>,
) -> Result<AuthResult, String> {
    let pool = mysql_client::create_pool(&payload.config).await?;
    let user_id = auth::register_user(&pool, &payload.app_username, &payload.app_password).await?;
    let token = auth::generate_token(user_id, &payload.app_username)?;

    let result = AuthResult {
        token: token.clone(),
        user_id,
    };

    *state.mysql_pool.lock().await = Some(pool);
    *state.current_user.lock().await = Some(UserSession {
        user_id,
        username: payload.app_username,
        token,
    });

    Ok(result)
}

#[command]
async fn login_user(
    payload: LoginPayload,
    state: State<'_, Arc<AppState>>,
) -> Result<AuthResult, String> {
    let pool = mysql_client::create_pool(&payload.config).await?;
    let (user_id, token) = auth::login_user(&pool, &payload.app_username, &payload.app_password).await?;

    let result = AuthResult {
        token: token.clone(),
        user_id,
    };

    *state.mysql_pool.lock().await = Some(pool);
    *state.current_user.lock().await = Some(UserSession {
        user_id,
        username: payload.app_username,
        token,
    });

    Ok(result)
}

#[command]
async fn sync_tasks(
    pending_tasks: Vec<sync::LocalTask>,
    last_sync_at: Option<String>,
    state: State<'_, Arc<AppState>>,
) -> Result<SyncResult, String> {
    let pool_guard = state.mysql_pool.lock().await;
    let pool = pool_guard.as_ref().ok_or("MySQL 未连接")?;
    let user_guard = state.current_user.lock().await;
    let user = user_guard.as_ref().ok_or("未登录")?;

    sync::push_tasks(pool, user.user_id, &pending_tasks).await?;
    let pulled_tasks = sync::pull_tasks(pool, user.user_id, last_sync_at.as_deref()).await?;

    let now = chrono::Local::now().naive_local().format("%Y-%m-%d %H:%M:%S").to_string();

    Ok(SyncResult {
        pulled_tasks,
        new_last_sync_at: now,
    })
}

#[command]
fn set_float_mode(window: WebviewWindow) -> Result<(), String> {
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: 300.0,
            height: 400.0,
        }))
        .map_err(|e| e.to_string())?;
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    window.set_decorations(false).map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
fn set_main_mode(window: WebviewWindow) -> Result<(), String> {
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: 900.0,
            height: 600.0,
        }))
        .map_err(|e| e.to_string())?;
    window.set_always_on_top(false).map_err(|e| e.to_string())?;
    window.set_decorations(true).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = Arc::new(AppState {
        mysql_pool: Mutex::new(None),
        current_user: Mutex::new(None),
    });

    Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(app_state)
        .invoke_handler(generate_handler![
            set_float_mode,
            set_main_mode,
            test_mysql_connection,
            register_user,
            login_user,
            sync_tasks,
        ])
        .run(generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 6.2: Verify Rust compiles**

Run:
```bash
cd src-tauri && cargo check
```
Expected: No errors.

- [ ] **Step 6.3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: wire MySQL auth and sync commands into Tauri"
```

---

### Task 7: Add Sync Integration to `taskStore.js`

**Files:**
- Modify: `src/stores/taskStore.js`

- [ ] **Step 7.1: Update `taskStore.js` with sync status and trigger**

Replace `src/stores/taskStore.js`:

```javascript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { selectAllTasks, insertTask, updateTask, deleteTask } from '../db/taskQueries.js'
import { getPendingTasks, markTasksSynced, getLastSyncAt, setLastSyncAt, upsertTaskByUuid } from '../db/syncQueries.js'

export const useTaskStore = defineStore('task', () => {
  const tasks = ref([])
  const filterTag = ref('')
  const searchQuery = ref('')
  const activeFilter = ref('active') // 'active' | 'pending' | 'completed'
  const syncStatus = ref('idle') // 'idle' | 'syncing' | 'error' | 'offline'

  const todayStr = () => new Date().toISOString().slice(0, 10)

  const incompleteTasks = computed(() =>
    tasks.value.filter((t) => !t.completed)
  )

  const completedTasks = computed(() =>
    tasks.value.filter((t) => t.completed)
  )

  const filteredTasks = computed(() => {
    let result = tasks.value
    if (activeFilter.value === 'active') {
      result = result.filter((t) => !t.completed && (!t.start_date || t.start_date <= todayStr()))
    } else if (activeFilter.value === 'pending') {
      result = result.filter((t) => !t.completed && t.start_date && t.start_date > todayStr())
    } else if (activeFilter.value === 'completed') {
      result = result.filter((t) => t.completed)
    }
    if (filterTag.value) {
      result = result.filter((t) => t.tag === filterTag.value)
    }
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      result = result.filter((t) => t.title.toLowerCase().includes(q))
    }
    return result
  })

  const floatTasks = computed(() => {
    return tasks.value
      .filter((t) => !t.completed)
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority
        return new Date(a.created_at) - new Date(b.created_at)
      })
  })

  const allTags = computed(() => {
    const set = new Set(tasks.value.map((t) => t.tag).filter(Boolean))
    return Array.from(set)
  })

  async function loadTasks() {
    tasks.value = await selectAllTasks()
  }

  async function triggerSync() {
    if (syncStatus.value === 'syncing') return
    syncStatus.value = 'syncing'
    try {
      const pending = await getPendingTasks()
      const lastSyncAt = await getLastSyncAt()
      const result = await invoke('sync_tasks', { pendingTasks: pending, lastSyncAt })
      for (const task of result.pulled_tasks) {
        await upsertTaskByUuid(task)
      }
      if (pending.length > 0) {
        await markTasksSynced(pending.map((t) => t.id))
      }
      if (result.pulled_tasks.length > 0) {
        await loadTasks()
      }
      await setLastSyncAt(result.new_last_sync_at)
      syncStatus.value = 'idle'
    } catch (e) {
      console.error('Sync failed:', e)
      const msg = e?.message || String(e)
      if (msg.includes('未连接') || msg.includes('未登录')) {
        syncStatus.value = 'offline'
      } else {
        syncStatus.value = 'error'
      }
    }
  }

  async function addTask({ title, startDate, dueDate, priority = 1, tag }) {
    await insertTask({ title, startDate, dueDate, priority, tag })
    await loadTasks()
    triggerSync().catch(console.error)
  }

  async function updateTaskById(id, payload) {
    await updateTask(id, payload)
    await loadTasks()
    triggerSync().catch(console.error)
  }

  async function toggleComplete(id) {
    const task = tasks.value.find((t) => t.id === id)
    if (!task) return
    const completed = task.completed ? 0 : 1
    const completedAt = completed ? new Date().toISOString() : null
    await updateTask(id, { completed, completedAt })
    await loadTasks()
    triggerSync().catch(console.error)
  }

  async function removeTask(id) {
    await deleteTask(id)
    await loadTasks()
    triggerSync().catch(console.error)
  }

  function setFilterTag(tag) {
    filterTag.value = tag
  }

  function setSearchQuery(q) {
    searchQuery.value = q
  }

  function setActiveFilter(filter) {
    activeFilter.value = filter
  }

  return {
    tasks,
    filterTag,
    searchQuery,
    activeFilter,
    syncStatus,
    incompleteTasks,
    completedTasks,
    filteredTasks,
    floatTasks,
    allTags,
    loadTasks,
    triggerSync,
    addTask,
    updateTaskById,
    toggleComplete,
    removeTask,
    setFilterTag,
    setSearchQuery,
    setActiveFilter,
  }
})
```

- [ ] **Step 7.2: Commit**

```bash
git add src/stores/taskStore.js
git commit -m "feat: integrate sync trigger and syncStatus into taskStore"
```

---

### Task 8: Create SyncStatus Component

**Files:**
- Create: `src/components/SyncStatus.vue`

- [ ] **Step 8.1: Write `SyncStatus.vue`**

Create `src/components/SyncStatus.vue`:

```vue
<script setup>
defineProps({ status: String })

const labels = {
  idle: { icon: '🟢', text: '在线' },
  syncing: { icon: '🔄', text: '同步中' },
  error: { icon: '🔴', text: '同步错误' },
  offline: { icon: '⚠️', text: '离线' },
}
</script>

<template>
  <div class="sync-status" :title="labels[status]?.text">
    <span class="icon">{{ labels[status]?.icon }}</span>
  </div>
</template>

<style scoped>
.sync-status {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: default;
}
.icon {
  font-size: 14px;
  line-height: 1;
}
</style>
```

- [ ] **Step 8.2: Commit**

```bash
git add src/components/SyncStatus.vue
git commit -m "feat: add SyncStatus component"
```

---

### Task 9: Update TopBar and Sidebar

**Files:**
- Modify: `src/components/TopBar.vue`
- Modify: `src/components/Sidebar.vue`

- [ ] **Step 9.1: Add SyncStatus and db config button to `TopBar.vue`**

Replace `src/components/TopBar.vue`:

```vue
<script setup>
import { Search, PictureInPicture, Database } from 'lucide-vue-next'
import ThemeToggle from './ThemeToggle.vue'
import SyncStatus from './SyncStatus.vue'
import { useTaskStore } from '../stores/taskStore.js'

const taskStore = useTaskStore()
defineProps({ searchQuery: String })
const emit = defineEmits(['enterFloat', 'update:searchQuery', 'openDbConfig'])
</script>

<template>
  <header class="top-bar">
    <div class="search">
      <Search :size="18" class="search-icon" />
      <input
        type="text"
        placeholder="搜索任务..."
        :value="searchQuery"
        @input="$emit('update:searchQuery', $event.target.value)"
      />
    </div>
    <div class="actions">
      <SyncStatus :status="taskStore.syncStatus" />
      <ThemeToggle />
      <button class="icon-btn" @click="emit('openDbConfig')" title="数据库连接">
        <Database :size="20" />
      </button>
      <button class="icon-btn" @click="emit('enterFloat')" title="悬浮窗">
        <PictureInPicture :size="20" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  height: 56px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  gap: 16px;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}
.search input {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text-primary);
  width: 260px;
  font-size: 14px;
}
.search input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.2);
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover {
  background: var(--surface-hover);
}
</style>
```

- [ ] **Step 9.2: Add db config button to `Sidebar.vue`**

Replace `src/components/Sidebar.vue`:

```vue
<script setup>
import { useTaskStore } from '../stores/taskStore.js'
import { Database } from 'lucide-vue-next'

const taskStore = useTaskStore()
const emit = defineEmits(['openDbConfig'])
const filters = [
  { label: '进行中', key: 'active' },
  { label: '未开始', key: 'pending' },
  { label: '已完成', key: 'completed' },
]
</script>

<template>
  <aside class="sidebar">
    <div class="logo">ToDoHelper</div>
    <nav class="nav">
      <button
        v-for="f in filters"
        :key="f.key"
        class="nav-item"
        :class="{ active: taskStore.activeFilter === f.key }"
        @click="taskStore.setActiveFilter(f.key)"
      >
        {{ f.label }}
      </button>
    </nav>
    <div class="spacer" />
    <button class="nav-item db-item" @click="emit('openDbConfig')">
      <Database :size="16" />
      <span>数据库连接</span>
    </button>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 220px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 16px;
  display: flex;
  flex-direction: column;
}
.logo {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 24px;
}
.nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nav-item {
  height: 36px;
  padding: 0 12px;
  border-radius: 12px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.nav-item:hover {
  background: var(--surface-hover);
}
.nav-item.active {
  background: var(--color-primary-subtle);
  color: var(--color-primary-hover);
}
.spacer {
  flex: 1;
}
.db-item {
  margin-top: 8px;
}
</style>
```

- [ ] **Step 9.3: Commit**

```bash
git add src/components/TopBar.vue src/components/Sidebar.vue
git commit -m "feat: add SyncStatus to TopBar and db config entry to Sidebar"
```

---

### Task 10: Create DatabaseConfigModal Component

**Files:**
- Create: `src/components/DatabaseConfigModal.vue`
- Modify: `src/db/settingQueries.js`

- [ ] **Step 10.1: Add config save helpers to `settingQueries.js`**

Append to `src/db/settingQueries.js`:

```javascript
export async function saveMysqlConfig({ host, port, database, username }) {
  const db = await getDb()
  await db.execute(
    "INSERT INTO app_settings (key, value) VALUES ('mysql_host', ?), ('mysql_port', ?), ('mysql_database', ?), ('mysql_username', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [host, String(port), database, username]
  )
}

export async function getMysqlConfig() {
  const db = await getDb()
  const rows = await db.select("SELECT key, value FROM app_settings WHERE key LIKE 'mysql_%'")
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
```

- [ ] **Step 10.2: Write `DatabaseConfigModal.vue`**

Create `src/components/DatabaseConfigModal.vue`:

```vue
<script setup>
import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { saveMysqlConfig, getMysqlConfig } from '../db/settingQueries.js'

const props = defineProps({ open: Boolean })
const emit = defineEmits(['close', 'connected'])

const step = ref('connection')
const isLoading = ref(false)
const error = ref('')

const host = ref('')
const port = ref(3306)
const database = ref('')
const mysqlUsername = ref('')
const mysqlPassword = ref('')

const authTab = ref('login')
const appUsername = ref('')
const appPassword = ref('')
const confirmPassword = ref('')

watch(() => props.open, async (open) => {
  if (open) {
    error.value = ''
    step.value = 'connection'
    const cfg = await getMysqlConfig()
    host.value = cfg.host
    port.value = cfg.port
    database.value = cfg.database
    mysqlUsername.value = cfg.username
    mysqlPassword.value = ''
    appUsername.value = ''
    appPassword.value = ''
    confirmPassword.value = ''
  }
})

async function testConnection() {
  isLoading.value = true
  error.value = ''
  try {
    await invoke('test_mysql_connection', {
      config: {
        host: host.value,
        port: port.value,
        database: database.value,
        username: mysqlUsername.value,
        password: mysqlPassword.value,
      }
    })
    step.value = 'auth'
  } catch (e) {
    error.value = '无法连接到数据库：' + (e?.message || e)
  } finally {
    isLoading.value = false
  }
}

async function handleAuth() {
  isLoading.value = true
  error.value = ''
  try {
    const config = {
      host: host.value,
      port: port.value,
      database: database.value,
      username: mysqlUsername.value,
      password: mysqlPassword.value,
    }
    if (authTab.value === 'register') {
      if (appPassword.value !== confirmPassword.value) {
        error.value = '两次输入的密码不一致'
        isLoading.value = false
        return
      }
      await invoke('register_user', {
        payload: {
          config,
          appUsername: appUsername.value,
          appPassword: appPassword.value,
        }
      })
    } else {
      await invoke('login_user', {
        payload: {
          config,
          appUsername: appUsername.value,
          appPassword: appPassword.value,
        }
      })
    }
    await saveMysqlConfig({
      host: host.value,
      port: port.value,
      database: database.value,
      username: mysqlUsername.value,
    })
    emit('connected')
    emit('close')
  } catch (e) {
    const prefix = authTab.value === 'register' ? '注册失败：' : '登录失败：'
    error.value = prefix + (e?.message || e)
  } finally {
    isLoading.value = false
  }
}

function onBackdrop(e) {
  if (e.target === e.currentTarget) emit('close')
}
</script>

<template>
  <div v-if="open" class="modal-backdrop" @click="onBackdrop">
    <div class="modal">
      <h3 class="modal-title">数据库连接</h3>

      <div v-if="step === 'connection'" class="form">
        <label>
          主机地址
          <input v-model="host" type="text" placeholder="例如：localhost" />
        </label>
        <label>
          端口
          <input v-model.number="port" type="number" />
        </label>
        <label>
          数据库名
          <input v-model="database" type="text" />
        </label>
        <label>
          MySQL 用户名
          <input v-model="mysqlUsername" type="text" />
        </label>
        <label>
          MySQL 密码
          <input v-model="mysqlPassword" type="password" />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="$emit('close')">取消</button>
          <button class="btn-primary" :disabled="isLoading || !host.trim() || !database.trim() || !mysqlUsername.trim()" @click="testConnection">
            {{ isLoading ? '连接中...' : '测试连接' }}
          </button>
        </div>
      </div>

      <div v-else class="form">
        <div class="tabs">
          <button :class="{ active: authTab === 'login' }" @click="authTab = 'login'">登录</button>
          <button :class="{ active: authTab === 'register' }" @click="authTab = 'register'">注册</button>
        </div>
        <label>
          用户名
          <input v-model="appUsername" type="text" />
        </label>
        <label>
          密码
          <input v-model="appPassword" type="password" />
        </label>
        <label v-if="authTab === 'register'">
          确认密码
          <input v-model="confirmPassword" type="password" />
        </label>
        <p v-if="error" class="error">{{ error }}</p>
        <div class="modal-actions">
          <button class="btn-secondary" @click="step = 'connection'">上一步</button>
          <button class="btn-primary" :disabled="isLoading || !appUsername.trim() || !appPassword.trim()" @click="handleAuth">
            {{ isLoading ? '处理中...' : (authTab === 'register' ? '注册' : '登录') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.modal {
  width: 420px;
  max-width: 90%;
  background: var(--bg);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
}
.modal-title {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--text-secondary);
}
.form input {
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text-primary);
  font-size: 14px;
}
.form input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(251, 146, 60, 0.2);
}
.tabs {
  display: flex;
  gap: 8px;
}
.tabs button {
  flex: 1;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
}
.tabs button.active {
  background: var(--color-primary-subtle);
  color: var(--color-primary-hover);
  border-color: transparent;
}
.error {
  color: #ef4444;
  font-size: 13px;
  margin: 0;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
.btn-secondary {
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
}
.btn-secondary:hover {
  background: var(--surface-hover);
}
.btn-primary {
  padding: 8px 16px;
  border-radius: 12px;
  border: none;
  background: var(--color-primary);
  color: white;
  cursor: pointer;
  font-size: 14px;
}
.btn-primary:hover {
  background: var(--color-primary-hover);
}
.btn-primary:active {
  transform: scale(0.98);
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 10.3: Commit**

```bash
git add src/components/DatabaseConfigModal.vue src/db/settingQueries.js
git commit -m "feat: add DatabaseConfigModal with connection test and auth flow"
```

---

### Task 11: Wire Config Modal into App and MainView

**Files:**
- Modify: `src/App.vue`
- Modify: `src/views/MainView.vue`

- [ ] **Step 11.1: Update `App.vue` to manage modal visibility and trigger sync on connect**

Replace `src/App.vue`:

```vue
<script setup>
import { onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import MainView from './views/MainView.vue'
import FloatView from './views/FloatView.vue'
import DatabaseConfigModal from './components/DatabaseConfigModal.vue'
import { useSettingStore } from './stores/settingStore.js'
import { useTaskStore } from './stores/taskStore.js'
import { initDb } from './db/init.js'
import { hasMysqlConfig } from './db/settingQueries.js'

const settingStore = useSettingStore()
const taskStore = useTaskStore()
const showDbConfig = ref(false)

onMounted(async () => {
  try {
    await initDb()
    await settingStore.init()
    await taskStore.loadTasks()
    const hasConfig = await hasMysqlConfig()
    if (!hasConfig) {
      showDbConfig.value = true
    }
  } catch (e) {
    console.error('App initialization failed:', e)
    alert('初始化失败：' + e.message)
  }
})

async function enterFloat() {
  try {
    await invoke('set_float_mode')
    settingStore.isFloat = true
  } catch (e) {
    console.error('Enter float mode failed:', e)
    alert('切换悬浮窗失败：' + e.message)
  }
}

async function exitFloat() {
  try {
    await invoke('set_main_mode')
    settingStore.isFloat = false
  } catch (e) {
    console.error('Exit float mode failed:', e)
    alert('返回主界面失败：' + e.message)
  }
}

function onDbConnected() {
  taskStore.triggerSync().catch(console.error)
}
</script>

<template>
  <MainView
    v-if="!settingStore.isFloat"
    @enter-float="enterFloat"
    @open-db-config="showDbConfig = true"
  />
  <FloatView
    v-else
    @exit-float="exitFloat"
  />
  <DatabaseConfigModal
    :open="showDbConfig"
    @close="showDbConfig = false"
    @connected="onDbConnected"
  />
</template>

<style>
#app {
  display: flex;
  flex-direction: column;
}
</style>
```

- [ ] **Step 11.2: Update `MainView.vue` to forward db-config event**

Modify `src/views/MainView.vue`. Change the script setup emit line:

```javascript
const emit = defineEmits(['enterFloat', 'openDbConfig'])
```

And change the `<TopBar>` usage:

```vue
<TopBar
  :search-query="taskStore.searchQuery"
  @update:search-query="taskStore.setSearchQuery"
  @enter-float="emit('enterFloat')"
  @open-db-config="emit('openDbConfig')"
/>
```

And change the `<Sidebar>` tag to:

```vue
<Sidebar @open-db-config="emit('openDbConfig')" />
```

- [ ] **Step 11.3: Commit**

```bash
git add src/App.vue src/views/MainView.vue
git commit -m "feat: wire DatabaseConfigModal into app startup and main view"
```

---

### Task 12: Update Frontend Tests

**Files:**
- Modify: `src/stores/__tests__/taskStore.test.js`
- Modify: `src/stores/__tests__/settingStore.test.js`

- [ ] **Step 12.1: Mock new sync queries in taskStore test**

Replace `src/stores/__tests__/taskStore.test.js`:

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '../taskStore.js'

vi.mock('../../db/taskQueries.js', () => ({
  selectAllTasks: vi.fn(),
  insertTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}))

vi.mock('../../db/syncQueries.js', () => ({
  getPendingTasks: vi.fn(),
  markTasksSynced: vi.fn(),
  getLastSyncAt: vi.fn(),
  setLastSyncAt: vi.fn(),
  upsertTaskByUuid: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { selectAllTasks, insertTask, updateTask, deleteTask } from '../../db/taskQueries.js'
import { getPendingTasks, getLastSyncAt } from '../../db/syncQueries.js'
import { invoke } from '@tauri-apps/api/core'

describe('taskStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    getPendingTasks.mockResolvedValue([])
    getLastSyncAt.mockResolvedValue(null)
    invoke.mockResolvedValue({ pulled_tasks: [], new_last_sync_at: '2026-01-01 00:00:00' })
  })

  it('加载任务并拆分为未完成/已完成', async () => {
    selectAllTasks.mockResolvedValue([
      { id: 1, title: 'A', completed: 0 },
      { id: 2, title: 'B', completed: 1 },
    ])
    const store = useTaskStore()
    await store.loadTasks()
    expect(store.tasks.length).toBe(2)
    expect(store.incompleteTasks.length).toBe(1)
    expect(store.completedTasks.length).toBe(1)
  })

  it('添加任务并持久化', async () => {
    insertTask.mockResolvedValue(3)
    selectAllTasks.mockResolvedValue([{ id: 3, title: 'New', completed: 0 }])
    const store = useTaskStore()
    await store.addTask({ title: 'New' })
    expect(insertTask).toHaveBeenCalledWith({ title: 'New', startDate: undefined, dueDate: undefined, priority: 1, tag: undefined })
    expect(store.tasks[0].title).toBe('New')
  })

  it('切换完成状态并设置 completed_at', async () => {
    selectAllTasks.mockResolvedValue([{ id: 1, title: 'A', completed: 0 }])
    const store = useTaskStore()
    await store.loadTasks()
    await store.toggleComplete(1)
    expect(updateTask).toHaveBeenCalledWith(1, expect.objectContaining({ completed: 1, completedAt: expect.any(String) }))
  })

  it('activeFilter pending excludes future start_date', async () => {
    const store = useTaskStore()
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    selectAllTasks.mockResolvedValue([
      { id: 1, title: 'Today', completed: 0, start_date: today },
      { id: 2, title: 'Tomorrow', completed: 0, start_date: tomorrow },
    ])
    await store.loadTasks()
    store.activeFilter = 'pending'
    expect(store.filteredTasks.map(t => t.title)).toEqual(['Tomorrow'])
  })

  it('activeFilter active excludes future start_date', async () => {
    const store = useTaskStore()
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    selectAllTasks.mockResolvedValue([
      { id: 1, title: 'Active', completed: 0, start_date: today },
      { id: 2, title: 'Future', completed: 0, start_date: tomorrow },
      { id: 3, title: 'NoStart', completed: 0, start_date: null },
    ])
    await store.loadTasks()
    store.activeFilter = 'active'
    expect(store.filteredTasks.map(t => t.title).sort()).toEqual(['Active', 'NoStart'])
  })

  it('floatTasks excludes completed and sorts by priority desc then created_at asc', async () => {
    const store = useTaskStore()
    selectAllTasks.mockResolvedValue([
      { id: 1, title: 'Low', completed: 0, priority: 0, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, title: 'High', completed: 0, priority: 2, created_at: '2026-01-02T00:00:00Z' },
      { id: 3, title: 'Mid', completed: 0, priority: 1, created_at: '2026-01-03T00:00:00Z' },
    ])
    await store.loadTasks()
    selectAllTasks.mockResolvedValue([
      { id: 1, title: 'Low', completed: 0, priority: 0, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, title: 'High', completed: 0, priority: 2, created_at: '2026-01-02T00:00:00Z' },
      { id: 3, title: 'Mid', completed: 1, priority: 1, created_at: '2026-01-03T00:00:00Z' },
    ])
    await store.toggleComplete(3)
    expect(store.floatTasks.map(t => t.title)).toEqual(['High', 'Low'])
  })
})
```

- [ ] **Step 12.2: Run frontend tests**

Run:
```bash
npm run test:run
```
Expected: All tests pass.

- [ ] **Step 12.3: Commit**

```bash
git add src/stores/__tests__/taskStore.test.js
git commit -m "test: update taskStore tests for sync integration"
```

---

### Task 13: Final Verification

**Files:** All touched files.

- [ ] **Step 13.1: Run Rust tests**

Run:
```bash
cd src-tauri && cargo test
```
Expected: `test result: ok` for all tests.

- [ ] **Step 13.2: Run frontend tests**

Run:
```bash
npm run test:run
```
Expected: All tests pass.

- [ ] **Step 13.3: Run dev build smoke test**

Run:
```bash
npm run build
```
Expected: Vite build completes with no errors.

- [ ] **Step 13.4: Commit any remaining fixes**

If fixes were needed:
```bash
git add -A
git commit -m "fix: address integration issues"
```

---

## Self-Review

### Spec Coverage Check

| Spec Requirement | Implementing Task |
|------------------|-------------------|
| SQLite schema migration (`updated_at`, `sync_state`, `local_uuid`) | Task 1 |
| Backfill existing tasks with UUID | Task 1 |
| Rust `sqlx` MySQL client | Task 2, 3 |
| bcrypt password hashing | Task 4 |
| JWT generation | Task 4 |
| Register/login commands | Task 6 |
| Bidirectional sync with timestamp conflict resolution | Task 5, 7 |
| `last_sync_at` tracking | Task 1, 5, 7 |
| `DatabaseConfigModal.vue` two-step flow | Task 10 |
| Sync status indicator | Task 8, 9 |
| First-launch auto-open config | Task 11 |
| Sidebar db config entry | Task 9 |
| Offline/error state handling | Task 7 |
| Persist connection params (not password) | Task 10 |

**No gaps identified.**

### Placeholder Scan

- No `TBD`, `TODO`, or `implement later` strings found.
- All test steps include actual test code.
- No vague instructions like "add appropriate error handling" — specific behaviors are defined.

### Type Consistency Check

- `MysqlConfig` fields: `host`, `port`, `database`, `username`, `password` — consistent across Rust and JS.
- `syncStatus` values: `idle | syncing | error | offline` — consistent in store and UI.
- `LocalTask`/`RemoteTask` field names match between Rust sync module and frontend sync queries.
- `invoke('sync_tasks', { pendingTasks, lastSyncAt })` matches Rust command signature.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-17-mysql-sync.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints for review

Which approach would you like?
