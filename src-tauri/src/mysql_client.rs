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
