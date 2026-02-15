/**
 * Tiered Diff Engine
 * 
 * Implements a 3-layer comparison strategy for maximum performance:
 * 
 * Layer 1: Data Masking
 *   - Strip dynamic fields (timestamps, tokens, IDs) before comparison
 *   - Uses regex patterns from comparison-config.js
 * 
 * Layer 2: Hash Check O(1)
 *   - MD5 hash both sides. If identical → PASS immediately (<1ms)
 *   - Avoids expensive deep diff for unchanged data
 * 
 * Layer 3: Deep Diff (Worker Thread)
 *   - Only runs when hashes differ
 *   - Offloaded to background worker thread to prevent event loop blocking
 * 
 * @module utils/tiered-diff-engine
 */

const crypto = require('crypto');
const { Worker } = require('worker_threads');
const path = require('path');
const os = require('os');

// Worker pool for diff operations
let workerPool = [];
let workerIndex = 0;
let taskIdCounter = 0;
const pendingTasks = new Map();
const POOL_SIZE = Math.max(1, Math.min(os.cpus().length - 1, 4)); // 1 to 4 workers

/**
 * Initialize the worker pool
 */
function ensureWorkerPool() {
    if (workerPool.length > 0) return;

    const workerPath = path.join(__dirname, 'diff-worker.js');
    for (let i = 0; i < POOL_SIZE; i++) {
        const worker = new Worker(workerPath);
        worker.on('message', (msg) => {
            const pending = pendingTasks.get(msg.id);
            if (pending) {
                pendingTasks.delete(msg.id);
                if (msg.error) {
                    pending.reject(new Error(msg.error));
                } else {
                    pending.resolve(msg.result);
                }
            }
        });
        worker.on('error', (err) => {
            console.error('[TieredDiff] Worker error:', err.message);
        });
        workerPool.push(worker);
    }
    console.log(`[TieredDiff] ✅ Worker pool initialized (${POOL_SIZE} workers)`);
}

/**
 * Send a task to a worker thread (round-robin)
 */
function runInWorker(task) {
    ensureWorkerPool();
    return new Promise((resolve, reject) => {
        const id = ++taskIdCounter;
        task.id = id;
        pendingTasks.set(id, { resolve, reject });
        const worker = workerPool[workerIndex % workerPool.length];
        workerIndex++;
        worker.postMessage(task);
    });
}

/**
 * Compute MD5 hash of a value (for O(1) equality check)
 * Handles objects by JSON.stringify, strings directly
 */
function computeHash(value) {
    if (value === null || value === undefined) return 'null';
    let str;
    if (typeof value === 'string') {
        str = value;
    } else {
        try {
            // Sort keys for consistent hashing
            str = JSON.stringify(value, Object.keys(value).sort());
        } catch {
            str = JSON.stringify(value);
        }
    }
    return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Apply data masking to an object — strip dynamic fields before comparison
 * Returns a cleaned copy (does not mutate original)
 */
function maskDynamicFields(obj, maskedFields) {
    if (!obj || typeof obj !== 'object' || maskedFields.length === 0) return obj;

    // Build a fast matcher from maskedFields
    const matchers = maskedFields.map(field => {
        // Regex pattern: /pattern/ or /pattern/flags
        const regexMatch = field.match(/^\/(.+)\/([gimsuy]*)$/);
        if (regexMatch) {
            try { return { type: 'regex', re: new RegExp(regexMatch[1], regexMatch[2]) }; } catch { return null; }
        }
        if (field.startsWith('*')) return { type: 'suffix', val: field.substring(1) };
        if (field.endsWith('*')) return { type: 'prefix', val: field.slice(0, -1) };
        return { type: 'exact', val: field };
    }).filter(Boolean);

    function isFieldMasked(key) {
        for (const m of matchers) {
            switch (m.type) {
                case 'exact': if (key === m.val) return true; break;
                case 'prefix': if (key.startsWith(m.val)) return true; break;
                case 'suffix': if (key.endsWith(m.val)) return true; break;
                case 'regex': if (m.re.test(key)) return true; break;
            }
        }
        return false;
    }

    function clean(val) {
        if (val === null || val === undefined) return val;
        if (Array.isArray(val)) return val.map(clean);
        if (typeof val === 'object') {
            const result = {};
            for (const [k, v] of Object.entries(val)) {
                if (!isFieldMasked(k)) {
                    result[k] = clean(v);
                }
            }
            return result;
        }
        return val;
    }

    return clean(obj);
}

// ═══════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════

const TieredDiffEngine = {
    /**
     * Tiered comparison of two JSON objects
     * 
     * @param {Object} main - The reference (old) object
     * @param {Object} section - The test (new) object  
     * @param {Array<string>} maskedFields - Fields to ignore
     * @param {Object} options - { useWorker: true, useHash: true }
     * @returns {Object} { hasChanges, changes, skippedByHash }
     */
    async compareJSON(main, section, maskedFields = [], options = {}) {
        const useHash = options.useHash !== false;
        const useWorker = options.useWorker !== false;

        // Layer 1: Mask dynamic fields
        const cleanMain = maskDynamicFields(main, maskedFields);
        const cleanSection = maskDynamicFields(section, maskedFields);

        // Layer 2: Hash check O(1)
        if (useHash) {
            const hash1 = computeHash(cleanMain);
            const hash2 = computeHash(cleanSection);
            if (hash1 === hash2) {
                return { hasChanges: false, changes: [], skippedByHash: true };
            }
        }

        // Layer 3: Deep diff (worker thread or main thread)
        if (useWorker) {
            try {
                const result = await runInWorker({
                    type: 'json_diff',
                    main: cleanMain,
                    section: cleanSection,
                    maskedFields
                });
                return { ...result, skippedByHash: false };
            } catch (err) {
                console.warn('[TieredDiff] Worker failed, falling back to sync:', err.message);
            }
        }

        // Fallback: sync diff on main thread
        const JsonDiffer = require('./json-differ');
        return { ...JsonDiffer.compare(cleanMain, cleanSection, maskedFields), skippedByHash: false };
    },

    /**
     * Tiered comparison of API response bodies
     * Hash check first, deep diff in worker only if needed
     */
    async compareResponseBodies(body1, body2, options = {}) {
        if (body1 === body2) return null;
        if (body1 === null && body2 === null) return null;
        if (body1 === null || body2 === null) {
            return { detail: body1 === null ? 'Response body added' : 'Response body removed' };
        }

        // Hash check for objects
        if (typeof body1 === 'object' && typeof body2 === 'object') {
            const hash1 = computeHash(body1);
            const hash2 = computeHash(body2);
            if (hash1 === hash2) return null; // identical after hashing

            if (options.useWorker !== false) {
                try {
                    return await runInWorker({
                        type: 'response_body_diff',
                        body1,
                        body2
                    });
                } catch (err) {
                    console.warn('[TieredDiff] Worker fallback for body diff:', err.message);
                }
            }
        }

        // Fallback: string comparison
        const str1 = typeof body1 === 'string' ? body1 : JSON.stringify(body1);
        const str2 = typeof body2 === 'string' ? body2 : JSON.stringify(body2);
        if (str1 === str2) return null;
        if (str1.length !== str2.length) {
            return { detail: `Body size: ${str1.length} → ${str2.length} chars` };
        }
        return { detail: 'Body content changed' };
    },

    /**
     * Compare endpoint APIs with hash check and worker threads
     */
    async compareEndpointAPIs(apis1, apis2, endpoint, options = {}) {
        // Quick hash check — if all request+response bodies are identical, skip deep diff
        const hash1 = computeHash(apis1.map(a => ({ s: a.status, req: a.requestBody, res: a.responseBody })));
        const hash2 = computeHash(apis2.map(a => ({ s: a.status, req: a.requestBody, res: a.responseBody })));
        if (hash1 === hash2) return []; // identical

        if (options.useWorker !== false) {
            try {
                return await runInWorker({
                    type: 'endpoint_apis_diff',
                    apis1,
                    apis2,
                    endpoint
                });
            } catch (err) {
                console.warn('[TieredDiff] Worker fallback for endpoint diff:', err.message);
            }
        }

        // Fallback handled by caller
        return null;
    },

    /**
     * Compare two HTML strings with hash check
     * Returns true if different (needs full diff), false if identical
     */
    htmlHashCheck(html1, html2) {
        if (!html1 && !html2) return false;
        if (!html1 || !html2) return true;
        const hash1 = crypto.createHash('md5').update(html1).digest('hex');
        const hash2 = crypto.createHash('md5').update(html2).digest('hex');
        return hash1 !== hash2;
    },

    /**
     * Shutdown worker pool (call on app exit)
     */
    async shutdown() {
        for (const worker of workerPool) {
            await worker.terminate();
        }
        workerPool = [];
        pendingTasks.clear();
        console.log('[TieredDiff] Worker pool shut down');
    },

    // Export utilities for testing
    computeHash,
    maskDynamicFields
};

module.exports = TieredDiffEngine;
