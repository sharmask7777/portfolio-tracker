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
init_env "backend"
init_env "frontend"

log "Environment initialization complete."

# Dependency Installation
log "Installing dependencies..."

# Backend Dependencies
log "Setting up backend..."
cd backend
log "Installing Node.js dependencies for backend..."
npm install
log "Generating Prisma client..."
npx prisma generate

# Python virtual environment for backend
if [ ! -d "venv" ]; then
    log "Creating Python virtual environment..."
    python3 -m venv venv
else
    log "Python virtual environment already exists."
fi

log "Installing Python dependencies (casparser)..."
./venv/bin/pip install --quiet casparser

cd ..

# Frontend Dependencies
log "Setting up frontend..."
cd frontend
log "Installing Node.js dependencies for frontend..."
npm install
cd ..

log "All dependencies installed successfully."
