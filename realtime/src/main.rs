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
            let mut backoff_secs: u64 = 2;
            loop {
                match f1::ingest_f1(state_service.clone(), sender.clone()).await {
                    Ok(_) => {
                        // Clean session-info restart — reset backoff
                        backoff_secs = 2;
                    }
                    Err(err) => {
                        warn!(?err, "ingest_f1 method returned error");
                    }
                };

                warn!(backoff_secs, "ingest_f1 returned, restarting after delay");
                tokio::time::sleep(tokio::time::Duration::from_secs(backoff_secs)).await;
                // Double delay up to 60s to avoid flooding on persistent outages
                backoff_secs = (backoff_secs * 2).min(60);
            }
        });
    }

    http_server::start(state_service, sender).await?;

    Ok(())
}
