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

function LabelInput({ label, required, value, onChange, placeholder, textarea=true, rows=5 }) {
  return (
    <div className="field">
      <label>{label}{required ? ' *' : ''}</label>
      {textarea ? (
        <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} />
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
  const [view, setView] = useState('notes') // notes | subjects | sort | graph
  const [subjects, setSubjects] = useState([])
  const [sortMode, setSortMode] = useState('subject') // subject | title | updated

  const selected = useMemo(() => notes.find(n=>n.id===selectedId) || null, [notes, selectedId])
  const [draft, setDraft] = useState({ title: '', subject: '', problem: '', solution: '', limit: '', details: '', status: '', priority: '', due_date: '', tags: '', props: {} })
  const isNew = !selected
  const subjLc = (draft.subject || '').toLowerCase()
  const isPaper = subjLc === 'paper'
  const isPlainNote = subjLc === 'plain-note' || subjLc === 'plain note'
  const isIdea = (draft.subject || '').toLowerCase() === 'idea'
  const currentSubject = useMemo(() => subjects.find(s => (s.name||'').toLowerCase() === subjLc) || null, [subjects, subjLc])
  const schemaFields = (currentSubject?.schema?.fields && Array.isArray(currentSubject.schema.fields)) ? currentSubject.schema.fields : []
  const usesSchema = !!draft.subject && schemaFields.length > 0 && !isIdea
  const isCustomSubject = !!draft.subject && !isPaper && !isPlainNote && !isIdea
  const showSubjectSpecificFields = !isNew || !!draft.subject
  const [ideaStage, setIdeaStage] = useState(1) // 1: Quick Capture, 2: Idea Card, 3: Detailed Plan

  useEffect(() => {
    // Reset stage when subject changes
    setIdeaStage(1)
  }, [draft.subject])

  // When switching to a custom subject on a new note, initialize its fields
  useEffect(() => {
    if (!usesSchema) return;
    // Only auto-initialize for new notes (no selection)
    if (selected) return;
    const nextProps = { ...(draft.props || {}) };
    let changed = false;
    (schemaFields || []).forEach((f, idx) => {
      const key = (f.key || (f.title || `field_${idx}`)).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      if (!(key in nextProps)) { nextProps[key] = ''; changed = true; }
    })
    if (changed) setDraft(prev => ({ ...prev, props: nextProps }))
  }, [usesSchema, schemaFields, selected])

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

  // Live preview suggestions based on draft/subject (only for papers)
  useEffect(() => {
    if (!isPaper) { setSimilar(null); return }
    const ideaProblem = [
      draft.props?.idea_pd_user || '',
      draft.props?.idea_pd_one || '',
      draft.props?.idea_pd_constraints || '',
    ].filter(Boolean).join('\n');
    const ideaSolution = [
      draft.props?.idea_hypothesis || '',
      draft.props?.idea_conclusion || '',
      draft.props?.idea_why || '',
    ].filter(Boolean).join('\n');
    const paperFallback = (draft.details?.trim() || draft.title?.trim() || draft.props?.link || '');
    const p = (isPlainNote
      ? (draft.details || '')
      : isIdea
        ? (ideaProblem || (draft.props?.idea_summary || ''))
        : isPaper
          ? (draft.problem?.trim() || paperFallback)
          : (draft.problem || '')
    ).trim();
    const s = (isPlainNote
      ? (draft.details || '')
      : isIdea
        ? (ideaSolution || (draft.props?.idea_summary || ''))
        : isPaper
          ? (draft.solution?.trim() || paperFallback)
          : (draft.solution || '')
    ).trim();
    if (!p && !s) { setSimilar(null); return }
    const handle = setTimeout(() => {
      fetch('/api/similar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ problem: p || '', solution: s || '', excludeId: selectedId || undefined }) })
        .then(r => r.json())
        .then(setSimilar)
        .catch(()=>{})
    }, 400)
    return () => clearTimeout(handle)
  }, [draft.problem, draft.solution, draft.details, draft.props?.idea_pd_user, draft.props?.idea_pd_one, draft.props?.idea_pd_constraints, draft.props?.idea_hypothesis, draft.props?.idea_conclusion, draft.props?.idea_why, draft.props?.idea_summary, draft.props?.link, draft.title, isPlainNote, isIdea, isPaper, selectedId])

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
    if (isNew && !draft.subject) { alert('Please select a subject'); return }
    if (isPlainNote) {
      if (!draft.details || !draft.details.trim()) { alert('Notes are required'); return }
    } else if (isPaper) {
      const link = (draft.props?.link || '').trim();
      if (!link) { alert('Link is required for Paper'); return }
    } else if (isIdea) {
      const ip = [
        draft.props?.idea_pd_user || '',
        draft.props?.idea_pd_one || '',
        draft.props?.idea_pd_constraints || '',
      ].filter(Boolean).join('\n').trim();
      const ih = [
        draft.props?.idea_hypothesis || '',
        draft.props?.idea_conclusion || '',
        draft.props?.idea_why || '',
      ].filter(Boolean).join('\n').trim();
      if (!(draft.props?.idea_summary || '').trim()) { alert('Please fill Summary of Idea'); return }
    } else if (isCustomSubject) {
      // allow empty custom fields; we'll fallback when building payload
    } else {
      if (!draft.problem || !draft.problem.trim() || !draft.solution || !draft.solution.trim()) { alert('Problem and Solution are required'); return }
    }
    setLoading(true)
    try {
      const ideaProblem = [
        draft.props?.idea_pd_user || '',
        draft.props?.idea_pd_one || '',
        draft.props?.idea_pd_constraints || '',
      ].filter(Boolean).join('\n');
      const ideaSolution = [
        draft.props?.idea_hypothesis || '',
        draft.props?.idea_conclusion || '',
        draft.props?.idea_why || '',
      ].filter(Boolean).join('\n');
      const ideaLimit = [
        draft.props?.idea_risks || '',
        draft.props?.idea_alternatives || '',
      ].filter(Boolean).join('\n');
      const paperFallback = (draft.problem?.trim() || draft.solution?.trim())
        ? ''
        : (draft.details?.trim() || draft.title?.trim() || draft.props?.link || '');
      // Build custom subject combined text for backend-required fields
      const customCombined = isCustomSubject ? (() => {
        try {
          const parts = (customFields || []).map((f, idx) => {
            const key = f.key || (f.title || `field_${idx}`).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
            const val = (draft.props || {})[key]
            const title = f.title || key
            return (val && String(val).trim()) ? `${title}: ${val}` : ''
          }).filter(Boolean)
          return parts.join('\n')
        } catch { return '' }
      })() : ''

      const payload = {
        title: draft.title,
        subject: draft.subject,
        problem: isPlainNote
          ? (draft.details || '')
          : isIdea
            ? (ideaProblem || (draft.props?.idea_summary || ''))
            : isPaper
              ? (draft.problem?.trim() || paperFallback)
              : isCustomSubject
                ? (draft.problem?.trim() || customCombined || draft.details || draft.title || 'Untitled')
                : draft.problem,
        solution: isPlainNote
          ? (draft.details || '')
          : isIdea
            ? (ideaSolution || (draft.props?.idea_summary || ''))
            : isPaper
              ? (draft.solution?.trim() || paperFallback)
              : isCustomSubject
                ? (draft.solution?.trim() || customCombined || draft.details || draft.title || 'Untitled')
                : draft.solution,
        limit: isPlainNote ? '' : (isIdea ? ideaLimit : draft.limit),
        details: isIdea
          ? [
              draft.props?.idea_summary ? `Summary:\n\n${draft.props?.idea_summary}` : '',
              (() => {
                const parts = [
                  draft.props?.idea_context_why ? `Why did it come to mind?\n\n${draft.props?.idea_context_why}` : '',
                  draft.props?.idea_context_who ? `Whose problem is it?\n\n${draft.props?.idea_context_who}` : '',
                  draft.props?.idea_context_assumption ? `Assuming solution idea\n\n${draft.props?.idea_context_assumption}` : '',
                ].filter(Boolean).join('\n\n');
                return parts ? `Context:\n\n${parts}` : '';
              })(),
              draft.props?.idea_date || draft.props?.idea_link ? `Meta:\n\n${[
                draft.props?.idea_date ? `Date: ${draft.props?.idea_date}` : '',
                draft.props?.idea_link ? `Link: ${draft.props?.idea_link}` : ''
              ].filter(Boolean).join('\n')}` : '',
              (() => {
                const perpose = (() => {
                  const sub = [
                    draft.props?.idea_dp_hypothesis ? `Hypothesis\n\n${draft.props?.idea_dp_hypothesis}` : '',
                    draft.props?.idea_dp_result ? `Assuming result\n\n${draft.props?.idea_dp_result}` : '',
                  ].filter(Boolean).join('\n\n');
                  return sub ? `Perpose & hypothesis:\n\n${sub}` : '';
                })();
                const plan = draft.props?.idea_dp_method ? `Plan:\n\n${draft.props?.idea_dp_method}` : '';
                const parts = [perpose, plan].filter(Boolean).join('\n\n');
                return parts ? `Detailed Plan:\n\n${parts}` : '';
              })()
            ].filter(Boolean).join('\n\n')
          : isCustomSubject
            ? [customCombined, draft.details].filter(Boolean).join('\n\n')
            : draft.details,
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
        <button className={`tab ${view==='subjects' ? 'active' : ''}`} onClick={()=>setView('subjects')}>Subjects</button>
        <button className={`tab ${view==='sort' ? 'active' : ''}`} onClick={()=>setView('sort')}>Sort</button>
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
                  <button className="btn" onClick={()=>setView('subjects')}>Manage</button>
                </div>
              </div>
              {showSubjectSpecificFields && isPaper && !usesSchema && (
                <LabelInput
                  label="Link"
                  value={draft.props?.link || ''}
                  onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), link: v } })}
                  placeholder="https://..."
                  textarea={false}
                />
              )}
              {showSubjectSpecificFields && usesSchema ? (
                <>
                  {schemaFields.length === 0 && (
                    <div className="muted" style={{ marginBottom: 8 }}>No fields defined for this subject. Add fields in Subjects.</div>
                  )}
                  {schemaFields.map((f, idx) => {
                    const rawKey = f.key || (f.title || `field_${idx}`)
                    const key = rawKey.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
                    const type = (f.type || 'text').toLowerCase()
                    const label = f.title || key
                    // Map special keys to top-level fields
                    if (key === 'problem') {
                      return <LabelInput key={key} label={label} value={draft.problem} onChange={v=>setDraft({ ...draft, problem: v })} placeholder="" />
                    }
                    if (key === 'solution') {
                      return <LabelInput key={key} label={label} value={draft.solution} onChange={v=>setDraft({ ...draft, solution: v })} placeholder="" />
                    }
                    if (key === 'limit' || key === 'limits') {
                      return <LabelInput key={key} label={label} value={draft.limit} onChange={v=>setDraft({ ...draft, limit: v })} placeholder="" />
                    }
                    if (key === 'details' || key === 'note' || key === 'notes') {
                      return <LabelInput key={key} label={label} value={draft.details} onChange={v=>setDraft({ ...draft, details: v })} placeholder="" />
                    }
                    if (type === 'tags' || key === 'tags' || key === 'keywords') {
                      return (
                        <div className="prop wide" key={key}>
                          <label>{label} (comma separated)</label>
                          <input value={draft.tags} onChange={e=>setDraft({ ...draft, tags: e.target.value })} placeholder="tag1, tag2" />
                        </div>
                      )
                    }
                    if (type === 'date') {
                      const propVal = (draft.props || {})[key]
                      const val = (draft[key] ?? propVal) || (key==='due_date' ? draft.due_date : '')
                      const setVal = (v) => {
                        if (key === 'due_date') setDraft({ ...draft, due_date: v })
                        else setDraft({ ...draft, props: { ...(draft.props || {}), [key]: v } })
                      }
                      return (
                        <div className="field" key={key}>
                          <label>{label}</label>
                          <input type="date" value={val} onChange={e=>setVal(e.target.value)} />
                        </div>
                      )
                    }
                    if (type === 'textarea') {
                      const val = (draft.props || {})[key] || ''
                      return <LabelInput key={key} label={label} value={val} onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), [key]: v } })} placeholder="" rows={5} />
                    }
                    // link/text default to single-line
                    const val = key === 'link' ? (draft.props?.link || '') : ((draft.props || {})[key] || '')
                    const setVal = (v) => setDraft({ ...draft, props: { ...(draft.props || {}), [key]: v } })
                    return <LabelInput key={key} label={label} value={val} onChange={setVal} placeholder="" textarea={false} />
                  })}
                </>
              ) : showSubjectSpecificFields && isPlainNote ? (
                <LabelInput label="Notes" value={draft.details} onChange={v=>setDraft({ ...draft, details: v })} placeholder="Write your notes..." />
              ) : showSubjectSpecificFields && isIdea ? (
              <>
                <div className="field">
                  <label>{`Stage ${ideaStage} of 3`}: {ideaStage === 1 ? 'Quick Capture' : ideaStage === 2 ? 'Idea Card' : 'Detailed Plan'}</label>
                </div>
                {ideaStage === 1 ? (
                  <>
                    <div className="field small-title"><label>Summary of Idea</label></div>
                    <LabelInput
                      label="Summary"
                      value={draft.props?.idea_summary || ''}
                      onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_summary: v } })}
                      placeholder="Briefly summarize the idea..."
                      rows={3}
                    />
                    <div className="field small-title">
                      <label>Context</label>
                    </div>
                    <LabelInput
                      label="Why did it come to mind?"
                      value={draft.props?.idea_context_why || ''}
                      onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_context_why: v } })}
                      placeholder="Describe the trigger or background..."
                      rows={3}
                    />
                    <LabelInput
                      label="Whose problem is it?"
                      value={draft.props?.idea_context_who || ''}
                      onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_context_who: v } })}
                      placeholder="Target user/persona and situation..."
                      rows={3}
                    />
                    <LabelInput
                      label="Assuming solution idea"
                      value={draft.props?.idea_context_assumption || ''}
                      onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_context_assumption: v } })}
                      placeholder="What solution idea are you assuming?"
                      rows={3}
                    />
                    <div className="properties">
                      <div className="props-row">
                        <div className="prop wide">
                          <label>Tags (comma separated)</label>
                          <input value={draft.tags} onChange={e=>setDraft({ ...draft, tags: e.target.value })} placeholder="tag1, tag2" />
                        </div>
                      </div>
                      <div className="props-row">
                        <div className="prop">
                          <label>Link/Screenshot</label>
                          <input value={draft.props?.idea_link || ''} onChange={e=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_link: e.target.value } })} placeholder="https://..." />
                        </div>
                        <div className="prop">
                          <label>Date</label>
                          <input type="date" value={draft.props?.idea_date || ''} onChange={e=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_date: e.target.value } })} />
                        </div>
                      </div>
                    </div>
                  </>
                ) : ideaStage === 2 ? (
                  <>
                    <div className="field small-title">
                      <label>Problem Definition</label>
                    </div>
                    <LabelInput
                      label="User/Situation"
                      value={draft.props?.idea_pd_user || ''}
                      onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_pd_user: v } })}
                      placeholder="Who is affected and in what context?"
                      rows={3}
                    />
                    <LabelInput
                      label="One-Line Problem Statement"
                      value={draft.props?.idea_pd_one || ''}
                      onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_pd_one: v } })}
                      placeholder="State the core problem in one sentence"
                      rows={3}
                    />
                    <LabelInput
                      label="Constraints"
                      value={draft.props?.idea_pd_constraints || ''}
                      onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_pd_constraints: v } })}
                      placeholder="Constraints and limitations"
                      rows={3}
                    />

                    <div className="field small-title">
                      <label>Hypothesis → Consequent</label>
                    </div>
                    <LabelInput
                      label="Hypothesis"
                      value={draft.props?.idea_hypothesis || ''}
                      onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_hypothesis: v } })}
                      placeholder="Your main hypothesis"
                      rows={3}
                    />
                    <LabelInput
                      label="Conclusion"
                      value={draft.props?.idea_conclusion || ''}
                      onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_conclusion: v } })}
                      placeholder="What follows if the hypothesis holds"
                      rows={3}
                    />
                    <LabelInput
                      label="Why it holds true"
                      value={draft.props?.idea_why || ''}
                      onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_why: v } })}
                      placeholder="Reasoning or evidence"
                      rows={3}
                    />

                    <div className="field small-title">
                      <label>Risk & Alternatives</label>
                    </div>
                    <LabelInput
                      label="Key Risks"
                      value={draft.props?.idea_risks || ''}
                      onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_risks: v } })}
                      placeholder="Main risks and unknowns"
                      rows={3}
                    />
                    <LabelInput
                      label="Alternatives/buffering measures"
                      value={draft.props?.idea_alternatives || ''}
                      onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_alternatives: v } })}
                      placeholder="Alternative approaches or mitigations"
                      rows={3}
                    />
                  </>
              ) : (
                <>
                    <div className="field small-title"><label>Detailed Plan</label></div>
                    <div className="field small-title"><label>Perpose & hypothesis</label></div>
                    <LabelInput
                      label="Hypothesis"
                      value={draft.props?.idea_dp_hypothesis || ''}
                      onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_dp_hypothesis: v } })}
                      placeholder="Hypothesis for the plan"
                      rows={3}
                    />
                    <LabelInput
                      label="Assuming result"
                      value={draft.props?.idea_dp_result || ''}
                      onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_dp_result: v } })}
                      placeholder="Expected/assumed result"
                      rows={3}
                    />
                    <div className="field small-title"><label>Plan</label></div>
                    <LabelInput
                      label="Method"
                      value={draft.props?.idea_dp_method || ''}
                      onChange={v=>setDraft({ ...draft, props: { ...(draft.props || {}), idea_dp_method: v } })}
                      placeholder="Methods, steps, or protocols"
                      rows={8}
                    />
                  </>
                )}
                <div className="field" style={{ display: 'flex', gap: 8 }}>
                  {ideaStage >= 2 && <button className="btn" onClick={()=>setIdeaStage(ideaStage-1)}>Back</button>}
                  {ideaStage === 1 && <button className="btn" onClick={()=>setIdeaStage(2)}>Next</button>}
                  {ideaStage === 2 && <button className="btn" onClick={()=>setIdeaStage(3)}>Detailed Plan</button>}
                </div>
              </>
              ) : showSubjectSpecificFields ? (
              <>
                <LabelInput label="Problem" required value={draft.problem} onChange={v=>setDraft({ ...draft, problem: v })} placeholder="Describe the problem..." />
                <LabelInput label="Solution" required value={draft.solution} onChange={v=>setDraft({ ...draft, solution: v })} placeholder="Describe the solution..." />
                <LabelInput label={isPaper ? 'Limits' : 'Limit'} value={draft.limit} onChange={v=>setDraft({ ...draft, limit: v })} placeholder="Constraints, limitations..." />
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
                      <label>{isPaper ? 'Keywords (comma separated)' : 'Tags (comma separated)'}</label>
                      <input value={draft.tags} onChange={e=>setDraft({ ...draft, tags: e.target.value })} placeholder={isPaper ? 'keyword1, keyword2' : 'tag1, tag2'} />
                    </div>
                  </div>
                  <CustomProps propsObj={draft.props} onChange={obj=>setDraft({ ...draft, props: obj })} />
                </div>
              </>
              ) : null}
            </div>
            {showSubjectSpecificFields && isPaper ? (
              <Suggestions data={selected ? similar : null} onSelect={setSelectedId} />
            ) : showSubjectSpecificFields && isIdea ? (
              <SuggestionPlaceholder message="Ideas can later be used as solutions for papers. Save this idea and link it from a paper." />
            ) : null}
          </div>
        </div>
      </div>
      </div>
      <div className={`sorts-view ${view==='subjects' ? '' : 'hidden'}`}>
        <div className="sorts-panel">
          <SubjectManager subjects={subjects} notes={notes} onChange={setSubjects} />
        </div>
      </div>

      <div className={`sorts-view ${view==='sort' ? '' : 'hidden'}`}>
        <div className="sorts-panel">
          <div className="sm-row" style={{ marginBottom: 12 }}>
            <label style={{ alignSelf:'center', color:'var(--muted)' }}>Sort by</label>
            <select className="sort-select" value={sortMode} onChange={e=>setSortMode(e.target.value)}>
              <option value="subject">Subject</option>
              <option value="title">Title</option>
              <option value="updated">Updated</option>
            </select>
          </div>
          <div className="groups">
            {sortMode === 'subject' ? (
              <>
                {subjects.map(s => (
                  <Group key={s.name} title={s.name} items={notes.filter(n=> (n.subject||'') === s.name)} onOpen={id=>{ setSelectedId(id); setView('notes'); }} />
                ))}
                <Group title="Uncategorized/Other" items={notes.filter(n=> !n.subject || !subjects.find(s=>s.name===n.subject))} onOpen={id=>{ setSelectedId(id); setView('notes'); }} />
              </>
            ) : (
              <Group title={`All Notes (${sortMode})`} items={sortNotes(notes, sortMode)} onOpen={id=>{ setSelectedId(id); setView('notes'); }} />
            )}
          </div>
        </div>
      </div>
      <div className={`placeholder ${view==='graph' ? '' : 'hidden'}`}></div>
    </div>
  )
}

function SubjectManager({ subjects, notes, onChange }) {
  const [name, setName] = useState('')
  const [showBuilder, setShowBuilder] = useState(false)
  const [mode, setMode] = useState('create') // create | edit
  const [selected, setSelected] = useState(null)
  const [fields, setFields] = useState([]) // {title:'', type:'text'}
  const [saveError, setSaveError] = useState('')
  const [shake, setShake] = useState(false)
  async function reload() {
    try { const r = await fetch('/api/subjects'); const subs = await r.json(); onChange(subs||[]) } catch {}
  }
  function addField() {
    setFields(prev => [...prev, { title: '', type: 'text' }])
  }
  function updateField(i, patch) {
    setFields(prev => prev.map((f, idx) => idx===i ? { ...f, ...patch } : f))
  }
  function removeField(i) {
    setFields(prev => prev.filter((_, idx) => idx!==i))
  }
  function addNew() {
    setMode('create'); setSelected(null); setName(''); setFields([]); setShowBuilder(true)
  }
  async function saveSubject() {
    const n = (mode === 'edit' ? (selected?.name || '') : name.trim());
    if (!n) return;
    const normalized = fields.map((f, idx) => {
      const title = (f.title || '').trim() || `Field ${idx+1}`;
      const type = (f.type || 'text').toLowerCase();
      const key = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `field_${idx+1}`;
      return { title, type, key };
    });
    const schema = { fields: normalized };
    // Validation: prevent incompatible changes if notes exist
    if (mode === 'edit' && selected) {
      try {
        const r = await fetch('/api/notes');
        const all = await r.json();
        const related = (all || []).filter(nm => (nm.subject||'').toLowerCase() === (selected.name||'').toLowerCase());
        if (related.length) {
          // Build old fields map
          const oldFields = ((selected.schema && Array.isArray(selected.schema.fields)) ? selected.schema.fields : []).map(f=>({
            key: (f.key || (f.title||'')).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''),
            type: (f.type||'text').toLowerCase(),
            title: f.title || ''
          }));
          const oldMap = new Map(oldFields.map(f=>[f.key, f]));
          const newMap = new Map(normalized.map(f=>[f.key, f]));
          const errors = [];
          const isTextish = t => (t==='text' || t==='textarea' || t==='link' || !t);
          for (const [k, ofld] of oldMap.entries()) {
            const nfld = newMap.get(k);
            // deletion with existing data
            if (!nfld) {
              const hasData = related.some(note => {
                if (k==='problem') return !!(note.problem||'').trim();
                if (k==='solution') return !!(note.solution||'').trim();
                if (k==='limit' || k==='limits') return !!(note.limit||'').trim();
                if (k==='details' || k==='note' || k==='notes') return !!(note.details||'').trim();
                if (k==='due_date') return !!(note.due_date||'').trim();
                if (k==='tags' || k==='keywords') return Array.isArray(note.tags) && note.tags.length>0;
                return !!(((note.props||{})[k]||'').toString().trim());
              });
              if (hasData) errors.push({key:k, from:ofld.type, to:'(removed)', reason:'field has data in existing notes'});
              continue;
            }
            // type change incompatibilities
            const ot = ofld.type; const nt = (nfld.type||'text').toLowerCase();
            if (ot!==nt) {
              const conflict = ((ot==='date') !== (nt==='date')) || ((ot==='tags') !== (nt==='tags'));
              if (conflict) {
                const hasData = related.some(note => {
                  if (k==='problem') return !!(note.problem||'').trim();
                  if (k==='solution') return !!(note.solution||'').trim();
                  if (k==='limit' || k==='limits') return !!(note.limit||'').trim();
                  if (k==='details' || k==='note' || k==='notes') return !!(note.details||'').trim();
                  if (k==='due_date') return !!(note.due_date||'').trim();
                  if (k==='tags' || k==='keywords') return Array.isArray(note.tags) && note.tags.length>0;
                  return !!(((note.props||{})[k]||'').toString().trim());
                });
                if (hasData) errors.push({key:k, from:ot, to:nt, reason:'incompatible type change with existing data'});
              }
            }
          }
          if (errors.length) {
            const msg = errors.map(e=>`Cannot change ${e.key} from ${e.from} to ${e.to}`).join('; ');
            setSaveError(msg);
            setShake(true);
            setTimeout(()=>{ setShake(false); setSaveError(''); }, 2500);
            return; // abort save
          }
        }
      } catch {}
    }
    await fetch('/api/subjects', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:n, schema }) })
    setName(''); setFields([]); setShowBuilder(false); setSelected(null); reload();
  }
  async function remove(n) {
    try {
      const r = await fetch(`/api/subjects/${encodeURIComponent(n)}`, { method:'DELETE' })
      if (!r.ok && r.status !== 204) {
        let msg = 'Delete failed';
        try { const j = await r.json(); if (j?.error) msg = j.error; } catch {}
        alert(msg);
      }
    } catch (e) {
      alert('Delete failed');
    } finally {
      reload();
    }
  }
  return (
    <div className="subject-manager">
      <div className="sm-row" style={{ marginBottom: 8 }}>
        <button className="btn" onClick={addNew}>Add new subject</button>
      </div>
      <div className="chips" style={{ marginBottom: 12 }}>
        {subjects.map(s => {
          const isBase = ['paper','plain-note','idea'].includes((s.name||'').toLowerCase());
          const hasNotes = (notes||[]).some(n=> (n.subject||'').toLowerCase() === (s.name||'').toLowerCase());
          return (
            <div key={s.name} className="chip" onClick={()=>{ setMode('edit'); setSelected(s); setName(s.name); setFields(((s.schema&&Array.isArray(s.schema.fields))?s.schema.fields:[])); setShowBuilder(true); }}>
              <span>{s.name}</span>
              {!isBase && !hasNotes && (
                <button className="chip-x" title="Delete" onClick={(e)=>{ e.stopPropagation(); remove(s.name); }}>×</button>
              )}
            </div>
          )
        })}
      </div>
      {showBuilder && (<>
        <div className="builder">
          <div className="field">
            {mode==='create' ? (
              <>
                <label>Create New Subject</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Subject name" />
              </>
            ) : (
              <label>Subject: {name}</label>
            )}
          </div>
          <div className="field">
            <label>Fields</label>
          </div>
          {fields.map((f, i) => (
            <div key={i} className="props-row">
              <div className="prop wide">
                <label>Title</label>
                <input value={f.title} onChange={e=>updateField(i, { title: e.target.value })} placeholder={`Field ${i+1} title`} />
              </div>
              <div className="prop">
                <label>Type</label>
                <select value={f.type} onChange={e=>updateField(i, { type: e.target.value })}>
                  <option value="text">text</option>
                  <option value="textarea">textarea</option>
                  <option value="date">date</option>
                  <option value="link">link</option>
                  <option value="tags">tags</option>
                </select>
              </div>
              <div className="prop" style={{ alignSelf:'flex-end' }}>
                <button className="btn" onClick={()=>removeField(i)}>Remove</button>
              </div>
            </div>
          ))}
          <div className="sm-row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={addField}>+ Field</button>
            <div style={{ flex:1 }}></div>
            <button className="btn" onClick={()=>{ setShowBuilder(false); setFields([]); setSelected(null); setMode('create'); }}>Close</button>
            <button className={`btn ${shake ? 'error shake' : 'primary'}`} onClick={saveSubject} disabled={mode==='edit' && ['paper','plain-note','idea'].includes((name||'').toLowerCase())}>{mode==='create' ? 'Save Subject' : 'Save Changes'}</button>
          </div>
          {mode==='edit' && ['paper','plain-note','idea'].includes((name||'').toLowerCase()) && (
            <div className="muted" style={{ marginTop: 6 }}>Base subjects cannot be modified.</div>
          )}
        </div>
        {!!saveError && (
          <div className="bubble">{saveError}</div>
        )}
      </>)}
    </div>
  )
}

function SuggestionPlaceholder({ message }) {
  return (
    <div className="suggestions">
      <div className="sugg-section">
        <h4>Suggestions</h4>
        <div className="muted">{message}</div>
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
