# Synapse-Pingora Dockerfile
# Multi-stage build for Rust-based WAF proxy

# =============================================================================
# Builder Stage
# =============================================================================
FROM rust:1.77-bookworm as builder

# Install build dependencies for Pingora (OpenSSL, CMake, Clang)
RUN apt-get update && apt-get install -y \
    cmake \
    perl \
    clang \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy the synapse-pingora application (fully self-contained, no external dependencies)
COPY apps/synapse-pingora ./apps/synapse-pingora

# Build the project
WORKDIR /usr/src/app/apps/synapse-pingora
RUN cargo build --release

# =============================================================================
# Runtime Stage
# =============================================================================
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r synapse && useradd -r -g synapse synapse

WORKDIR /app

# Copy configuration and rules
COPY apps/synapse-pingora/config.yaml /app/config.yaml
COPY apps/synapse-pingora/data/rules.json /app/data/rules.json

# Copy binary from builder
COPY --from=builder /usr/src/app/apps/synapse-pingora/target/release/synapse-pingora /usr/local/bin/synapse-pingora

# Set permissions
RUN chown -R synapse:synapse /app

# Expose ports
# 6190: Admin API & Metrics
# 6191: Status/Health
EXPOSE 6190 6191

USER synapse

CMD ["synapse-pingora", "--config", "/app/config.yaml"]
