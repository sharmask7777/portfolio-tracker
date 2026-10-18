//! Queue abstractions and implementations for background job processing.
//!
//! Provides:
//! - `JobQueue`: Async trait for enqueuing and dequeuing typed jobs.
//! - `InMemoryJobQueue`: Fast, thread-safe in-memory queue for hermetic sub-millisecond testing.
//! - `RedisBullQueue`: BullMQ-compatible Redis queue connecting to `bull:<queue_name>:*`.

use std::collections::VecDeque;
use std::sync::Arc;

use async_trait::async_trait;
use serde::Serialize;
use serde::de::DeserializeOwned;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::error::WorkerError;

/// Core async queue trait for managing job life cycles.
#[async_trait]
pub trait JobQueue<T>: Send + Sync {
    /// Enqueues a job into the queue, returning the unique job ID.
    async fn enqueue(&self, job: T) -> Result<String, WorkerError>;

    /// Dequeues the next pending job from the queue if available.
    async fn dequeue(&self) -> Result<Option<T>, WorkerError>;
}

/// Thread-safe in-memory job queue for fast hermetic unit and integration testing.
/// Does not require an external Redis instance.
#[derive(Debug, Clone)]
pub struct InMemoryJobQueue<T> {
    queue: Arc<Mutex<VecDeque<T>>>,
}

impl<T: Send + Sync + 'static> InMemoryJobQueue<T> {
    pub fn new() -> Self {
        Self {
            queue: Arc::new(Mutex::new(VecDeque::new())),
        }
    }

    pub async fn len(&self) -> usize {
        self.queue.lock().await.len()
    }

    pub async fn is_empty(&self) -> bool {
        self.queue.lock().await.is_empty()
    }

    pub async fn clear(&self) {
        self.queue.lock().await.clear();
    }
}

impl<T: Send + Sync + 'static> Default for InMemoryJobQueue<T> {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl<T: Send + Sync + 'static> JobQueue<T> for InMemoryJobQueue<T> {
    async fn enqueue(&self, job: T) -> Result<String, WorkerError> {
        let job_id = Uuid::new_v4().to_string();
        let mut q = self.queue.lock().await;
        q.push_back(job);
        Ok(job_id)
    }

    async fn dequeue(&self) -> Result<Option<T>, WorkerError> {
        let mut q = self.queue.lock().await;
        Ok(q.pop_front())
    }
}

/// Redis client implementing BullMQ-compatible list and hash queuing (`bull:<queue_name>:*`).
#[derive(Clone)]
pub struct RedisBullQueue {
    client: redis::Client,
    queue_name: String,
    conn: Arc<Mutex<Option<redis::aio::MultiplexedConnection>>>,
}

impl RedisBullQueue {
    /// Creates a new `RedisBullQueue` for the given client and queue name.
    pub fn new(client: redis::Client, queue_name: impl Into<String>) -> Self {
        Self {
            client,
            queue_name: queue_name.into(),
            conn: Arc::new(Mutex::new(None)),
        }
    }

    /// Creates a new `RedisBullQueue` with a pre-established multiplexed async connection.
    pub fn with_connection(
        client: redis::Client,
        queue_name: impl Into<String>,
        conn: redis::aio::MultiplexedConnection,
    ) -> Self {
        Self {
            client,
            queue_name: queue_name.into(),
            conn: Arc::new(Mutex::new(Some(conn))),
        }
    }

    /// Opens a connection to Redis URL and initializes the queue.
    pub fn from_url(redis_url: &str, queue_name: impl Into<String>) -> Result<Self, WorkerError> {
        let client = redis::Client::open(redis_url)?;
        Ok(Self::new(client, queue_name))
    }

    /// Asynchronously connects to Redis and returns a `RedisBullQueue` with active connection.
    pub async fn connect(
        redis_url: &str,
        queue_name: impl Into<String>,
    ) -> Result<Self, WorkerError> {
        let client = redis::Client::open(redis_url)?;
        let conn = client.get_multiplexed_async_connection().await?;
        Ok(Self::with_connection(client, queue_name, conn))
    }

    /// Reuses or initializes the cached multiplexed async Redis connection.
    async fn get_connection(
        &self,
    ) -> Result<tokio::sync::MutexGuard<'_, Option<redis::aio::MultiplexedConnection>>, WorkerError>
    {
        let mut guard = self.conn.lock().await;
        if guard.is_none() {
            let conn = self.client.get_multiplexed_async_connection().await?;
            *guard = Some(conn);
        }
        Ok(guard)
    }

    pub fn queue_name(&self) -> &str {
        &self.queue_name
    }

    pub fn wait_key(&self) -> String {
        format!("bull:{}:wait", self.queue_name)
    }

    pub fn job_key(&self, job_id: &str) -> String {
        format!("bull:{}:{}", self.queue_name, job_id)
    }

    pub fn id_key(&self) -> String {
        format!("bull:{}:id", self.queue_name)
    }
}

#[async_trait]
impl<T: Serialize + DeserializeOwned + Send + Sync + 'static> JobQueue<T> for RedisBullQueue {
    async fn enqueue(&self, job: T) -> Result<String, WorkerError> {
        let mut guard = self.get_connection().await?;
        let conn = guard.as_mut().expect("multiplexed connection initialized");

        let job_id: i64 = redis::cmd("INCR")
            .arg(self.id_key())
            .query_async(conn)
            .await?;
        let job_id_str = job_id.to_string();

        let data_json = serde_json::to_string(&job)?;
        let now_ms = chrono::Utc::now().timestamp_millis();

        let _: () = redis::cmd("HSET")
            .arg(self.job_key(&job_id_str))
            .arg("name")
            .arg(&self.queue_name)
            .arg("data")
            .arg(&data_json)
            .arg("opts")
            .arg("{}")
            .arg("timestamp")
            .arg(now_ms)
            .query_async(conn)
            .await?;

        // BullMQ FIFO convention: LPUSH on enqueue, RPOP on dequeue
        let _: () = redis::cmd("LPUSH")
            .arg(self.wait_key())
            .arg(&job_id_str)
            .query_async(conn)
            .await?;

        Ok(job_id_str)
    }

    async fn dequeue(&self) -> Result<Option<T>, WorkerError> {
        let mut guard = self.get_connection().await?;
        let conn = guard.as_mut().expect("multiplexed connection initialized");

        // BullMQ FIFO convention: RPOP on dequeue
        let job_id_opt: Option<String> = redis::cmd("RPOP")
            .arg(self.wait_key())
            .query_async(conn)
            .await?;

        match job_id_opt {
            None => Ok(None),
            Some(job_id) => {
                let data_opt: Option<String> = redis::cmd("HGET")
                    .arg(self.job_key(&job_id))
                    .arg("data")
                    .query_async(conn)
                    .await?;

                match data_opt {
                    Some(data_str) => {
                        let job: T = serde_json::from_str(&data_str)?;
                        Ok(Some(job))
                    }
                    None => Ok(None),
                }
            }
        }
    }
}
