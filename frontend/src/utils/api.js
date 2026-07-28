// src/utils/api.js
import axios from 'axios';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './auth';
import { getCachedApiResponse, cacheApiResponse, queueRequest, db } from './offlineDb';
import { normalizeApiError } from './errorUtils';

/**
 * Smart Offline Fallback Logic:
 * Provides filtered data from Dexie tables when URL-based cache misses.
 */
const smartOfflineFallback = async (config) => {
  try {
    const url = config.url || '';
    const params = config.params || {};

    // 1. Students list with filters
    if (url.includes('/api/academics/students/')) {
      const { classroom, section } = params;
      let students = await db.students.toArray();
      if (classroom) students = students.filter(s => String(s.classroom_id || s.classroom?.id || s.classroom) === String(classroom));
      if (section) students = students.filter(s => String(s.section_id || s.section?.id || s.section) === String(section));

      // Basic sorting by roll number
      students.sort((a, b) => {
        const ar = parseInt(String(a.roll_number || '').replace(/\D/g, ''), 10);
        const br = parseInt(String(b.roll_number || '').replace(/\D/g, ''), 10);
        return (isNaN(ar) ? 0 : ar) - (isNaN(br) ? 0 : br);
      });

      return { results: students, count: students.length };
    }

    // 2. Results list with filters
    if (url.includes('/api/results/results/')) {
      const { examination, student, subject } = params;
      let results = await db.results.toArray();
      if (examination) results = results.filter(r => String(r.examination_id || r.examination?.id || r.examination) === String(examination));
      if (student) results = results.filter(r => String(r.student_id || r.student?.id || r.student) === String(student));
      if (subject) results = results.filter(r => String(r.subject_id || r.subject?.id || r.subject) === String(subject));
      return { results, count: results.length };
    }

    // 3. Metadata tables
    const tableMap = {
      '/api/academics/classrooms/': 'classrooms',
      '/api/academics/sections/': 'sections',
      '/api/academics/subjects/': 'subjects',
      '/api/users/teachers/': 'teachers',
      '/api/results/examinations/': 'examinations',
      '/api/fees/fees/': 'fees',
      '/api/results/results/': 'results'
    };

    for (const [path, table] of Object.entries(tableMap)) {
      if (url.includes(path)) {
        let data = await db[table].toArray();
        // Simple filtering for sections/subjects by classroom
        if (params.classroom && (table === 'sections' || table === 'subjects' || table === 'examinations')) {
          data = data.filter(item => String(item.classroom_id || item.classroom?.id || item.classroom) === String(params.classroom));
        }
        return Array.isArray(data) ? { results: data, count: data.length } : data;
      }
    }

    return null;
  } catch (e) {
    console.error('Smart fallback error:', e);
    return null;
  }
};

/**
 * API Engine with Offline Support.
 */
const api = axios.create({
  baseURL: localStorage.getItem('api_base_url') || process.env.REACT_APP_API_URL || (typeof window !== 'undefined' ? window.location.origin : ''),
  timeout: 60000,
  withCredentials: true,
});

/**
 * Normalizes URL and Params into a unique, environment-independent cache key.
 * It merges query strings from the URL and the config.params object to ensure consistency.
 */
const getCacheKey = (config) => {
  try {
    const urlStr = config.url || '';
    // Use URL object to parse (relative URLs need a base, so we use a dummy one)
    const dummyBase = 'http://localhost';
    const url = new URL(urlStr, dummyBase);

    // Merge existing search params with config.params
    const searchParams = url.searchParams;
    if (config.params) {
      Object.keys(config.params).forEach(key => {
        if (config.params[key] !== undefined && config.params[key] !== null) {
          searchParams.set(key, String(config.params[key]));
        }
      });
    }

    // Sort params to ensure consistency regardless of insertion order
    searchParams.sort();

    // pathOnly should not contain the protocol/host
    const path = url.pathname;
    const finalParams = searchParams.toString();

    return `${path}${finalParams ? '?' + finalParams : ''}`;
  } catch (e) {
    // Fallback for extremely malformed URLs
    return config.url || '';
  }
};

// Request interceptor: Only add auth header
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Cache successful GET responses
api.interceptors.response.use(
  async (response) => {
    const method = response.config.method?.toLowerCase();
    if (method === 'get' && !response.config._skipCache) {
      const cacheKey = getCacheKey(response.config);
      try {
        // Only cache valid non-empty data
        if (response.data && (typeof response.data !== 'object' || Object.keys(response.data).length > 0)) {
          await cacheApiResponse(cacheKey, response.data);
        }
      } catch (e) {
        console.warn('Cache write failed:', e);
      }
    } else if (['post', 'put', 'patch', 'delete'].includes(method)) {
      // Clear cache on mutations to avoid stale data
      try {
        await db.genericCache.clear();
        console.log('🧹 Generic cache cleared due to mutation:', response.config.url);
      } catch (e) {
        console.warn('Cache clear failed:', e);
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) return Promise.reject(error);

    // If request failed (network error, timeout, or certain server errors)
    const isNetworkError = !error.response || error.code === 'ECONNABORTED' || error.message === 'Network Error';
    const isServerError = error.response && [500, 502, 503, 504].includes(error.response.status);
    const isAuthError = error.response && error.response.status === 401;

    // 1. If GET failed, try to use cached data as fallback
    // Don't fallback for auth errors (401) to prevent showing stale private data
    if (originalRequest.method?.toLowerCase() === 'get' && !originalRequest._skipCache && !isAuthError) {
      const cacheKey = getCacheKey(originalRequest);
      try {
        // Try exact URL match first
        let cached = await getCachedApiResponse(cacheKey);

        // If exact match fails, try Smart Fallback for known endpoints
        if (!cached) {
          cached = await smartOfflineFallback(originalRequest);
        }

        // Stricter validation: Ensure data is not null, empty object, or empty array
        const hasData = cached && (
          (Array.isArray(cached) && cached.length > 0) ||
          (Array.isArray(cached?.results) && cached.results.length > 0) ||
          (typeof cached === 'object' && Object.keys(cached).length > 0 && !(cached instanceof Date))
        );

        if (hasData) {
          console.log('📦 Serving from Offline Cache fallback:', cacheKey);
          return {
            data: cached,
            status: 200,
            statusText: 'OK (From Cache)',
            headers: { 'x-from-cache': 'true' },
            config: originalRequest,
            request: {},
          };
        } else {
            console.warn('📦 Cache miss or invalid data for:', cacheKey);
        }
      } catch (e) {
        console.warn('Fallback cache read failed:', e);
      }
    }

    // 2. Handle offline for mutations (POST, PUT, PATCH, DELETE)
    const isMutation = ['post', 'put', 'patch', 'delete'].includes(originalRequest.method?.toLowerCase());
    // Queue if network error OR server is temporarily unavailable (502, 503, 504)
    // IMPORTANT: Don't queue if the request already has _isSyncRetry flag to avoid infinite loop
    if (isMutation && !originalRequest._isSyncRetry && (isNetworkError || (isServerError && error.response.status !== 500))) {
       console.log('📡 Network/Server error, queuing mutation for sync:', originalRequest.url);
       try {
         await queueRequest(originalRequest.url, originalRequest.method, originalRequest.data);
         return {
           data: { message: 'Queued for sync', offline: true },
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

    // Auth 401 refresh logic
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        clearTokens();
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
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
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }

    // Attach normalized error for consistent handling in components
    try {
      error.normalized = normalizeApiError(error);
    } catch (e) {
      console.warn('Error normalization failed:', e);
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
