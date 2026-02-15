/**
 * File I/O Optimizer
 * 
 * Performance utilities for file system operations:
 * 
 * 1. PathCache: Caches fs.pathExists results within a session (TTL-based)
 * 2. batchWrite: Writes multiple files in parallel via Promise.all
 * 3. writeJsonFast: Uses fs.writeFile + JSON.stringify (avoids fs.writeJson double serialize)
 * 4. readDirCached: Caches readdir results for repeated directory listings
 * 
 * These are drop-in replacements for fs-extra functions.
 * 
 * @module utils/file-io-optimizer
 */

const fs = require('fs-extra');
const path = require('path');

// ═══════════════════════════════════════════════════
// PATH EXISTS CACHE
// ═══════════════════════════════════════════════════

const pathCache = new Map();
const PATH_CACHE_TTL = 30000; // 30 seconds TTL
const MAX_CACHE_SIZE = 500;

/**
 * Cached version of fs.pathExists
 * Reduces redundant syscalls when checking same paths repeatedly
 */
async function pathExistsCached(filePath) {
    const now = Date.now();
    const cached = pathCache.get(filePath);

    if (cached && (now - cached.time) < PATH_CACHE_TTL) {
        return cached.exists;
    }

    const exists = await fs.pathExists(filePath);

    // Evict oldest entries if cache is full
    if (pathCache.size >= MAX_CACHE_SIZE) {
        const oldest = [...pathCache.entries()]
            .sort((a, b) => a[1].time - b[1].time)
            .slice(0, Math.floor(MAX_CACHE_SIZE / 4));
        for (const [key] of oldest) {
            pathCache.delete(key);
        }
    }

    pathCache.set(filePath, { exists, time: now });
    return exists;
}

/**
 * Invalidate cache for a specific path and its parent
 * Call this after write/delete operations
 */
function invalidatePathCache(filePath) {
    pathCache.delete(filePath);
    pathCache.delete(path.dirname(filePath));
}

/**
 * Invalidate all cache entries under a directory
 */
function invalidatePathCacheDir(dirPath) {
    for (const [key] of pathCache) {
        if (key.startsWith(dirPath)) {
            pathCache.delete(key);
        }
    }
}

/**
 * Clear entire path cache
 */
function clearPathCache() {
    pathCache.clear();
}

// ═══════════════════════════════════════════════════
// BATCH FILE OPERATIONS
// ═══════════════════════════════════════════════════

/**
 * Write multiple files in parallel
 * 
 * @param {Array<{path: string, data: any, options?: object}>} writes
 *   Each entry: { path, data, options }
 *   - If data is object → JSON.stringify + writeFile
 *   - If data is string/Buffer → writeFile directly
 * @returns {Promise<void>}
 */
async function batchWrite(writes) {
    const operations = writes.map(({ path: filePath, data, options }) => {
        invalidatePathCache(filePath);
        if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
            const spaces = options?.spaces;
            const json = spaces ? JSON.stringify(data, null, spaces) : JSON.stringify(data);
            return fs.writeFile(filePath, json, 'utf-8');
        }
        return fs.writeFile(filePath, data, options);
    });
    await Promise.all(operations);
}

// ═══════════════════════════════════════════════════
// FAST JSON WRITE
// ═══════════════════════════════════════════════════

/**
 * Write JSON to file using writeFile + JSON.stringify
 * Faster than fs.writeJson which does double serialization internally
 * 
 * @param {string} filePath - Path to write to
 * @param {any} data - Data to serialize as JSON
 * @param {object} options - { spaces: number } for pretty-printing
 */
async function writeJsonFast(filePath, data, options = {}) {
    invalidatePathCache(filePath);
    const spaces = options.spaces;
    const json = spaces ? JSON.stringify(data, null, spaces) : JSON.stringify(data);
    await fs.writeFile(filePath, json, 'utf-8');
}

// ═══════════════════════════════════════════════════
// CACHED READDIR
// ═══════════════════════════════════════════════════

const readDirCache = new Map();
const READDIR_CACHE_TTL = 10000; // 10s TTL (shorter since dirs change more)

/**
 * Cached version of fs.readdir with withFileTypes
 */
async function readdirCached(dirPath, options) {
    const now = Date.now();
    const key = `${dirPath}:${JSON.stringify(options || {})}`;
    const cached = readDirCache.get(key);

    if (cached && (now - cached.time) < READDIR_CACHE_TTL) {
        return cached.result;
    }

    const result = await fs.readdir(dirPath, options);
    readDirCache.set(key, { result, time: now });
    return result;
}

/**
 * Batch check existence of multiple files in parallel
 * Returns Map<filePath, boolean>
 */
async function batchPathExists(filePaths) {
    const results = new Map();
    const uncached = [];

    for (const fp of filePaths) {
        const cached = pathCache.get(fp);
        if (cached && (Date.now() - cached.time) < PATH_CACHE_TTL) {
            results.set(fp, cached.exists);
        } else {
            uncached.push(fp);
        }
    }

    if (uncached.length > 0) {
        const checks = await Promise.all(uncached.map(fp => fs.pathExists(fp)));
        for (let i = 0; i < uncached.length; i++) {
            results.set(uncached[i], checks[i]);
            pathCache.set(uncached[i], { exists: checks[i], time: Date.now() });
        }
    }

    return results;
}

module.exports = {
    pathExistsCached,
    invalidatePathCache,
    invalidatePathCacheDir,
    clearPathCache,
    batchWrite,
    writeJsonFast,
    readdirCached,
    batchPathExists
};
