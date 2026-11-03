// temp check: replicate getSubjectMaxima + regular cell display for ICT
const getSubjectMaxima = (name, isNT, group = '') => {
  let lower = String(name || '').toLowerCase();
  const g = String(group || '').toLowerCase();
  if (lower.includes('/') && g) {
      const parts = lower.split('/');
      const sciPool = ['physics', 'chemistry', 'biology', 'higher', 'পদার্থ', 'রসায়ন', 'রসায়ন', 'জীব', 'উচ্চতর'];
      const comPool = ['accounting', 'finance', 'business', 'হিসাব', 'ফিন্যান্স', 'ব্যবসায়', 'ব্যবসায়', 'entrepreneurship', 'উদ্যোগ'];
      const humPool = ['history', 'geography', 'civics', 'economics', 'ইতিহাস', 'ভূগোল', 'পৌরনীতি', 'পৌরণীতি', 'অর্থনীতি'];
      let found = '';
      if (g.includes('science')) found = parts.find(p => sciPool.some(kw => p.includes(kw)));
      else if (g.includes('commerce') || g.includes('business')) found = parts.find(p => comPool.some(kw => p.includes(kw)));
      else if (g.includes('arts') || g.includes('humanities') || g.includes('manobik') || g.includes('মানবিক')) found = parts.find(p => humPool.some(kw => p.includes(kw)));
      if (found) lower = found.trim();
  }
  if (lower.includes('বাংলা') || lower.includes('bangla')) {
    if (isNT && (lower.includes('১ম+২য়') || lower.includes('1st+2nd'))) return { cq: 140, mcq: 60, pr: 0 };
    if (!isNT && (lower.includes('২য়') || lower.includes('২য়') || lower.includes('2nd') || lower.includes('second') || lower.includes('ii'))) return { cq: 50, mcq: 0, pr: 0 };
    if (!isNT) return { cq: 100, mcq: 30, pr: 0 };
    return { cq: 70, mcq: 30, pr: 0 };
  }
  if (lower.includes('english') || lower.includes('ইংরেজি') || lower.includes('ইংরেজী') || lower.includes('eng')) {
    if (isNT && (lower.includes('১ম+২য়') || lower.includes('1st+2nd'))) return { cq: 200, mcq: 0, pr: 0 };
    if (isNT) return { cq: 100, mcq: 0, pr: 0 };
    if (!isNT && (lower.includes('২য়') || lower.includes('২য়') || lower.includes('2nd') || lower.includes('second') || lower.includes('ii'))) return { cq: 50, mcq: 0, pr: 0 };
    return { cq: 100, mcq: 0, pr: 0 };
  }
  if (lower.includes('ict') || lower.includes('তথ্য') || lower.includes('information') || lower.includes('যোগাযোগ')) {
    return isNT ? { cq: 0, mcq: 25, pr: 25 } : { cq: 10, mcq: 15, pr: 25 };
  }
  const isPracticalScience = lower.includes('পদার্থ') || lower.includes('physics') || lower.includes('রসায়ন') || lower.includes('রসায়ন') || lower.includes('chemistry') || lower.includes('জীব') || lower.includes('biology') || lower.includes('উচ্চতর') || lower.includes('higher');
  const isAgriHome = lower.includes('কৃষি') || lower.includes('agriculture') || lower.includes('গার্হস্থ্য') || lower.includes('home science') || lower.includes('home economics');
  const isCA = lower.includes('শারীরিক') || lower.includes('physical') || lower.includes('career') || lower.includes('ক্যারিয়ার') || lower.includes('ক্যারিয়ার') || lower.includes('word') || lower.includes('book') || lower.includes('পড়া') || lower.includes('পড়া') || lower.includes('achievement');
  if (isNT) {
    if (isPracticalScience || isAgriHome) return { cq: 50, mcq: 25, pr: 25 };
    if (isCA) return { cq: 0, mcq: 0, pr: 100 };
  } else {
    if (isPracticalScience) return { cq: 50, mcq: 25, pr: 25 };
    if (isAgriHome) return { cq: 35, mcq: 15, pr: 0 };
    if (isCA) return { cq: 0, mcq: 0, pr: 50 };
    if (lower.includes('ধর্ম') || lower.includes('religion') || lower.includes('islam') || lower.includes('hindu') || lower.includes('ইসলাম') || lower.includes('হিন্দ')) return { cq: 100, mcq: 30, pr: 0 };
    return { cq: 100, mcq: 30, pr: 0 };
  }
  return isNT ? { cq: 70, mcq: 30, pr: 0 } : { cq: 100, mcq: 30, pr: 0 };
};

const isPrimaryClass = false;
const isClassNineOrTen = true;
const stuGroup = 'science';

const rows = [
  { name: 'তথ্য ও যোগাযোগ প্রযুক্তি', written_marks: '0.00', mcq_marks: '9.00', practical_marks: '25.00', total_obtained: '34.00', hasMarks: true },
  { name: 'ইসলাম ও নৈতিক শিক্ষা', written_marks: '51.00', mcq_marks: '22.00', practical_marks: null, total_obtained: '73.00', hasMarks: true },
];
for (const r of rows) {
  const w = parseFloat(r.written_marks)||0, mcq = parseFloat(r.mcq_marks)||0, pr = parseFloat(r.practical_marks)||0, has = r.hasMarks;
  const spec = getSubjectMaxima(r.name, isClassNineOrTen, stuGroup);
  const totalPossible = (spec.cq + spec.mcq + spec.pr || 100);
  let tot = (w + mcq + pr) > 0 ? (w + mcq + pr) : (parseFloat(r.total_obtained) || 0);
  if (tot > totalPossible) tot = totalPossible;
  const p = [];
  if (spec.cq > 0) p.push(r.written_marks !== '' && r.written_marks !== null ? Math.round(w) : '0');
  if (spec.mcq > 0 && !isPrimaryClass) p.push(r.mcq_marks !== '' && r.mcq_marks !== null ? Math.round(mcq) : '0');
  if (spec.pr > 0) p.push(r.practical_marks !== '' && r.practical_marks !== null ? Math.round(pr) : '0');
  const displayStr = !has ? 'Absent' : isPrimaryClass ? 'x' : (tot > 0 ? (p.length > 1 ? `${Math.round(tot)} = ${p.join('+')}` : String(Math.round(tot))) : '0');
  console.log(r.name, '| spec=', JSON.stringify(spec), '| p=', JSON.stringify(p), '| display=', displayStr);
}
