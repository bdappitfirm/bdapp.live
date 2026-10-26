/**
 * Resolves a media path (relative or absolute) to a full URL.
 * Handles different environments (dev vs prod) and inconsistencies in backend data.
 * 
 * @param {string} path - The image path or URL from the backend
 * @param {string} type - 'media' (default) or 'static'
 * @returns {string|null} - The resolved URL or null
 */
export const getMediaUrl = (path, type = 'media') => {
  if (!path) return null;
  if (typeof path !== 'string') return null;

  let val = path.trim();
  const lowerVal = val.toLowerCase();
  if (
    !val ||
    val === '/' ||
    val === 'media' ||
    val === '/media' ||
    val === '/media/' ||
    lowerVal === 'null' ||
    lowerVal === 'undefined' ||
    lowerVal === 'none'
  ) {
    return null;
  }

  // Extract relative media path if an absolute URL is given (strip domain/protocol)
  if (/^https?:\/\//i.test(val)) {
    val = val.replace(/^https?:\/\/[^/]+/i, '');
  }

  // Use origin as base
  let base = (process.env.REACT_APP_API_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  
  // If we're on the production domain, always prefer HTTPS
  if (typeof window !== 'undefined' && window.location.hostname.includes('bdapp.live')) {
    if (base.startsWith('http://')) {
      base = base.replace('http://', 'https://');
    } else if (!base.startsWith('https://')) {
      base = 'https://bdapp.live';
    }
  }
  
  // In development (CRA), if base is port 3000, point to port 8000 on current hostname for media
  if (typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/$/, '');
    if (/:3000$/.test(origin)) {
      base = `http://${window.location.hostname}:8000`;
    }
  }

  // Normalize backslashes (Windows style) to forward slashes
  let normalized = val.replace(/\\/g, '/');

  // If the path already contains /media/, extract only the part after /media/
  if (type === 'media') {
    if (normalized.startsWith('/media/')) {
      return `${base}${normalized}`;
    }
    if (normalized.startsWith('media/')) {
      return `${base}/${normalized}`;
    }
    if (normalized.includes('/media/')) {
      const parts = normalized.split('/media/');
      return `${base}/media/${parts[parts.length - 1]}`;
    }
    
    // If it's just a filename (e.g., "logo.png"), assume it's a school logo
    if (!normalized.includes('/') && !normalized.startsWith('.')) {
      return `${base}/media/school_logos/${normalized}`;
    }
    
    return `${base}/media/${normalized.replace(/^\/+/, '')}`;
  }

  if (type === 'static') {
    if (normalized.startsWith('/static/')) return `${base}${normalized}`;
    if (normalized.startsWith('static/')) return `${base}/${normalized}`;
    return `${base}/static/${normalized.replace(/^\/+/, '')}`;
  }

  return `${base}/${normalized.replace(/^\/+/, '')}`;
};

/**
 * Resolves a student's photo URL from various possible fields.
 */
export const resolveStudentPhoto = (student) => {
  if (!student) return null;
  const candidates = [
    student.user?.thumbnail_url,
    student.user?.photo_url,
    student.user?.photo,
    student.user?.profile_picture,
    student.student?.user?.photo_url,
    student.student?.user?.photo,
    student.student?.photo_url,
    student.student?.photo,
    student.photo_url,
    student.photo,
    student.profile_picture,
    student.avatar
  ];
  
  for (const path of candidates) {
    const resolved = getMediaUrl(path);
    if (resolved) return resolved;
  }
  return null;
};

/**
 * Resolves a school's logo URL from various possible fields.
 */
export const resolveSchoolLogo = (school) => {
  if (!school) return null;
  const candidates = [
    school.logo_url,
    school.logo,
    school.school_logo,
    school.image_url,
    school.image,
    school.img,
    school.photo_url,
    school.photo,
    school.logo_thumbnail_url,
    school.logo_thumbnail
  ];
  
  for (const path of candidates) {
    const resolved = getMediaUrl(path);
    if (resolved) return resolved;
  }
  return null;
};
