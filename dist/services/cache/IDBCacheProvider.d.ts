import { CacheProvider } from '@/interfaces';
/**
 * IndexedDB-backed cache.
 * Entries are stored with an expiry timestamp; stale entries are evicted lazily.
 */
export declare class IDBCacheProvider implements CacheProvider {
    private db;
    private getDb;
    get<T>(key: string): Promise<T | null>;
    set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
    size(): Promise<number>;
    /** Remove all expired entries — call periodically to free space */
    evictExpired(): Promise<number>;
}
export declare const cacheProvider: IDBCacheProvider;
//# sourceMappingURL=IDBCacheProvider.d.ts.map