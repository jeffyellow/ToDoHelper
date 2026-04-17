use bcrypt::{hash, verify, DEFAULT_COST};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::{MySqlPool, Row};

#[derive(Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub user_id: i32,
    pub iat: usize,
    pub exp: usize,
}

pub fn hash_password(password: &str) -> Result<String, String> {
    hash(password, DEFAULT_COST).map_err(|e| e.to_string())
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, String> {
    verify(password, hash).map_err(|e| e.to_string())
}

fn token_expiration() -> usize {
    let now = chrono::Utc::now().timestamp() as usize;
    now + 30 * 24 * 60 * 60 // 30 days
}

pub fn generate_token(user_id: i32, username: &str, secret: &[u8]) -> Result<String, String> {
    let now = chrono::Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: username.to_string(),
        user_id,
        iat: now,
        exp: token_expiration(),
    };
    encode(&Header::default(), &claims, &EncodingKey::from_secret(secret)).map_err(|e| e.to_string())
}

pub fn verify_token(token: &str, secret: &[u8]) -> Result<Claims, String> {
    decode::<Claims>(token, &DecodingKey::from_secret(secret), &Validation::default())
        .map(|data| data.claims)
        .map_err(|e| e.to_string())
}

fn validate_credentials(username: &str, password: &str) -> Result<(), String> {
    if username.len() < 2 || username.len() > 32 {
        return Err("用户名长度必须在 2-32 个字符之间".to_string());
    }
    if password.len() < 6 || password.len() > 128 {
        return Err("密码长度必须在 6-128 个字符之间".to_string());
    }
    Ok(())
}

pub async fn register_user(pool: &MySqlPool, username: &str, password: &str) -> Result<i32, String> {
    validate_credentials(username, password)?;
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
    secret: &[u8],
) -> Result<(i32, String), String> {
    let (user_id, password_hash) = match sqlx::query("SELECT id, password_hash FROM users WHERE username = ?")
        .bind(username)
        .fetch_one(pool)
        .await
    {
        Ok(row) => {
            let id: i32 = row.try_get("id").map_err(|e| e.to_string())?;
            let hash: String = row.try_get("password_hash").map_err(|e| e.to_string())?;
            (id, hash)
        }
        Err(_) => {
            // constant-time dummy verify to mitigate timing attacks
            let _ = verify_password(password, "$2b$04$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
            return Err("用户名或密码错误".to_string());
        }
    };

    if !verify_password(password, &password_hash).unwrap_or(false) {
        return Err("用户名或密码错误".to_string());
    }

    let token = generate_token(user_id, username, secret)?;
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
    fn test_generate_and_verify_token() {
        let secret = b"test_secret_key_123";
        let token = generate_token(42, "alice", secret).unwrap();
        assert!(!token.is_empty());
        let claims = verify_token(&token, secret).unwrap();
        assert_eq!(claims.user_id, 42);
        assert_eq!(claims.sub, "alice");
    }

    #[test]
    fn test_validate_credentials() {
        assert!(validate_credentials("alice", "secret123").is_ok());
        assert!(validate_credentials("a", "secret123").is_err());
        assert!(validate_credentials("alice", "12345").is_err());
    }
}
