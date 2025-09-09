import { tokenize } from './text.js'

function toSet(arr) {
  const s = new Set();
  for (const t of arr) s.add(t);
  return s;
}

function overlapCount(aSet, bSet) {
  let c = 0;
  const small = aSet.size <= bSet.size ? aSet : bSet;
  const large = aSet.size <= bSet.size ? bSet : aSet;
  for (const t of small) if (large.has(t)) c++;
  return c;
}

function indexNotes(notes) {
  // Build token sets for problems and solutions
  const idx = new Map();
  for (const n of notes) {
    idx.set(n.id, {
      id: n.id,
      title: n.title,
      problemSet: toSet(tokenize(n.problem || '')),
      solutionSet: toSet(tokenize(n.solution || '')),
    });
  }
  return idx;
}

function topOverlap(items, key, limit) {
  const filtered = items.filter((x) => x[key] > 0);
  filtered.sort((a, b) => b[key] - a[key] || a.title.localeCompare(b.title));
  return filtered.slice(0, limit).map((x) => ({ id: x.id, title: x.title, score: x[key] }));
}

export function suggestForNoteId(notes, id, limit = 5) {
  const idx = indexNotes(notes);
  const cur = idx.get(id);
  if (!cur) return null;
  const others = Array.from(idx.values()).filter((x) => x.id !== id);

  const scored = others.map((o) => ({
    id: o.id,
    title: o.title,
    probProb: overlapCount(cur.problemSet, o.problemSet),
    solSol: overlapCount(cur.solutionSet, o.solutionSet),
    solToProb: overlapCount(cur.solutionSet, o.problemSet),
    probToSol: overlapCount(cur.problemSet, o.solutionSet),
  }));

  return {
    problem_similar: topOverlap(scored, 'probProb', limit),
    solution_similar: topOverlap(scored, 'solSol', limit),
    solution_to_problem: topOverlap(scored, 'solToProb', limit),
    problem_to_solution: topOverlap(scored, 'probToSol', limit),
  };
}

export function suggestForDraft(notes, draft, limit = 5, excludeId = undefined) {
  const idx = indexNotes(notes);
  const curProblem = toSet(tokenize(draft.problem || ''));
  const curSolution = toSet(tokenize(draft.solution || ''));
  const others = Array.from(idx.values()).filter((o) => !excludeId || o.id !== excludeId);

  const scored = others.map((o) => ({
    id: o.id,
    title: o.title,
    probProb: overlapCount(curProblem, o.problemSet),
    solSol: overlapCount(curSolution, o.solutionSet),
    solToProb: overlapCount(curSolution, o.problemSet),
    probToSol: overlapCount(curProblem, o.solutionSet),
  }));

  return {
    problem_similar: topOverlap(scored, 'probProb', limit),
    solution_similar: topOverlap(scored, 'solSol', limit),
    solution_to_problem: topOverlap(scored, 'solToProb', limit),
    problem_to_solution: topOverlap(scored, 'probToSol', limit),
  };
}
