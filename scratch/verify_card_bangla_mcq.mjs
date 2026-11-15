// Verify: AcademicTranscriptCard Bangla MCQ gate for English-translated subject names.
// translator.py maps 'বাংলা' -> 'Bengali', 'বাংলা প্রথম পত্র' -> 'Bengali 1st Paper'.

const getSubjectMaximaOld = (name, isClassNineOrTen, group = '') => {
  const lower = String(name || '').toLowerCase();
  if (lower.includes('বাংলা') || lower.includes('bangla')) {
    if (isClassNineOrTen && (lower.includes('১ম+২য়') || lower.includes('1st+2nd'))) return { cq: 140, mcq: 60, pr: 0 };
    if (!isClassNineOrTen && (lower.includes('২য়') || lower.includes('2nd') || lower.includes('second') || lower.includes('ii'))) return { cq: 35, mcq: 15, pr: 0 };
    return { cq: 70, mcq: 30, pr: 0 };
  }
  if (lower.includes('english') || lower.includes('ইংরেজি') || lower.includes('eng')) {
    if (isClassNineOrTen && (lower.includes('১ম+২য়') || lower.includes('1st+2nd'))) return { cq: 200, mcq: 0, pr: 0 };
    if (isClassNineOrTen) return { cq: 100, mcq: 0, pr: 0 };
    return { cq: 100, mcq: 0, pr: 0 };
  }
  return { cq: 70, mcq: 30, pr: 0 };
};

const getSubjectMaximaNew = (name, isClassNineOrTen, group = '') => {
  const lower = String(name || '').toLowerCase();
  if (lower.includes('বাংলা') || lower.includes('bangla') || lower.includes('bengali')) {
    if (isClassNineOrTen && (lower.includes('১ম+২য়') || lower.includes('1st+2nd'))) return { cq: 140, mcq: 60, pr: 0 };
    if (!isClassNineOrTen && (lower.includes('২য়') || lower.includes('2nd') || lower.includes('second') || lower.includes('ii'))) return { cq: 35, mcq: 15, pr: 0 };
    return { cq: 70, mcq: 30, pr: 0 };
  }
  if (lower.includes('english') || lower.includes('ইংরেজি') || lower.includes('eng')) {
    if (isClassNineOrTen && (lower.includes('১ম+২য়') || lower.includes('1st+2nd'))) return { cq: 200, mcq: 0, pr: 0 };
    if (isClassNineOrTen) return { cq: 100, mcq: 0, pr: 0 };
    return { cq: 100, mcq: 0, pr: 0 };
  }
  return { cq: 70, mcq: 30, pr: 0 };
};

const isBanglaOld = (n) => { const s = String(n || '').toLowerCase(); return s.includes('বাংলা') || s.includes('bangla'); };
const isBanglaNew = (n) => { const s = String(n || '').toLowerCase(); return s.includes('বাংলা') || s.includes('bangla') || s.includes('bengali'); };

const names = ['Bengali', 'Bengali 1st Paper', 'Bengali 2nd Paper', 'Bangla (1st+2nd)', 'বাংলা', 'বাংলা প্রথম পত্র', 'বাংলা দ্বিতীয় পত্র', 'English 1st Paper', 'BGS', 'বাংলাদেশ ও বিশ্বপরিচয়'];

console.log('name'.padEnd(26), '| merged-detect OLD/NEW | spec OLD -> NEW (class 9-10)');
for (const n of names) {
  const o = getSubjectMaximaOld(n, true);
  const w = getSubjectMaximaNew(n, true);
  const mcqCell = (spec) => (spec.mcq > 0 ? 'shows number' : '--');
  console.log(
    n.padEnd(26),
    '|', String(isBanglaOld(n)).padEnd(5), '/', String(isBanglaNew(n)).padEnd(5),
    '|', JSON.stringify(o).padEnd(28), '->', JSON.stringify(w).padEnd(28),
    '| MCQ cell OLD:', mcqCell(o), ' NEW:', mcqCell(w)
  );
}
