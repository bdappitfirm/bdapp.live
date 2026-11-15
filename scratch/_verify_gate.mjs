// Verify the paper-aware gate fix against real rows (exam 1689, class 133).
// Replicates normalizeSubjKeyLocal + BN_2ND_REGEX + old/new countSubjectsWithMarks.
import fs from 'fs';

const BN_2ND_REGEX = /(২য়|২য়|2nd|second|দ্বিতীয়|দ্বিতীয়|\bii\b| 2)/i;
const sumStr = (s) => String(s ?? '').split('+').reduce((a, v) => a + (parseFloat(v) || 0), 0);

// faithful subset of normalizeSubjKeyLocal for the subjects present in this dataset
const normalizeSubjKeyLocal = (n) => {
  const low = String(n).toLowerCase().trim();
  if (low.includes('higher') || low.includes('উচ্চতর')) return 'higher';
  if (low.includes('math') || low.includes('গণিত')) return 'math';
  if (low.includes('history') || low.includes('ইতিহাস') || low.includes('সভ্যতা')) return 'history';
  if (low.includes('bgs') || (low.includes('বাংলাদেশ') && (low.includes('পরিচয়') || low.includes('পরিচয়'))) || low.includes('global studies')) return 'bgs';
  if ((low.includes('bangla') || low.includes('বাংলা')) && !low.includes('বাংলাদেশ') && !low.includes('bangladesh')) return 'bangla';
  if (low.includes('english') || low.includes('ইংরেজি') || low.includes('ইংরেজী')) return 'english';
  if (low.includes('religion') || low.includes('islam') || low.includes('hindu') || low.includes('ধর্ম') || low.includes('ইসলাম') || low.includes('হিন্দু') || low.includes('moral') || low.includes('নৈতিক')) return 'religion';
  if (low.includes('ict') || low.includes('তথ্য') || low.includes('information') || low.includes('communication') || low.includes('technology')) return 'ict';
  if (low.includes('physics') || low.includes('পদার্থ')) return 'physics';
  if (low.includes('chemistry') || low.includes('রসায়ন') || low.includes('রসায়ন')) return 'chemistry';
  if (low.includes('biology') || low.includes('জীব')) return 'biology';
  if (low.includes('agriculture') || low.includes('কৃষি') || low.includes('home') || low.includes('গার্হস্থ্য')) return 'agriculture';
  if (low.includes('accounting') || low.includes('হিসাব')) return 'accounting';
  if (low.includes('finance') || low.includes('ফিন্যান্স')) return 'finance';
  if (low.includes('business') || low.includes('ব্যবসায়') || low.includes('ব্যবসায়') || low.includes('entrepreneurship') || low.includes('উদ্যোগ')) return 'business';
  if (low.includes('geography') || low.includes('ভূগোল') || low.includes('ভুগোল')) return 'geography';
  if (low.includes('civics') || low.includes('পৌরনীতি') || low.includes('পৌরণীতি')) return 'civics';
  if (low.includes('economics') || low.includes('অর্থনীতি')) return 'economics';
  if ((low.includes('science') || low.includes('বিজ্ঞান')) && !low.includes('social') && !low.includes('সমাজ')) return 'science';
  return low;
};

const countOld = (rows) => {
  const keys = new Set();
  rows.forEach(r => {
    const w = sumStr(r.written_marks), m = sumStr(r.mcq_marks), p = sumStr(r.practical_marks);
    const tot = parseFloat(r.total_obtained) || 0;
    if ((w + m + p) <= 0 && tot <= 0) return;
    const key = normalizeSubjKeyLocal(r.subject_name || '');
    if (!key) return;
    keys.add(String(key).split('_')[0]);          // OLD: bangla ১ম+২য় collapse
  });
  return keys.size;
};

const hasDataEntryLocal = (r) => {
  if (!r) return false;
  const w = r.written_marks;
  const m = r.mcq_marks;
  const p = r.practical_marks;
  const tot = parseFloat(r.total_obtained);
  return (w !== null && w !== undefined && String(w).trim() !== '') ||
         (m !== null && m !== undefined && String(m).trim() !== '') ||
         (p !== null && p !== undefined && String(p).trim() !== '') ||
         (Number.isFinite(tot) && tot > 0);
};

const countNew = (rows) => {
  const keys = new Set();
  rows.forEach(r => {
    if (!hasDataEntryLocal(r)) return;
    const name = r.subject_name || '';
    let key = normalizeSubjKeyLocal(name);
    if (!key) return;
    if (key === 'bangla' || key === 'english') key = key + (BN_2ND_REGEX.test(String(name)) ? '_p2' : '_p1');
    keys.add(key);
  });
  return keys.size;
};

const MIN = 3;
const data = JSON.parse(fs.readFileSync('scratch/_rows1689.json', 'utf-8'));

let oldPass = 0, newPass = 0, bothZero = 0;
const newlyPassing = [];
for (const [sid, rows] of Object.entries(data)) {
  const o = countOld(rows), n = countNew(rows);
  if (o >= MIN) oldPass++;
  if (n >= MIN) newPass++;
  if (n >= MIN && o < MIN) newlyPassing.push(`${sid} (old ${o} -> new ${n})`);
  if (o === 0 && n === 0) bothZero++;
}
console.log('students in exam 1689 / class 133 :', Object.keys(data).length);
console.log('pass OLD gate (bangla merged)   :', oldPass);
console.log('pass NEW gate (paper-aware)     :', newPass);
console.log('students with NO marks at all   :', bothZero, '(still blocked, correct)');
console.log('\nnewly unblocked students:', newlyPassing.join(', ') || '(none)');
console.log('\nsample 2126 old/new:', countOld(data['2126'] || []), '/', countNew(data['2126'] || []));
