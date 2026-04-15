# mcp-todo

Zero-dependency MCP todo server for [Picoclaw](https://github.com/sipeed/picoclaw). In-memory only — todos are lost on restart.

Designed for the **agent's own use** — to track its state during long-running tasks. Not a user-facing UI.

## Quick Start

```bash
cp .env.example .env
# edit .env with your server details
./deploy.sh
```

## Tools

| Tool | Description |
|------|-------------|
| `add_todo` | Record a step, reminder, or sub-task |
| `start_todo` | Mark a todo as in-progress |
| `complete_todo` | Mark a todo as done |
| `remove_todo` | Delete a todo |
| `clear_todos` | Reset the list |
| `list_todos` | View all todos and their states |

## Design Principles

### Idempotent mutations
`complete_todo` and `remove_todo` always return `success: true` — even if the item was already done or already removed. The agent never needs error recovery.

### Full state in every response
Every tool returns the complete `todos` array so the agent stays synchronized without extra calls.

### Agent-facing descriptions
Tool descriptions explain *when* an agent should use each tool, not what parameters to pass.

## Response Format

```json
{
  "success": true,
  "todo": { "id": "123", "text": "Do thing", "done": false, "inProgress": true },
  "todos": [ ... ]
}
```

On error (e.g., not found):
```json
{
  "success": false,
  "error": "not_found",
  "todos": [ ... ]
}
```

## Deployment

The `deploy.sh` script:
1. Copies `mcp-todo.js` to `/usr/local/bin/mcp-todo.js` on the remote
2. Adds the server to Picoclaw's `tools.mcp.servers` config (idempotent — safe to run multiple times)
3. Restarts Picoclaw

## Picoclaw Config

After deploy, the following is added to `~/.picoclaw/config.json`:

```json
{
  "tools": {
    "mcp": {
      "servers": {
        "todo": {
          "enabled": true,
          "command": "node",
          "args": ["/usr/local/bin/mcp-todo.js"]
        }
      }
    }
  }
}
```

## Tech

- Pure Node.js, zero npm dependencies
- MCP stdio transport (JSON-RPC over stdin/stdout)
- ~100 lines of vanilla JS
