import Dexie from 'dexie';

// Create the offline database
export const db = new Dexie('SchoolAppOfflineDB');

// Define the schema
// Version 6: Upgraded indices for advanced offline filtering and optimistic updates
db.version(6).stores({
    students: 'id, classroom_id, section_id, roll_number, name',
    teachers: 'id, username, email',
    classrooms: 'id, name',
    sections: 'id, classroom_id, name',
    subjects: 'id, name',
    fees: 'id, student_id, status',
    attendance: 'id, student_id, date, classroom_id, section_id',
    examinations: 'id, classroom_id',
    results: 'id, examination_id, student_id, subject_id, classroom_id',
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
            const sanitized = data.map((item, index) => {
                if (item && typeof item === 'object') {
                    if (!item.id) {
                        return {
                            ...item,
                            id: item.student_id ? `${item.student_id}_${item.date || item.examination_id || index}` : `item_${index}_${Date.now()}`
                        };
                    }
                }
                return item;
            });
            await db[storeName].bulkPut(sanitized);
        } else if (data && typeof data === 'object') {
            const item = { ...data };
            if (!item.id) {
                item.id = item.student_id ? `${item.student_id}_${item.date || item.examination_id || 0}` : `item_${Date.now()}`;
            }
            await db[storeName].put(item);
        }
    } catch (error) {
        console.error(`Failed to cache ${storeName}:`, error);
    }
};

/**
 * Helper to optimistically save mutations locally so UI updates instantly
 */
export const optimisticSave = async (storeName, data) => {
    try {
        if (!db[storeName]) return;
        if (Array.isArray(data)) {
            const sanitized = data.map((item, index) => {
                if (item && typeof item === 'object') {
                    if (!item.id) {
                        return {
                            ...item,
                            id: 'temp_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substring(2, 7)
                        };
                    }
                }
                return item;
            });
            await db[storeName].bulkPut(sanitized);
        } else if (data && typeof data === 'object') {
            const item = { ...data };
            if (!item.id) {
                item.id = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            }
            await db[storeName].put(item);
        }
    } catch (e) {
        console.warn(`Optimistic save error for ${storeName}:`, e);
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

    if (body instanceof FormData) {
        storedBody = { _isFormData: true, entries: [] };
        for (const [key, value] of body.entries()) {
            storedBody.entries.push({ key, value });
        }
    } else if (typeof body === 'string') {
        try {
            storedBody = JSON.parse(body);
        } catch (e) {
            // keep as string
        }
    }

    await db.syncQueue.add({
        url,
        method,
        body: storedBody,
        timestamp: new Date().toISOString()
    });

    processSyncQueue();
};

/**
 * Process the sync queue when online
 */
export const processSyncQueue = async () => {
    if (!navigator.onLine) return;

    const queue = await db.syncQueue.toArray();
    if (!queue || queue.length === 0) return;

    for (const item of queue) {
        try {
            const { default: api } = await import('./api');

            let dataToSync = item.body;

            if (item.body && item.body._isFormData) {
                const fd = new FormData();
                if (Array.isArray(item.body.entries)) {
                    for (const { key, value } of item.body.entries) {
                        fd.append(key, value);
                    }
                }
                dataToSync = fd;
            }

            const isLargeUpload = item.url.includes('/api/ads/') || (item.body && item.body._isFormData);
            await api({
                url: item.url,
                method: item.method,
                data: dataToSync,
                timeout: isLargeUpload ? 300000 : 60000,
                _isSyncRetry: true
            });
            await db.syncQueue.delete(item.id);
            console.log(`✅ Synced item #${item.id}: ${item.url}`);
        } catch (error) {
            console.error(`Sync failed for ${item.url}:`, error);
        }
    }
};

window.addEventListener('online', processSyncQueue);

export const getQueueCount = async () => {
    try { return await db.syncQueue.count(); } catch (e) { return 0; }
};

let _autoSyncTimer = null;

export const startAutoSync = (intervalMs = 30000) => {
    if (_autoSyncTimer) return () => {};
    const tick = () => { processSyncQueue().catch(() => {}); };
    tick();
    _autoSyncTimer = setInterval(tick, intervalMs);
    return () => { clearInterval(_autoSyncTimer); _autoSyncTimer = null; };
};
