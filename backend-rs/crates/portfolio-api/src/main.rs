//! Production entrypoint binary for the Axum REST API server (`portfolio-api`).

use std::sync::Arc;

use portfolio_api::{AppState, create_app};
use portfolio_db::InMemoryDatabase;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let port: u16 = std::env::var("PORT")
        .or_else(|_| std::env::var("VITE_API_PORT"))
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3001);

    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "your-super-secret-jwt-key-change-me".to_string());

    let db = Arc::new(InMemoryDatabase::new());
    let state = AppState::new(db, jwt_secret);
    let app = create_app(state);

    let addr = format!("0.0.0.0:{port}");
    println!("Starting portfolio-api HTTP server on http://{addr}");

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    println!("portfolio-api server shutdown cleanly.");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => signal.recv().await,
            Err(e) => {
                eprintln!("Failed to install SIGTERM signal handler: {e}");
                std::future::pending::<()>().await;
                None
            }
        };
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            println!("Received Ctrl+C, initiating graceful shutdown...");
        },
        _ = terminate => {
            println!("Received SIGTERM, initiating graceful shutdown...");
        },
    }
}
