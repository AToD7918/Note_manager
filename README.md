# Note Manager (Problem/Solution-centric)

A lightweight Notion/Obsidian-like note app focused on connecting notes via their Problem and Solution sections. Notes are saved to local files and mirrored into a small database for fast linking and similarity suggestions.

## Features

- Problem and Solution are required; Limit and Details are optional.
- Optional subject metadata for sorting/grouping.
- Saves each note to `notes/<id>.json` and `notes/<id>.md` for readability.
- SQLite database (via `better-sqlite3`) for quick listing and querying.
- Automatic suggestions:
  - Similar Problems (problem ↔ problem)
  - Similar Solutions (solution ↔ solution)
  - Solution → Problem (connect “after”)
  - Problem → Solution (connect “before”)
  - Excludes the current note from results
- Global search across all notes (title, problem, solution, details, limit, tags)
  - Second search box in the editor sidebar for quick content search
- Web UI (Vite + React) with a Notion-like layout.

## Getting Started

1. Install dependencies

   - Root tools:
     ```
     cd "note manager"
     npm i
     ```
   - Server & Client deps (if not yet installed):
     ```
     npm --prefix server i
     npm --prefix client i
     ```

2. Development

   Run both server (port 3001) and client (Vite dev, port 5173/5174):
   ```
   npm run dev
   ```
   Open the printed Vite URL in a browser.

3. Production build

   Build the client and serve it from the server:
   ```
   npm run build
   npm start
   # open http://localhost:3001
   ```

## API Overview

- `GET /api/notes` – list notes
- `GET /api/notes/:id` – get one
- `POST /api/notes` – create `{ title?, problem, solution, limit?, details? }`
  - Supports optional `subject`, `status`, `priority`, `due_date`, `tags`, `props`
- `PUT /api/notes/:id` – update
- `DELETE /api/notes/:id` – delete (also removes local files)
- `GET /api/notes/:id/similar` – suggestions for an existing note
- `POST /api/similar` – suggestions for a draft `{ problem?, solution?, excludeId? }`
- `GET /api/search?q=...` – search all notes; returns ranked results

## Data Locations

- Files: `notes/<id>.json`, `notes/<id>.md`
- SQLite DB: `server/data/notes.db`

## Next Ideas

- Add explicit “link” edges and a graph view
- Markdown editor with live preview
- Tagging and collections
- Electron/Tauri wrapper for a desktop build

## Metadata (Notion-like)

Notes also support optional properties:
- `status` (idea/doing/done/blocked)
- `priority` (1–5)
- `due_date` (YYYY-MM-DD)
- `tags` (array of strings)
- `props` (custom key/value object)
