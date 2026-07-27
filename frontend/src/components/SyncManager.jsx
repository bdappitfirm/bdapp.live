import { useEffect, useRef, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { cacheData, processSyncQueue } from '../utils/offlineDb';

/**
 * SyncManager: Automatically pre-fetches all school data into local storage
 * This runs in the background when the user visits the dashboard.
 */
const SyncManager = () => {
    const { id: paramId } = useParams();
    const location = useLocation();
    const isSyncing = useRef(false);

    // Extract school ID from URL
    const schoolId = useMemo(() => {
        if (paramId) return paramId;
        const match = location.pathname.match(/\/school\/(\d+)/);
        return match ? match[1] : localStorage.getItem('currentSchoolId');
    }, [paramId, location.pathname]);

    useEffect(() => {
        // If we are on the WelcomePage (root), don't start heavy prefetch for a school
        // This keeps the network clear for the main school list and ads
        if (location.pathname === '/' || location.pathname === '/login') {
            return;
        }

        if (!schoolId || isSyncing.current) return;

        // Safety guard: Don't sync more than once every 15 minutes per session
        const syncKey = `last_sync_${schoolId}`;
        const lastSync = sessionStorage.getItem(syncKey);
        const now = Date.now();
        if (lastSync && (now - parseInt(lastSync, 10) < 900000)) {
            return;
        }

        if (!navigator.onLine) return;

        const prefetchData = async () => {
            console.log('📡 Background sync: Starting sequential prefetch for school', schoolId);
            isSyncing.current = true;

            const endpoints = [
                // Priority 1: UI Essentials
                { url: `/api/schools/${schoolId}/`, store: 'genericCache', priority: 1 },
                { url: `/api/academics/classrooms/?school=${schoolId}`, store: 'classrooms', priority: 1 },
                { url: `/api/academics/sections/?school=${schoolId}`, store: 'sections', priority: 1 },

                // Priority 2: Staff & Subjects
                { url: `/api/users/me/`, store: 'genericCache', priority: 2 },
                { url: `/api/users/teachers/?school=${schoolId}&page_size=200`, store: 'teachers', priority: 2 },
                { url: `/api/academics/subjects/?school=${schoolId}&page_size=200`, store: 'subjects', priority: 2 },

                // Priority 3: Students
                { url: `/api/academics/students/?school=${schoolId}&page_size=200`, store: 'students', priority: 3 },

                // Priority 4: Results & Exams
                { url: `/api/results/examinations/?school=${schoolId}&page_size=200`, store: 'examinations', priority: 4 },
                { url: `/api/results/overall/dashboard_result_summary/?school=${schoolId}&year=${new Date().getFullYear()}`, store: 'genericCache', priority: 4 },

                // Priority 5: Fees (Lightened)
                { url: `/api/fees/fees/?school=${schoolId}&page_size=100`, store: 'fees', priority: 5 },

                // Priority 6: Secondary Metadata
                { url: `/api/ads/?school=${schoolId}`, store: 'genericCache', priority: 6 },
                { url: `/api/schools/`, store: 'genericCache', priority: 6 },
            ];

            endpoints.sort((a, b) => a.priority - b.priority);

            for (const item of endpoints) {
                // If school changed mid-sync, stop this task
                if (localStorage.getItem('currentSchoolId') !== schoolId) break;

                try {
                    // 1.5s delay between requests to keep the pipe open for user actions
                    await new Promise(r => setTimeout(r, 1500));

                    const response = await api.get(item.url, { timeout: 30000 });
                    if (item.store !== 'genericCache') {
                        const data = response.data.results || response.data;
                        if (data) await cacheData(item.store, data);
                    }
                } catch (e) {
                    console.warn(`Sync failed for ${item.url}:`, e.message);
                }
            }

            console.log('✅ Background sync: Finished sequential prefetch for school', schoolId);
            sessionStorage.setItem(syncKey, Date.now().toString());
            isSyncing.current = false;

            processSyncQueue();
        };

        const timer = setTimeout(prefetchData, 10000);
        return () => clearTimeout(timer);
    }, [schoolId]);

    return null;
};

export default SyncManager;
