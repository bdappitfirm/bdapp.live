import fs from 'fs';

const src = fs.readFileSync('frontend/src/pages/ClassResultsPage.jsx', 'utf8').split('\n');
const fnCode = src.slice(123, 177).join('\n') + '\n' + src.slice(188, 246).join('\n');
const factory = new Function(`${fnCode}\nreturn { getSubjectMaxima, normalizeSubjKey };`);
const { getSubjectMaxima, normalizeSubjKey } = factory();

const data = JSON.parse(fs.readFileSync('scratch/exam1541.json', 'utf8'));
const isClassNineOrTen = true;
const isPrimaryClass = false;

const byStudent = new Map();
for (const r of data) {
  const sid = String(r.student?.id ?? r.student);
  if (!byStudent.has(sid)) byStudent.set(sid, []);
  byStudent.get(sid).push(r);
}

function cellForICT(rs, group) {
  const r = rs[0];
  const w = parseFloat(r.written_marks) || 0, mcq = parseFloat(r.mcq_marks) || 0, pr = parseFloat(r.practical_marks) || 0;
  const hasActual = (r.written_marks !== '' && r.written_marks !== null) || (r.mcq_marks !== '' && r.mcq_marks !== null) || (r.practical_marks !== '' && r.practical_marks !== null);
  const total = (w + mcq + pr) > 0 ? (w + mcq + pr) : (parseFloat(r.total_obtained) || 0);
  const has = hasActual && total > 0;
  const spec = getSubjectMaxima(r.subject?.name || r.subject_name || '', isClassNineOrTen, group);
  const totalPossible = (spec.cq + spec.mcq + spec.pr || 100);
  let tot = (w + mcq + pr) > 0 ? (w + mcq + pr) : (parseFloat(r.total_obtained) || 0);
  if (tot > totalPossible) tot = totalPossible;
  const p = [];
  if (spec.cq > 0) p.push(r.written_marks !== '' && r.written_marks !== null ? Math.round(w) : '0');
  if (spec.mcq > 0 && !isPrimaryClass) p.push(r.mcq_marks !== '' && r.mcq_marks !== null ? Math.round(mcq) : '0');
  if (spec.pr > 0) p.push(r.practical_marks !== '' && r.practical_marks !== null ? Math.round(pr) : '0');
  const displayStr = !has ? 'Absent' : (tot > 0 ? (p.length > 1 ? `${Math.round(tot)} = ${p.join('+')}` : String(Math.round(tot))) : '0');
  return { spec, p, displayStr, has };
}

let n = 0;
for (const [sid, rs] of byStudent) {
  const ict = rs.filter(r => normalizeSubjKey(r.subject?.name || '') === 'ict');
  if (ict.length === 0) continue;
  const out = cellForICT(ict, 'science');
  if (n < 8) console.log(sid, JSON.stringify(out));
  n++;
}
console.log('total students with ICT:', n);
