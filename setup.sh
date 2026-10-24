#!/bin/bash

# Unified Setup Script for Portfolio Tracker

set -e

# Logging helpers
log() {
    echo -e "\033[1;32m[INFO]\033[0m $1"
}

warn() {
    echo -e "\033[1;33m[WARN]\033[0m $1"
}

error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
    exit 1
}

# Pre-requisite checks
log "Checking pre-requisites..."
command -v node >/dev/null 2>&1 || error "node is not installed."
command -v npm >/dev/null 2>&1 || error "npm is not installed."
command -v cargo >/dev/null 2>&1 || error "cargo (Rust) is not installed."
command -v python3 >/dev/null 2>&1 || error "python3 is not installed."

# Environment Variable Initialization
init_env() {
    local dir=$1
    local example="$dir/.env.example"
    local target="$dir/.env"

    if [ -f "$example" ]; then
        if [ ! -f "$target" ]; then
            log "Creating $target from $example"
            cp "$example" "$target"
        else
            log "$target already exists, skipping."
        fi
    else
        warn "$example not found in $dir"
    fi
}

log "Initializing environment variables..."
init_env "."
init_env "frontend"

log "Environment initialization complete."

# Dependency Installation
log "Installing dependencies..."

# Backend (Rust Workspace)
log "Setting up Rust backend (backend-rs)..."
(cd backend-rs && cargo build)

# Frontend Dependencies
log "Setting up frontend..."
(cd frontend && npm install)

log "All dependencies installed successfully."

# Docker Orchestration
echo ""
read -p "Setup complete. Would you like to start the application via Docker? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log "Starting application via Docker..."
    docker compose up --build -d
    log "Application started!"
    log "Backend: http://localhost:3001"
    log "Frontend: http://localhost:8082"
    log "To view logs, run: npm run docker:logs"
else
    log "Setup finished. You can start the app later with 'npm start' or 'docker compose up'."
fi
