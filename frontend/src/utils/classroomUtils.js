// দ্রষ্টব্য: JavaScript-এ \b শুধু ASCII শব্দ-অক্ষরের (A-Za-z0-9_) জন্য কাজ করে;
// বাংলা অক্ষর \w নয় — তাই বাংলা শব্দের আগে \b দিলে প্যাটার্নটি কখনোই ম্যাচ করে না।
// এজন্য বাংলা alternative-গুলোর আগে \b ব্যবহার করা হয়নি, শুধু ASCII-র জন্য রাখা হয়েছে।
const BANGLA_CLASS_ORDER_PATTERNS = [
  [/প্লে|play/i, 1],
  [/নুরানী/i, 2],
  [/নাযেরা|হিফজ/i, 3],
  [/নাসারী|নার্সারি|nursery|শিশু|shishu/i, 4],
  [/কেজি|\bkg\b/i, 5],
  [/প্রথম|১ম|\b1st\b|class\s*1(?!\d)|\bone\b/i, 6],
  [/দ্বিতীয়|দ্বীতিয়|দ্বীতিয়|দ্বিতীয়|২য়|২য়|\b2nd\b|class\s*2(?!\d)|\btwo\b/i, 7],
  [/তৃতীয়|তৃতীয়|৩য়|৩য়|\b3rd\b|class\s*3(?!\d)|\bthree\b/i, 8],
  [/চতুর্থ|৪র্থ|\b4th\b|class\s*4(?!\d)|\bfour\b/i, 9],
  [/পঞ্চম|৫ম|\b5th\b|class\s*5(?!\d)|\bfive\b/i, 10],
  [/ষষ্ঠ|৬ষ্ঠ|\b6th\b|class\s*6(?!\d)|\bsix\b/i, 11],
  [/সপ্তম|৭ম|\b7th\b|class\s*7(?!\d)|\bseven\b/i, 12],
  [/অষ্টম|৮ম|অস্টম|\b8th\b|class\s*8(?!\d)|\beight\b/i, 13],
  [/নবম\s*-\s*দশম/i, 14],
  [/নবম|৯ম|\b9th\b|class\s*9(?!\d)|\bnine\b/i, 15],
  [/দশম|১০ম|\b10th\b|class\s*10(?!\d)|\bten\b/i, 16],
  [/এস\.এস\.সি|এসএসসি|s\.s\.c|ssc|পরীক্ষার্থী/i, 17],
  [/একাদশ|১১শ|\b11th\b|class\s*11(?!\d)|\beleven\b/i, 18],
  [/দ্বাদশ|১২তম|১২-তম|\b12th\b|class\s*12(?!\d)|\btwelve\b/i, 19],
  [/এইচএসসি|hsc|আলিম|আলীম/i, 20],
  [/নন-শিক্ষা|স্নাতক|ফাজেল|কামেল/i, 21],
];

export const getClassroomYear = (className) => {
  if (!className) return null;
  const n = String(className).normalize('NFKC').trim();
  const bnMap = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
  const engName = n.replace(/[০-৯]/g, d => bnMap[d] || d);
  const match = engName.match(/(19|20)\d{2}/);
  return match ? parseInt(match[0], 10) : null;
};

export const filterClassroomsByYear = (classrooms, targetYear) => {
  if (!Array.isArray(classrooms)) return [];
  if (!targetYear) return classrooms;
  const targetYearNum = parseInt(String(targetYear), 10);
  if (Number.isNaN(targetYearNum)) return classrooms;

  return classrooms.filter(cls => {
    const clsYear = getClassroomYear(cls?.name);
    if (clsYear === null) return true;
    return clsYear === targetYearNum;
  });
};

export const filterSectionsByYear = (sections, targetYear) => {
  if (!Array.isArray(sections)) return [];
  if (!targetYear) return sections;
  const targetYearNum = parseInt(String(targetYear), 10);
  if (Number.isNaN(targetYearNum)) return sections;

  return sections.filter(sec => {
    const secYear = getClassroomYear(sec?.name);
    if (secYear === null) return true;
    return secYear === targetYearNum;
  });
};

export const getClassOrder = (className) => {
  if (!className) return { baseRank: 999, is2027: 0, baseName: '' };
  const n = String(className).normalize('NFKC').trim().toLowerCase();
  const is2027 = (n.includes('2027') || n.includes('২০২৭')) ? 1 : 0;
  const baseName = n.replace(/[-–_]?\s*(2027|২০২৭)/gi, '').trim();

  let baseRank = 900;
  for (const [pattern, rank] of BANGLA_CLASS_ORDER_PATTERNS) {
    if (pattern.test(baseName)) {
      baseRank = rank;
      break;
    }
  }

  if (baseRank === 900) {
    const match = baseName.match(/\d+/);
    if (match) baseRank = parseInt(match[0], 10);
  }

  return { baseRank, is2027, baseName };
};

// দুটি ক্লাস-নামের তুলনা করে -1/0/1 ফেরত দেয় (baseRank → is2027 → localeCompare)
export const compareClassOrder = (nameA, nameB) => {
  const orderA = getClassOrder(nameA);
  const orderB = getClassOrder(nameB);
  if (orderA.baseRank !== orderB.baseRank) {
    return orderA.baseRank - orderB.baseRank;
  }
  if (orderA.is2027 !== orderB.is2027) {
    return orderA.is2027 - orderB.is2027;
  }
  return String(nameA || '').localeCompare(String(nameB || ''));
};

export const sortClassrooms = (classrooms) => {
  if (!Array.isArray(classrooms)) return [];
  return [...classrooms].sort((a, b) => compareClassOrder(a?.name, b?.name));
};

export const isSecondaryOrHigherClass = (className) => {
  if (!className) return false;
  return /নবম|দশম|একাদশ|দ্বাদশ|এসএসসি|এইচএসসি|দাখিল|আলিম|এস[\s.]*?এস[\s.]*?সি|এইচ[\s.]*?এইচ[\s.]*?সি|পরীক্ষার্থী|\b(nine|ten|eleven|twelve|ssc|hsc|dakhil|alim|ix|x|xi|xii|9|10|11|12)\b/i.test(String(className)) || /s\.?\s*?s\.?\s*?c/i.test(String(className));
};
