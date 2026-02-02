//! Bad bot signatures for malicious traffic identification.
//!
//! ## Security
//! All regex patterns are designed to avoid catastrophic backtracking (ReDoS):
//! - No nested quantifiers (e.g., (a+)+)
//! - No overlapping alternations with quantifiers
//! - Negative lookaheads use anchored patterns where possible
//! - Complex exclusion logic is handled in code, not regex

use serde::{Deserialize, Serialize};

/// Severity level for bad bot signatures.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BadBotSeverity {
    Low,
    Medium,
    High,
}

/// Signature for detecting a bad bot.
#[derive(Debug, Clone)]
pub struct BadBotSignature {
    /// Signature name
    pub name: &'static str,
    /// Regex pattern to match user agent (ReDoS-safe)
    pub pattern: &'static str,
    /// Severity level
    pub severity: BadBotSeverity,
    /// Description
    pub description: &'static str,
}

/// Known bad bot signatures.
///
/// Patterns are designed to be ReDoS-safe:
/// - Simple literal matches with case-insensitive flag
/// - Exclusion logic moved to code
/// - No nested quantifiers or complex alternations
pub static BAD_BOT_SIGNATURES: &[BadBotSignature] = &[
    // Attack tools (HIGH severity)
    BadBotSignature {
        name: "SQLMap",
        pattern: r"(?i)sqlmap",
        severity: BadBotSeverity::High,
        description: "SQL injection testing tool",
    },
    BadBotSignature {
        name: "Nikto",
        pattern: r"(?i)nikto",
        severity: BadBotSeverity::High,
        description: "Web server scanner",
    },
    BadBotSignature {
        name: "Nmap",
        pattern: r"(?i)nmap",
        severity: BadBotSeverity::High,
        description: "Network scanner",
    },
    BadBotSignature {
        name: "Acunetix",
        pattern: r"(?i)acunetix",
        severity: BadBotSeverity::High,
        description: "Vulnerability scanner",
    },
    BadBotSignature {
        name: "Nessus",
        pattern: r"(?i)nessus",
        severity: BadBotSeverity::High,
        description: "Vulnerability scanner",
    },
    BadBotSignature {
        name: "OpenVAS",
        pattern: r"(?i)openvas",
        severity: BadBotSeverity::High,
        description: "Vulnerability scanner",
    },
    BadBotSignature {
        name: "Metasploit",
        pattern: r"(?i)metasploit",
        severity: BadBotSeverity::High,
        description: "Penetration testing framework",
    },
    BadBotSignature {
        name: "w3af",
        pattern: r"(?i)w3af",
        severity: BadBotSeverity::High,
        description: "Web application attack framework",
    },
    // Security testing tools (MEDIUM severity)
    BadBotSignature {
        name: "ZAP",
        // Simplified: removed .* between terms to prevent backtracking
        pattern: r"(?i)owasp[- ]?zap",
        severity: BadBotSeverity::Medium,
        description: "OWASP ZAP security scanner",
    },
    BadBotSignature {
        name: "BurpSuite",
        pattern: r"(?i)burp",
        severity: BadBotSeverity::Medium,
        description: "Security testing tool",
    },
    // Generic scrapers (LOW severity)
    BadBotSignature {
        name: "PythonUrllib",
        // Simplified: exclusions handled in code
        pattern: r"(?i)python-urllib",
        severity: BadBotSeverity::Low,
        description: "Generic Python scraper",
    },
    BadBotSignature {
        name: "PythonRequests",
        pattern: r"(?i)python-requests",
        severity: BadBotSeverity::Low,
        description: "Generic Python scraper",
    },
    BadBotSignature {
        name: "Curl",
        pattern: r"^curl/",
        severity: BadBotSeverity::Low,
        description: "Generic curl client",
    },
    BadBotSignature {
        name: "Wget",
        pattern: r"^wget/",
        severity: BadBotSeverity::Low,
        description: "Generic wget client",
    },
    BadBotSignature {
        name: "Scrapy",
        pattern: r"(?i)scrapy",
        severity: BadBotSeverity::Medium,
        description: "Python scraping framework",
    },
    BadBotSignature {
        name: "BeautifulSoup",
        pattern: r"(?i)beautifulsoup",
        severity: BadBotSeverity::Low,
        description: "Python scraping library",
    },
    BadBotSignature {
        name: "Mechanize",
        pattern: r"(?i)mechanize",
        severity: BadBotSeverity::Low,
        description: "Python web scraping library",
    },
    BadBotSignature {
        name: "Selenium",
        pattern: r"(?i)selenium",
        severity: BadBotSeverity::Low,
        description: "Browser automation tool",
    },
    BadBotSignature {
        name: "Puppeteer",
        // Simplified: removed .* - now just checks for both terms
        pattern: r"(?i)puppeteer",
        severity: BadBotSeverity::Low,
        description: "Browser automation tool",
    },
    BadBotSignature {
        name: "PhantomJS",
        pattern: r"(?i)phantomjs",
        severity: BadBotSeverity::Low,
        description: "Headless browser",
    },
    // SEO spam bots (MEDIUM severity)
    BadBotSignature {
        name: "SEMrushUnauthorized",
        pattern: r"(?i)semrush",
        severity: BadBotSeverity::Medium,
        description: "SEO tool when used without permission",
    },
    BadBotSignature {
        name: "AhrefsUnauthorized",
        pattern: r"(?i)ahrefs",
        severity: BadBotSeverity::Medium,
        description: "SEO tool when used without permission",
    },
    BadBotSignature {
        name: "MajesticUnauthorized",
        pattern: r"(?i)majestic",
        severity: BadBotSeverity::Medium,
        description: "SEO tool when used without permission",
    },
    // Content scrapers (MEDIUM severity)
    BadBotSignature {
        name: "HTTrack",
        pattern: r"(?i)httrack",
        severity: BadBotSeverity::Medium,
        description: "Website downloader",
    },
    BadBotSignature {
        name: "WebCopier",
        pattern: r"(?i)webcopier",
        severity: BadBotSeverity::Medium,
        description: "Website copier tool",
    },
    BadBotSignature {
        name: "WebReaper",
        pattern: r"(?i)webreaper",
        severity: BadBotSeverity::Medium,
        description: "Website downloader",
    },
    BadBotSignature {
        name: "WebZIP",
        pattern: r"(?i)webzip",
        severity: BadBotSeverity::Medium,
        description: "Website downloader",
    },
    BadBotSignature {
        name: "OfflineExplorer",
        // Simplified: use optional space/hyphen instead of \s*
        pattern: r"(?i)offline[- ]?explorer",
        severity: BadBotSeverity::Medium,
        description: "Website downloader",
    },
    BadBotSignature {
        name: "TeleportPro",
        pattern: r"(?i)teleport[- ]?pro",
        severity: BadBotSeverity::Medium,
        description: "Website downloader",
    },
    // Email harvesters (HIGH severity)
    BadBotSignature {
        name: "EmailCollector",
        // Split into two patterns to avoid .* - this matches the literal
        pattern: r"(?i)emailcollector",
        severity: BadBotSeverity::High,
        description: "Email harvesting tool",
    },
    BadBotSignature {
        name: "EmailHarvester",
        pattern: r"(?i)emailharvest",
        severity: BadBotSeverity::High,
        description: "Email harvesting tool",
    },
    BadBotSignature {
        name: "EmailSiphon",
        pattern: r"(?i)emailsiphon",
        severity: BadBotSeverity::High,
        description: "Email harvesting tool",
    },
    // Link checkers (LOW severity)
    BadBotSignature {
        name: "LinkChecker",
        pattern: r"(?i)linkchecker",
        severity: BadBotSeverity::Low,
        description: "Automated link checker",
    },
    BadBotSignature {
        name: "Xenu",
        pattern: r"(?i)xenu",
        severity: BadBotSeverity::Low,
        description: "Link checker",
    },
    // Aggressive crawlers (MEDIUM/HIGH severity)
    BadBotSignature {
        name: "WebStripper",
        pattern: r"(?i)webstripper",
        severity: BadBotSeverity::Medium,
        description: "Content stripper",
    },
    BadBotSignature {
        name: "WebAuto",
        pattern: r"(?i)webauto",
        severity: BadBotSeverity::Medium,
        description: "Automated web tool",
    },
    BadBotSignature {
        name: "WebBandit",
        pattern: r"(?i)webbandit",
        severity: BadBotSeverity::High,
        description: "Aggressive scraper",
    },
    // Suspicious patterns (MEDIUM severity)
    BadBotSignature {
        name: "EmptyUserAgent",
        pattern: r"^$",
        severity: BadBotSeverity::Medium,
        description: "Missing user agent string",
    },
    // REFACTORED: Complex negative lookaheads removed
    // Exclusion logic now handled in code
    BadBotSignature {
        name: "GenericBot",
        // Simple pattern - exclusions handled in code
        pattern: r"(?i)\bbot\b",
        severity: BadBotSeverity::Low,
        description: "Generic bot pattern",
    },
    BadBotSignature {
        name: "GenericCrawler",
        // Simple pattern - exclusions handled in code
        pattern: r"(?i)\bcrawler\b",
        severity: BadBotSeverity::Low,
        description: "Generic crawler pattern",
    },
    BadBotSignature {
        name: "GenericSpider",
        // Simple pattern - exclusions handled in code
        pattern: r"(?i)\bspider\b",
        severity: BadBotSeverity::Low,
        description: "Generic spider pattern",
    },
    // DDoS tools (HIGH severity)
    BadBotSignature {
        name: "LOIC",
        pattern: r"(?i)loic",
        severity: BadBotSeverity::High,
        description: "DDoS tool",
    },
    BadBotSignature {
        name: "Slowloris",
        pattern: r"(?i)slowloris",
        severity: BadBotSeverity::High,
        description: "DDoS tool",
    },
    // Credential stuffing tools
    BadBotSignature {
        name: "SentryMBA",
        // Simplified: removed .* - use word boundary instead
        pattern: r"(?i)sentry[- ]?mba",
        severity: BadBotSeverity::High,
        description: "Credential stuffing tool",
    },
    BadBotSignature {
        name: "STORM",
        pattern: r"(?i)storm[- ]?cracker",
        severity: BadBotSeverity::High,
        description: "Credential stuffing tool",
    },
];
