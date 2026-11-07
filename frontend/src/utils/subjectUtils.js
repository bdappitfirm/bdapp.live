// subjectUtils.js - Standard subject ordering and weighting for Bangladeshi school curriculum

export const getSubjectOrderWeight = (r, isOptional = false, group = '') => {
  if (!r) return 9999;
  if (isOptional) return 1000;
  const name = typeof r === 'string' ? r : (r.name || r.subject_name || r.subject?.name || '');
  const rawName = String(name).replace(/\s*\(.*?\)\s*/g, '').trim();
  const subLower = rawName.toLowerCase();
  const clean = subLower.replace(/\u200d/g, '').replace(/\s+/g, ' ').trim();
  const g = String(group || '').toLowerCase();

  // 1. Core Common Subjects
  if (r.id === 'merged-bangla' || (clean.includes('বাংলা') && !clean.includes('বাংলাদেশ') && !clean.includes('দেশ')) || (clean.includes('bangla') && !clean.includes('bangladesh'))) return 10;
  if (r.id === 'merged-english' || clean.includes('english') || clean.includes('ইংরেজি') || clean.includes('ইংরেজী')) return 20;
  if (clean.includes('গণিত') || clean.includes('math')) {
      if (clean.includes('উচ্চতর') || clean.includes('higher')) return 1000;
      return 30;
  }
  if (clean.includes('ইসলাম') || clean.includes('islam') || clean.includes('ধর্ম') || clean.includes('religion')) return 40;
  if (clean.includes('আইসিটি') || clean.includes('ict') || clean.includes('তথ্য')) return 50;

  // 2. Bangladesh and Global Studies (BGS)
  if (clean.includes('বাংলাদেশ') || clean.includes('বিশ্বপরিচয়') || clean.includes('bgs') || clean.includes('global studies') || clean.includes('bangladesh') || clean.includes('সামাজিক')) return 60;

  // 3. Group Specific Logic
  if (g.includes('science') || g.includes('বিজ্ঞান')) {
      if (clean.includes('পদার্থ') || clean.includes('physics')) return 70;
      if (clean.includes('রসায়ন') || clean.includes('chemistry')) return 80;
      if (clean.includes('জীব') || clean.includes('biology')) return 90;
  } else if (g.includes('commerce') || g.includes('business') || g.includes('ব্যবসায়')) {
      if (clean.includes('বিজ্ঞান') || clean.includes('science')) return 65;
      if (clean.includes('হিসাব') || clean.includes('accounting')) return 70;
      if (clean.includes('ফিন্যান্স') || clean.includes('finance')) return 80;
      if (clean.includes('ব্যবসায়') || clean.includes('business')) return 90;
  } else if (g.includes('arts') || g.includes('humanities') || g.includes('মানবিক')) {
      if (clean.includes('বিজ্ঞান') || clean.includes('science')) return 65;
      if (clean.includes('ইতিহাস') || clean.includes('history')) return 70;
      if (clean.includes('পৌরনীতি') || clean.includes('civics')) return 80;
      if (clean.includes('ভূগোল') || clean.includes('geography')) return 90;
  } else {
      if (clean.includes('পদার্থ') || clean.includes('physics')) return 70;
      if (clean.includes('রসায়ন') || clean.includes('chemistry')) return 80;
      if (clean.includes('জীব') || clean.includes('biology')) return 90;
      if (clean.includes('হিসাব') || clean.includes('accounting')) return 70;
      if (clean.includes('ফিন্যান্স') || clean.includes('finance')) return 80;
      if (clean.includes('ব্যবসায়') || clean.includes('business')) return 90;
      if (clean.includes('ইতিহাস') || clean.includes('history')) return 70;
      if (clean.includes('পৌরনীতি') || clean.includes('civics')) return 80;
      if (clean.includes('ভূগোল') || clean.includes('geography')) return 90;
  }

  if (clean.includes('কৃষি') || clean.includes('agriculture') || clean.includes('গার্হস্থ্য') || clean.includes('home science')) return 500;

  return 200 + clean.length;
};

export const sortSubjectsArray = (arr, group = '') => {
  if (!Array.isArray(arr) || arr.length === 0) return arr;
  const weighted = arr.map(item => ({
    item,
    weight: getSubjectOrderWeight(item, item.is_optional_detected, group)
  }));
  return weighted.sort((a, b) => {
    if (a.weight !== b.weight) return a.weight - b.weight;
    const na = String(a.item?.name || a.item?.subject_name || a.item?.subject?.name || '').toLowerCase();
    const nb = String(b.item?.name || b.item?.subject_name || b.item?.subject?.name || '').toLowerCase();
    return na.localeCompare(nb, 'bn', { sensitivity: 'base' });
  }).map(x => x.item);
};
