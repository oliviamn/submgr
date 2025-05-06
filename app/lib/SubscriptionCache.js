// Simple in-memory cache with expiration
export class SubscriptionCache {
    constructor(ttlMs = 5 * 60 * 1000) { // 5 minutes default TTL
        this.cache = new Map();
        this.ttlMs = ttlMs;
    }

    async getOrFetch(key, fetchFn) {
        const now = Date.now();
        const cached = this.cache.get(key);
        
        if (cached && now - cached.timestamp < this.ttlMs) {
            return cached.data;
        }

        const data = await fetchFn();
        this.cache.set(key, {
            data,
            timestamp: now
        });
        
        return data;
    }

    clear() {
        this.cache.clear();
    }
}

// Singleton instance
export const subscriptionCache = new SubscriptionCache(); 