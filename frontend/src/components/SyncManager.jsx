import { useEffect, useRef, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { prefetchEverything } from '../utils/prefetch';

/**
 * SyncManager: Automatically pre-fetches all school data into local storage
 * This runs in the background as soon as the user enters a school view.
 */
const SyncManager = () => {
    const { id: paramId } = useParams();
    const location = useLocation();
    const isSyncing = useRef(false);

    // Extract school ID from URL or storage
    const schoolId = useMemo(() => {
        if (paramId) return paramId;
        const match = location.pathname.match(/\/school\/(\d+)/);
        return match ? match[1] : (localStorage.getItem('currentSchoolId') || localStorage.getItem('active_school_id'));
    }, [paramId, location.pathname]);

    useEffect(() => {
        if (location.pathname === '/' || location.pathname === '/login') {
            return;
        }

        if (!schoolId || isSyncing.current) return;
        if (!navigator.onLine) return;

        const runPrefetch = async () => {
            isSyncing.current = true;
            try {
                await prefetchEverything(schoolId);
            } catch (e) {
                console.warn('SyncManager prefetch error:', e);
            } finally {
                isSyncing.current = false;
            }
        };

        // Start prefetch promptly (100ms after load)
        const timer = setTimeout(runPrefetch, 100);
        return () => clearTimeout(timer);
    }, [schoolId, location.pathname]);

    return null;
};

export default SyncManager;
