import fs from 'fs';

const src = fs.readFileSync('frontend/src/pages/ClassResultsPage.jsx', 'utf8');

// Extract the real SPECIFIC_PAPER_PAT and normalizeSubjKey from the source file
const patLine = src.split('\n').find(l => l.includes('const SPECIFIC_PAPER_PAT ='));
const SPECIFIC_PAPER_PAT = eval(patLine.match(/const SPECIFIC_PAPER_PAT = (\/.*\/i);/)[1]);
console.log('SPECIFIC_PAPER_PAT:', SPECIFIC_PAPER_PAT.source);

const start = src.indexOf('const normalizeSubjKey = (n) => {');
const end = src.indexOf('const isScienceGroup =');
const fnBody = src.slice(start, end);
const normalizeSubjKey = eval('(' + fnBody.replace(/const normalizeSubjKey = /, '').trim().replace(/;$/, '') + ')');

const data = JSON.parse(fs.readFileSync('scratch/_exam1655.json', 'utf8'));
const sumStr = (s) => String(s || '').split('+').reduce((a, v) => a + (parseFloat(v) || 0), 0);

console.log('--- normalized keys (unique) ---');
console.log([...new Set(data.map(r => normalizeSubjKey(r.subject?.name || '')))].join(' | '));

const byStu = new Map();
for (const r of data) {
    const sid = String(r.student?.id ?? r.student);
    if (!byStu.has(sid)) byStu.set(sid, []);
    byStu.get(sid).push(r);
}

let withoutEnglish = 0;
for (const [sid, list] of byStu) {
    const subjectMap = new Map();
    const stuRes = list;
    for (const r of stuRes) {
        const rawName = String(r.subject?.name || '').toLowerCase().trim();
        const key = normalizeSubjKey(rawName);
        const isCombined = !SPECIFIC_PAPER_PAT.test(rawName);
        const hasSpecificPapers = stuRes.some(x => {
            const xName = String(x.subject?.name || '').toLowerCase();
            const xKey = normalizeSubjKey(xName);
            return (xKey.startsWith(key.split('_')[0]) && SPECIFIC_PAPER_PAT.test(xName)) || xKey === key + '_p1' || xKey === key + '_p2';
        });
        if (isCombined && hasSpecificPapers) { console.log('SKIP combined', sid, rawName, '=> key', key); continue; }
        const hasActual = (r.written_marks !== null && r.written_marks !== undefined) ||
                          (r.mcq_marks !== null && r.mcq_marks !== undefined) ||
                          (r.practical_marks !== null && r.practical_marks !== undefined);
        const w = hasActual ? sumStr(r.written_marks) : 0;
        const m = hasActual ? sumStr(r.mcq_marks) : 0;
        const p = hasActual ? sumStr(r.practical_marks) : 0;
        const rTotal = hasActual ? (w + m + p) : 0;
        const existing = subjectMap.get(key);
        if (!existing || (hasActual && !existing.hasActualMarks) || (hasActual === !!existing.hasActualMarks && rTotal > (existing.total_obtained || 0))) {
            subjectMap.set(key, { ...r, sumW: w, sumM: m, sumP: p, total_obtained: rTotal, standard_key: key, hasActualMarks: hasActual });
        }
    }
    const entries = Array.from(subjectMap.values());
    const e = entries.filter(r => String(r.standard_key || '').toLowerCase().startsWith('english'));
    if (e.length === 0) { withoutEnglish++; console.log('!! NO ENGLISH for', sid, entries.map(x => x.standard_key).join(',')); }
}
console.log('students', byStu.size, 'without english', withoutEnglish);
