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

// Permission helpers
export const canEdit = (user, itemUserId = null, itemRole = null) => {
  if (!user) return false;
  
  const normalize = (u) => String(u || '').toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const username = normalize(user.username);
  const role = String(user.role || user.profile?.effective_role || user.profile?.role || '').toLowerCase();
  const designation = String(user.profile?.designation || '').toLowerCase();
  
  // Principal (shamir), Superuser (bdadmin) or Admin can edit anything
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
    designation.includes('headmaster')
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
  
  // Others can only edit their own data
  return itemUserId && String(user.id) === String(itemUserId);
};

export const canDelete = (user, itemUserId = null, itemRole = null) => {
  if (!user) return false;
  
  const normalize = (u) => String(u || '').toLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const username = normalize(user.username);
  const role = String(user.role || user.profile?.effective_role || user.profile?.role || '').toLowerCase();
  const designation = String(user.profile?.designation || '').toLowerCase();
  
  // Principal (shamir), Superuser (bdadmin) or Admin can delete anything
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
    designation.includes('headmaster')
  ) {
    return true;
  }
  
  // Others cannot delete anything except their own data in specific cases
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
  const fn = (firstName || '').trim();
  const ln = (lastName || '').trim();

  if (!fn) return ln || fallback;
  if (!ln) return fn || fallback;

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
    'চ': 'ch', 'ছ': 'sh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
    'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'p', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
    'য': 'z', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
    'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't', 'ং': 'ng', 'ঃ': 'h', 'ঁ': 'n',
    'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri',
    'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
    'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri',
    'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
    '্': '', '্য': 'y', '্র': 'r', '্ব': 'b', '্ল': 'l'
  };

  let result = text;

  // Common titles and honorifics
  result = result.replace(/মো: /g, 'Md. ')
                 .replace(/মোঃ /g, 'Md. ')
                 .replace(/মোসাম্মৎ/g, 'Mst.')
                 .replace(/মোসা:/g, 'Mst.')
                 .replace(/মোসাঃ/g, 'Mst.');

  // Special handling for common name suffixes and patterns
  result = result.replace(/উদ্দীন/g, 'uddin')
                 .replace(/ইসলাম/g, 'islam')
                 .replace(/রহমান/g, 'rahman')
                 .replace(/আহমেদ/g, 'ahmed')
                 .replace(/খান/g, 'khan')
                 .replace(/চৌধুরী/g, 'chowdhury')
                 .replace(/বেগম/g, 'begum')
                 .replace(/মন্ডল/g, 'mondal')
                 .replace(/বিশ্বাস/g, 'biswas')
                 .replace(/সরকার/g, 'sarkar');

  let output = "";
  for (let i = 0; i < result.length; i++) {
    const char = result[i];

    // Handle inherent vowel 'o' for some cases or specific character combinations
    // For simplicity in names, we stay with basic mapping but can add rules here.

    if (mapping[char] !== undefined) {
      output += mapping[char];
    } else {
      output += char;
    }
  }

  // Cleanup: remove multiple spaces, fix capitalization
  output = output.replace(/\s+/g, ' ').trim();

  // Return with proper casing (Capitalize Each Word)
  return output.split(' ').map(word => {
    if (!word) return '';
    // Handle honorifics that should stay abbreviated
    if (word.toLowerCase() === 'md') return 'Md.';
    if (word.toLowerCase() === 'mst') return 'Mst.';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
};
