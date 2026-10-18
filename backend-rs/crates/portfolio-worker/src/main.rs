//! Production entrypoint binary for the background queue worker (`portfolio-worker`).

use std::sync::Arc;
use std::time::Duration;

use portfolio_db::InMemoryDatabase;
use portfolio_worker::jobs::{ProcessPdfUploadJobData, process_pdf_job};
use portfolio_worker::queue::{JobQueue, RedisBullQueue};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting portfolio-worker background service...");

    let uploads_dir = std::env::var("UPLOADS_DIR").unwrap_or_else(|_| "uploads".to_string());
    println!("[Worker] Startup: Verifying access to {uploads_dir}");
    if let Err(e) = std::fs::create_dir_all(&uploads_dir) {
        eprintln!("[Worker] Warning: could not create uploads directory '{uploads_dir}': {e}");
    }

    let redis_host = std::env::var("REDIS_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let redis_port = std::env::var("REDIS_PORT").unwrap_or_else(|_| "6379".to_string());
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| format!("redis://{redis_host}:{redis_port}"));

    let db = Arc::new(InMemoryDatabase::new());

    // Connect to Redis BullMQ queue, or run in fallback polling mode if Redis is temporarily unreachable
    let redis_queue = match RedisBullQueue::connect(&redis_url, "pdfUploadQueue").await {
        Ok(queue) => {
            println!("[Worker] Successfully connected to Redis BullMQ queue at {redis_url}");
            Some(queue)
        }
        Err(err) => {
            eprintln!(
                "[Worker] Warning: Redis connection to '{redis_url}' failed ({err}). Running in fallback mode."
            );
            None
        }
    };

    println!(
        "[Worker] Background worker listening for jobs. Press Ctrl+C or send SIGTERM to terminate."
    );

    let shutdown = shutdown_signal();
    tokio::pin!(shutdown);

    loop {
        tokio::select! {
            _ = &mut shutdown => {
                println!("[Worker] Received shutdown signal, terminating gracefully...");
                break;
            }
            _ = tokio::time::sleep(Duration::from_millis(500)) => {
                if let Some(ref queue) = redis_queue {
                    let dequeue_result: Result<Option<ProcessPdfUploadJobData>, _> =
                        queue.dequeue().await;
                    match dequeue_result {
                        Ok(Some(job)) => {
                            println!("[Worker] Dequeued job {} for user {}", job.job_id, job.user_id);
                            match process_pdf_job(&job, &db).await {
                                Ok(()) => {
                                    println!("[Worker] Successfully processed job {}", job.job_id);
                                }
                                Err(err) => {
                                    eprintln!("[Worker] Failed to process job {}: {err}", job.job_id);
                                }
                            }
                        }
                        Ok(None) => {
                            // Queue is empty, continue waiting
                        }
                        Err(err) => {
                            eprintln!("[Worker] Error dequeuing job from Redis: {err}");
                            tokio::time::sleep(Duration::from_secs(2)).await;
                        }
                    }
                }
            }
        }
    }

    println!("[Worker] portfolio-worker shutdown cleanly.");
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
