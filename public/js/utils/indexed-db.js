/**
 * IndexedDB Storage System
 * Offloads large data from RAM to IndexedDB for low-memory devices
 */

class IndexedDBManager {
  constructor(dbName = 'MAPITestingDB', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.cacheStats = {
      hits: 0,
      misses: 0,
      writes: 0,
    };
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IndexedDB] Database opened');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('screenshots')) {
          const screenshotStore = db.createObjectStore('screenshots', { keyPath: 'id' });
          screenshotStore.createIndex('timestamp', 'timestamp', { unique: false });
          screenshotStore.createIndex('projectId', 'projectId', { unique: false });
        }

        if (!db.objectStoreNames.contains('apiData')) {
          const apiStore = db.createObjectStore('apiData', { keyPath: 'id' });
          apiStore.createIndex('timestamp', 'timestamp', { unique: false });
          apiStore.createIndex('url', 'url', { unique: false });
        }

        if (!db.objectStoreNames.contains('screenHTML')) {
          const htmlStore = db.createObjectStore('screenHTML', { keyPath: 'id' });
          htmlStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
          cacheStore.createIndex('accessCount', 'accessCount', { unique: false });
        }

        console.log('[IndexedDB] Stores created');
      };
    });
  }

  async set(storeName, key, value, metadata = {}) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      const data = {
        id: key,
        value,
        timestamp: Date.now(),
        accessCount: 0,
        ...metadata
      };

      const request = store.put(data);

      request.onsuccess = () => {
        this.cacheStats.writes++;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, key) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        if (request.result) {
          this.cacheStats.hits++;

          const data = request.result;
          data.accessCount = (data.accessCount || 0) + 1;
          data.lastAccessed = Date.now();
          store.put(data);

          resolve(request.result.value);
        } else {
          this.cacheStats.misses++;
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async evictOldest(storeName, keepCount = 100) {
    if (!this.db) await this.init();

    const all = await this.getAll(storeName);

    all.sort((a, b) => {
      const scoreA = (a.accessCount || 0) * 1000 + a.lastAccessed || 0;
      const scoreB = (b.accessCount || 0) * 1000 + b.lastAccessed || 0;
      return scoreA - scoreB;
    });

    const toDelete = all.slice(0, Math.max(0, all.length - keepCount));

    for (const item of toDelete) {
      await this.delete(storeName, item.id);
    }

    console.log(`[IndexedDB] Evicted ${toDelete.length} items from ${storeName}`);
  }

  async getSize(storeName) {
    if (!this.db) await this.init();

    const all = await this.getAll(storeName);
    let totalSize = 0;

    all.forEach(item => {
      const str = JSON.stringify(item);
      totalSize += new Blob([str]).size;
    });

    return totalSize;
  }

  getStats() {
    return {
      ...this.cacheStats,
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
    };
  }
}

window.IndexedDBManager = IndexedDBManager;
