// Storage management with localStorage caching
// Handles cache TTL, cleanup, and user preferences

/**
 * Cache data to localStorage with TTL
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttl - Time to live in milliseconds
 * @returns {boolean} Success status
 */
function cacheData(key, data, ttl) {
    const entry = {
        timestamp: Date.now(),
        data: data,
        ttl: ttl,
        stateHash: typeof data === 'object' ? generateHash(JSON.stringify(data)) : null
    };

    try {
        localStorage.setItem(key, JSON.stringify(entry));
        log(`Cached data: ${key}`);
        return true;
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            logError('localStorage quota exceeded, cleaning up old entries');
            cleanupCache();

            // Retry after cleanup
            try {
                localStorage.setItem(key, JSON.stringify(entry));
                log(`Cached data after cleanup: ${key}`);
                return true;
            } catch (retryError) {
                logError('Failed to cache data even after cleanup', retryError);
                return false;
            }
        } else {
            logError('Failed to cache data', error);
            return false;
        }
    }
}

/**
 * Get cached data from localStorage
 * @param {string} key - Cache key
 * @returns {Object|null} Object with data and stale flag, or null if not found
 */
function getCachedData(key) {
    try {
        const cached = localStorage.getItem(key);
        if (!cached) {
            return null;
        }

        const entry = JSON.parse(cached);
        const age = Date.now() - entry.timestamp;

        if (age > entry.ttl) {
            // Cache expired, but return it anyway (stale data better than no data)
            log(`Cache stale: ${key} (age: ${Math.floor(age / 1000)}s)`);
            return { data: entry.data, stale: true, age: age };
        }

        log(`Cache hit: ${key} (age: ${Math.floor(age / 1000)}s)`);
        return { data: entry.data, stale: false, age: age };
    } catch (error) {
        logError(`Failed to retrieve cached data: ${key}`, error);
        return null;
    }
}

/**
 * Check if cache exists and is valid
 * @param {string} key - Cache key
 * @returns {boolean} True if valid cache exists
 */
function hasCachedData(key) {
    const cached = getCachedData(key);
    return cached !== null && !cached.stale;
}

/**
 * Remove specific cache entry
 * @param {string} key - Cache key
 */
function removeCachedData(key) {
    try {
        localStorage.removeItem(key);
        log(`Removed cache: ${key}`);
    } catch (error) {
        logError(`Failed to remove cache: ${key}`, error);
    }
}

/**
 * Clean up old cache entries (older than 24 hours)
 * @returns {number} Number of entries removed
 */
function cleanupCache() {
    let removed = 0;
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

    try {
        const keysToRemove = [];

        // Find all ESPN cache keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('espn:')) {
                try {
                    const cached = localStorage.getItem(key);
                    const entry = JSON.parse(cached);
                    if (entry.timestamp < oneDayAgo) {
                        keysToRemove.push(key);
                    }
                } catch (error) {
                    // Invalid entry, mark for removal
                    keysToRemove.push(key);
                }
            }
        }

        // Remove old entries
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            removed++;
        });

        if (removed > 0) {
            log(`Cleaned up ${removed} old cache entries`);
        }

        return removed;
    } catch (error) {
        logError('Failed to cleanup cache', error);
        return 0;
    }
}

/**
 * Clear all ESPN cache data
 */
function clearAllCache() {
    try {
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('espn:')) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });

        log(`Cleared all cache (${keysToRemove.length} entries)`);
        showToast('Cache cleared successfully', 'success');
    } catch (error) {
        logError('Failed to clear cache', error);
        showToast('Failed to clear cache', 'error');
    }
}

/**
 * Save user preference
 * @param {string} key - Preference key
 * @param {any} value - Preference value
 */
function savePreference(key, value) {
    try {
        const prefKey = `nfl-sim:${key}`;
        localStorage.setItem(prefKey, JSON.stringify(value));
        log(`Saved preference: ${key}`);
    } catch (error) {
        logError(`Failed to save preference: ${key}`, error);
    }
}

/**
 * Get user preference
 * @param {string} key - Preference key
 * @param {any} defaultValue - Default value if not found
 * @returns {any} Preference value
 */
function getPreference(key, defaultValue = null) {
    try {
        const prefKey = `nfl-sim:${key}`;
        const value = localStorage.getItem(prefKey);
        if (value === null) {
            return defaultValue;
        }
        return JSON.parse(value);
    } catch (error) {
        logError(`Failed to get preference: ${key}`, error);
        return defaultValue;
    }
}

/**
 * Remove user preference
 * @param {string} key - Preference key
 */
function removePreference(key) {
    try {
        const prefKey = `nfl-sim:${key}`;
        localStorage.removeItem(prefKey);
        log(`Removed preference: ${key}`);
    } catch (error) {
        logError(`Failed to remove preference: ${key}`, error);
    }
}

/**
 * Get storage usage information
 * @returns {Object} Storage usage stats
 */
function getStorageInfo() {
    try {
        let totalSize = 0;
        let espnCacheSize = 0;
        let espnCacheCount = 0;
        let prefSize = 0;
        let prefCount = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                const value = localStorage.getItem(key);
                const size = value ? value.length : 0;
                totalSize += size;

                if (key.startsWith('espn:')) {
                    espnCacheSize += size;
                    espnCacheCount++;
                } else if (key.startsWith('nfl-sim:')) {
                    prefSize += size;
                    prefCount++;
                }
            }
        }

        return {
            totalSize: totalSize,
            totalSizeKB: (totalSize / 1024).toFixed(2),
            espnCacheSize: espnCacheSize,
            espnCacheSizeKB: (espnCacheSize / 1024).toFixed(2),
            espnCacheCount: espnCacheCount,
            prefSize: prefSize,
            prefSizeKB: (prefSize / 1024).toFixed(2),
            prefCount: prefCount
        };
    } catch (error) {
        logError('Failed to get storage info', error);
        return null;
    }
}

/**
 * Log storage usage to console
 */
function logStorageInfo() {
    const info = getStorageInfo();
    if (info) {
        console.group('Storage Usage');
        console.log(`Total Size: ${info.totalSizeKB} KB`);
        console.log(`ESPN Cache: ${info.espnCacheSizeKB} KB (${info.espnCacheCount} entries)`);
        console.log(`Preferences: ${info.prefSizeKB} KB (${info.prefCount} entries)`);
        console.groupEnd();
    }
}

/**
 * Check if game state has changed
 * @param {string} gameId - Game ID
 * @param {Object} newData - New game data
 * @returns {boolean} True if state changed
 */
function hasGameStateChanged(gameId, newData) {
    const lastHashKey = `espn:game:${gameId}:lastStateHash`;
    const lastHash = localStorage.getItem(lastHashKey);

    const newHash = generateStateHash(newData);

    if (newHash !== lastHash) {
        localStorage.setItem(lastHashKey, newHash);
        log(`Game state changed for game ${gameId}`);
        return true;
    }

    log(`Game state unchanged for game ${gameId}`);
    return false;
}

/**
 * Initialize storage (run on app startup)
 * Cleans up old cache automatically
 */
function initStorage() {
    log('Initializing storage');
    cleanupCache();
    logStorageInfo();

    // Set up periodic cleanup (every hour)
    setInterval(() => {
        log('Running periodic cache cleanup');
        cleanupCache();
    }, 60 * 60 * 1000);
}

/**
 * Export all preferences (for backup/debugging)
 * @returns {Object} All preferences
 */
function exportPreferences() {
    const preferences = {};

    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('nfl-sim:')) {
                const shortKey = key.replace('nfl-sim:', '');
                preferences[shortKey] = getPreference(shortKey);
            }
        }
        return preferences;
    } catch (error) {
        logError('Failed to export preferences', error);
        return {};
    }
}

/**
 * Import preferences (from backup)
 * @param {Object} preferences - Preferences object
 */
function importPreferences(preferences) {
    try {
        Object.keys(preferences).forEach(key => {
            savePreference(key, preferences[key]);
        });
        log(`Imported ${Object.keys(preferences).length} preferences`);
        showToast('Preferences imported successfully', 'success');
    } catch (error) {
        logError('Failed to import preferences', error);
        showToast('Failed to import preferences', 'error');
    }
}

/**
 * Reset all app data (cache + preferences)
 */
function resetAllData() {
    if (!confirm('Are you sure you want to reset all data? This cannot be undone.')) {
        return;
    }

    try {
        const keysToRemove = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('espn:') || key.startsWith('nfl-sim:'))) {
                keysToRemove.push(key);
            }
        }

        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });

        log(`Reset all data (${keysToRemove.length} entries removed)`);
        showToast('All data reset successfully', 'success');

        // Reload page
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    } catch (error) {
        logError('Failed to reset data', error);
        showToast('Failed to reset data', 'error');
    }
}

// Export for use in other modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        cacheData,
        getCachedData,
        hasCachedData,
        removeCachedData,
        cleanupCache,
        clearAllCache,
        savePreference,
        getPreference,
        removePreference,
        getStorageInfo,
        logStorageInfo,
        hasGameStateChanged,
        initStorage,
        exportPreferences,
        importPreferences,
        resetAllData
    };
}
