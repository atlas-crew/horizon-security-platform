//! Terminal User Interface for Synapse-Pingora monitoring.
//! Built with ratatui for high-performance terminal visualization.

use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::{Backend, CrosstermBackend},
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::Line,
    widgets::{Block, Borders, Cell, Gauge, List, ListItem, Paragraph, Row, Table},
    Frame, Terminal,
};
use std::io;
use std::sync::Arc;
use std::time::{Duration, Instant};

use synapse_pingora::block_log::BlockLog;
use synapse_pingora::entity::EntityManager;
use synapse_pingora::metrics::MetricsRegistry;

/// TUI Dashboard Application
pub struct TuiApp {
    /// Metrics registry for real-time stats
    metrics: Arc<MetricsRegistry>,
    /// Entity manager for risk tracking
    entities: Arc<EntityManager>,
    /// Block log for recent events
    block_log: Arc<BlockLog>,
    /// Application start time
    start_time: Instant,
    /// Whether the app should quit
    pub should_quit: bool,
    /// Tick rate for updates
    tick_rate: Duration,
}

impl TuiApp {
    pub fn new(
        metrics: Arc<MetricsRegistry>,
        entities: Arc<EntityManager>,
        block_log: Arc<BlockLog>,
    ) -> Self {
        Self {
            metrics,
            entities,
            block_log,
            start_time: Instant::now(),
            should_quit: false,
            tick_rate: Duration::from_millis(250),
        }
    }

    /// Run the TUI event loop
    pub fn run<B: Backend>(&mut self, terminal: &mut Terminal<B>) -> io::Result<()> {
        let mut last_tick = Instant::now();
        while !self.should_quit {
            terminal.draw(|f| self.ui(f))?;

            let timeout = self
                .tick_rate
                .checked_sub(last_tick.elapsed())
                .unwrap_or_else(|| Duration::from_secs(0));

            if event::poll(timeout)? {
                if let Event::Key(key) = event::read()? {
                    match key.code {
                        KeyCode::Char('q') => self.should_quit = true,
                        _ => {}
                    }
                }
            }

            if last_tick.elapsed() >= self.tick_rate {
                last_tick = Instant::now();
            }
        }
        Ok(())
    }

    fn ui(&self, f: &mut Frame) {
        let size = f.size();

        // Vertical layout: Header (3), Main Content (1fr), Footer (1)
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints(
                [
                    Constraint::Length(3),
                    Constraint::Min(10),
                    Constraint::Length(1),
                ]
                .as_ref(),
            )
            .split(size);

        self.render_header(f, chunks[0]);
        self.render_main(f, chunks[1]);
        self.render_footer(f, chunks[2]);
    }

    fn render_header(&self, f: &mut Frame, area: Rect) {
        let uptime = self.start_time.elapsed().as_secs();
        let total_requests = self.metrics.total_requests();
        let blocked = self.metrics.waf_metrics.blocked.load(std::sync::atomic::Ordering::Relaxed);
        
        let block_rate = if total_requests > 0 {
            (blocked as f64 / total_requests as f64) * 100.0
        } else {
            0.0
        };

        let header_text = format!(
            " Synapse-Pingora v0.1.0 | Uptime: {}s | Requests: {} | Blocked: {} ({:.1}%) ",
            uptime, total_requests, blocked, block_rate
        );

        let header = Paragraph::new(Line::from(header_text))
            .style(Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD))
            .block(Block::default().borders(Borders::ALL).title(" Status "));
        
        f.render_widget(header, area);
    }

    fn render_main(&self, f: &mut Frame, area: Rect) {
        // Horizontal layout: Left (Metrics + Chart), Right (Entities + Blocks)
        let main_chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(40), Constraint::Percentage(60)].as_ref())
            .split(area);

        self.render_left_panel(f, main_chunks[0]);
        self.render_right_panel(f, main_chunks[1]);
    }

    fn render_left_panel(&self, f: &mut Frame, area: Rect) {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Length(6), Constraint::Min(0)].as_ref())
            .split(area);

        // RPS Gauge
        let rps = self.metrics.requests_last_minute() / 60;
        let gauge = Gauge::default()
            .block(Block::default().borders(Borders::ALL).title(" Requests/sec "))
            .gauge_style(Style::default().fg(Color::Green))
            .percent((rps.min(100) as u16).into())
            .label(format!("{} RPS", rps));
        f.render_widget(gauge, chunks[0]);

        // Detailed Metrics
        let avg_latency = self.metrics.avg_latency_ms();
        let avg_waf = self.metrics.waf_metrics.avg_detection_us();
        
        let metrics_list = vec![
            ListItem::new(format!("Avg Latency:   {:.2} ms", avg_latency)),
            ListItem::new(format!("WAF Detection: {:.2} μs", avg_waf)),
            ListItem::new(format!("Active Conns:  {}", self.metrics.active_requests())),
            ListItem::new(format!("Rules Loaded:  {}", crate::DetectionEngine::rule_count())),
        ];

        let metrics = List::new(metrics_list)
            .block(Block::default().borders(Borders::ALL).title(" System Metrics "));
        f.render_widget(metrics, chunks[1]);
    }

    fn render_right_panel(&self, f: &mut Frame, area: Rect) {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Percentage(50), Constraint::Percentage(50)].as_ref())
            .split(area);

        // Top Risky Entities
        let top_entities = self.entities.list_top_risk(10);
        let header = Row::new(vec![
            Cell::from("IP Address"),
            Cell::from("Risk"),
            Cell::from("Reqs"),
            Cell::from("Status"),
        ])
        .style(Style::default().add_modifier(Modifier::BOLD).fg(Color::Yellow));

        let rows = top_entities.iter().map(|e| {
            let status = if e.blocked { "BLOCKED" } else { "OK" };
            let status_color = if e.blocked { Color::Red } else { Color::Green };
            Row::new(vec![
                Cell::from(e.entity_id.clone()),
                Cell::from(format!("{:.1}", e.risk)),
                Cell::from(e.request_count.to_string()),
                Cell::from(status).style(Style::default().fg(status_color)),
            ])
        });

        let table = Table::new(
            rows,
            [
                Constraint::Min(15),
                Constraint::Length(8),
                Constraint::Length(8),
                Constraint::Length(10),
            ],
        )
        .header(header)
        .block(Block::default().borders(Borders::ALL).title(" Top Risky Entities "));
        f.render_widget(table, chunks[0]);

        // Recent Blocks
        let recent_blocks = self.block_log.recent(10);
        let block_items: Vec<ListItem> = recent_blocks
            .iter()
            .map(|b| {
                let time = chrono::DateTime::from_timestamp_millis(b.timestamp as i64)
                    .map(|dt| dt.format("%H:%M:%S").to_string())
                    .unwrap_or_else(|| "00:00:00".to_string());
                
                ListItem::new(format!(
                    "[{}] {} blocked on {} (Risk: {})",
                    time, b.client_ip, b.path, b.risk_score
                ))
                .style(Style::default().fg(Color::Red))
            })
            .collect();

        let blocks = List::new(block_items)
            .block(Block::default().borders(Borders::ALL).title(" Recent WAF Blocks "));
        f.render_widget(blocks, chunks[1]);
    }

    fn render_footer(&self, f: &mut Frame, area: Rect) {
        let footer = Paragraph::new(" [q] Quit | [r] Reset Stats | [f] Filter ")
            .style(Style::default().bg(Color::Blue).fg(Color::White));
        f.render_widget(footer, area);
    }
}

/// Start the TUI application
pub fn start_tui(
    metrics: Arc<MetricsRegistry>,
    entities: Arc<EntityManager>,
    block_log: Arc<BlockLog>,
) -> io::Result<()> {
    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Create app and run
    let mut app = TuiApp::new(metrics, entities, block_log);
    let res = app.run(&mut terminal);

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    if let Err(err) = res {
        println!("{:?}", err);
    }

    Ok(())
}
