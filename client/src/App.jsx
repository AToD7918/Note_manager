import React, { useEffect, useMemo, useState } from 'react'

  const api = {
  async list() {
    const r = await fetch('/api/notes');
    return r.json();
  },
  async remove(id) {
    const r = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 204) throw new Error('Delete failed');
  },
  async get(id) {
    const r = await fetch(`/api/notes/${id}`);
    if (!r.ok) throw new Error('Not found');
    return r.json();
  },
  async create(payload) {
    const r = await fetch('/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error('Create failed');
    return r.json();
  },
  async update(id, payload) {
    const r = await fetch(`/api/notes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error('Update failed');
    return r.json();
  },
  async similar(id) {
    const r = await fetch(`/api/notes/${id}/similar`);
    return r.json();
  }
}

function Sidebar({ notes, selectedId, onSelect, onNew, query, onQueryChange, onSearch, sortBy, onSortBy, contentQuery, onContentQueryChange, contentResults }) {
  useEffect(() => {
    const q = (query || '').trim();
    if (!q) { onSearch([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        onSearch(data.results || []);
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [query]);
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Notes</h2>
        <button className="btn" onClick={onNew}>New</button>
      </div>
      <div className="search-box">
        <input
          className="search-input"
          placeholder="Search notes..."
          value={query}
          onChange={e=>onQueryChange(e.target.value)}
        />
      </div>
      <div className="sort-box">
        <label>Sort by</label>
        <select className="sort-select" value={sortBy} onChange={e=>onSortBy(e.target.value)}>
          <option value="updated">Updated</option>
          <option value="title">Title</option>
          <option value="subject">Subject</option>
        </select>
      </div>
      <div className="note-list">
        {notes.map(n => (
          <div key={n.id} className={`note-item ${selectedId===n.id? 'selected': ''}`} onClick={() => onSelect(n.id)}>
            <div className="title">{n.title || 'Untitled'}{(n.hits != null || n.score != null) && <span className="muted"> · {(n.hits ?? n.score)}</span>}</div>
            <div className="meta">{new Date(n.updated_at).toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div className="sidebar-bottom">
        <div className="sb-header">Search All Notes</div>
        <input className="search-input" placeholder="Search in all notes..." value={contentQuery} onChange={e=>onContentQueryChange(e.target.value)} />
        <div className="bottom-results">
          {contentQuery.trim() && (
            contentResults.length === 0 ? (
              <div className="muted">No search results</div>
            ) : (
              contentResults.map(r => (
                <div key={r.id} className="sugg-item" onClick={()=>onSelect(r.id)}>
                  <div className="title">{(notes.find(n=>n.id===r.id)?.title) || 'Untitled'}</div>
                  <div className="score">{r.count ?? r.score}</div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  )
}

function LabelInput({ label, required, value, onChange, placeholder, textarea=true }) {
  return (
    <div className="field">
      <label>{label}{required ? ' *' : ''}</label>
      {textarea ? (
        <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={5} />
      ) : (
        <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  )
}

function Suggestions({ data, onSelect }) {
  if (!data) return null;
  const Section = ({ name, items }) => (
    <div className="sugg-section">
      <h4>{name}</h4>
      {(!items || items.length===0) && <div className="muted">No suggestions yet</div>}
      {items && items.map(it=> (
        <div key={it.id} className="sugg-item" onClick={()=>onSelect(it.id)}>
          <div className="title">{it.title}</div>
          <div className="score">{it.score}</div>
        </div>
      ))}
    </div>
  )
  return (
    <div className="suggestions">
      <Section name="Similar Problems" items={data.problem_similar} />
      <Section name="Similar Solutions" items={data.solution_similar} />
      <Section name="Solution → Problem (After)" items={data.solution_to_problem} />
      <Section name="Problem → Solution (Before)" items={data.problem_to_solution} />
    </div>
  )
}

function sortNotes(notes, sortBy) {
  const arr = [...notes]
  if (sortBy === 'title') arr.sort((a,b)=> (a.title||'').localeCompare(b.title||''))
  else if (sortBy === 'subject') arr.sort((a,b)=> (a.subject||'').localeCompare(b.subject||'') || (a.title||'').localeCompare(b.title||''))
  else arr.sort((a,b)=> new Date(b.updated_at) - new Date(a.updated_at))
  return arr
}

export default function App() {
  const [notes, setNotes] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [similar, setSimilar] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [sortBy, setSortBy] = useState('updated') // updated | title | subject
  const [contentQuery, setContentQuery] = useState('')
  const [contentResults, setContentResults] = useState([])
  const [view, setView] = useState('notes') // notes | sorts | graph
  const [subjects, setSubjects] = useState([])

  const selected = useMemo(() => notes.find(n=>n.id===selectedId) || null, [notes, selectedId])
  const [draft, setDraft] = useState({ title: '', subject: '', problem: '', solution: '', limit: '', details: '', status: '', priority: '', due_date: '', tags: '', props: {} })

  useEffect(() => { (async () => {
    const data = await api.list();
    setNotes(data);
    if (data.length) setSelectedId(data[0].id)
    try {
      const r = await fetch('/api/subjects');
      const subs = await r.json();
      setSubjects(subs || [])
    } catch {}
  })() }, [])

  useEffect(() => {
    if (selected) {
      const tagsStr = (selected.tags || []).join(', ')
      setDraft({
        title: selected.title || '',
        subject: selected.subject || '',
        problem: selected.problem || '',
        solution: selected.solution || '',
        limit: selected.limit || '',
        details: selected.details || '',
        status: selected.status || '',
        priority: selected.priority ?? '',
        due_date: selected.due_date || '',
        tags: tagsStr,
        props: selected.props || {}
      })
    } else {
      setDraft({ title: '', subject: '', problem: '', solution: '', limit: '', details: '', status: '', priority: '', due_date: '', tags: '', props: {} })
    }
  }, [selectedId])

  // Live preview suggestions based on draft
  useEffect(() => {
    const p = draft.problem?.trim();
    const s = draft.solution?.trim();
    if (!p && !s) { setSimilar(null); return }
    const handle = setTimeout(() => {
      fetch('/api/similar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ problem: p || '', solution: s || '', excludeId: selectedId || undefined }) })
        .then(r => r.json())
        .then(setSimilar)
        .catch(()=>{})
    }, 400)
    return () => clearTimeout(handle)
  }, [draft.problem, draft.solution, selectedId])

  // Content search (all fields)
  useEffect(() => {
    const q = (contentQuery || '').trim();
    if (!q) { setContentResults([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const data = await r.json();
        setContentResults(data.results || [])
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [contentQuery])

  async function handleSave() {
    if (!draft.problem || !draft.solution) { alert('Problem and Solution are required'); return }
    setLoading(true)
    try {
      const payload = {
        title: draft.title,
        subject: draft.subject,
        problem: draft.problem,
        solution: draft.solution,
        limit: draft.limit,
        details: draft.details,
        status: draft.status,
        priority: draft.priority === '' ? '' : Number(draft.priority),
        due_date: draft.due_date,
        tags: (draft.tags || '').split(',').map(s=>s.trim()).filter(Boolean),
        props: draft.props || {}
      }
      if (!selected) {
        const created = await api.create(payload)
        const all = await api.list();
        setNotes(all)
        setSelectedId(created.id)
      } else {
        const updated = await api.update(selected.id, payload)
        setNotes(prev => prev.map(n => n.id===updated.id ? updated : n))
      }
      // suggestions will refresh via draft effect
    } catch (e) {
      console.error(e)
      alert('Save failed')
    } finally {
      setLoading(false)
    }
  }

  function handleNew() {
    setSelectedId(null)
    setDraft({ title: '', subject: '', problem: '', solution: '', limit: '', details: '', status: '', priority: '', due_date: '', tags: '', props: {} })
    setSimilar(null)
  }

  async function handleDelete() {
    if (!selected) return;
    const ok = confirm('Delete this note? This cannot be undone.');
    if (!ok) return;
    setLoading(true);
    try {
      const deletedId = selected.id;
      await api.remove(deletedId);
      const remaining = notes.filter(n => n.id !== deletedId);
      setNotes(remaining);
      // choose next selection
      setSelectedId(remaining.length ? remaining[0].id : null);
      if (!remaining.length) {
        setDraft({ title: '', subject: '', problem: '', solution: '', limit: '', details: '', status: '', priority: '', due_date: '', tags: '', props: {} });
        setSimilar(null);
      }
    } catch (e) {
      console.error(e);
      alert('Delete failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <div className="topnav">
        <button className={`tab ${view==='notes' ? 'active' : ''}`} onClick={()=>setView('notes')}>Notes</button>
        <button className={`tab ${view==='sorts' ? 'active' : ''}`} onClick={()=>setView('sorts')}>Sorts</button>
        <button className={`tab ${view==='graph' ? 'active' : ''}`} onClick={()=>setView('graph')}>Graph</button>
      </div>
      <div className={`content-row ${view==='notes' ? '' : 'hidden'}`}>
      <Sidebar
        notes={query ? results.map(r => ({ ...notes.find(n=>n.id===r.id), score: r.score, hits: r.count })) : sortNotes(notes, sortBy)}
        selectedId={selectedId}
        onSelect={(id) => { setSelectedId(id); setQuery(''); setResults([]); }}
        onNew={handleNew}
        query={query}
        onQueryChange={setQuery}
        onSearch={setResults}
        sortBy={sortBy}
        onSortBy={setSortBy}
        contentQuery={contentQuery}
        onContentQueryChange={setContentQuery}
        contentResults={contentResults}
      />
      <div className="main">
        <div className="editor">
          <div className="editor-header">
            <input className="title-input" placeholder="Title (optional)" value={draft.title} onChange={e=>setDraft({ ...draft, title: e.target.value })} />
            {selected && <button className="btn danger" disabled={loading} onClick={handleDelete}>Delete</button>}
            <button className="btn primary" disabled={loading} onClick={handleSave}>{loading ? 'Saving...' : 'Save'}</button>
          </div>
          
          <div className="editor-body">
            <div className="fields">
              <div className="field">
                <label>Subject</label>
                <div className="subject-row">
                  <select value={draft.subject} onChange={e=>setDraft({ ...draft, subject: e.target.value })}>
                    <option value="">-</option>
                    {subjects.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    {draft.subject && !subjects.find(s=>s.name===draft.subject) && <option value={draft.subject}>{draft.subject}</option>}
                  </select>
                  <button className="btn" onClick={()=>setView('sorts')}>Manage</button>
                </div>
              </div>
              <LabelInput label="Problem" required value={draft.problem} onChange={v=>setDraft({ ...draft, problem: v })} placeholder="Describe the problem..." />
              <LabelInput label="Solution" required value={draft.solution} onChange={v=>setDraft({ ...draft, solution: v })} placeholder="Describe the solution..." />
              <LabelInput label="Limit" value={draft.limit} onChange={v=>setDraft({ ...draft, limit: v })} placeholder="Constraints, limitations..." />
              <LabelInput label="Details" value={draft.details} onChange={v=>setDraft({ ...draft, details: v })} placeholder="Additional context..." />
              <div className="properties">
                <div className="props-row">
                  <div className="prop">
                    <label>Status</label>
                    <select value={draft.status} onChange={e=>setDraft({ ...draft, status: e.target.value })}>
                      <option value="">-</option>
                      <option>idea</option>
                      <option>doing</option>
                      <option>done</option>
                      <option>blocked</option>
                    </select>
                  </div>
                  <div className="prop">
                    <label>Priority</label>
                    <select value={draft.priority} onChange={e=>setDraft({ ...draft, priority: e.target.value })}>
                      <option value="">-</option>
                      {[1,2,3,4,5].map(n=> <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="prop">
                    <label>Due</label>
                    <input type="date" value={draft.due_date} onChange={e=>setDraft({ ...draft, due_date: e.target.value })} />
                  </div>
                </div>
                <div className="props-row">
                  <div className="prop wide">
                    <label>Tags (comma separated)</label>
                    <input value={draft.tags} onChange={e=>setDraft({ ...draft, tags: e.target.value })} placeholder="tag1, tag2" />
                  </div>
                </div>
                <CustomProps propsObj={draft.props} onChange={obj=>setDraft({ ...draft, props: obj })} />
              </div>
            </div>
            <Suggestions data={selected ? similar : null} onSelect={setSelectedId} />
          </div>
        </div>
      </div>
      </div>
      <div className={`sorts-view ${view==='sorts' ? '' : 'hidden'}`}>
        <div className="sorts-panel">
          <SubjectManager subjects={subjects} onChange={setSubjects} onSelectSubject={(name)=>{ setQuery(name); setView('notes'); }} />
          <div className="groups">
            {subjects.map(s => (
              <Group key={s.name} title={s.name} items={notes.filter(n=> (n.subject||'') === s.name)} onOpen={id=>{ setSelectedId(id); setView('notes'); }} />
            ))}
            <Group title="Uncategorized/Other" items={notes.filter(n=> !n.subject || !subjects.find(s=>s.name===n.subject))} onOpen={id=>{ setSelectedId(id); setView('notes'); }} />
          </div>
        </div>
      </div>
      <div className={`placeholder ${view==='graph' ? '' : 'hidden'}`}></div>
    </div>
  )
}

function SubjectManager({ subjects, onChange, onSelectSubject }) {
  const [name, setName] = useState('')
  async function reload() {
    try { const r = await fetch('/api/subjects'); const subs = await r.json(); onChange(subs||[]) } catch {}
  }
  async function add() {
    const n = name.trim(); if (!n) return;
    await fetch('/api/subjects', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:n }) })
    setName(''); reload();
  }
  async function remove(n) {
    await fetch(`/api/subjects/${encodeURIComponent(n)}`, { method:'DELETE' })
    reload();
  }
  return (
    <div className="subject-manager">
      <div className="sm-row">
        <input className="sm-input" placeholder="Add subject (e.g., paper, note, idea)" value={name} onChange={e=>setName(e.target.value)} />
        <button className="btn" onClick={add}>Add</button>
      </div>
      <div className="chips">
        {subjects.map(s => (
          <div key={s.name} className="chip" onClick={()=>onSelectSubject(s.name)}>
            <span>{s.name}</span>
            <button className="chip-x" title="Delete" onClick={(e)=>{ e.stopPropagation(); remove(s.name); }}>×</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function Group({ title, items, onOpen }) {
  return (
    <div className="group">
      <div className="group-title">{title} <span className="muted">({items.length})</span></div>
      {items.length === 0 && <div className="muted">No notes</div>}
      {items.map(n => (
        <div key={n.id} className="group-item" onClick={()=>onOpen(n.id)}>
          <div className="gi-title">{n.title || 'Untitled'}</div>
          <div className="gi-meta">{new Date(n.updated_at).toLocaleString()}</div>
        </div>
      ))}
    </div>
  )
}

function CustomProps({ propsObj, onChange }) {
  const entries = Object.entries(propsObj || {});
  function setKV(k, v) {
    const next = { ...(propsObj || {}) };
    if (!k && !v) return; // ignore empty
    next[k] = v;
    onChange(next);
  }
  function removeK(k) {
    const next = { ...(propsObj || {}) };
    delete next[k];
    onChange(next);
  }
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  function addPair() {
    const k = newKey.trim();
    if (!k) return;
    setKV(k, newVal);
    setNewKey(''); setNewVal('');
  }
  return (
    <div className="custom-props">
      <div className="props-header">Properties</div>
      {entries.length === 0 && <div className="muted">No custom properties</div>}
      {entries.map(([k,v]) => (
        <div key={k} className="prop kv">
          <input className="kv-key" value={k} onChange={e=>{
            const nk = e.target.value;
            const val = propsObj[k];
            const next = { ...(propsObj || {}) };
            delete next[k];
            if (nk) next[nk] = val;
            onChange(next);
          }} />
          <input className="kv-val" value={v} onChange={e=>setKV(k, e.target.value)} />
          <button className="btn" onClick={()=>removeK(k)}>Remove</button>
        </div>
      ))}
      <div className="prop kv">
        <input className="kv-key" placeholder="Key" value={newKey} onChange={e=>setNewKey(e.target.value)} />
        <input className="kv-val" placeholder="Value" value={newVal} onChange={e=>setNewVal(e.target.value)} />
        <button className="btn" onClick={addPair}>Add</button>
      </div>
    </div>
  )
}
