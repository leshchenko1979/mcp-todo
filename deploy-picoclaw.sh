#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load env
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  export "$(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)"
fi

HOST="${REMOTE_HOST_IP:?missing REMOTE_HOST_IP}"
USER="${REMOTE_USER:-root}"
KEY="${SSH_KEY:-~/.ssh/id_ed25519}"

echo "=== Deploying mcp-todo to $USER@$HOST ==="

# Copy script
scp -i "$KEY" "$SCRIPT_DIR/mcp-todo.js" "$USER@$HOST:/usr/local/bin/mcp-todo.js"
ssh -i "$KEY" "$USER@$HOST" "chmod +x /usr/local/bin/mcp-todo.js"
echo "  + Script copied to /usr/local/bin/mcp-todo.js"

# Ensure picoclaw config has the todo server
ssh -i "$KEY" "$USER@$HOST" bash -se << 'EOF'
CONFIG="/root/.picoclaw/config.json"
TMP_CONFIG="/tmp/picoclaw_config_new.json"

# Check if todo server already configured
if jq -e '.tools.mcp.servers.todo' "$CONFIG" > /dev/null 2>&1; then
  echo "  + todo server already in picoclaw config"
else
  jq '.tools.mcp.servers.todo = { enabled: true, command: "node", args: ["/usr/local/bin/mcp-todo.js"] }' \
    "$CONFIG" > "$TMP_CONFIG" && mv "$TMP_CONFIG" "$CONFIG"
  chmod 600 "$CONFIG"
  echo "  + Added todo server to picoclaw config"
fi
EOF

# Restart picoclaw
ssh -i "$KEY" "$USER@$HOST" "systemctl --user restart picoclaw"
sleep 3

# Verify
if ssh -i "$KEY" "$USER@$HOST" "systemctl --user is-active picoclaw" | grep -q active; then
  echo "  + picoclaw restarted successfully"
else
  echo "  ! picoclaw failed to restart"
  exit 1
fi

echo "=== Done ==="
