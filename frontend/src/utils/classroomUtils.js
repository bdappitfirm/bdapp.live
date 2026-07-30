
const banglaNumberMap = {
  'প্লে': -3, 'Play': -3, 'play': -3,
  'নার্সারি': -2, 'Nursery': -2, 'nursery': -2, 'শিশু': -2,
  'কেজি': -1, 'KG': -1, 'kg': -1, 'কে.জি': -1, 'কে.জি.': -1,
  '১ম': 1, '২য়': 2, '৩য়': 3, '৪র্থ': 4, '৫ম': 5, '৬ষ্ঠ': 6, '৭ম': 7, '৮ম': 8, '৯ম': 9, '১০ম': 10,
  'প্রথম': 1, 'দ্বিতীয়': 2, 'দ্বিতীয়': 2, 'তৃতীয়': 3, 'তৃতীয়': 3, 'চতুর্থ': 4, 'পঞ্চম': 5, 'ষষ্ঠ': 6, 'সপ্তম': 7, 'অষ্টম': 8, 'নবম': 9, 'দশম': 10,
  'একাদশ': 11, 'দ্বাদশ': 12, 'এসএসসি': 13, 'SSC': 13
};

export const getClassOrder = (className) => {
  const name = String(className || '').toLowerCase();

  // Check predefined map
  for (const [key, val] of Object.entries(banglaNumberMap)) {
    if (name.includes(key.toLowerCase())) return val;
  }

  // Try to find numbers
  const match = name.match(/\d+/);
  if (match) return parseInt(match[0], 10);

  return 999;
};

export const sortClassrooms = (classrooms) => {
  if (!Array.isArray(classrooms)) return [];
  return [...classrooms].sort((a, b) => getClassOrder(a.name) - getClassOrder(b.name));
};
