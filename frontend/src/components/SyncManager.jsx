import { useEffect, useRef, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { cacheData } from '../utils/offlineDb';

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

        // Safety guard: Don't sync more than once every 30 minutes per session
        const syncKey = `last_sync_${schoolId}`;
        const lastSync = sessionStorage.getItem(syncKey);
        const now = Date.now();
        if (lastSync && (now - parseInt(lastSync, 10) < 1800000)) {
            return;
        }

        if (!navigator.onLine) return;

        const prefetchData = async () => {
            console.log('📡 Background sync: Starting minimal prefetch for school', schoolId);
            isSyncing.current = true;

            const endpoints = [
                // Priority 1: UI Essentials (Must have for app to feel fast)
                { url: `/api/schools/${schoolId}/`, store: 'genericCache', priority: 1 },
                { url: `/api/academics/classrooms/?school=${schoolId}`, store: 'classrooms', priority: 1 },
                { url: `/api/academics/sections/?school=${schoolId}`, store: 'sections', priority: 1 },

                // Priority 2: Staff, Students & Basic Meta
                { url: `/api/users/me/`, store: 'genericCache', priority: 2 },
                { url: `/api/academics/subjects/?school=${schoolId}&page_size=200`, store: 'subjects', priority: 2 },
                { url: `/api/users/teachers/?school=${schoolId}&page_size=500`, store: 'teachers', priority: 2 },
                { url: `/api/academics/students/?school=${schoolId}&page_size=2000`, store: 'students', priority: 2 },
                { url: `/api/results/examinations/?school=${schoolId}`, store: 'examinations', priority: 2 },

                // Priority 3: Fees & Results Summary
                { url: `/api/fees/fees/?school=${schoolId}&page_size=2000`, store: 'fees', priority: 3 },
                { url: `/api/results/overall/dashboard_result_summary/?school=${schoolId}&year=${new Date().getFullYear()}`, store: 'genericCache', priority: 3 },
            ];

            endpoints.sort((a, b) => a.priority - b.priority);

            for (const item of endpoints) {
                if (localStorage.getItem('currentSchoolId') !== schoolId) break;

                try {
                    // 2s delay between requests to keep the pipe open
                    await new Promise(r => setTimeout(r, 2000));

                    const response = await api.get(item.url, { timeout: 30000 });
                    if (item.store !== 'genericCache') {
                        const data = response.data.results || response.data;
                        if (data) await cacheData(item.store, data);
                    }
                } catch (e) {
                    // Skip failures
                }
            }

            console.log('✅ Background sync: Finished minimal prefetch.');
            sessionStorage.setItem(syncKey, Date.now().toString());
            isSyncing.current = false;
        };

        const timer = setTimeout(prefetchData, 15000);
        return () => clearTimeout(timer);
    }, [schoolId, location.pathname]);

    return null;
};

export default SyncManager;
