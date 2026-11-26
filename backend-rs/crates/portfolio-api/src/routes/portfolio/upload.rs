//! CAS statement upload and job status polling route handlers.

use axum::Json;
use axum::extract::{Multipart, Path, State};
use axum::http::StatusCode;
use chrono::Utc;
use portfolio_db::UploadJobStatus;
use portfolio_db::entities::UploadJobEntity;
use portfolio_db::error::DbError;
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;
use ts_rs::TS;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::state::AppState;

/// Response returned upon successfully queuing an uploaded CAS statement for processing.
#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct UploadPdfResponse {
    /// Unique identifier of the background processing job.
    pub job_id: String,
    /// Human-readable status message.
    pub message: String,
}

/// Validates that the uploaded file's leading bytes match its declared `.pdf` or `.json` extension.
fn validate_magic_bytes(is_json: bool, header: &[u8]) -> Result<(), ApiError> {
    if is_json {
        let first_non_ws = header.iter().copied().find(|b| !b.is_ascii_whitespace());
        if !matches!(first_non_ws, Some(b'{' | b'[')) {
            return Err(ApiError::BadRequest(
                "Invalid JSON file: expected object or array".to_string(),
            ));
        }
    } else if !header.starts_with(b"%PDF") {
        return Err(ApiError::BadRequest(
            "Invalid PDF file: missing %PDF header".to_string(),
        ));
    }
    Ok(())
}

/// Route handler for `POST /api/portfolio/upload` handling CAS statement file uploads.
///
/// Receives multipart form uploads containing CAS PDFs or JSON statements, validates magic bytes,
/// stores the payload into the designated uploads directory with a unique UUID and matching extension,
/// initializes a database `UploadJob` record in `PENDING` state, and enqueues the job into BullMQ.
pub async fn upload_pdf(
    auth_user: AuthUser,
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<UploadPdfResponse>), ApiError> {
    let job_id = Uuid::new_v4();
    let uploads_dir = std::env::var("UPLOADS_DIR").unwrap_or_else(|_| "uploads".to_string());
    tokio::fs::create_dir_all(&uploads_dir)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    let mut bytes_written = 0usize;
    let mut file_path: Option<std::path::PathBuf> = None;
    let mut is_json = false;
    let mut header_buf: Vec<u8> = Vec::with_capacity(64);
    let mut password: Option<String> = None;

    while let Some(mut field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
    {
        let name = field.name().unwrap_or_default().to_string();
        match name.as_str() {
            "password" => {
                if let Ok(bytes) = field.bytes().await {
                    let pw = String::from_utf8_lossy(&bytes).to_string();
                    if !pw.is_empty() {
                        password = Some(pw);
                    }
                }
            }
            "file" => {
                let filename = field.file_name().unwrap_or_default().to_ascii_lowercase();
                let content_type = field
                    .content_type()
                    .unwrap_or_default()
                    .to_ascii_lowercase();
                is_json = std::path::Path::new(&filename)
                    .extension()
                    .is_some_and(|ext| ext.eq_ignore_ascii_case("json"))
                    || content_type.contains("json");
                let ext = if is_json { "json" } else { "pdf" };
                let path = std::path::Path::new(&uploads_dir).join(format!("{job_id}.{ext}"));
                let mut dest = tokio::fs::File::create(&path)
                    .await
                    .map_err(|e| ApiError::Internal(e.to_string()))?;
                file_path = Some(path);

                while let Some(chunk) = field
                    .chunk()
                    .await
                    .map_err(|e| ApiError::BadRequest(e.to_string()))?
                {
                    if header_buf.len() < 64 {
                        let take = (64 - header_buf.len()).min(chunk.len());
                        header_buf.extend_from_slice(&chunk[..take]);
                    }
                    bytes_written += chunk.len();
                    dest.write_all(&chunk)
                        .await
                        .map_err(|e| ApiError::Internal(e.to_string()))?;
                }
                dest.flush()
                    .await
                    .map_err(|e| ApiError::Internal(e.to_string()))?;
            }
            _ => {}
        }
    }

    let Some(file_path) = file_path else {
        return Err(ApiError::ValidationFailed("No file uploaded".to_string()));
    };

    if bytes_written == 0 {
        let _ = tokio::fs::remove_file(&file_path).await;
        return Err(ApiError::ValidationFailed("No file uploaded".to_string()));
    }

    if let Err(err) = validate_magic_bytes(is_json, &header_buf) {
        let _ = tokio::fs::remove_file(&file_path).await;
        return Err(err);
    }

    let file_path_str = file_path.to_string_lossy().to_string();
    let now = Utc::now();
    let job = UploadJobEntity {
        id: job_id,
        user_id: auth_user.user_id,
        file_path: file_path_str.clone(),
        status: UploadJobStatus::Pending,
        message: password.as_ref().map(|_| "password_provided".to_string()),
        created_at: now,
        updated_at: now,
        started_at: None,
        completed_at: None,
    };

    if let Some(pool) = state.pool() {
        let insert_res = sqlx::query(
            r#"
            INSERT INTO "UploadJob" ("id", "userId", "filePath", "status", "message", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, 'PENDING', $4, $5, $5)
            "#,
        )
        .bind(job_id.to_string())
        .bind(auth_user.user_id.to_string())
        .bind(&file_path_str)
        .bind(None::<String>)
        .bind(now)
        .execute(pool)
        .await;

        if let Err(e) = insert_res {
            let _ = tokio::fs::remove_file(&file_path).await;
            return Err(DbError::from(e).into());
        }
    }

    state.db.insert_upload_job(job);

    if let Some(ref client) = state.redis {
        let mut conn = client
            .get_multiplexed_async_connection()
            .await
            .map_err(|e| ApiError::Internal(format!("Redis connection failed: {e}")))?;

        let job_data = serde_json::json!({
            "userId": auth_user.user_id.to_string(),
            "filePath": file_path_str,
            "password": password,
            "jobId": job_id.to_string(),
        });
        let job_data_str = job_data.to_string();
        let now_ms = chrono::Utc::now().timestamp_millis();

        let bull_job_id: i64 = redis::cmd("INCR")
            .arg("bull:pdfUploadQueue:id")
            .query_async(&mut conn)
            .await
            .map_err(|e| ApiError::Internal(format!("Redis INCR failed: {e}")))?;

        redis::cmd("HSET")
            .arg(format!("bull:pdfUploadQueue:{bull_job_id}"))
            .arg("name")
            .arg("pdfUploadQueue")
            .arg("data")
            .arg(&job_data_str)
            .arg("opts")
            .arg("{}")
            .arg("timestamp")
            .arg(now_ms)
            .query_async::<()>(&mut conn)
            .await
            .map_err(|e| ApiError::Internal(format!("Redis HSET failed: {e}")))?;

        redis::cmd("LPUSH")
            .arg("bull:pdfUploadQueue:wait")
            .arg(bull_job_id.to_string())
            .query_async::<()>(&mut conn)
            .await
            .map_err(|e| ApiError::Internal(format!("Redis LPUSH failed: {e}")))?;
    }

    Ok((
        StatusCode::ACCEPTED,
        Json(UploadPdfResponse {
            job_id: job_id.to_string(),
            message: "PDF upload accepted and processing has started.".to_string(),
        }),
    ))
}

/// Route handler for `GET /api/portfolio/upload-status/:id` polling CAS processing job status.
pub async fn get_upload_status(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<UploadJobEntity>, ApiError> {
    let job = if let Some(pool) = state.pool() {
        let opt = sqlx::query_as::<_, UploadJobEntity>(
            r#"
            SELECT id::uuid, "userId"::uuid, "filePath", status, message,
                   "createdAt" AT TIME ZONE 'UTC' AS "createdAt",
                   "updatedAt" AT TIME ZONE 'UTC' AS "updatedAt",
                   "startedAt" AT TIME ZONE 'UTC' AS "startedAt",
                   "completedAt" AT TIME ZONE 'UTC' AS "completedAt"
            FROM "UploadJob"
            WHERE id = $1
            "#,
        )
        .bind(job_id.to_string())
        .fetch_optional(pool)
        .await
        .map_err(DbError::from)?;

        opt.or_else(|| state.db.get_upload_job(job_id))
    } else {
        state.db.get_upload_job(job_id)
    };

    let job = job.ok_or_else(|| ApiError::NotFound("Job not found".to_string()))?;

    if job.user_id != auth_user.user_id {
        return Err(ApiError::NotFound("Job not found".to_string()));
    }

    Ok(Json(job))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_magic_bytes() {
        assert!(validate_magic_bytes(true, b"  {\"ok\":true}").is_ok());
        assert!(validate_magic_bytes(true, b"[1,2]").is_ok());
        assert!(validate_magic_bytes(true, b"not json").is_err());
        assert!(validate_magic_bytes(false, b"%PDF-1.7").is_ok());
        assert!(validate_magic_bytes(false, b"not pdf").is_err());
    }
}
