import { openDB, IDBPDatabase } from 'idb';
import { CacheProvider } from '@/interfaces';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  sizeBytes: number;
}

const DB_NAME = 'manga-translate-cache';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

/**
 * IndexedDB-backed cache.
 * Entries are stored with an expiry timestamp; stale entries are evicted lazily.
 */
export class IDBCacheProvider implements CacheProvider {
  private db: IDBPDatabase | null = null;

  private async getDb(): Promise<IDBPDatabase> {
    if (this.db) return this.db;
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
    return this.db;
  }

  async get<T>(key: string): Promise<T | null> {
    const db = await this.getDb();
    const entry = await db.get(STORE_NAME, key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      // Lazy eviction
      await db.delete(STORE_NAME, key);
      return null;
    }

    return entry.value;
  }

  async set<T>(key: string, value: T, ttlMs = 72 * 60 * 60 * 1000): Promise<void> {
    const db = await this.getDb();
    const serialized = JSON.stringify(value);
    const entry: CacheEntry<T> = {
      value,
      expiresAt: Date.now() + ttlMs,
      sizeBytes: serialized.length * 2, // rough UTF-16 estimate
    };
    await db.put(STORE_NAME, entry, key);
  }

  async delete(key: string): Promise<void> {
    const db = await this.getDb();
    await db.delete(STORE_NAME, key);
  }

  async clear(): Promise<void> {
    const db = await this.getDb();
    await db.clear(STORE_NAME);
  }

  async size(): Promise<number> {
    const db = await this.getDb();
    const keys = await db.getAllKeys(STORE_NAME);
    let total = 0;
    for (const key of keys) {
      const entry = await db.get(STORE_NAME, key) as CacheEntry<unknown> | undefined;
      if (entry) total += entry.sizeBytes;
    }
    return total;
  }

  /** Remove all expired entries — call periodically to free space */
  async evictExpired(): Promise<number> {
    const db = await this.getDb();
    const keys = await db.getAllKeys(STORE_NAME);
    let removed = 0;
    const now = Date.now();
    for (const key of keys) {
      const entry = await db.get(STORE_NAME, key) as CacheEntry<unknown> | undefined;
      if (entry && entry.expiresAt < now) {
        await db.delete(STORE_NAME, key);
        removed++;
      }
    }
    return removed;
  }
}

export const cacheProvider = new IDBCacheProvider();
