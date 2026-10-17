import api from './api';
import { cacheData } from './offlineDb';

let lastPrefetchTime = 0;
let lastPrefetchSchool = null;

/**
 * Aggressively downloads all school data into local IndexedDB
 */
export const prefetchEverything = async (schoolId) => {
    if (!schoolId) return;

    const now = Date.now();
    if (lastPrefetchSchool === schoolId && (now - lastPrefetchTime < 180000)) {
        return; // Don't prefetch more than once every 3 minutes
    }

    lastPrefetchTime = now;
    lastPrefetchSchool = schoolId;
    console.log('🚀 Starting Comprehensive Offline Prefetch for School:', schoolId);

    try {
        // 1. User Info (Persist for auth & offline reload)
        await api.get('/api/users/me/').catch(() => {});

        // 2. Core Metadata
        const [classRes, sectionRes, subjectRes, teacherRes, examsRes] = await Promise.all([
            api.get(`/api/academics/classrooms/?school=${schoolId}`).catch(() => null),
            api.get(`/api/academics/sections/?school=${schoolId}`).catch(() => null),
            api.get(`/api/academics/subjects/?school=${schoolId}`).catch(() => null),
            api.get(`/api/users/teachers/?school=${schoolId}&page_size=2000`).catch(() => null),
            api.get(`/api/results/examinations/?school=${schoolId}`).catch(() => null)
        ]);

        if (classRes?.data) {
            const classrooms = Array.isArray(classRes.data) ? classRes.data : classRes.data?.results || [];
            await cacheData('classrooms', classrooms);
        }
        if (sectionRes?.data) {
            const sections = Array.isArray(sectionRes.data) ? sectionRes.data : sectionRes.data?.results || [];
            await cacheData('sections', sections);
        }
        if (subjectRes?.data) {
            const subjects = Array.isArray(subjectRes.data) ? subjectRes.data : subjectRes.data?.results || [];
            await cacheData('subjects', subjects);
        }
        if (teacherRes?.data) {
            const teachers = Array.isArray(teacherRes.data) ? teacherRes.data : teacherRes.data?.results || [];
            await cacheData('teachers', teachers);
        }
        if (examsRes?.data) {
            const exams = Array.isArray(examsRes.data) ? examsRes.data : examsRes.data?.results || [];
            await cacheData('examinations', exams);
        }

        // 3. All Students
        const studentRes = await api.get(`/api/academics/students/?school=${schoolId}&page_size=3000`).catch(() => null);
        if (studentRes?.data) {
            const allStudents = studentRes.data?.results || studentRes.data || [];
            if (Array.isArray(allStudents) && allStudents.length > 0) {
                await cacheData('students', allStudents);
            }
        }

        // 4. Fees & Fee Assignments
        const feeRes = await api.get(`/api/fees/assignments/?school=${schoolId}&page_size=3000`).catch(() => null);
        if (feeRes?.data) {
            const fees = Array.isArray(feeRes.data) ? feeRes.data : feeRes.data?.results || [];
            if (fees.length > 0) await cacheData('fees', fees);
        }

        // 5. Results
        const resultRes = await api.get(`/api/results/results/?school=${schoolId}&page_size=5000`).catch(() => null);
        if (resultRes?.data) {
            const results = Array.isArray(resultRes.data) ? resultRes.data : resultRes.data?.results || [];
            if (results.length > 0) await cacheData('results', results);
        }

        // 6. Attendance Records
        const attRes = await api.get(`/api/attendance/records/?school=${schoolId}&page_size=5000`).catch(() => null);
        if (attRes?.data) {
            const attendance = Array.isArray(attRes.data) ? attRes.data : attRes.data?.results || [];
            if (attendance.length > 0) await cacheData('attendance', attendance);
        }

        // 7. Non-blocking secondary page endpoints
        const endpoints = [
            `/api/users/committees/?school=${schoolId}`,
            `/api/schools/${schoolId}/`,
            `/api/ads/?school=${schoolId}`,
            `/api/results/overall/?school=${schoolId}`,
            `/api/results/overall/dashboard_result_summary/?school=${schoolId}&year=${new Date().getFullYear()}&exam_type=annual`,
            `/api/attendance/records/monthly_report/?school=${schoolId}&month=${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
            `/api/sms/logs/?school=${schoolId}`,
            `/api/billing/invoices/?school=${schoolId}`
        ];

        endpoints.forEach(url => api.get(url).catch(() => {}));

        console.log(`✅ Offline prefetch completed for School: ${schoolId}`);

    } catch (e) {
        console.warn('Prefetch partially failed (likely offline or network glitch):', e.message);
    }
};
