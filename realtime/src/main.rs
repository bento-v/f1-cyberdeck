use anyhow::Error;
use shared::tracing_subscriber;
use tokio::sync::broadcast;
use tracing::warn;

use crate::services::state_service::StateService;

mod f1;
mod http_server;
mod services {
    pub mod state_service;
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    tracing_subscriber();

    let state_service = StateService::new();

    let (sender, _reciver) = broadcast::channel::<String>(128);

    {
        let state_service = state_service.clone();
        let sender = sender.clone();
        tokio::spawn(async move {
            let mut error_backoff_secs: u64 = 2;
            loop {
                let clean = match f1::ingest_f1(state_service.clone(), sender.clone()).await {
                    Ok(_) => true,
                    Err(err) => {
                        warn!(?err, "ingest_f1 method returned error");
                        false
                    }
                };

                if clean {
                    // SessionInfo-triggered restart: always wait a short fixed delay,
                    // then reconnect immediately at full speed for the new session.
                    warn!("session info restart, reconnecting in 2s");
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                    error_backoff_secs = 2;
                } else {
                    // Network/protocol error: back off exponentially to avoid flooding.
                    warn!(error_backoff_secs, "connection error, backing off before retry");
                    tokio::time::sleep(tokio::time::Duration::from_secs(error_backoff_secs)).await;
                    error_backoff_secs = (error_backoff_secs * 2).min(60);
                }
            }
        });
    }

    http_server::start(state_service, sender).await?;

    Ok(())
}
