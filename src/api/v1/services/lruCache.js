/**
 * lruCache.js
 * High-performance, zero-dependency In-Memory LRU (Least Recently Used) Cache.
 * 
 * Uses JavaScript's native Map which maintains insertion order.
 * Re-inserting on get/set achieves O(1) LRU eviction.
 */
class LRUCache {
    /**
     * @param {Object} options
     * @param {number} [options.max=200] Maximum number of entries before oldest is evicted
     * @param {number} [options.ttl=1800000] Time-to-live in milliseconds (default: 30 minutes)
     */
    constructor({ max = 200, ttl = 30 * 60 * 1000 } = {}) {
        this.max = max;
        this.ttl = ttl;
        this.cache = new Map();
    }

    /**
     * Retrieve an item from cache.
     * Refreshes access order (moves to newest) and checks TTL.
     * @param {string} key 
     * @returns {any|null}
     */
    get(key) {
        if (!this.cache.has(key)) return null;

        const entry = this.cache.get(key);
        const now = Date.now();

        // Expired entry check
        if (entry.expiresAt && now > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        // Refresh LRU order: delete and re-insert as most recently used
        this.cache.delete(key);
        this.cache.set(key, entry);

        return entry.value;
    }

    /**
     * Store an item in cache.
     * Evicts least recently used item if max capacity is reached.
     * @param {string} key 
     * @param {any} value 
     * @param {number} [customTtl] Optional custom TTL in ms
     */
    set(key, value, customTtl) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.max) {
            // Evict oldest item (first key in Map iterator)
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }

        const effectiveTtl = customTtl !== undefined ? customTtl : this.ttl;
        const entry = {
            value,
            expiresAt: effectiveTtl > 0 ? Date.now() + effectiveTtl : null
        };

        this.cache.set(key, entry);
    }

    /**
     * Check if key exists and is not expired without updating LRU order.
     * @param {string} key 
     * @returns {boolean}
     */
    has(key) {
        if (!this.cache.has(key)) return false;
        const entry = this.cache.get(key);
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return false;
        }
        return true;
    }

    /**
     * Delete an item by key.
     * @param {string} key 
     * @returns {boolean}
     */
    delete(key) {
        return this.cache.delete(key);
    }

    /**
     * Delete all keys starting with a given prefix.
     * Useful for invalidating all roles belonging to a specific firm (e.g. `firm:1:`).
     * @param {string} prefix 
     * @returns {number} Number of keys deleted
     */
    deletePrefix(prefix) {
        let count = 0;
        for (const key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                this.cache.delete(key);
                count++;
            }
        }
        return count;
    }

    /**
     * Clear all entries.
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Current size of cache.
     */
    get size() {
        return this.cache.size;
    }
}

module.exports = LRUCache;
