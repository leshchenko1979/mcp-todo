# mcp-todo

A persistent scratch-pad for AI agents. In-memory todo list served over MCP — no storage, no setup, no dependencies.

**For the agent, not the user.** The agent creates todos to track its own state during complex or long-running tasks. The user never sees or manages this list.

## Benefits

- **Zero footprint** — pure Node.js, no npm packages, no database
- **Agent-safe mutations** — `complete_todo` and `remove_todo` are idempotent. Calling them on already-done items returns success, not an error. The agent never needs error recovery logic
- **Always synchronized** — every response includes the full todo list. No need for the agent to make a separate `list_todos` call after each mutation
- **Designed for retries** — if an agent iteration fails mid-task, todos survive. If the whole process restarts, todos are fresh (intentional — the agent should re-plan anyway)

## Tools

| Tool | When to use |
|------|-------------|
| `add_todo` | Agent needs to remember a step, sub-task, or reminder |
| `start_todo` | Agent begins working on a tracked item |
| `complete_todo` | Agent finishes an item |
| `remove_todo` | Agent discards a no-longer-needed item |
| `clear_todos` | Agent resets the list after completing everything |
| `list_todos` | Agent reviews current state (usually called after mutations) |

## Response format

```json
{
  "success": true,
  "todo": { "id": "123", "text": "Do thing", "done": false, "inProgress": true },
  "todos": [ ... ]
}
```

Errors only happen when the ID genuinely doesn't exist (`not_found`).

## Quick start

```bash
cp .env.example .env
# edit .env with your Picoclaw server IP and DEPLOY_PATH
./deploy-picoclaw.sh
```

## What deploy does

1. Copies `mcp-todo.js` to `$DEPLOY_PATH` on the remote (default: `/usr/local/bin/mcp-todo.js`)
2. Adds the server entry to Picoclaw's `tools.mcp.servers` config (safe to run repeatedly)
3. Restarts Picoclaw

## Picoclaw config (added automatically)

```json
{
  "tools": {
    "mcp": {
      "servers": {
        "todo": {
          "enabled": true,
          "command": "node",
          "args": ["$DEPLOY_PATH"]
        }
      }
    }
  }
}
```

## Tech

- Vanilla Node.js — `readline` + `JSON` only
- MCP stdio transport
- ~100 lines
- Hosted at [github.com/leshchenko1979/mcp-todo](https://github.com/leshchenko1979/mcp-todo)
