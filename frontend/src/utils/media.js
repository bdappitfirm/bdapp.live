import api from './api';

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

  const val = path.trim();
  if (!val || val === '/' || val === 'media' || val === '/media' || val === '/media/') return null;

  // Normalize absolute URLs from backend to HTTPS if needed
  if (/^https?:\/\//i.test(val)) {
    // If it's the production domain but with http, upgrade to https
    const prodDomain = 'bdapp.live';
    if (val.includes(prodDomain) && val.startsWith('http://')) {
      return val.replace('http://', 'https://');
    }
    return val;
  }

  // Get base URL from api utility or fallback to current origin
  let base = (process.env.REACT_APP_API_URL || api?.defaults?.baseURL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/$/, '');
  
  // If we're on the production domain, always prefer HTTPS
  if (typeof window !== 'undefined' && window.location.hostname.includes('bdapp.live')) {
    if (base.startsWith('http://')) {
      base = base.replace('http://', 'https://');
    } else if (!base.startsWith('https://')) {
      // If base is relative or just a domain without protocol
      base = 'https://bdapp.live';
    }
  } else if (base.includes('bdapp.live') && base.startsWith('http://')) {
    // Upgrade base to https for production if it's not already
    base = base.replace('http://', 'https://');
  }
  
  // In development (CRA), if base is port 3000, we might need to point to 8000 for media
  // if the proxy doesn't handle it or if we want to be explicit.
  if (typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/$/, '');
    const isFrontendDev = /:3000$/.test(origin);
    const isBaseSameAsOrigin = base === origin;
    if (isFrontendDev && isBaseSameAsOrigin) {
      // Check if we're likely using the standard local dev setup
      base = 'http://127.0.0.1:8000';
    }
  }

  // Normalize backslashes (Windows style) to forward slashes
  let normalized = val.replace(/\\/g, '/');

  // If the path already contains /media/, extract only the part after /media/
  // or handle it appropriately.
  if (type === 'media') {
    if (normalized.startsWith('/media/')) {
      return `${base}${normalized}`;
    }
    if (normalized.startsWith('media/')) {
      return `${base}/${normalized}`;
    }
    // Check for nested media/ paths in absolute-looking strings that aren't actually URLs
    if (normalized.includes('/media/')) {
      const parts = normalized.split('/media/');
      return `${base}/media/${parts[parts.length - 1]}`;
    }
    
    // If it's just a filename (e.g., "logo.png"), assume it's a school logo
    if (!normalized.includes('/') && !normalized.startsWith('.')) {
      return `${base}/media/school_logos/${normalized}`;
    }
    
    // If it has a path but no /media/, try to prepend /media/
    return `${base}/media/${normalized.replace(/^\/+/, '')}`;
  }

  // Handle static files if needed
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
    student.photo_url,
    student.user?.photo_url,
    student.photo,
    student.user?.photo,
    student.profile_picture,
    student.user?.profile_picture
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
    school.image_url,
    school.image,
    school.img,
    school.photo_url,
    school.photo
  ];
  
  for (const path of candidates) {
    const resolved = getMediaUrl(path);
    if (resolved) return resolved;
  }
  return null;
};
