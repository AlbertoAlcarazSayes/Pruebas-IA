'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'tasks.db');

// ── Database setup ────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT    NOT NULL,
    description TEXT  NOT NULL DEFAULT '',
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT   NOT NULL DEFAULT (datetime('now'))
  )
`);

// Prepared statements
const stmts = {
  getAll:  db.prepare('SELECT * FROM tasks ORDER BY created_at DESC'),
  getById: db.prepare('SELECT * FROM tasks WHERE id = ?'),
  insert:  db.prepare('INSERT INTO tasks (title, description) VALUES (?, ?)'),
  update:  db.prepare(
    'UPDATE tasks SET title = ?, description = ?, completed = ? WHERE id = ?'
  ),
  remove:  db.prepare('DELETE FROM tasks WHERE id = ?'),
};

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowToTask(row) {
  return { ...row, completed: row.completed === 1 };
}

// ── API routes ────────────────────────────────────────────────────────────────

// GET  /api/tasks        – list all tasks
app.get('/api/tasks', (_req, res) => {
  const tasks = stmts.getAll.all().map(rowToTask);
  res.json(tasks);
});

// GET  /api/tasks/:id    – get a single task
app.get('/api/tasks/:id', (req, res) => {
  const row = stmts.getById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Task not found' });
  res.json(rowToTask(row));
});

// POST /api/tasks        – create a task
app.post('/api/tasks', (req, res) => {
  const { title, description = '' } = req.body || {};
  if (!title || typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'title is required' });
  }
  const info = stmts.insert.run(title.trim(), description.trim());
  const newTask = stmts.getById.get(info.lastInsertRowid);
  res.status(201).json(rowToTask(newTask));
});

// PUT  /api/tasks/:id    – update a task
app.put('/api/tasks/:id', (req, res) => {
  const row = stmts.getById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Task not found' });

  const { title, description, completed } = req.body || {};
  const newTitle       = title       !== undefined ? String(title).trim()       : row.title;
  const newDescription = description !== undefined ? String(description).trim() : row.description;
  const newCompleted   = completed   !== undefined ? (completed ? 1 : 0)        : row.completed;

  if (newTitle === '') return res.status(400).json({ error: 'title cannot be empty' });

  stmts.update.run(newTitle, newDescription, newCompleted, row.id);
  res.json(rowToTask(stmts.getById.get(row.id)));
});

// DELETE /api/tasks/:id  – delete a task
app.delete('/api/tasks/:id', (req, res) => {
  const row = stmts.getById.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Task not found' });
  stmts.remove.run(row.id);
  res.status(204).end();
});

// ── Start ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Task Manager running at http://localhost:${PORT}`);
  });
}

module.exports = { app, db };
