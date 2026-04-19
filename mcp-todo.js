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
        { name: 'add_todos', description: 'Add one or more todos. Use clear_existing to reset the list before adding.', inputSchema: { type: 'object', properties: { texts: { type: 'array', items: { type: 'string' }, description: 'Array of todo texts to add' }, clear_existing: { type: 'boolean', description: 'If true, clear all existing todos before adding new ones' } }, required: ['texts'] } },
        { name: 'start_todos', description: 'Mark one or more todos as in-progress.', inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, description: 'Array of todo IDs' } }, required: ['ids'] } },
        { name: 'complete_todos', description: 'Mark one or more todos as done.', inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, description: 'Array of todo IDs' } }, required: ['ids'] } },
        { name: 'remove_todos', description: 'Delete one or more todos.', inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' }, description: 'Array of todo IDs' } }, required: ['ids'] } },
        { name: 'clear_todos', description: 'Clear all todos at once.', inputSchema: { type: 'object', properties: {} } },
        { name: 'list_todos', description: 'List all current todos and their states.', inputSchema: { type: 'object', properties: {} } }
      ]
    }));
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;

    if (name === 'add_todos') {
      if (args.clear_existing) {
        todoStore.length = 0;
      }
      const added = args.texts.map(text => {
        const todo = { id: Date.now().toString() + Math.random().toString(36).slice(2, 7), text, done: false, inProgress: false };
        todoStore.push(todo);
        return todo;
      });
      return sendMessage(createResponse(id, { content: [{ type: 'text', text: JSON.stringify(res(true, { added })) }] }));
    }

    if (name === 'start_todos') {
      const results = args.ids.map(id => {
        const todo = todoStore.find(t => t.id === id);
        if (!todo) return { id, found: false };
        todo.inProgress = true;
        todo.done = false;
        return { id, found: true };
      });
      return sendMessage(createResponse(id, { content: [{ type: 'text', text: JSON.stringify(res(true, { results })) }] }));
    }

    if (name === 'complete_todos') {
      const results = args.ids.map(id => {
        const todo = todoStore.find(t => t.id === id);
        if (!todo) return { id, found: false };
        todo.done = true;
        todo.inProgress = false;
        return { id, found: true };
      });
      return sendMessage(createResponse(id, { content: [{ type: 'text', text: JSON.stringify(res(true, { results })) }] }));
    }

    if (name === 'remove_todos') {
      const results = args.ids.map(id => {
        const idx = todoStore.findIndex(t => t.id === id);
        if (idx === -1) return { id, removed: false };
        todoStore.splice(idx, 1);
        return { id, removed: true };
      });
      return sendMessage(createResponse(id, { content: [{ type: 'text', text: JSON.stringify(res(true, { results })) }] }));
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
