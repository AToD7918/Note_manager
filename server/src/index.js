// Simple Note Manager backend
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Database from 'better-sqlite3';
import { suggestForDraft, suggestForNoteId } from './similarity.js';
import { searchNotes } from './search.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));

// Data paths
const dataDir = path.resolve(__dirname, '..', 'data');
const fileNotesDir = path.resolve(__dirname, '..', '..', 'notes');
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(fileNotesDir, { recursive: true });

// DB setup
const dbPath = path.join(dataDir, 'notes.db');
const db = new Database(dbPath);
const BASE_SUBJECTS = ['paper', 'plain-note', 'idea'];

db.exec(`
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  title TEXT,
  subject TEXT,
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  limit_text TEXT,
  details TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  -- Notion-like metadata (added via migration if missing)
  status TEXT,
  priority INTEGER,
  due_date TEXT,
  tags_json TEXT,
  meta_json TEXT
);
CREATE TABLE IF NOT EXISTS subjects (
  name TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
`);

// Migrations: add missing columns if table existed before
try {
  const cols = db.prepare('PRAGMA table_info(notes)').all().map(r => r.name);
  const add = (name, type) => { if (!cols.includes(name)) db.exec(`ALTER TABLE notes ADD COLUMN ${name} ${type}`); };
  add('subject', 'TEXT');
  add('status', 'TEXT');
  add('priority', 'INTEGER');
  add('due_date', 'TEXT');
  add('tags_json', 'TEXT');
  add('meta_json', 'TEXT');
} catch (e) {
  console.error('Migration check failed:', e);
}

// Migrate old typo 'plan-note' -> 'plain-note'
try {
  db.prepare("UPDATE subjects SET name='plain-note' WHERE LOWER(name)='plan-note'").run();
  db.prepare("UPDATE notes SET subject='plain-note' WHERE LOWER(subject)='plan-note'").run();
} catch (e) {
  console.error('Subject rename migration failed:', e);
}

// Seed base subjects (cannot be deleted)
try {
  const now = new Date().toISOString();
  const stmt = db.prepare('INSERT OR IGNORE INTO subjects (name, created_at) VALUES (?, ?)');
  for (const name of BASE_SUBJECTS) stmt.run(name, now);
} catch (e) {
  console.error('Seeding subjects failed:', e);
}

// Utilities
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function sanitize(s) {
  return (s || '').toString();
}

function extractTitle(problem) {
  const first = (problem || '').split(/\n|\.|!|\?/)[0].trim();
  return first.slice(0, 60) || 'Untitled';
}


function ensureMarkdown(id, note) {
  const md = `# ${note.title}\n\n## Problem\n\n${note.problem}\n\n## Solution\n\n${note.solution}\n\n${note.limit ? '## Limit\n\n' + note.limit + '\n\n' : ''}${note.details ? '## Details\n\n' + note.details + '\n' : ''}`;
  const filePath = path.join(fileNotesDir, `${id}.md`);
  const metaLines = [];
  if (note.subject) metaLines.push(`- Subject: ${note.subject}`);
  if (note.status) metaLines.push(`- Status: ${note.status}`);
  if (note.priority != null && note.priority !== '') metaLines.push(`- Priority: ${note.priority}`);
  if (note.due_date) metaLines.push(`- Due: ${note.due_date}`);
  if (Array.isArray(note.tags) && note.tags.length) metaLines.push(`- Tags: ${note.tags.join(', ')}`);
  if (note.props && typeof note.props === 'object' && Object.keys(note.props).length) {
    for (const [k,v] of Object.entries(note.props)) metaLines.push(`- ${k}: ${v}`);
  }
  const metaSection = metaLines.length ? `\n## Metadata\n\n${metaLines.join('\n')}\n` : '';
  fs.writeFileSync(filePath, md + metaSection, 'utf-8');
}

function normalizeTags(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(s => s.toString().trim()).filter(Boolean);
  return String(input).split(',').map(s => s.trim()).filter(Boolean);
}

function fromRow(row) {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject || '',
    problem: row.problem,
    solution: row.solution,
    limit: row.limit_text,
    details: row.details,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: row.status || '',
    priority: row.priority ?? '',
    due_date: row.due_date || '',
    tags: row.tags_json ? (() => { try { return JSON.parse(row.tags_json) || []; } catch { return []; } })() : [],
    props: row.meta_json ? (() => { try { return JSON.parse(row.meta_json) || {}; } catch { return {}; } })() : {},
  };
}

function toDbNote(payload, base) {
  const tags = normalizeTags(payload.tags);
  const props = payload.props && typeof payload.props === 'object' ? payload.props : {};
  return {
    id: base.id,
    title: (payload.title && payload.title.trim()) || base.title,
    subject: payload.subject ? String(payload.subject) : null,
    problem: sanitize(payload.problem),
    solution: sanitize(payload.solution),
    limit_text: sanitize(payload.limit),
    details: sanitize(payload.details),
    created_at: base.created_at,
    updated_at: base.updated_at,
    status: payload.status ? String(payload.status) : null,
    priority: payload.priority === '' || payload.priority == null ? null : Number(payload.priority),
    due_date: payload.due_date ? String(payload.due_date) : null,
    tags_json: JSON.stringify(tags),
    meta_json: JSON.stringify(props),
  };
}

// CRUD endpoints
app.get('/api/notes', (req, res) => {
  const rows = db.prepare('SELECT * FROM notes ORDER BY updated_at DESC').all();
  res.json(rows.map(fromRow));
});

app.get('/api/notes/:id', (req,res) => {
  const row = db.prepare('SELECT * FROM notes WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(fromRow(row));
});

app.post('/api/notes', (req, res) => {
  const { title, problem, solution } = req.body || {};
  if (!problem || !solution) return res.status(400).json({ error: 'problem and solution are required' });
  const id = uid();
  const now = new Date().toISOString();
  const t = title && title.trim() ? title.trim() : extractTitle(problem);
  const base = { id, title: t, created_at: now, updated_at: now };
  const dbNote = toDbNote(req.body || {}, base);
  const stmt = db.prepare('INSERT INTO notes (id, title, subject, problem, solution, limit_text, details, created_at, updated_at, status, priority, due_date, tags_json, meta_json) VALUES (@id,@title,@subject,@problem,@solution,@limit_text,@details,@created_at,@updated_at,@status,@priority,@due_date,@tags_json,@meta_json)');
  stmt.run(dbNote);
  // file storage
  const apiNote = fromRow(db.prepare('SELECT * FROM notes WHERE id=?').get(id));
  fs.writeFileSync(path.join(fileNotesDir, `${id}.json`), JSON.stringify(apiNote, null, 2), 'utf-8');
  ensureMarkdown(id, apiNote);
  res.status(201).json(apiNote);
});

app.put('/api/notes/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM notes WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  const { problem, solution } = req.body || {};
  if (!problem || !solution) return res.status(400).json({ error: 'problem and solution are required' });
  const now = new Date().toISOString();
  const t = (req.body.title && req.body.title.trim()) ? req.body.title.trim() : extractTitle(problem);
  const base = { id, title: t, created_at: existing.created_at, updated_at: now };
  const dbNote = toDbNote(req.body || {}, base);
  db.prepare('UPDATE notes SET title=@title, subject=@subject, problem=@problem, solution=@solution, limit_text=@limit_text, details=@details, updated_at=@updated_at, status=@status, priority=@priority, due_date=@due_date, tags_json=@tags_json, meta_json=@meta_json WHERE id=@id').run(dbNote);
  const apiNote = fromRow(db.prepare('SELECT * FROM notes WHERE id=?').get(id));
  fs.writeFileSync(path.join(fileNotesDir, `${id}.json`), JSON.stringify(apiNote, null, 2), 'utf-8');
  ensureMarkdown(id, apiNote);
  res.json(apiNote);
});

// Similarity endpoint
app.get('/api/notes/:id/similar', (req, res) => {
  const id = req.params.id;
  const notes = db.prepare('SELECT * FROM notes').all();
  const out = suggestForNoteId(notes, id, 5);
  if (!out) return res.status(404).json({ error: 'Not found' });
  res.json(out);
});

// Preview similarity for unsaved drafts
app.post('/api/similar', (req, res) => {
  const { problem = '', solution = '', excludeId } = req.body || {};
  const notes = db.prepare('SELECT * FROM notes').all();
  const out = suggestForDraft(notes, { problem, solution }, 5, excludeId);
  res.json(out);
});

// Delete a note
app.delete('/api/notes/:id', (req, res) => {
  const id = req.params.id;
  const existing = db.prepare('SELECT * FROM notes WHERE id=?').get(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM notes WHERE id=?').run(id);
  // remove files if present
  try { fs.unlinkSync(path.join(fileNotesDir, `${id}.json`)); } catch {}
  try { fs.unlinkSync(path.join(fileNotesDir, `${id}.md`)); } catch {}
  res.status(204).end();
});

// Search endpoint
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toString();
  if (!q.trim()) return res.json({ query: q, results: [] });
  const notes = db.prepare('SELECT * FROM notes').all().map(fromRow);
  const results = searchNotes(notes, q, 50);
  res.json({ query: q, results });
});

// Subjects API
app.get('/api/subjects', (req, res) => {
  const rows = db.prepare('SELECT name, created_at FROM subjects ORDER BY name COLLATE NOCASE').all();
  res.json(rows);
});

app.post('/api/subjects', (req, res) => {
  const name = (req.body?.name || '').toString().trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const now = new Date().toISOString();
  try {
    db.prepare('INSERT OR IGNORE INTO subjects (name, created_at) VALUES (?, ?)').run(name, now);
  } catch (e) {
    return res.status(500).json({ error: 'failed to insert' });
  }
  const row = db.prepare('SELECT name, created_at FROM subjects WHERE name=?').get(name);
  res.status(201).json(row);
});

app.delete('/api/subjects/:name', (req, res) => {
  const name = (req.params.name || '').toString();
  if (BASE_SUBJECTS.includes(name.toLowerCase())) {
    return res.status(400).json({ error: 'cannot delete base subject' });
  }
  db.prepare('DELETE FROM subjects WHERE name=?').run(name);
  res.status(204).end();
});

// Serve built client if exists
const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
