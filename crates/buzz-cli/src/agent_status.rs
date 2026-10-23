//! Bounded, owner-encrypted task updates carried by the existing observer feed.
use buzz_core::observer::{encrypt_observer_payload, OBSERVER_FRAME_TELEMETRY};
use nostr::{Event, Keys, PublicKey};
use serde_json::json;
use uuid::Uuid;

use crate::error::CliError;

pub(crate) fn build_status(
    keys: &Keys,
    owner: &PublicKey,
    worker: u8,
    turn: Uuid,
    stage: &str,
    task: &str,
    next: &str,
) -> Result<Event, CliError> {
    if worker >= 32
        || ![
            "working",
            "testing",
            "reviewing",
            "waiting_ci",
            "waiting_approval",
            "blocked",
            "completed",
            "available",
        ]
        .contains(&stage)
    {
        return Err(CliError::Usage("invalid worker or task stage".into()));
    }
    if task.trim().is_empty() || task.chars().count() > 300 || next.chars().count() > 300 {
        return Err(CliError::Usage(
            "task is required; task and next must each be at most 300 characters".into(),
        ));
    }
    let payload = json!({
        "seq": 0,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "kind": "task_status",
        "agentIndex": worker,
        "channelId": null,
        "sessionId": null,
        "turnId": turn.to_string(),
        "payload": { "version": 1, "stage": stage, "task": task.trim(), "next": next.trim() }
    });
    let encrypted = encrypt_observer_payload(keys, owner, &payload)
        .map_err(|e| CliError::Other(format!("could not encrypt task status: {e}")))?;
    buzz_sdk::build_agent_observer_frame(
        &owner.to_hex(),
        &keys.public_key().to_hex(),
        OBSERVER_FRAME_TELEMETRY,
        &encrypted,
    )
    .map_err(|e| CliError::Other(format!("could not build task status: {e}")))?
    .sign_with_keys(keys)
    .map_err(|e| CliError::Other(format!("could not sign task status: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use buzz_core::observer::decrypt_observer_payload;

    #[test]
    fn status_is_encrypted_for_owner_and_bound_to_worker_turn() {
        let agent = Keys::generate();
        let owner = Keys::generate();
        let turn = Uuid::new_v4();
        let event = build_status(
            &agent,
            &owner.public_key(),
            2,
            turn,
            "waiting_ci",
            "Example task",
            "Check CI",
        )
        .unwrap();
        assert!(!event.content.contains("Example task"));
        let payload: serde_json::Value = decrypt_observer_payload(&owner, &event).unwrap();
        assert_eq!(payload["agentIndex"], 2);
        assert_eq!(payload["turnId"], turn.to_string());
        assert_eq!(payload["payload"]["stage"], "waiting_ci");
        assert!(decrypt_observer_payload::<serde_json::Value>(&Keys::generate(), &event).is_err());
    }

    #[test]
    fn rejects_unbounded_or_invalid_reports() {
        let keys = Keys::generate();
        for (worker, stage, task) in [
            (32, "working", "task".into()),
            (0, "guess", "task".into()),
            (0, "working", " ".into()),
            (0, "working", "x".repeat(301)),
        ] {
            assert!(build_status(
                &keys,
                &keys.public_key(),
                worker,
                Uuid::new_v4(),
                stage,
                &task,
                ""
            )
            .is_err());
        }
    }
}
