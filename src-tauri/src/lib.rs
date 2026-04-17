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
    pub jwt_secret: String,
}

async fn ensure_mysql_schema(pool: &sqlx::MySqlPool) -> Result<(), String> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(32) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            local_uuid VARCHAR(36) NOT NULL,
            title VARCHAR(255) NOT NULL,
            completed TINYINT NOT NULL DEFAULT 0,
            start_date VARCHAR(10),
            due_date VARCHAR(10),
            priority INT NOT NULL DEFAULT 1,
            tag VARCHAR(50),
            created_at VARCHAR(24),
            completed_at VARCHAR(24),
            updated_at VARCHAR(24) NOT NULL,
            UNIQUE KEY uk_user_uuid (user_id, local_uuid)
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
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
    ensure_mysql_schema(&pool).await?;
    let user_id = auth::register_user(&pool, &payload.app_username, &payload.app_password).await?;
    let token = auth::generate_token(user_id, &payload.app_username, state.jwt_secret.as_bytes())?;

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
    ensure_mysql_schema(&pool).await?;
    let (user_id, token) = auth::login_user(
        &pool,
        &payload.app_username,
        &payload.app_password,
        state.jwt_secret.as_bytes(),
    )
    .await?;

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

    auth::verify_token(&user.token, state.jwt_secret.as_bytes())
        .map_err(|_| "登录已过期，请重新连接")?;

    sync::push_tasks(pool, user.user_id, &pending_tasks).await?;
    let pulled_tasks = sync::pull_tasks(pool, user.user_id, last_sync_at.as_deref()).await?;

    let now = chrono::Local::now()
        .naive_local()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

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
        jwt_secret: uuid::Uuid::new_v4().to_string(),
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
