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
  
  const username = String(user.username || '').toLowerCase();
  const role = String(user.role || '').toLowerCase();
  
  // Principal (shamir), Superuser (bdadmin) or Admin can edit anything
  if (username === 'shamir' || username === 'bdadmin' || user.is_superuser || role === 'admin' || role === 'superadmin' || user.is_staff) {
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
  
  const username = String(user.username || '').toLowerCase();
  const role = String(user.role || '').toLowerCase();
  
  // Principal (shamir), Superuser (bdadmin) or Admin can delete anything
  if (username === 'shamir' || username === 'bdadmin' || user.is_superuser || role === 'admin' || role === 'superadmin' || user.is_staff) {
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