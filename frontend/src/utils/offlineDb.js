import Dexie from 'dexie';

// Create the offline database
export const db = new Dexie('SchoolAppOfflineDB');

// Define the schema
// Version 4: Upgraded to handle new syncQueue and avoid SchemaDiff
db.version(5).stores({
    students: 'id, classroom_id, section_id, roll_number, name',
    teachers: 'id, username, email',
    classrooms: 'id, name',
    sections: 'id, classroom_id, name',
    subjects: 'id, name',
    fees: 'id, student_id, status',
    attendance: 'id, student_id, date',
    examinations: 'id, classroom_id',
    results: 'id, examination_id, student_id, subject_id',
    genericCache: 'url, data, timestamp',
    syncQueue: '++id, url, method, body, timestamp'
});

/**
 * Cache any API response based on its URL
 */
export const cacheApiResponse = async (url, data) => {
    try {
        await db.genericCache.put({
            url,
            data,
            timestamp: Date.now()
        });
    } catch (e) {
        console.error('Failed to cache API response:', e);
    }
};

/**
 * Get cached API response
 */
export const getCachedApiResponse = async (url) => {
    try {
        const record = await db.genericCache.get(url);
        return record ? record.data : null;
    } catch (e) {
        return null;
    }
};

/**
 * Optimized helper to save data to local DB
 */
export const cacheData = async (storeName, data) => {
    try {
        if (!db[storeName]) {
            console.error(`Store ${storeName} does not exist in Dexie DB`);
            return;
        }
        if (Array.isArray(data)) {
            await db[storeName].bulkPut(data);
        } else if (data && typeof data === 'object') {
            await db[storeName].put(data);
        }
    } catch (error) {
        console.error(`Failed to cache ${storeName}:`, error);
    }
};

/**
 * Get data from local DB with optional advanced filtering
 */
export const getCachedData = async (storeName, filter = null) => {
    try {
        if (!db[storeName]) return [];

        if (!filter) {
            return await db[storeName].toArray();
        }

        // Dexie filtering
        return await db[storeName].where(filter).toArray();
    } catch (error) {
        console.error(`Failed to get cached ${storeName}:`, error);
        return [];
    }
};

/**
 * Queue a request for background sync
 */
export const queueRequest = async (url, method, body) => {
    let storedBody = body;

    // If body is FormData, convert it to a serializable structure for IndexedDB
    if (body instanceof FormData) {
        storedBody = { _isFormData: true, entries: [] };
        for (const [key, value] of body.entries()) {
            // value can be a string or a Blob/File, which Dexie can store
            storedBody.entries.push({ key, value });
        }
    } else if (typeof body === 'string') {
        try {
            storedBody = JSON.parse(body);
        } catch (e) {
            // keep as string if not JSON
        }
    }

    await db.syncQueue.add({
        url,
        method,
        body: storedBody,
        timestamp: new Date().toISOString()
    });

    // Trigger sync process
    processSyncQueue();
};

/**
 * Process the sync queue when online
 */
export const processSyncQueue = async () => {
    if (!navigator.onLine) return;

    const queue = await db.syncQueue.toArray();
    for (const item of queue) {
        try {
            // We will import api here dynamically to avoid circular dependencies
            const { default: api } = await import('./api');

            let dataToSync = item.body;

            // Reconstruct FormData if needed
            if (item.body && item.body._isFormData) {
                const fd = new FormData();
                if (Array.isArray(item.body.entries)) {
                    for (const { key, value } of item.body.entries) {
                        fd.append(key, value);
                    }
                }
                dataToSync = fd;
                // Important: Don't set Content-Type manually to let Axios/Browser set the boundary correctly
            }

            await api({
                url: item.url,
                method: item.method,
                data: dataToSync,
                _isSyncRetry: true // Prevent interceptor from re-queuing this
            });
            await db.syncQueue.delete(item.id);
            console.log(`✅ Synced: ${item.url}`);
        } catch (error) {
            console.error(`Sync failed for ${item.url}:`, error);
        }
    }
};

// Listen for connection changes
window.addEventListener('online', processSyncQueue);

// ---------------------------------------------------------------------------
// AUTO-FLUSH + PENDING COUNT
//   api.js queues a failed mutation and replies with a fake 202 "Queued for sync",
//   so the UI reports success even though the server never received it. This queue
//   used to be flushed ONLY by the browser 'online' event - which does NOT fire when
//   the backend is simply not running - so those entered marks were silently lost.
//   Now the queue is retried on app start and every 30s, and the UI can show how
//   many entries are still waiting to be saved.
// ---------------------------------------------------------------------------
export const getQueueCount = async () => {
    try { return await db.syncQueue.count(); } catch (e) { return 0; }
};

let _autoSyncTimer = null;

export const startAutoSync = (intervalMs = 30000) => {
    if (_autoSyncTimer) return () => {};
    const tick = () => { processSyncQueue().catch(() => {}); };
    tick();                                    // flush immediately on app start
    _autoSyncTimer = setInterval(tick, intervalMs);
    return () => { clearInterval(_autoSyncTimer); _autoSyncTimer = null; };
};
