//! Standalone CLI utility for manually refreshing historical portfolio valuation checkpoints.

use portfolio_db::InMemoryDatabase;
use portfolio_worker::jobs::{HistoryRefreshJobData, process_history_refresh_job_with_pool};
use std::env;
use std::str::FromStr;
use uuid::Uuid;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let db_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgresql://portfolio_admin:select_a_strong_password@localhost:5432/portfolio_tracker"
            .to_string()
    });
    let pool = sqlx::PgPool::connect(&db_url).await?;
    let portfolio_id_str = env::args()
        .nth(1)
        .unwrap_or_else(|| "4072eb14-0876-46f8-86c2-566b6131cb42".to_string());
    let portfolio_id = Uuid::from_str(&portfolio_id_str)?;
    let db = InMemoryDatabase::new();
    let job_data = HistoryRefreshJobData::new(portfolio_id);
    let records = process_history_refresh_job_with_pool(&job_data, &db, Some(&pool)).await?;
    println!(
        "Successfully refreshed history for {portfolio_id}: {} records stored.",
        records.len()
    );
    Ok(())
}
