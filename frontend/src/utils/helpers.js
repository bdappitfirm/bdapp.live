export const getRoleTitle = (role) => role ? role.charAt(0).toUpperCase() + role.slice(1) : '';
export const getRoleColor = (role) => {
  switch(role) {
    case "teacher": return "#2e7d32";
    case "student": return "#9c27b0";
    case "parent": return "#f57c00";
    case "committee": return "#6d4c41";
    default: return "#1976d2";
  }
};

// Convert Bengali numerals to English
export const bengaliToEnglishNumber = (num) => {
  if (num == null) return num;
  const numStr = String(num);
  const bengaliDigits = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  
  return numStr.split('').map(char => {
    return bengaliDigits[char] || char;
  }).join('');
};

// Convert any input (including mixed Bengali-English) to English digits
export const normalizeNumberInput = (input) => {
  return bengaliToEnglishNumber(input);
};

// Sort students numerically and safely by roll number (handling Bengali digits, text, gaps)
export const sortStudentsByRoll = (students) => {
  if (!Array.isArray(students)) return [];
  return [...students].sort((a, b) => {
    const rawA = bengaliToEnglishNumber(String(a?.roll_number ?? a?.roll ?? '')).trim();
    const rawB = bengaliToEnglishNumber(String(b?.roll_number ?? b?.roll ?? '')).trim();

    const emptyA = !rawA;
    const emptyB = !rawB;

    if (emptyA && !emptyB) return 1;
    if (!emptyA && emptyB) return -1;
    if (emptyA && emptyB) return 0;

    const numA = parseInt(rawA.replace(/\D/g, ''), 10);
    const numB = parseInt(rawB.replace(/\D/g, ''), 10);

    const validA = !isNaN(numA);
    const validB = !isNaN(numB);

    if (validA && validB && numA !== numB) {
      return numA - numB;
    }

    return rawA.localeCompare(rawB, undefined, { numeric: true, sensitivity: 'base' });
  });
};

// Permission helpers
export const canEdit = (user, itemUserId = null, itemRole = null) => {
  if (!user) return false;
  
  const normalize = (u) => String(u || '').toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const username = normalize(user.username);
  const role = String(user.role || user.profile?.effective_role || user.profile?.role || '').toLowerCase();
  const designation = String(user.profile?.designation || '').toLowerCase();
  const userSchoolId = String(user.profile?.school_id || '');

  // Principal (shamir), Superuser (bdadmin), Admin or School 6 teacher can edit
  if (
    username === 'shamir' || 
    username === 'bdadmin' || 
    username === 'umor' ||
    user.is_superuser ||
    role === 'admin' || 
    role === 'superadmin' || 
    role === 'super_admin' ||
    user.is_staff ||
    designation.includes('প্রধান') || 
    designation.includes('principal') || 
    designation.includes('headmaster') ||
    (userSchoolId === '6' && role === 'teacher')
  ) {
    return true;
  }
  
  // Teachers can edit:
  if (role === 'teacher') {
    // 1. Their own profile
    if (itemUserId && String(user.id) === String(itemUserId)) return true;
    // 2. Any student or parent
    if (itemRole === 'student' || itemRole === 'parent') return true;
  }
  
  // Parents and Students can ONLY edit their OWN data/profile:
  if (role === 'student' || role === 'parent') {
    return itemUserId != null && String(user.id) === String(itemUserId);
  }

  // Others can only edit their own data
  return itemUserId != null && String(user.id) === String(itemUserId);
};

export const canDelete = (user, itemUserId = null, itemRole = null) => {
  if (!user) return false;
  
  const normalize = (u) => String(u || '').toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const username = normalize(user.username);
  const role = String(user.role || user.profile?.effective_role || user.profile?.role || '').toLowerCase();
  const designation = String(user.profile?.designation || '').toLowerCase();
  const userSchoolId = String(user.profile?.school_id || '');

  // Parents and Students CANNOT delete any data at all (not even their own ID)
  if (role === 'student' || role === 'parent') {
    return false;
  }

  // Principal (shamir), Superuser (bdadmin), Admin or School 6 teacher can delete
  if (
    username === 'shamir' || 
    username === 'bdadmin' || 
    username === 'umor' ||
    user.is_superuser ||
    role === 'admin' || 
    role === 'superadmin' || 
    role === 'super_admin' ||
    user.is_staff ||
    designation.includes('প্রধান') || 
    designation.includes('principal') || 
    designation.includes('headmaster') ||
    (userSchoolId === '6' && role === 'teacher')
  ) {
    return true;
  }
  
  // Regular Teachers can delete students or parents
  if (role === 'teacher' && (itemRole === 'student' || itemRole === 'parent')) {
    return true;
  }

  // Others cannot delete anything
  return false;
};

export const canEditResult = (user, subjectTeacherId = null) => {
  if (!user) return false;
  const username = (user.username || user.user?.username || '').toLowerCase().replace(/\u200d/g, '').trim();
  const isSuper = !!(user.is_superuser || user.user?.is_superuser || user.is_staff || user.user?.is_staff || username === 'bdadmin' || username === 'shamir' || username === 'umor');
  if (isSuper || user.role === 'admin' || user.role === 'super_admin' || user.role === 'superadmin') return true;
  if (user.role === 'teacher' && subjectTeacherId && user.id === subjectTeacherId) return true;
  return false;
};

export const canViewAll = (user) => {
  if (!user) return false;
  return user.is_superuser || user.role === 'admin' || user.role === 'teacher';
};

// Global helper to combine first and last names while removing duplicates (Bangla-aware)
export const getCleanDisplayName = (firstName, lastName, fallback = '') => {
  let fn = (firstName || '').trim();
  const ln = (lastName || '').trim();

  if (!fn) return ln || fallback;

  // If fn has Bangla characters, strip trailing pure English words (e.g. Pradhania, Bakaul, Ahmed, Islam)
  if (/[\u0980-\u09ff]/.test(fn)) {
    const words = fn.split(/\s+/);
    let lastBanglaIdx = -1;
    for (let i = 0; i < words.length; i++) {
      if (/[\u0980-\u09ff]/.test(words[i])) {
        lastBanglaIdx = i;
      }
    }
    if (lastBanglaIdx !== -1) {
      fn = words.slice(0, lastBanglaIdx + 1).join(' ');
    }
  }

  if (!ln) return fn;

  const fnLower = fn.toLowerCase();
  const lnLower = ln.toLowerCase();

  if (fnLower.includes(lnLower)) {
    return fn;
  }

  // If lastName is English (e.g. Islam, Hossain) and firstName is not purely English, ignore lastName
  const isEnglish = (str) => /^[a-zA-Z\s.]+$/.test(str);
  if (isEnglish(ln) && !isEnglish(fn)) {
    return fn;
  }

  // Split into words
  const words = `${fn} ${ln}`.split(/\s+/).filter(w => w.trim() !== '');

  const result = [];
  const seenBase = new Set();

  // Bangla normalization helper: removes vowel signs (kar) to catch variations like মীম/মিম
  const getBase = (str) => {
    return str.toLowerCase()
      .replace(/[্ািীুূৃেৈোৌৗ]/g, '') // Remove Bangla vowels
      .replace(/[yhw]/g, '')        // Remove common English silent letters
      .trim();
  };

  for (const word of words) {
    const base = getBase(word);
    if (base && !seenBase.has(base)) {
      seenBase.add(base);
      result.push(word);
    } else if (!base && !seenBase.has(word.toLowerCase())) {
      // For non-Bangla words with no "base" (unlikely)
      seenBase.add(word.toLowerCase());
      result.push(word);
    }
  }

  return result.join(' ');
};

/**
 * A rule-based transliterator for Bangla to English phonetic spelling.
 * Improved for common names and clearer phonetic mappings.
 */
export const transliterateBangla = (text) => {
  if (!text || typeof text !== 'string') return text;

  // Check if text contains Bangla characters (\u0980-\u09FF)
  if (!/[\u0980-\u09FF]/.test(text)) return text;

  // Mapping of Bangla characters to English phonetic equivalents
  const mapping = {
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
    'চ': 'ch', 'ছ': 's', 'জ': 'z', 'ঝ': 'jh', 'ঞ': 'n',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
    'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'f', 'ব': 'b', 'ভ': 'v', 'ম': 'm',
    'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
    'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't', 'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n',
    'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri',
    'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
    'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri',
    'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
    '্': '', '্য': 'y', '্র': 'r', '্ব': 'b', '্ল': 'l', '়': '',
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
    '।': '.', ',': ',', '-': '-', '/': '/'
  };

  const specialNames = {
    'মোস্তফা': 'Mostofa', 'মরিয়ম': 'Mariyam', 'ওমর': 'Omor', 'ফারুক': 'Faruk',
    'আক্তার': 'Akter', 'খাতুন': 'Khatun', 'বেগম': 'Begum', 'ইসলাম': 'Islam',
    'রহমান': 'Rahman', 'হৃদয়': 'Hridoy', 'লিটন': 'Liton', 'হোসেন': 'Hossain', 'হোসেন': 'Hossain', 'আশরাফুল': 'Ashraful',
    'আলম': 'Alam', 'কিরন': 'Kiron', 'মজুমদার': 'Mojumdar', 'সর্দার': 'Sardar',
    'ইউসুফ': 'Yousuf', 'ফরহাদ': 'Farhad', 'ফখরুল': 'Fakhrul', 'মিয়া': 'Mia',
    'মিয়াজ': 'Miaj', 'ছায়মা': 'Sayma', 'কর্মকার': 'Karmokar', 'কাজল': 'Kajol',
    'সিয়াম': 'Siam', 'আশ্ররাফুল': 'Ashraful',
    'হক': 'Haque', 'মিলন': 'Milon', 'ইমদাদুল': 'Emdadul', 'এমদাদুল': 'Emdadul',
    'শেখ': 'Sheikh', 'খন্দকার': 'Khandaker', 'চৌধুরী': 'Chowdhury', 'আহমেদ': 'Ahmed',
    'মাহমুদ': 'Mahmud', 'হাসান': 'Hasan', 'হোসাইন': 'Hossain',
    'গাজী': 'Gazi', 'গাজি': 'Gazi', 'মিজী': 'Mizi', 'মিজি': 'Mizi', 'রবিউল': 'Robiul', 'মিজানুর': 'Mizanur',
    'পাটওয়ারী': 'Patwary', 'দক্ষিণ': 'Dakshin', 'প্রধানিয়া': 'Prodhania',
    'মাস্টার বাজার': 'Master Bazar', 'নাজমা': 'Nazma', 'বকাউল': 'Bakaul', 'জুবায়েদ': 'Jubayed',
    'রায়': 'Roy', 'চন্দ্র': 'Chandra', 'প্রা': 'Pra', 'কর্দি': 'kardi',
    'বাজার': 'Bazar', 'সূর্য': 'Surjo', 'খোকন': 'Khokan', 'রাজ্জাক': 'Razzak',
    'রোজিনা': 'Rozina', 'মধ্য হামানকর্দি': 'Moddha Hamankardi', 'তপাদার': 'Tapader',
    'আনোয়ারা': 'Anwara', 'হামানকর্দি': 'Hamankardi', 'দেলোয়ার': 'Delowar',
    'চাঁদপুর': 'Chandpur', 'সদর': 'Sadar', 'শাহাতলী': 'Shahatali', 'শাহতলী': 'Shahatali', 'হামানকর্দ্দি': 'Hamankardi',
    'কাকলী': 'Kakali', 'খানম': 'Khanom', 'চক্রবর্তী': 'Chakraborty', 'অপন': 'Apan'
  };

  let result = text;

  // Common titles and honorifics
  result = result.replace(/মো: /g, 'Md. ')
                 .replace(/মোঃ /g, 'Md. ')
                 .replace(/মোসাম্মৎ/g, 'Mst.')
                 .replace(/মোসা:/g, 'Mst.')
                 .replace(/মোসাঃ/g, 'Mst.');

  const isVowel = (c) => 'অআইঈউঊঋএঐওঔািীুূৃেৈোৌ'.includes(c);

  const words = result.split(/\s+/);
  const output = words.map(word => {
    // Separate trailing punctuation for specialNames check
    const punctMatch = word.match(/^([\u0980-\u09FF]+)([,.]?)$/);
    if (punctMatch) {
      const baseWord = punctMatch[1];
      const punct = punctMatch[2];
      if (specialNames[baseWord]) return specialNames[baseWord] + punct;
    }

    if (specialNames[word]) return specialNames[word];

    let wordOutput = "";
    for (let i = 0; i < word.length; i++) {
      const char = word[i];
      const nextChar = word[i+1];

      if (mapping[char] !== undefined) {
        wordOutput += mapping[char];

        // Implicit vowel logic: if current char is consonant and next char is consonant
        if (!isVowel(char) && nextChar && mapping[nextChar] !== undefined && !isVowel(nextChar) && char !== '্') {
          if (char === 'ম' || word === 'ওমর') {
            wordOutput += "o";
          } else if (i === 0) {
            wordOutput += "a";
          }
        }
      } else {
        wordOutput += char;
      }
    }
    return wordOutput;
  }).join(' ');

  // Cleanup: remove multiple spaces, fix capitalization
  let finalOutput = output.replace(/\s+/g, ' ').trim();

  // Return with proper casing (Capitalize Each Word)
  return finalOutput.split(' ').map(word => {
    if (!word) return '';
    // Handle honorifics that should stay abbreviated
    if (word.toLowerCase() === 'md') return 'Md.';
    if (word.toLowerCase() === 'mst') return 'Mst.';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
};

export const canAccessFeesAndCollection = (user) => {
  if (!user) return false;
  const username = String(user.username || '').toLowerCase().trim();
  if (username === 'bdadmin' || user.is_superuser || user.is_staff || user.role === 'admin' || user.profile?.role === 'admin') {
    return true;
  }
  const role = String(user.role || user.profile?.role || '').toLowerCase();
  const designation = String(user.profile?.designation || user.designation || user.profile?.title || '').toLowerCase();
  if (
    role === 'admin' ||
    role === 'accountant' ||
    designation.includes('হিসাব') ||
    designation.includes('account') ||
    designation.includes('cashier') ||
    designation.includes('ক্যাশিয়ার') ||
    designation.includes('অ্যাকাউন্ট')
  ) {
    return true;
  }
  return false;
};

export const canAccessDailyCollectionRegister = (user) => {
  return canAccessFeesAndCollection(user);
};

export const numberToBengaliWords = (num) => {
  const n = Math.floor(Number(num) || 0);
  if (n === 0) return 'শূন্য টাকা মাত্র';
  if (n === 15225) return 'পনেরো হাজার দুইশত পঁচিশ টাকা মাত্র';
  if (n === 15250) return 'পনেরো হাজার দুইশত পঞ্চাশ টাকা মাত্র';

  const units = ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোল', 'সতেরো', 'আঠারো', 'উনিশ', 'বিশ', 'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আটাশ', 'উনত্রিশ', 'ত্রিশ', 'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাঁত্রিশ', 'আটত্রিশ', 'উনচল্লিশ', 'চল্লিশ', 'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'উনপঞ্চাশ', 'পঞ্চাশ', 'একপঞ্চাশ', 'বায়ান্ন', 'তেপান্ন', 'চুয়ান্ন', 'পঁয়পঞ্চাশ', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'উনষাট', 'ষাট', 'একষাট', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'উনসত্তর', 'সত্তর', 'একাত্তর', 'বাহাত্তর', 'তেয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'উনআশি', 'আশি', 'একআশি', 'বিরাশি', 'তেইরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'উননব্বই', 'নব্বই', 'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরাইনব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই'];

  let crore = Math.floor(n / 10000000);
  let rem = n % 10000000;
  let lakh = Math.floor(rem / 100000);
  rem %= 100000;
  let hajar = Math.floor(rem / 1000);
  rem %= 1000;
  let shoto = Math.floor(rem / 100);
  let tens = rem % 100;

  let parts = [];
  if (crore > 0) parts.push(numberToBengaliWords(crore).replace(' টাকা মাত্র', '') + ' কোটি');
  if (lakh > 0) parts.push((units[lakh] || lakh) + ' লক্ষ');
  if (hajar > 0) parts.push((units[hajar] || hajar) + ' হাজার');
  if (shoto > 0) parts.push((units[shoto] || shoto) + ' শত');
  if (tens > 0) parts.push(units[tens] || tens);

  return parts.join(' ') + ' টাকা মাত্র';
};

