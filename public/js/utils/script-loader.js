/**
 * ScriptLoader — Dynamic script loading with caching & idle prefetch
 * Load scripts on-demand when user opens specific tabs,
 * or prefetch them during idle time so they're ready instantly.
 */
const ScriptLoader = {
    loaded: new Set(),
    loading: new Map(),

    /**
     * Load a single script by src URL
     * Returns immediately if already loaded
     */
    load(src) {
        if (this.loaded.has(src)) return Promise.resolve();
        if (this.loading.has(src)) return this.loading.get(src);

        const promise = new Promise((resolve, reject) => {
            // Check if script tag already exists in DOM (pre-loaded)
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                this.loaded.add(src);
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                this.loaded.add(src);
                this.loading.delete(src);
                console.log(`[ScriptLoader] Loaded: ${src}`);
                resolve();
            };
            script.onerror = (err) => {
                this.loading.delete(src);
                console.error(`[ScriptLoader] Failed: ${src}`, err);
                reject(new Error(`Failed to load script: ${src}`));
            };
            document.head.appendChild(script);
        });

        this.loading.set(src, promise);
        return promise;
    },

    /**
     * Load multiple scripts in order (sequential for dependencies)
     */
    async loadAll(srcs) {
        for (const src of srcs) {
            await this.load(src);
        }
    },

    /**
     * Load multiple scripts in parallel (no dependency between them)
     */
    loadParallel(srcs) {
        return Promise.all(srcs.map(src => this.load(src)));
    },

    /**
     * Check if a script is already loaded
     */
    isLoaded(src) {
        return this.loaded.has(src);
    },

    /**
     * Prefetch scripts during browser idle time.
     * Loads one script per idle window to avoid jank.
     * Uses requestIdleCallback (falls back to setTimeout).
     * @param {string[]} srcs - Array of script URLs to prefetch
     * @param {number} delayMs - Initial delay before starting (default 3000ms)
     */
    prefetchWhenIdle(srcs, delayMs = 3000) {
        const pending = srcs.filter(s => !this.loaded.has(s) && !this.loading.has(s));
        if (!pending.length) return;

        console.log(`[ScriptLoader] Will prefetch ${pending.length} scripts after ${delayMs}ms idle`);

        const scheduleIdle = (callback) => {
            if ('requestIdleCallback' in window) {
                requestIdleCallback(callback, { timeout: 5000 });
            } else {
                setTimeout(callback, 100);
            }
        };

        // Wait initial delay, then start prefetching one-by-one
        setTimeout(() => {
            let idx = 0;

            const loadNext = () => {
                if (idx >= pending.length) {
                    console.log('[ScriptLoader] Prefetch complete');
                    return;
                }

                scheduleIdle(() => {
                    const src = pending[idx++];
                    // Skip if already loaded while waiting
                    if (this.loaded.has(src)) {
                        loadNext();
                        return;
                    }

                    this.load(src)
                        .then(() => loadNext())
                        .catch(() => loadNext()); // continue even if one fails
                });
            };

            loadNext();
        }, delayMs);
    }
};

window.ScriptLoader = ScriptLoader;
