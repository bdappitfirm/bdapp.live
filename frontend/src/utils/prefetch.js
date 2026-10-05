import api from './api';
import { cacheData } from './offlineDb';

/**
 * Super Prefetcher: Aggressively downloads all school data to local storage.
 * Optimized for performance using batching and non-blocking calls.
 */
let lastPrefetchTime = 0;
let lastPrefetchSchool = null;

export const prefetchEverything = async (schoolId) => {
    if (!schoolId) return;

    // Safety guard: Don't prefetch for the same school more than once every 10 minutes
    const now = Date.now();
    if (lastPrefetchSchool === schoolId && (now - lastPrefetchTime < 600000)) {
        return;
    }

    lastPrefetchTime = now;
    lastPrefetchSchool = schoolId;
    console.log('🚀 Starting Super Prefetch for School:', schoolId);

    try {
        // 1. User Info (Essential for Auth persistence on reload)
        await api.get('/api/users/me/').catch(() => {});

        // 2. Core Metadata
        const [classRes, sectionRes, subjectRes] = await Promise.all([
            api.get(`/api/academics/classrooms/?school=${schoolId}`),
            api.get(`/api/academics/sections/?school=${schoolId}`),
            api.get(`/api/academics/subjects/?school=${schoolId}`)
        ]);

        // Cache metadata
        const classrooms = Array.isArray(classRes.data) ? classRes.data : classRes.data?.results || [];
        const sections = Array.isArray(sectionRes.data) ? sectionRes.data : sectionRes.data?.results || [];
        const subjects = Array.isArray(subjectRes.data) ? subjectRes.data : subjectRes.data?.results || [];
        await cacheData('classrooms', classrooms);
        await cacheData('sections', sections);
        await cacheData('subjects', subjects);

        // 2. Students (Main Data)
        // Fetching in large batches to fill local DB (1000 is usually the max allowed by API)
        const studentRes = await api.get(`/api/academics/students/?school=${schoolId}&page_size=1000`);
        const allStudents = studentRes.data?.results || studentRes.data || [];
        if (allStudents.length > 0) {
            await cacheData('students', allStudents);
        }

        // 3. Fee Assignments & Results Summary
        const [feeRes, , teacherRes, examsRes] = await Promise.all([
            api.get(`/api/fees/assignments/?school=${schoolId}&page_size=1000`),
            api.get(`/api/results/overall/dashboard_result_summary/?school=${schoolId}&year=${new Date().getFullYear()}&exam_type=annual`),
            api.get(`/api/users/teachers/?school=${schoolId}&page_size=1000`),
            api.get(`/api/results/examinations/?school=${schoolId}`)
        ]);

        const teachers = teacherRes.data?.results || teacherRes.data || [];
        const exams = examsRes.data?.results || examsRes.data || [];
        await cacheData('teachers', teachers);
        await cacheData('examinations', exams);

        // 4. Background Fetch for sub-modules (non-blocking)
        // These will be cached by the api.js interceptor automatically
        const endpoints = [
            `/api/users/committees/?school=${schoolId}`,
            `/api/schools/${schoolId}/`,
            `/api/ads/?school=${schoolId}`,
            `/api/results/overall/?school=${schoolId}`,
            `/api/attendance/records/monthly_report/?school=${schoolId}&month=${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
        ];

        endpoints.forEach(url => api.get(url).catch(() => {}));

        console.log(`✅ Prefetched ${allStudents.length} students, ${teachers.length} teachers and metadata.`);

        // Cache fees and results too!
        const fees = Array.isArray(feeRes.data) ? feeRes.data : feeRes.data?.results || [];
        if (fees.length > 0) {
            await cacheData('fees', fees);
        }

    } catch (e) {
        console.warn('Prefetch partially failed (likely network limit), will retry in background:', e.message);
    }
};
