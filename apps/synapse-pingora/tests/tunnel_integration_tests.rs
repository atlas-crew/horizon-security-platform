use futures_util::{SinkExt, StreamExt};
use hmac::{Hmac, Mac};
use serde_json::Value;
use sha2::Sha256;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio::sync::{mpsc, watch};
use tokio_tungstenite::{accept_async, tungstenite::Message};
use uuid::Uuid;

type HmacSha256 = Hmac<Sha256>;

use synapse_pingora::metrics::MetricsRegistry;
use synapse_pingora::tunnel::{ConnectionState, TunnelChannel, TunnelClient, TunnelConfig};

const TEST_API_KEY: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

#[derive(Debug, Clone)]
enum ServerEvent {
    Auth(Value),
    ClientMessage(Value),
}

struct MockServerState {
    connections: AtomicUsize,
    events: mpsc::Sender<ServerEvent>,
}

impl MockServerState {
    fn new(events: mpsc::Sender<ServerEvent>) -> Self {
        Self {
            connections: AtomicUsize::new(0),
            events,
        }
    }

    fn connection_count(&self) -> usize {
        self.connections.load(Ordering::SeqCst)
    }
}

struct MockServer {
    addr: SocketAddr,
    shutdown: watch::Sender<bool>,
    handle: tokio::task::JoinHandle<()>,
    state: Arc<MockServerState>,
}

impl MockServer {
    fn url(&self) -> String {
        format!("ws://{}/ws/tunnel/sensor", self.addr)
    }

    async fn shutdown(self) {
        let _ = self.shutdown.send(true);
        let _ = self.handle.await;
    }
}

async fn spawn_mock_server<H, Fut>(mut handler: H) -> (MockServer, mpsc::Receiver<ServerEvent>)
where
    H: FnMut(
            tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
            Arc<MockServerState>,
        ) -> Fut
        + Send
        + 'static,
    Fut: std::future::Future<Output = ()> + Send + 'static,
{
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let addr = listener.local_addr().expect("local_addr");
    let (events_tx, events_rx) = mpsc::channel(64);
    let state = Arc::new(MockServerState::new(events_tx));
    let (shutdown_tx, mut shutdown_rx) = watch::channel(false);
    let state_clone = Arc::clone(&state);

    let handle = tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = shutdown_rx.changed() => {
                    if *shutdown_rx.borrow() {
                        break;
                    }
                }
                accept_result = listener.accept() => {
                    let (stream, _) = match accept_result {
                        Ok(result) => result,
                        Err(_) => break,
                    };
                    let ws_stream = match accept_async(stream).await {
                        Ok(ws) => ws,
                        Err(_) => continue,
                    };
                    state_clone.connections.fetch_add(1, Ordering::SeqCst);
                    handler(ws_stream, Arc::clone(&state_clone)).await;
                }
            }
        }
    });

    (
        MockServer {
            addr,
            shutdown: shutdown_tx,
            handle,
            state,
        },
        events_rx,
    )
}

fn build_config(url: String) -> TunnelConfig {
    TunnelConfig {
        enabled: true,
        url,
        api_key: TEST_API_KEY.to_string(),
        sensor_id: "sensor-123".to_string(),
        auth_timeout_ms: 80,
        reconnect_delay_ms: 100,
        max_reconnect_attempts: 5,
        ..TunnelConfig::default()
    }
}

fn build_client(config: TunnelConfig) -> TunnelClient {
    TunnelClient::new(config, Arc::new(MetricsRegistry::new()))
}

async fn wait_for_state(
    client: &TunnelClient,
    expected: ConnectionState,
    timeout: Duration,
) -> bool {
    let deadline = std::time::Instant::now() + timeout;
    loop {
        if client.state() == expected {
            return true;
        }
        if std::time::Instant::now() >= deadline {
            return false;
        }
        tokio::task::yield_now().await;
    }
}

fn build_auth_signature_payload(
    sensor_id: &str,
    tenant_id: &str,
    session_id: &str,
    timestamp: &str,
    capabilities: &[String],
    sensor_name: Option<&str>,
) -> String {
    let mut caps = capabilities.to_vec();
    caps.sort();
    let caps = caps.join(",");
    let sensor_name = sensor_name.unwrap_or("");
    [
        "type=auth-success".to_string(),
        format!("sensorId={}", sensor_id),
        format!("tenantId={}", tenant_id),
        format!("sessionId={}", session_id),
        format!("timestamp={}", timestamp),
        format!("capabilities={}", caps),
        format!("sensorName={}", sensor_name),
    ]
    .join("\n")
}

fn sign_auth_success(api_key: &str, payload: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(api_key.as_bytes()).expect("hmac key");
    mac.update(payload.as_bytes());
    let result = mac.finalize().into_bytes();
    hex::encode(result)
}

fn auth_success_message(sensor_id: &str, tenant_id: &str, api_key: &str) -> String {
    let session_id = Uuid::new_v4().to_string();
    let timestamp = chrono::Utc::now().to_rfc3339();
    let capabilities = vec!["shell".to_string(), "logs".to_string()];
    let signature_payload = build_auth_signature_payload(
        sensor_id,
        tenant_id,
        &session_id,
        &timestamp,
        &capabilities,
        Some("sensor-alpha"),
    );
    let signature = sign_auth_success(api_key, &signature_payload);
    let payload = serde_json::json!({
        "sensorId": sensor_id,
        "tenantId": tenant_id,
        "capabilities": capabilities,
        "sensorName": "sensor-alpha",
    });
    serde_json::json!({
        "type": "auth-success",
        "payload": payload,
        "sessionId": session_id,
        "timestamp": timestamp,
        "signature": signature,
    })
    .to_string()
}

async fn next_non_heartbeat(
    ws: &mut tokio_tungstenite::WebSocketStream<tokio::net::TcpStream>,
) -> Option<Value> {
    loop {
        match ws.next().await {
            Some(Ok(Message::Text(text))) => {
                let json: Value = serde_json::from_str(&text).ok()?;
                let is_heartbeat = json.get("type").and_then(Value::as_str) == Some("heartbeat");
                if is_heartbeat {
                    continue;
                }
                return Some(json);
            }
            Some(Ok(_)) => continue,
            _ => return None,
        }
    }
}

// ============================================================================
// TEST 1: Circuit Breaker Integration
// ============================================================================

#[tokio::test]
async fn circuit_breaker_tracks_reconnect_attempts() {
    let (server, _events) = spawn_mock_server(|mut ws, _state| async move {
        let _ = ws.next().await;
        let _ = ws
            .send(Message::Text(auth_success_message(
                "sensor-123",
                "tenant-1",
                TEST_API_KEY,
            )))
            .await;
        while ws.next().await.is_some() {}
    })
    .await;

    let mut config = build_config(server.url());
    config.reconnect_delay_ms = 100;
    config.max_reconnect_attempts = 10;

    let mut client = build_client(config);
    client.start().await.unwrap();

    assert!(wait_for_state(&client, ConnectionState::Connected, Duration::from_secs(2)).await);

    tokio::time::sleep(Duration::from_millis(100)).await;

    let stats = client.stats();
    assert_eq!(
        stats.reconnect_attempts, 0,
        "Expected 0 reconnect attempts on successful connection, got {}",
        stats.reconnect_attempts
    );

    client.stop().await;
    server.shutdown().await;
}

#[tokio::test]
async fn circuit_breaker_recovery_sequence() {
    let attempt_count = Arc::new(AtomicUsize::new(0));
    let attempt_count_clone = Arc::clone(&attempt_count);

    let (server, _events) = spawn_mock_server(move |mut ws, _state| {
        let count = Arc::clone(&attempt_count_clone);
        async move {
            let _ = ws.next().await;
            let n = count.fetch_add(1, Ordering::SeqCst);

            if n < 3 {
                let _ = ws.close(None).await;
            } else {
                let _ = ws
                    .send(Message::Text(auth_success_message(
                        "sensor-123",
                        "tenant-1",
                        TEST_API_KEY,
                    )))
                    .await;
                while ws.next().await.is_some() {}
            }
        }
    })
    .await;

    let mut config = build_config(server.url());
    config.reconnect_delay_ms = 100;
    config.max_reconnect_attempts = 10;

    let mut client = build_client(config);
    client.start().await.unwrap();

    tokio::time::sleep(Duration::from_millis(800)).await;

    assert!(wait_for_state(&client, ConnectionState::Connected, Duration::from_secs(2)).await);

    let stats = client.stats();
    assert_eq!(
        stats.circuit_breaker_state, 0,
        "Circuit breaker should be closed (0) after recovery"
    );

    client.stop().await;
    server.shutdown().await;
}

// ============================================================================
// TEST 2: Message Routing to Channels
// ============================================================================

#[tokio::test]
async fn routes_shell_channel_message() {
    let (server, _events) = spawn_mock_server(|mut ws, _state| async move {
        let _ = ws.next().await;
        let _ = ws
            .send(Message::Text(auth_success_message(
                "sensor-123",
                "tenant-1",
                TEST_API_KEY,
            )))
            .await;
        tokio::time::sleep(Duration::from_millis(20)).await;
        let message = serde_json::json!({
            "channel": "shell",
            "sessionId": "session-1",
            "sequenceId": 42,
            "timestamp": 1_700_000_000,
            "payload": { "command": "whoami" }
        });
        let _ = ws.send(Message::Text(message.to_string())).await;
    })
    .await;

    let mut client = build_client(build_config(server.url()));
    let mut rx = client.subscribe_channel(TunnelChannel::Shell);
    client.start().await.unwrap();

    assert!(wait_for_state(&client, ConnectionState::Connected, Duration::from_secs(2)).await);

    let envelope = tokio::time::timeout(Duration::from_millis(200), rx.recv())
        .await
        .expect("timeout waiting for channel message")
        .expect("channel message");

    assert_eq!(envelope.channel, TunnelChannel::Shell);
    assert_eq!(envelope.session_id.as_deref(), Some("session-1"));
    assert_eq!(envelope.sequence_id, Some(42));

    client.stop().await;
    server.shutdown().await;
}

#[tokio::test]
async fn routes_logs_channel_message() {
    let (server, _events) = spawn_mock_server(|mut ws, _state| async move {
        let _ = ws.next().await;
        let _ = ws
            .send(Message::Text(auth_success_message(
                "sensor-123",
                "tenant-1",
                TEST_API_KEY,
            )))
            .await;
        tokio::time::sleep(Duration::from_millis(20)).await;
        let message = serde_json::json!({
            "channel": "logs",
            "sessionId": "session-2",
            "sequenceId": 99,
            "timestamp": 1_700_000_001,
            "payload": { "log": "system event" }
        });
        let _ = ws.send(Message::Text(message.to_string())).await;
    })
    .await;

    let mut client = build_client(build_config(server.url()));
    let mut rx = client.subscribe_channel(TunnelChannel::Logs);
    client.start().await.unwrap();

    assert!(wait_for_state(&client, ConnectionState::Connected, Duration::from_secs(2)).await);

    let envelope = tokio::time::timeout(Duration::from_millis(200), rx.recv())
        .await
        .expect("timeout")
        .expect("envelope");

    assert_eq!(envelope.channel, TunnelChannel::Logs);
    assert_eq!(envelope.session_id.as_deref(), Some("session-2"));
    assert_eq!(envelope.sequence_id, Some(99));

    client.stop().await;
    server.shutdown().await;
}

#[tokio::test]
async fn routes_diag_channel_message() {
    let (server, _events) = spawn_mock_server(|mut ws, _state| async move {
        let _ = ws.next().await;
        let _ = ws
            .send(Message::Text(auth_success_message(
                "sensor-123",
                "tenant-1",
                TEST_API_KEY,
            )))
            .await;
        tokio::time::sleep(Duration::from_millis(20)).await;
        let message = serde_json::json!({
            "channel": "diag",
            "sessionId": "session-3",
            "sequenceId": 77,
            "payload": { "diagnostic": "health check" }
        });
        let _ = ws.send(Message::Text(message.to_string())).await;
    })
    .await;

    let mut client = build_client(build_config(server.url()));
    let mut rx = client.subscribe_channel(TunnelChannel::Diag);
    client.start().await.unwrap();

    assert!(wait_for_state(&client, ConnectionState::Connected, Duration::from_secs(2)).await);

    let envelope = tokio::time::timeout(Duration::from_millis(200), rx.recv())
        .await
        .expect("timeout")
        .expect("envelope");

    assert_eq!(envelope.channel, TunnelChannel::Diag);

    client.stop().await;
    server.shutdown().await;
}

#[tokio::test]
async fn routes_control_channel_message() {
    let (server, _events) = spawn_mock_server(|mut ws, _state| async move {
        let _ = ws.next().await;
        let _ = ws
            .send(Message::Text(auth_success_message(
                "sensor-123",
                "tenant-1",
                TEST_API_KEY,
            )))
            .await;
        tokio::time::sleep(Duration::from_millis(20)).await;
        let message = serde_json::json!({
            "channel": "control",
            "sequenceId": 55,
            "payload": { "action": "restart" }
        });
        let _ = ws.send(Message::Text(message.to_string())).await;
    })
    .await;

    let mut client = build_client(build_config(server.url()));
    let mut rx = client.subscribe_channel(TunnelChannel::Control);
    client.start().await.unwrap();

    assert!(wait_for_state(&client, ConnectionState::Connected, Duration::from_secs(2)).await);

    let envelope = tokio::time::timeout(Duration::from_millis(200), rx.recv())
        .await
        .expect("timeout")
        .expect("envelope");

    assert_eq!(envelope.channel, TunnelChannel::Control);

    client.stop().await;
    server.shutdown().await;
}

#[tokio::test]
async fn routes_files_channel_message() {
    let (server, _events) = spawn_mock_server(|mut ws, _state| async move {
        let _ = ws.next().await;
        let _ = ws
            .send(Message::Text(auth_success_message(
                "sensor-123",
                "tenant-1",
                TEST_API_KEY,
            )))
            .await;
        tokio::time::sleep(Duration::from_millis(20)).await;
        let message = serde_json::json!({
            "channel": "files",
            "sequenceId": 33,
            "payload": { "file": "config.txt" }
        });
        let _ = ws.send(Message::Text(message.to_string())).await;
    })
    .await;

    let mut client = build_client(build_config(server.url()));
    let mut rx = client.subscribe_channel(TunnelChannel::Files);
    client.start().await.unwrap();

    assert!(wait_for_state(&client, ConnectionState::Connected, Duration::from_secs(2)).await);

    let envelope = tokio::time::timeout(Duration::from_millis(200), rx.recv())
        .await
        .expect("timeout")
        .expect("envelope");

    assert_eq!(envelope.channel, TunnelChannel::Files);

    client.stop().await;
    server.shutdown().await;
}

#[tokio::test]
async fn routes_update_channel_message() {
    let (server, _events) = spawn_mock_server(|mut ws, _state| async move {
        let _ = ws.next().await;
        let _ = ws
            .send(Message::Text(auth_success_message(
                "sensor-123",
                "tenant-1",
                TEST_API_KEY,
            )))
            .await;
        tokio::time::sleep(Duration::from_millis(20)).await;
        let message = serde_json::json!({
            "channel": "update",
            "sequenceId": 11,
            "payload": { "version": "1.2.3" }
        });
        let _ = ws.send(Message::Text(message.to_string())).await;
    })
    .await;

    let mut client = build_client(build_config(server.url()));
    let mut rx = client.subscribe_channel(TunnelChannel::Update);
    client.start().await.unwrap();

    assert!(wait_for_state(&client, ConnectionState::Connected, Duration::from_secs(2)).await);

    let envelope = tokio::time::timeout(Duration::from_millis(200), rx.recv())
        .await
        .expect("timeout")
        .expect("envelope");

    assert_eq!(envelope.channel, TunnelChannel::Update);

    client.stop().await;
    server.shutdown().await;
}

#[tokio::test]
async fn routes_all_channels_concurrently() {
    let (server, _events) = spawn_mock_server(|mut ws, _state| async move {
        let _ = ws.next().await;
        let _ = ws
            .send(Message::Text(auth_success_message(
                "sensor-123",
                "tenant-1",
                TEST_API_KEY,
            )))
            .await;
        tokio::time::sleep(Duration::from_millis(30)).await;

        for (idx, channel) in ["shell", "logs", "diag", "control", "files", "update"]
            .iter()
            .enumerate()
        {
            let message = serde_json::json!({
                "channel": channel,
                "sequenceId": idx as u64,
                "payload": {}
            });
            let _ = ws.send(Message::Text(message.to_string())).await;
            tokio::time::sleep(Duration::from_millis(5)).await;
        }
    })
    .await;

    let mut client = build_client(build_config(server.url()));
    client.start().await.unwrap();

    assert!(wait_for_state(&client, ConnectionState::Connected, Duration::from_secs(2)).await);

    let channels = [
        TunnelChannel::Shell,
        TunnelChannel::Logs,
        TunnelChannel::Diag,
        TunnelChannel::Control,
        TunnelChannel::Files,
        TunnelChannel::Update,
    ];

    let mut receivers = Vec::new();
    for channel in &channels {
        receivers.push((channel, client.subscribe_channel(*channel)));
    }

    for (expected_channel, mut rx) in receivers {
        let envelope = tokio::time::timeout(Duration::from_millis(300), rx.recv())
            .await
            .expect("timeout")
            .expect("envelope");
        assert_eq!(
            &envelope.channel, expected_channel,
            "Expected {:?}, got {:?}",
            expected_channel, envelope.channel
        );
    }

    client.stop().await;
    server.shutdown().await;
}

// ============================================================================
// TEST 3: Heartbeat Interval & Timeout Tracking
// ============================================================================

#[tokio::test]
async fn heartbeat_sends_pings_regularly() {
    let ping_count = Arc::new(AtomicUsize::new(0));
    let ping_count_clone = Arc::clone(&ping_count);

    let (server, _events) = spawn_mock_server(move |mut ws, _state| {
        let count = Arc::clone(&ping_count_clone);
        async move {
            let _ = ws.next().await;
            let _ = ws
                .send(Message::Text(auth_success_message(
                    "sensor-123",
                    "tenant-1",
                    TEST_API_KEY,
                )))
                .await;

            let start = std::time::Instant::now();
            while start.elapsed() < Duration::from_secs(4) {
                match ws.next().await {
                    Some(Ok(Message::Ping(data))) => {
                        count.fetch_add(1, Ordering::SeqCst);
                        let _ = ws.send(Message::Pong(data)).await;
                    }
                    Some(Ok(_)) => continue,
                    _ => break,
                }
            }
        }
    })
    .await;

    let mut config = build_config(server.url());
    config.heartbeat_interval_ms = 1_000;
    config.reconnect_delay_ms = 100;
    config.max_reconnect_attempts = 1;

    let mut client = build_client(config);
    client.start().await.unwrap();

    assert!(wait_for_state(&client, ConnectionState::Connected, Duration::from_secs(2)).await);

    tokio::time::sleep(Duration::from_secs(4)).await;

    let stats = client.stats();
    assert!(
        stats.heartbeats_sent > 0,
        "Expected heartbeats to be sent during connection, got {}",
        stats.heartbeats_sent
    );

    client.stop().await;
    server.shutdown().await;
}

#[tokio::test]
async fn heartbeat_detects_no_pong_response() {
    let (server, _events) = spawn_mock_server(|mut ws, _state| async move {
        let _ = ws.next().await;
        let _ = ws
            .send(Message::Text(auth_success_message(
                "sensor-123",
                "tenant-1",
                TEST_API_KEY,
            )))
            .await;

        let start = std::time::Instant::now();
        while start.elapsed() < Duration::from_secs(8) {
            match ws.next().await {
                Some(Ok(Message::Ping(_))) => {
                    continue;
                }
                _ => break,
            }
        }
    })
    .await;

    let mut config = build_config(server.url());
    config.heartbeat_interval_ms = 1_000;
    config.reconnect_delay_ms = 100;
    config.max_reconnect_attempts = 1;

    let mut client = build_client(config);
    client.start().await.unwrap();

    assert!(wait_for_state(&client, ConnectionState::Connected, Duration::from_secs(2)).await);

    tokio::time::sleep(Duration::from_secs(8)).await;

    assert!(
        wait_for_state(
            &client,
            ConnectionState::Reconnecting,
            Duration::from_secs(2)
        )
        .await
            || wait_for_state(&client, ConnectionState::Error, Duration::from_secs(2)).await,
        "Expected client to reconnect or error after heartbeat timeouts"
    );

    client.stop().await;
    server.shutdown().await;
}

#[tokio::test]
async fn heartbeat_interval_configurable() {
    let ping_count = Arc::new(AtomicUsize::new(0));
    let ping_count_clone = Arc::clone(&ping_count);

    let (server, _events) = spawn_mock_server(move |mut ws, _state| {
        let count = Arc::clone(&ping_count_clone);
        async move {
            let _ = ws.next().await;
            let _ = ws
                .send(Message::Text(auth_success_message(
                    "sensor-123",
                    "tenant-1",
                    TEST_API_KEY,
                )))
                .await;

            let start = std::time::Instant::now();
            while start.elapsed() < Duration::from_secs(3) {
                match ws.next().await {
                    Some(Ok(Message::Ping(_))) => {
                        count.fetch_add(1, Ordering::SeqCst);
                    }
                    Some(Ok(_)) => continue,
                    _ => break,
                }
            }
        }
    })
    .await;

    let mut config = build_config(server.url());
    config.heartbeat_interval_ms = 1_000;
    config.reconnect_delay_ms = 100;
    config.max_reconnect_attempts = 1;

    let mut client = build_client(config);
    client.start().await.unwrap();

    assert!(wait_for_state(&client, ConnectionState::Connected, Duration::from_secs(2)).await);

    tokio::time::sleep(Duration::from_secs(3)).await;

    let stats = client.stats();
    assert_eq!(
        stats.messages_received, 0,
        "Should not receive any messages in this test"
    );
    assert_eq!(
        stats.heartbeat_timeouts, 0,
        "Should have no heartbeat timeouts when responding to pings"
    );

    client.stop().await;
    server.shutdown().await;
}

#[tokio::test]
async fn heartbeat_rtt_tracking() {
    let (server, _events) = spawn_mock_server(|mut ws, _state| async move {
        let _ = ws.next().await;
        let _ = ws
            .send(Message::Text(auth_success_message(
                "sensor-123",
                "tenant-1",
                TEST_API_KEY,
            )))
            .await;

        while let Some(msg) = ws.next().await {
            match msg {
                Ok(Message::Ping(data)) => {
                    tokio::time::sleep(Duration::from_millis(50)).await;
                    let _ = ws.send(Message::Pong(data)).await;
                }
                Ok(Message::Close(_)) => break,
                Err(_) => break,
                _ => {}
            }
        }
    })
    .await;

    let mut config = build_config(server.url());
    config.heartbeat_interval_ms = 1_000;
    config.reconnect_delay_ms = 100;
    config.max_reconnect_attempts = 1;

    let mut client = build_client(config);
    client.start().await.unwrap();

    assert!(wait_for_state(&client, ConnectionState::Connected, Duration::from_secs(2)).await);

    tokio::time::sleep(Duration::from_secs(2)).await;

    let stats = client.stats();
    assert!(
        stats.heartbeat_rtt_ms > 0,
        "Expected heartbeat RTT to be measured (>0), got {}",
        stats.heartbeat_rtt_ms
    );

    client.stop().await;
    server.shutdown().await;
}

// ============================================================================
// TEST 4: Connection State Serialization
// ============================================================================

#[test]
fn serializes_disconnected_state() {
    let state = ConnectionState::Disconnected;
    let json = serde_json::to_value(state).expect("serialize");
    assert_eq!(json, "disconnected");

    let deserialized: ConnectionState = serde_json::from_value(json).expect("deserialize");
    assert_eq!(deserialized, ConnectionState::Disconnected);
}

#[test]
fn serializes_connecting_state() {
    let state = ConnectionState::Connecting;
    let json = serde_json::to_value(state).expect("serialize");
    assert_eq!(json, "connecting");

    let deserialized: ConnectionState = serde_json::from_value(json).expect("deserialize");
    assert_eq!(deserialized, ConnectionState::Connecting);
}

#[test]
fn serializes_authenticating_state() {
    let state = ConnectionState::Authenticating;
    let json = serde_json::to_value(state).expect("serialize");
    assert_eq!(json, "authenticating");

    let deserialized: ConnectionState = serde_json::from_value(json).expect("deserialize");
    assert_eq!(deserialized, ConnectionState::Authenticating);
}

#[test]
fn serializes_connected_state() {
    let state = ConnectionState::Connected;
    let json = serde_json::to_value(state).expect("serialize");
    assert_eq!(json, "connected");

    let deserialized: ConnectionState = serde_json::from_value(json).expect("deserialize");
    assert_eq!(deserialized, ConnectionState::Connected);
}

#[test]
fn serializes_reconnecting_state() {
    let state = ConnectionState::Reconnecting;
    let json = serde_json::to_value(state).expect("serialize");
    assert_eq!(json, "reconnecting");

    let deserialized: ConnectionState = serde_json::from_value(json).expect("deserialize");
    assert_eq!(deserialized, ConnectionState::Reconnecting);
}

#[test]
fn serializes_error_state() {
    let state = ConnectionState::Error;
    let json = serde_json::to_value(state).expect("serialize");
    assert_eq!(json, "error");

    let deserialized: ConnectionState = serde_json::from_value(json).expect("deserialize");
    assert_eq!(deserialized, ConnectionState::Error);
}

#[test]
fn all_states_roundtrip() {
    let states = [
        ConnectionState::Disconnected,
        ConnectionState::Connecting,
        ConnectionState::Authenticating,
        ConnectionState::Connected,
        ConnectionState::Reconnecting,
        ConnectionState::Error,
    ];

    for original_state in &states {
        let json = serde_json::to_value(*original_state).expect("serialize");
        let deserialized: ConnectionState = serde_json::from_value(json).expect("deserialize");
        assert_eq!(
            &deserialized, original_state,
            "State roundtrip failed for {:?}",
            original_state
        );
    }
}

#[test]
fn state_serialization_in_json_object() {
    #[derive(serde::Serialize, serde::Deserialize)]
    struct StateMessage {
        state: ConnectionState,
        timestamp: i64,
    }

    let msg = StateMessage {
        state: ConnectionState::Connected,
        timestamp: 1234567890,
    };

    let json = serde_json::to_string(&msg).expect("serialize");
    let deserialized: StateMessage = serde_json::from_str(&json).expect("deserialize");
    assert_eq!(deserialized.state, ConnectionState::Connected);
    assert_eq!(deserialized.timestamp, 1234567890);
}

#[test]
fn tunnel_channels_serialize() {
    let channels = [
        TunnelChannel::Shell,
        TunnelChannel::Logs,
        TunnelChannel::Diag,
        TunnelChannel::Control,
        TunnelChannel::Files,
        TunnelChannel::Update,
    ];

    for channel in &channels {
        let json = serde_json::to_value(*channel).expect("serialize");
        let deserialized: TunnelChannel = serde_json::from_value(json).expect("deserialize");
        assert_eq!(
            &deserialized, channel,
            "Channel roundtrip failed for {:?}",
            channel
        );
    }
}
