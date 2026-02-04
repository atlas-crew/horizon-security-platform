//! Remote shell handler for the tunnel client.

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use dashmap::DashMap;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tracing::{debug, warn};

use super::client::TunnelClientHandle;
use super::types::LegacyTunnelMessage;

const DEFAULT_COLS: u16 = 80;
const DEFAULT_ROWS: u16 = 24;

struct ShellSession {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    master: Arc<Mutex<Box<dyn portable_pty::MasterPty + Send>>>,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send>>>,
    shell: String,
}

/// Remote shell handler for tunnel legacy messages.
pub struct TunnelShellService {
    handle: TunnelClientHandle,
    sessions: Arc<DashMap<String, ShellSession>>,
    default_shell: String,
}

impl TunnelShellService {
    /// Create a new shell service with the given tunnel handle.
    pub fn new(handle: TunnelClientHandle) -> Self {
        let default_shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
        Self {
            handle,
            sessions: Arc::new(DashMap::new()),
            default_shell,
        }
    }

    /// Start the shell service (listens for legacy tunnel messages).
    pub async fn run(self) {
        let mut rx = self.handle.subscribe_legacy();
        loop {
            match rx.recv().await {
                Ok(message) => self.handle_message(message).await,
                Err(err) => {
                    warn!("Shell service channel closed: {}", err);
                    break;
                }
            }
        }
    }

    async fn handle_message(&self, message: LegacyTunnelMessage) {
        match message.message_type.as_str() {
            "shell-data" => {
                self.handle_shell_data(message).await;
            }
            "shell-resize" => {
                self.handle_shell_resize(message).await;
            }
            _ => {}
        }
    }

    async fn handle_shell_data(&self, message: LegacyTunnelMessage) {
        let Some(session_id) = message.session_id.clone() else {
            warn!("shell-data received without sessionId");
            return;
        };

        let payload = message.payload;

        if let Some(action) = payload.get("action").and_then(|value| value.as_str()) {
            match action {
                "start" => {
                    let cols = payload
                        .get("cols")
                        .and_then(|value| value.as_u64())
                        .map(|value| value as u16)
                        .unwrap_or(DEFAULT_COLS);
                    let rows = payload
                        .get("rows")
                        .and_then(|value| value.as_u64())
                        .map(|value| value as u16)
                        .unwrap_or(DEFAULT_ROWS);
                    if let Err(err) = self.start_session(&session_id, cols, rows) {
                        self.send_shell_error(&session_id, err);
                    }
                    return;
                }
                "end" => {
                    self.end_session(&session_id, "session ended");
                    return;
                }
                _ => {}
            }
        }

        if let Some(data) = payload.get("data").and_then(|value| value.as_str()) {
            if let Err(err) = self.write_input(&session_id, data) {
                self.send_shell_error(&session_id, err);
            }
        }
    }

    async fn handle_shell_resize(&self, message: LegacyTunnelMessage) {
        let Some(session_id) = message.session_id.clone() else {
            warn!("shell-resize received without sessionId");
            return;
        };
        let cols = message
            .payload
            .get("cols")
            .and_then(|value| value.as_u64())
            .map(|value| value as u16)
            .unwrap_or(DEFAULT_COLS);
        let rows = message
            .payload
            .get("rows")
            .and_then(|value| value.as_u64())
            .map(|value| value as u16)
            .unwrap_or(DEFAULT_ROWS);

        if let Some(session) = self.sessions.get(&session_id) {
            if let Err(err) = session.master.lock().unwrap().resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            }) {
                self.send_shell_error(&session_id, format!("resize failed: {}", err));
            }
        } else {
            warn!("shell-resize for unknown session {}", session_id);
        }
    }

    fn start_session(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        if self.sessions.contains_key(session_id) {
            return Err("shell session already active".to_string());
        }

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|err| format!("failed to open pty: {}", err))?;

        let shell = self.default_shell.clone();
        let mut cmd = CommandBuilder::new(&shell);
        cmd.env("TERM", "xterm-256color");
        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|err| format!("failed to spawn shell: {}", err))?;

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|err| format!("failed to clone pty reader: {}", err))?;
        let writer = pair
            .master
            .take_writer()
            .map_err(|err| format!("failed to get pty writer: {}", err))?;

        let session = ShellSession {
            writer: Arc::new(Mutex::new(writer)),
            master: Arc::new(Mutex::new(pair.master)),
            child: Arc::new(Mutex::new(child)),
            shell: shell.clone(),
        };

        self.sessions.insert(session_id.to_string(), session);
        self.send_shell_ready(session_id, &shell);

        self.spawn_reader(session_id.to_string(), reader);
        self.spawn_waiter(session_id.to_string());

        Ok(())
    }

    fn spawn_reader(&self, session_id: String, mut reader: Box<dyn Read + Send>) {
        let handle = self.handle.clone();

        std::thread::spawn(move || {
            let mut buffer = [0u8; 8192];
            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => {
                        debug!("shell output closed for {}", session_id);
                        break;
                    }
                    Ok(bytes_read) => {
                        let encoded = STANDARD.encode(&buffer[..bytes_read]);
                        let message = serde_json::json!({
                            "type": "shell-data",
                            "sessionId": session_id,
                            "payload": { "data": encoded },
                            "timestamp": chrono::Utc::now().to_rfc3339(),
                        });
                        let _ = handle.send_json_blocking(message);
                    }
                    Err(err) => {
                        let message = serde_json::json!({
                            "type": "shell-error",
                            "sessionId": session_id,
                            "payload": { "error": format!("shell output error: {}", err) },
                            "timestamp": chrono::Utc::now().to_rfc3339(),
                        });
                        let _ = handle.send_json_blocking(message);
                        break;
                    }
                }
            }
        });
    }

    fn spawn_waiter(&self, session_id: String) {
        let sessions = Arc::clone(&self.sessions);
        let handle = self.handle.clone();

        std::thread::spawn(move || {
            loop {
                if let Some(entry) = sessions.get(&session_id) {
                    let mut child = entry.child.lock().unwrap();
                    match child.try_wait() {
                        Ok(Some(status)) => {
                            let exit_code = status.exit_code();
                            let message = serde_json::json!({
                                "type": "shell-exit",
                                "sessionId": session_id,
                                "payload": { "code": exit_code },
                                "timestamp": chrono::Utc::now().to_rfc3339(),
                            });
                            let _ = handle.send_json_blocking(message);
                            sessions.remove(&session_id);
                            break;
                        }
                        Ok(None) => {}
                        Err(err) => {
                            let message = serde_json::json!({
                                "type": "shell-error",
                                "sessionId": session_id,
                                "payload": { "error": format!("shell wait error: {}", err) },
                                "timestamp": chrono::Utc::now().to_rfc3339(),
                            });
                            let _ = handle.send_json_blocking(message);
                            sessions.remove(&session_id);
                            break;
                        }
                    }
                } else {
                    break;
                }

                std::thread::sleep(Duration::from_millis(250));
            }
        });
    }

    fn write_input(&self, session_id: &str, data: &str) -> Result<(), String> {
        let decoded = STANDARD
            .decode(data.as_bytes())
            .map_err(|err| format!("invalid base64 input: {}", err))?;

        if let Some(session) = self.sessions.get(session_id) {
            let mut writer = session.writer.lock().unwrap();
            writer
                .write_all(&decoded)
                .map_err(|err| format!("failed to write to pty: {}", err))?;
            writer
                .flush()
                .map_err(|err| format!("failed to flush pty: {}", err))?;
            Ok(())
        } else {
            Err("shell session not found".to_string())
        }
    }

    fn end_session(&self, session_id: &str, reason: &str) {
        if let Some((_, session)) = self.sessions.remove(session_id) {
            let mut child = session.child.lock().unwrap();
            if let Err(err) = child.kill() {
                warn!("Failed to kill shell session {}: {}", session_id, err);
            }
        }

        let message = serde_json::json!({
            "type": "shell-exit",
            "sessionId": session_id,
            "payload": { "code": 0, "reason": reason },
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        let _ = self.handle.send_json_blocking(message);
    }

    fn send_shell_ready(&self, session_id: &str, shell: &str) {
        let message = serde_json::json!({
            "type": "shell-ready",
            "sessionId": session_id,
            "payload": { "shell": shell },
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        let _ = self.handle.send_json_blocking(message);
    }

    fn send_shell_error(&self, session_id: &str, error_message: impl Into<String>) {
        let message = serde_json::json!({
            "type": "shell-error",
            "sessionId": session_id,
            "payload": { "error": error_message.into() },
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        let _ = self.handle.send_json_blocking(message);
    }
}
