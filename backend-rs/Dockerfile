# Stage 1: Build Rust release binaries
FROM rust:bookworm AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY . .
RUN cargo build --release --bin portfolio-api --bin portfolio-worker

# Stage 2: Minimal Debian runtime environment
FROM debian:bookworm-slim AS runtime
WORKDIR /app

# Install runtime dependencies: OpenSSL, CA certificates, Python 3, and casparser
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
    python3 \
    python3-pip \
    python3-cryptography \
    && pip3 install --no-cache-dir casparser --break-system-packages \
    && apt-get purge -y python3-pip \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Create non-root app user (uid 1000) and shared uploads directory
RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g appuser -m -s /bin/bash appuser && \
    mkdir -p /app/uploads && \
    chown -R appuser:appuser /app

# Copy compiled binaries and scripts from builder stage
COPY --from=builder /app/target/release/portfolio-api /usr/local/bin/portfolio-api
COPY --from=builder /app/target/release/portfolio-worker /usr/local/bin/portfolio-worker
COPY --chown=appuser:appuser scripts /app/scripts

USER appuser
ENV PORT=3001
ENV PYTHON_PATH=python3
ENV UPLOADS_DIR=/app/uploads
ENV PARSE_CAS_SCRIPT=/app/scripts/parse_cas.py
EXPOSE 3001

CMD ["portfolio-api"]
