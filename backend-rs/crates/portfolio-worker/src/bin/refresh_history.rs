//! Standalone CLI utility for refreshing historical portfolio valuation checkpoints.
//!
//! Usage:
//! ```bash
//! cargo run --bin refresh_history [portfolio_id | --all]
//! ```

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
    let target_arg = env::args().nth(1);

    let portfolio_ids: Vec<Uuid> = match target_arg.as_deref() {
        Some("--all") | None => {
            let rows = sqlx::query_as::<_, (String,)>(r#"SELECT id FROM "Portfolio""#)
                .fetch_all(&pool)
                .await?;
            rows.into_iter()
                .filter_map(|(id_str,)| Uuid::from_str(&id_str).ok())
                .collect()
        }
        Some(single_id) => vec![Uuid::from_str(single_id)?],
    };

    println!(
        "Starting historical valuation refresh for {} portfolio(s)...",
        portfolio_ids.len()
    );
    let db = InMemoryDatabase::new();

    for portfolio_id in portfolio_ids {
        // Purge previous checkpoints to ensure clean-slate reconstruction
        portfolio_db::repositories::purge_portfolio_history(&pool, portfolio_id).await?;
        let job_data = HistoryRefreshJobData::new(portfolio_id);
        let records = process_history_refresh_job_with_pool(&job_data, &db, Some(&pool)).await?;
        println!(
            "Successfully refreshed history for {portfolio_id}: {} checkpoints recorded.",
            records.len()
        );
    }

    Ok(())
}
