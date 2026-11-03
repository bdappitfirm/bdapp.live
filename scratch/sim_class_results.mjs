import fs from 'fs';

const normalizeSubjKey = (n) => {
    const low = String(n).toLowerCase().trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
    const is2 = /([- ](২য়|২য়|২য়|2nd|second|ii|দ্বি[তত]ীয|দ্বিতীয়|দ্বিতীয়)(\s|$))|(\bii\b)/i.test(low);
    const has1 = /([- ]([১1]ম|1st|first|i|প্রথম)(\s|$))|(\bi\b)/i.test(low);
    if (low.includes('higher') || low.includes('উচ্চতর')) return 'higher';
    if (low.includes('math') || low.includes('গণিত') || low.includes('গনিত')) return 'math';
    if (low.includes('history') || low.includes('ইতিহাস') || low.includes('সভ্যতা')) return 'history';
    if ((low.includes('bangla') || low.includes('বাংলা')) && !low.includes('বাংলাদেশ') && !low.includes('bangladesh')) {
        if (is2 && !has1) return 'bangla_p2';
        if (has1 && !is2) return 'bangla_p1';
        if (is2 && has1) return 'bangla_combined';
        return 'bangla';
    }
    if (low.includes('english') || low.includes('ইংরেজি') || low.includes('ইংরেজী')) {
        if (is2 && !has1) return 'english_p2';
        if (has1 && !is2) return 'english_p1';
        if (is2 && has1) return 'english_combined';
        return 'english';
    }
    return low;
};

const data = JSON.parse(fs.readFileSync('scratch/exam1541.json', 'utf8'));
const byStu = new Map();
for (const r of data) {
    const sid = String(r.student?.id ?? r.student);
    if (!byStu.has(sid)) byStu.set(sid, []);
    byStu.get(sid).push(r);
}

const sumStr = (s) => String(s || '').split('+').reduce((a, v) => a + (parseFloat(v) || 0), 0);

let agg = {};
for (const [sid, list] of byStu) {
    // dedup by normalized key (mirrors subjectMap)
    const subjectMap = new Map();
    for (const r of list) {
        const rawName = String(r.subject?.name || '').toLowerCase().trim();
        const key = normalizeSubjKey(rawName);
        const w = sumStr(r.written_marks), m = sumStr(r.mcq_marks), p = sumStr(r.practical_marks);
        const hasActual = (r.written_marks !== null) || (r.mcq_marks !== null) || (r.practical_marks !== null);
        const rTotal = hasActual ? (w + m + p) : 0;
        const existing = subjectMap.get(key);
        if (!existing || rTotal > (existing.total_obtained || 0)) {
            subjectMap.set(key, { ...r, sumW: w, sumM: m, sumP: p, total_obtained: rTotal, standard_key: key });
        }
    }
    const entries = Array.from(subjectMap.values());
    const b = entries.filter(r => (r.standard_key || '').startsWith('bangla'));
    if (b.length === 0) continue;
    const cqParts = b.map(r => Math.round(parseFloat(r.written_marks) || 0));
    const mcqParts = b.map(r => Math.round(parseFloat(r.mcq_marks) || 0));
    const cqDisp = cqParts.length > 1 ? cqParts.join('+') : String(cqParts.reduce((s, v) => s + v, 0));
    const mcqDisp = mcqParts.length > 1 ? mcqParts.join('+') : String(mcqParts.reduce((s, v) => s + v, 0));
    const keys = b.map(r => r.standard_key + ':' + r.subject.name).join(' | ');
    const label = `${cqDisp} / ${mcqDisp}`;
    agg[label] = (agg[label] || 0) + 1;
    if (b.length < 2) console.log('SINGLE-PAPER student', sid, label, '=>', keys);
}
console.log('--- distribution of (cqDisp / mcqDisp) ---');
Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([k, v]) => console.log(v, k));
console.log('total students', byStu.size);
