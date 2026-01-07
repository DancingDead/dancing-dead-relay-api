#!/bin/bash

################################################################################
# Automatic Deployment Script for o2switch
# Triggered by GitHub webhook
################################################################################

set -e  # Exit on error

# Configuration
PROJECT_DIR="/home/zibe1437/repositories/dancing-dead-relay-api"
NODE_VENV="/home/zibe1437/nodevenv/repositories/dancing-dead-relay-api/20/bin/activate"
LOG_FILE="$PROJECT_DIR/deploy.log"
SERVER_LOG="$PROJECT_DIR/server.log"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

################################################################################
# Main Deployment Process
################################################################################

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "🚀 Starting deployment..."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Navigate to project directory
log "📁 Navigating to project directory..."
cd "$PROJECT_DIR" || {
    log_error "Failed to navigate to $PROJECT_DIR"
    exit 1
}
log_success "In directory: $(pwd)"

# 2. Activate Node.js virtual environment
log "🔌 Activating Node.js environment..."
if [ -f "$NODE_VENV" ]; then
    source "$NODE_VENV"
    log_success "Node.js environment activated"
else
    log_error "Node.js virtual environment not found at $NODE_VENV"
    exit 1
fi

# 3. Check current branch
CURRENT_BRANCH=$(git branch --show-current)
log "🌿 Current branch: $CURRENT_BRANCH"

# 4. Stash any local changes (safety)
log "💾 Stashing local changes (if any)..."
git stash --quiet || log_warn "No changes to stash"

# 5. Pull latest code from GitHub
log "📥 Pulling latest code from GitHub..."
if git pull origin main; then
    log_success "Code pulled successfully"
else
    log_error "Failed to pull code from GitHub"
    exit 1
fi

# 6. Check if package.json changed
log "📦 Checking if dependencies need update..."
if git diff HEAD@{1} HEAD --name-only | grep -q "package.json"; then
    log "📦 package.json changed, running npm install..."
    if npm install --production; then
        log_success "Dependencies updated"
    else
        log_error "npm install failed"
        exit 1
    fi
else
    log_success "No dependency changes detected"
fi

# 7. Stop existing Node.js process
log "🛑 Stopping existing Node.js process..."
PIDS=$(pgrep -f "node.*index.js" || true)
if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9
    log_success "Stopped process(es): $PIDS"
    sleep 2
else
    log_warn "No existing Node.js process found"
fi

# 8. Start new Node.js process
log "🚀 Starting Node.js server..."
nohup node index.js > "$SERVER_LOG" 2>&1 &
NEW_PID=$!

# Wait a moment to ensure it started
sleep 3

# Check if process is still running
if ps -p $NEW_PID > /dev/null; then
    log_success "Server started successfully (PID: $NEW_PID)"
else
    log_error "Server failed to start"
    log_error "Check $SERVER_LOG for errors"
    exit 1
fi

# 9. Verify server is responding
log "🔍 Verifying server health..."
sleep 2
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|404"; then
    log_success "Server is responding"
else
    log_warn "Server health check failed (may need more time to start)"
fi

# 10. Show last lines of server log
log "📄 Last 5 lines of server log:"
tail -n 5 "$SERVER_LOG" | tee -a "$LOG_FILE"

# 11. Deployment complete
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_success "✅ Deployment completed successfully!"
log_success "Server PID: $NEW_PID"
log_success "Server log: $SERVER_LOG"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit 0
