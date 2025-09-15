# Copilot instructions for this repo (Note Manager)

Purpose: enable AI agents to be productive quickly by codifying this repo¡¯s architecture, workflows, and conventions. Prefer these patterns unless intentionally refactoring.

## Big picture
- Local-first notes with Problem/Solution core; optional Limit/Details and Notion-like metadata.
- Dual storage: files in `notes/` (JSON + Markdown) and SQLite DB at `server/data/notes.db`.
- Backend: Express + better-sqlite3. Entrypoint `server/src/index.js`; similarity in `server/src/similarity.js`; search in `server/src/search.js`; tokenization in `server/src/text.js`.
- Frontend: React (Vite) in `client/` with a Notion-like editor in `client/src/App.jsx`. Vite proxy maps `/api` ¡æ `http://localhost:3001`.
- Subjects define editor fields and payload shaping. Base subjects (seeded, immutable): `paper`, `plain-note`, `idea`.

## Dev workflow
- Install (root): `npm i`; then `npm --prefix server i` and `npm --prefix client i`.
- Dev run: `npm run dev` (server 3001, client 5173 via Vite proxy).
- Production: `npm run build` ¡æ `npm start` (server serves `client/dist`).
- Nodemon watches `server/src/**` only (see `server/nodemon.json`). Changes under `notes/` or `client/` don¡¯t restart server.

## Data model and files
- Note fields (see `fromRow`/`toDbNote`): required `problem`, `solution`; optional `title`, `subject`, `limit` (DB column `limit_text`), `details`, `status`, `priority`, `due_date`, `tags[]`, `props{}`.
- On create/update the server writes `notes/<id>.json` and renders Markdown via `ensureMarkdown()` including a ¡°Metadata¡± section from top-level fields and `props`.
- Deleting a note removes both `notes/<id>.json` and `notes/<id>.md`.
- Subjects table stores `schema_json`; human-readable mirrors live in `server/data/subjects/*.json`.

## API contracts (subset)
- CRUD: `GET/POST/PUT/DELETE /api/notes[/:id]` with payload `{ title?, subject, problem, solution, limit?, details?, status?, priority?, due_date?, tags, props }`.
- Similarity: `GET /api/notes/:id/similar`, `POST /api/similar` (for drafts). Keys must match frontend: `problem_similar`, `solution_similar`, `limit_similar`, `solution_to_problem` (After = Limit ¡æ Solution), `problem_to_solution` (Before = Problem ¡æ Solution).
- Search: `GET /api/search?q=...` returning ranked results by normalized phrase counts.
- Graph: `GET /api/graph?subject=...` ¡æ `{ nodes, edges }`; edges currently derive only from `solution_to_problem` and are typed `limit->after`.
- Subjects: `GET /api/subjects`, `POST /api/subjects` (create/update schema), `DELETE /api/subjects/:name` (denied for base subjects).

## Frontend patterns (client/src/App.jsx)
- Two search UX: sidebar search (debounced 300ms) + bottom ¡°Search All Notes¡± using `/api/search`.
- Subject-driven editor: schema fields normalize to keys; special keys map to top-level fields (`problem`, `solution`, `limit|limits`, `details|note|notes`, `tags|keywords`, `due_date`).
- Validation: `paper` requires `props.link`; `plain-note` requires `details`; `idea` uses 3 stages and synthesizes problem/solution/limit/details from `props`.
- Custom subjects: values live in `draft.props`; client concatenates to satisfy required `problem`/`solution` when missing.
- Draft similarity preview posts to `/api/similar` (debounced 400ms), excluding current note id.

## Conventions and gotchas
- When adding a new top-level field, update DB migrations, `fromRow`/`toDbNote`, `ensureMarkdown`, API payloads, and the editor in one pass to keep file/DB in sync.
- Keep similarity keys and frontend section labels aligned; breaking these keys breaks Suggestions and Graph.
- Tokenization is English lowercase-alnum with stopwords (`server/src/text.js`); changes affect similarity and search semantics.
- Subject name normalization is lowercase; migration already renames `plan-note` ¡æ `plain-note`.
- Ports: server honors `PORT`; update Vite proxy if you change it during dev.

## Where to look first
- Server: `server/src/index.js`, `server/src/similarity.js`, `server/src/search.js`, `server/src/text.js`.
- Client: `client/src/App.jsx`, `client/vite.config.js`, `client/src/styles.css`.
- Data: `notes/`, `server/data/notes.db`, `server/data/subjects/`.

If this guide drifts from code, update it in the same PR as your changes.

## Graph view quickstart
- Open the Graph tab in the UI (top nav). Subject selector defaults to `paper` and filters nodes by subject.
- Backend builds edges from the ¡°After¡± relation only: `solution_to_problem` (Limit ¡æ Solution). Edge type is `limit->after` with an overlap score as `weight`.
- Initial layout uses `cose`; positions are saved and reused. Scroll to zoom (increased wheel sensitivity), drag nodes to reposition; positions auto-save.
- Fetch graph via API (dev): `GET /api/graph?subject=paper` ¡æ `{ subject, nodes, edges }`.

Example response:

```json
{
	"subject": "paper",
	"nodes": [
		{ "id": "a1b2", "title": "Efficient Sorting for Logs" },
		{ "id": "c3d4", "title": "Streaming Dedup Pipeline" }
	],
	"edges": [
		{ "source": "a1b2", "target": "c3d4", "type": "limit->after", "weight": 3 }
	]
}
```