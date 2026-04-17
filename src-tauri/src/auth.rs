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
        assert!(!verify_password("wrong", &hash).unwrap());
    }

    #[test]
    fn test_generate_token() {
        let token = generate_token(42, "alice").unwrap();
        assert!(!token.is_empty());
    }
}
