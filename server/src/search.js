// Phrase-based search: counts occurrences of the exact (normalized) query
function norm(s) {
  return (s || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while (true) {
    idx = haystack.indexOf(needle, idx);
    if (idx === -1) break;
    count++;
    idx += needle.length || 1;
  }
  return count;
}

export function searchNotes(notes, query, limit = 50) {
  const q = norm(query);
  if (!q) return [];
  const results = notes.map(n => {
    const title = norm(n.title);
    const subject = norm(n.subject);
    const problem = norm(n.problem);
    const solution = norm(n.solution);
    const limitText = norm(n.limit);
    const details = norm(n.details);
    const tags = norm((Array.isArray(n.tags) ? n.tags.join(' ') : ''));

    const t = countOccurrences(title, q);
    const s = countOccurrences(subject, q);
    const p = countOccurrences(problem, q);
    const so = countOccurrences(solution, q);
    const d = countOccurrences(details, q);
    const l = countOccurrences(limitText, q);
    const tg = countOccurrences(tags, q);

    const count = t + s + p + so + d + l + tg;
    const score = 3*t + 3*s + 2*p + 2*so + 1*d + 1*l + 2*tg;
    return { id: n.id, title: n.title, updated_at: n.updated_at, score, count };
  }).filter(r => r.score > 0);
  results.sort((a,b)=> b.score - a.score || new Date(b.updated_at) - new Date(a.updated_at));
  return results.slice(0, limit);
}
