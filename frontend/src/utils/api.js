// src/utils/api.js
import axios from 'axios';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './auth';
import { getCachedApiResponse, cacheApiResponse, queueRequest, cacheData, optimisticSave, db } from './offlineDb';
import { normalizeApiError } from './errorUtils';

/**
 * Normalizes URL and Params into a unique, environment-independent cache key.
 */
export const getCacheKey = (config) => {
  try {
    const urlStr = config.url || '';
    const dummyBase = 'http://localhost';
    const url = new URL(urlStr, dummyBase);

    const searchParams = url.searchParams;
    if (config.params) {
      Object.keys(config.params).forEach(key => {
        if (config.params[key] !== undefined && config.params[key] !== null) {
          searchParams.set(key, String(config.params[key]));
        }
      });
    }

    searchParams.sort();
    const path = url.pathname;
    const finalParams = searchParams.toString();

    return `${path}${finalParams ? '?' + finalParams : ''}`;
  } catch (e) {
    return config.url || '';
  }
};

/**
 * Smart Offline Fallback Logic:
 * Provides filtered data from Dexie tables or local storage when URL-based cache misses.
 */
const smartOfflineFallback = async (config) => {
  try {
    const url = config.url || '';
    const params = config.params || {};

    // 0. Current user profile fallback
    if (url.includes('/api/users/me/')) {
      const savedUser = localStorage.getItem('cached_user_profile');
      if (savedUser) {
        try { return JSON.parse(savedUser); } catch (_) {}
      }
    }

    // 1. Students list with filters
    if (url.includes('/api/academics/students/')) {
      const { classroom, section } = params;
      let students = await db.students.toArray();
      if (classroom) students = students.filter(s => String(s.classroom_id || s.classroom?.id || s.classroom) === String(classroom));
      if (section) students = students.filter(s => String(s.section_id || s.section?.id || s.section) === String(section));

      students.sort((a, b) => {
        const ar = parseInt(String(a.roll_number || '').replace(/\D/g, ''), 10);
        const br = parseInt(String(b.roll_number || '').replace(/\D/g, ''), 10);
        return (isNaN(ar) ? 0 : ar) - (isNaN(br) ? 0 : br);
      });

      return { results: students, count: students.length };
    }

    // 2. Attendance records list with filters
    if (url.includes('/api/attendance/records/')) {
      const { classroom, section, date, student } = params;
      let records = await db.attendance.toArray();
      if (date) records = records.filter(r => String(r.date) === String(date));
      if (classroom) records = records.filter(r => String(r.classroom_id || r.classroom?.id || r.classroom) === String(classroom));
      if (section) records = records.filter(r => String(r.section_id || r.section?.id || r.section) === String(section));
      if (student) records = records.filter(r => String(r.student_id || r.student?.id || r.student) === String(student));
      return { results: records, count: records.length };
    }

    // 3. Results list with filters
    if (url.includes('/api/results/results/')) {
      const { examination, exam_type, student, subject, classroom, section } = params;
      let results = await db.results.toArray();
      if (examination) results = results.filter(r => String(r.examination_id || r.examination?.id || r.examination) === String(examination));
      if (exam_type) results = results.filter(r => String(r.examination?.exam_type || r.exam_type || '') === String(exam_type));
      if (student) results = results.filter(r => String(r.student_id || r.student?.id || r.student) === String(student));
      if (subject) results = results.filter(r => String(r.subject_id || r.subject?.id || r.subject) === String(subject));
      if (classroom) results = results.filter(r => String(r.classroom_id || r.classroom || r.student?.classroom_id) === String(classroom));
      if (section) results = results.filter(r => String(r.section_id || r.section || r.student?.section_id) === String(section));
      return { results, count: results.length };
    }

    // 4. Metadata tables & listings
    const tableMap = {
      '/api/academics/classrooms/': 'classrooms',
      '/api/academics/sections/': 'sections',
      '/api/academics/subjects/': 'subjects',
      '/api/users/teachers/': 'teachers',
      '/api/results/examinations/': 'examinations',
      '/api/fees/fees/': 'fees',
      '/api/fees/assignments/': 'fees'
    };

    for (const [path, table] of Object.entries(tableMap)) {
      if (url.includes(path)) {
        let data = await db[table].toArray();
        if (params.classroom && (table === 'sections' || table === 'subjects' || table === 'examinations')) {
          data = data.filter(item => String(item.classroom_id || item.classroom?.id || item.classroom) === String(params.classroom));
        }
        return Array.isArray(data) ? { results: data, count: data.length } : data;
      }
    }

    // 5. Generic Cache Fallback for any endpoint saved by SyncManager
    const cacheKey = getCacheKey(config);
    const cachedEntry = await db.genericCache.get(cacheKey) || await db.genericCache.get(url);
    if (cachedEntry && cachedEntry.data) {
      return cachedEntry.data;
    }

    return null;
  } catch (e) {
    console.error('Smart fallback error:', e);
    return null;
  }
};

/**
 * Optimistically saves mutations locally so local state updates immediately
 */
const optimisticallySaveMutation = async (url, method, data) => {
  try {
    if (!data || typeof data !== 'object') return;

    if (url.includes('/api/academics/students/')) {
      await optimisticSave('students', data);
    } else if (url.includes('/api/attendance/records/')) {
      await optimisticSave('attendance', data);
    } else if (url.includes('/api/results/results/')) {
      await optimisticSave('results', data);
    } else if (url.includes('/api/fees/assignments/') || url.includes('/api/fees/fees/')) {
      await optimisticSave('fees', data);
    }
  } catch (e) {
    console.warn('Optimistic save mutation error:', e);
  }
};

/**
 * API Engine with Local-First & Offline Support.
 */
const api = axios.create({
  baseURL: localStorage.getItem('api_base_url') || process.env.REACT_APP_API_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
  timeout: 60000,
  withCredentials: true,
});

// Request interceptor: Add auth token header
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Cache GET responses and handle offline fallbacks
api.interceptors.response.use(
  async (response) => {
    const method = response.config.method?.toLowerCase();
    const url = response.config.url || '';

    if (method === 'get') {
      if (!response.config._skipCache) {
        const cacheKey = getCacheKey(response.config);
        try {
          if (response.data && (typeof response.data !== 'object' || Object.keys(response.data).length > 0)) {
            await cacheApiResponse(cacheKey, response.data);

            // Also populate structured Dexie tables if list data is received
            if (url.includes('/api/academics/students/')) {
              const students = response.data?.results || (Array.isArray(response.data) ? response.data : null);
              if (students) await cacheData('students', students);
            } else if (url.includes('/api/attendance/records/')) {
              const records = response.data?.results || (Array.isArray(response.data) ? response.data : null);
              if (records) await cacheData('attendance', records);
            } else if (url.includes('/api/results/results/')) {
              const results = response.data?.results || (Array.isArray(response.data) ? response.data : null);
              if (results) await cacheData('results', results);
            }
          }
        } catch (e) {
          console.warn('Cache write failed:', e);
        }
      }
    } else if (['post', 'put', 'patch', 'delete'].includes(method)) {
      // Successful mutation on server: update local Dexie store
      await optimisticallySaveMutation(url, method, response.data);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    const isNetworkError = !error.response || error.code === 'ECONNABORTED' || error.message === 'Network Error';
    const isServerError = error.response && [500, 502, 503, 504].includes(error.response.status);
    const isAuthError = error.response && error.response.status === 401;

    // 1. GET request offline / error fallback
    if (originalRequest.method?.toLowerCase() === 'get' && !isAuthError) {
      if (!originalRequest._skipCache) {
        const cacheKey = getCacheKey(originalRequest);
        try {
          let cached = await getCachedApiResponse(cacheKey);

          if (!cached) {
            cached = await smartOfflineFallback(originalRequest);
          }

          const hasData = cached !== null && cached !== undefined && (
            (Array.isArray(cached)) ||
            (Array.isArray(cached?.results)) ||
            (typeof cached === 'object' && Object.keys(cached).length > 0)
          );

          if (hasData) {
            console.log('📦 Serving from Offline Local Cache:', cacheKey);
            return {
              data: cached,
              status: 200,
              statusText: 'OK (From Local Cache)',
              headers: { 'x-from-cache': 'true' },
              config: originalRequest,
              request: {},
            };
          } else {
            console.warn('📦 Cache miss for key:', cacheKey);
          }
        } catch (e) {
          console.warn('Fallback cache read failed:', e);
        }
      }
    }

    // 2. Mutation requests offline / error queuing (POST, PUT, PATCH, DELETE)
    const isMutation = ['post', 'put', 'patch', 'delete'].includes(originalRequest.method?.toLowerCase());
    if (isMutation && !originalRequest._isSyncRetry && (isNetworkError || (isServerError && error.response.status !== 500))) {
       console.log('📡 Offline mutation queued for sync:', originalRequest.url);
       try {
         // Optimistically update local IndexedDB so offline views immediately show the update
         await optimisticallySaveMutation(originalRequest.url, originalRequest.method, originalRequest.data);
         await queueRequest(originalRequest.url, originalRequest.method, originalRequest.data);
         return {
           data: { message: 'Queued for sync', offline: true, ...originalRequest.data },
           status: 202,
           statusText: 'Accepted (Offline)',
           headers: {},
           config: originalRequest,
           request: {},
         };
       } catch (syncErr) {
         console.error('Failed to queue request:', syncErr);
       }
    }

    // 3. Auth 401 refresh token retry
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        clearTokens();
        localStorage.removeItem('cached_user_profile');
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/login?next=${next}`;
        }
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${api.defaults.baseURL}/api/token/refresh/`, { refresh: refreshToken });
        saveTokens(res.data.access, refreshToken);
        originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
        return api(originalRequest);
      } catch (refreshErr) {
        clearTokens();
        localStorage.removeItem('cached_user_profile');
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/login?next=${next}`;
        }
      }
    }

    try {
      error.normalized = normalizeApiError(error);
    } catch (e) {
      error.normalized = {
        title: 'Error',
        message: error?.message || 'Something went wrong.',
        fieldErrors: {},
        suggestions: [],
        status: error?.response?.status || null,
      };
    }

    return Promise.reject(error);
  }
);

export default api;
