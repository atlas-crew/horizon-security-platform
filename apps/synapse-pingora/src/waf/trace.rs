//! WAF evaluation tracing utilities.

use serde::Serialize;

/// Trace events emitted during WAF evaluation.
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum TraceEvent {
    EvaluationStarted {
        method: String,
        uri: String,
        candidate_rules: usize,
    },
    RuleStart {
        rule_id: u32,
    },
    ConditionEvaluated {
        rule_id: u32,
        kind: String,
        field: Option<String>,
        op: Option<String>,
        name: Option<String>,
        matched: bool,
    },
    RuleEnd {
        rule_id: u32,
        matched: bool,
        risk: f64,
        blocking: bool,
    },
    EvaluationFinished {
        verdict: String,
        risk_score: u16,
        matched_rules: Vec<u32>,
        timed_out: bool,
        rules_evaluated: Option<u32>,
        detection_time_us: u64,
    },
    Truncated {
        limit: usize,
    },
}

/// Sink for WAF trace events.
pub trait TraceSink: Send {
    fn record(&mut self, event: TraceEvent);
}

/// Trace state helper to avoid allocations when tracing is disabled.
pub struct TraceState<'a> {
    sink: Option<&'a mut dyn TraceSink>,
}

impl<'a> TraceState<'a> {
    pub fn enabled(sink: &'a mut dyn TraceSink) -> Self {
        Self { sink: Some(sink) }
    }

    pub fn disabled() -> Self {
        Self { sink: None }
    }

    pub fn is_enabled(&self) -> bool {
        self.sink.is_some()
    }

    pub fn emit(&mut self, event: TraceEvent) {
        if let Some(sink) = self.sink.as_mut() {
            sink.record(event);
        }
    }
}
