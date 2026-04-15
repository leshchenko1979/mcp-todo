#!/usr/bin/env node
// Zero-dependency MCP todo server — agent-facing, idempotent, full-state responses

const rl = require('readline');
const todoStore = [];

function sendMessage(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function createResponse(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function createError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function res(success, data) {
  return { success, ...data, todos: todoStore };
}

function handleRequest(req) {
  const { method, params, id } = req;

  if (method === 'initialize') {
    return sendMessage(createResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'todo', version: '2.0.0' }
    }));
  }

  if (method === 'notifications/initialized') {
    return;
  }

  if (method === 'tools/list') {
    return sendMessage(createResponse(id, {
      tools: [
        { name: 'add_todo', description: 'Use to record a step, reminder, or sub-task the agent needs to track. The agent creates todos for itself to stay organized during complex tasks.', inputSchema: { type: 'object', properties: { text: { type: 'string', description: 'The todo text' } }, required: ['text'] } },
        { name: 'start_todo', description: 'Use when the agent begins working on a todo item. Marks it as in-progress so the agent can track what is currently being done.', inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Todo ID' } }, required: ['id'] } },
        { name: 'complete_todo', description: 'Use when a todo item is finished. Marks it done=true.', inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Todo ID' } }, required: ['id'] } },
        { name: 'remove_todo', description: 'Use to delete a todo the agent no longer needs to track.', inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Todo ID' } }, required: ['id'] } },
        { name: 'clear_todos', description: 'Use when the agent has completed all tasks and wants to reset the list.', inputSchema: { type: 'object', properties: {} } },
        { name: 'list_todos', description: 'Use to review all current todos and their states. The agent should call this after any mutation to stay synchronized.', inputSchema: { type: 'object', properties: {} } }
      ]
    }));
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;

    if (name === 'add_todo') {
      const todo = { id: Date.now().toString(), text: args.text, done: false, inProgress: false };
      todoStore.push(todo);
      return sendMessage(createResponse(id, { content: [{ type: 'text', text: JSON.stringify(res(true, { todo })) }] }));
    }

    if (name === 'start_todo') {
      const todo = todoStore.find(t => t.id === args.id);
      if (!todo) return sendMessage(createResponse(id, { content: [{ type: 'text', text: JSON.stringify(res(false, { error: 'not_found' })) }] }));
      todo.inProgress = true;
      todo.done = false;
      return sendMessage(createResponse(id, { content: [{ type: 'text', text: JSON.stringify(res(true, { todo })) }] }));
    }

    if (name === 'complete_todo') {
      const todo = todoStore.find(t => t.id === args.id);
      if (!todo) return sendMessage(createResponse(id, { content: [{ type: 'text', text: JSON.stringify(res(false, { error: 'not_found' })) }] }));
      todo.done = true;
      todo.inProgress = false;
      return sendMessage(createResponse(id, { content: [{ type: 'text', text: JSON.stringify(res(true, { todo })) }] }));
    }

    if (name === 'remove_todo') {
      const idx = todoStore.findIndex(t => t.id === args.id);
      if (idx === -1) return sendMessage(createResponse(id, { content: [{ type: 'text', text: JSON.stringify(res(true, { removed: false })) }] }));
      todoStore.splice(idx, 1);
      return sendMessage(createResponse(id, { content: [{ type: 'text', text: JSON.stringify(res(true, { removed: true })) }] }));
    }

    if (name === 'clear_todos') {
      const count = todoStore.length;
      todoStore.length = 0;
      return sendMessage(createResponse(id, { content: [{ type: 'text', text: JSON.stringify(res(true, { cleared: count })) }] }));
    }

    if (name === 'list_todos') {
      return sendMessage(createResponse(id, { content: [{ type: 'text', text: JSON.stringify(res(true, { count: todoStore.length })) }] }));
    }

    return sendMessage(createError(id, -32601, `Unknown tool: ${name}`));
  }

  if (method && method.startsWith('notifications/')) {
    return;
  }

  sendMessage(createError(id, -32601, `Unknown method: ${method}`));
}

const interface = rl.createInterface({ input: process.stdin, terminal: false });

interface.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const msg = JSON.parse(line);
    handleRequest(msg);
  } catch (e) {
    // ignore parse errors on empty lines
  }
});

process.stdin.on('error', () => process.exit(0));
