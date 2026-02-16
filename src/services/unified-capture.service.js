/**
 * Unified Capture Service - Maximum Data for Testing
 * 
 * Purpose: Capture MAXIMUM data for UI & API comparison testing
 * 
 * Data per Capture:
 * - screen.html (full HTML for preview, compare & replay)
 * - dom.json (structured DOM tree for element-level comparison)
 * - apis.json (FULL API data: all headers, full request/response bodies)
 * - actions.json (user actions for replay)
 * - meta.json (metadata + screen assignment info)
 * 
 * Performance optimizations (without sacrificing data):
 * - Batched IPC: actions buffered in browser, sent every 500ms
 * - No getComputedStyle (uses el.offsetParent for visibility)
 * - Parallel file writes with Promise.all
 * - CSS pointer-events for freeze (not 30 event listeners)
 * - Incremental JSONL save (crash-safe)
 * - DOM serialized AFTER user confirms (not during freeze)
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const storageService = require('./storage.service');

const CHROME_DEBUG_PORT = 9222;
const DEBUG = process.env.CAPTURE_DEBUG === '1';

function debugLog(...args) {
    if (DEBUG) console.log(...args);
}

class UnifiedCaptureService {
    constructor() {
        // Browser state
        this.browser = null;
        this.context = null;
        this.page = null;
        this.cdpSession = null;

        // Session state
        this.currentSession = null;
        this.isClosing = false;
        this.captureCounter = 0;

        // API Tracking - Full data for comparison
        this.pendingAPIs = [];
        this.allSessionAPIs = [];  // Keep full session history for testing
        this.sessionAPICount = 0;

        // Action Tracking
        this.pendingActions = [];
        this.allSessionActions = [];  // Keep full session history
        this.sessionActionCount = 0;

        // Incremental writer
        this.streamWriter = null;

        // Frozen state for capture
        this.frozenState = null;

        // URL change tracking — reset pending data on navigation
        this.lastPagePath = null;

        console.log('[UnifiedCapture] ✅ Service initialized (Performance Mode)');
    }

    /**
     * Get Chrome executable path
     */
    getChromePath() {
        if (process.platform === 'darwin') {
            const paths = [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome',
                '/usr/bin/google-chrome'
            ];
            for (const p of paths) {
                if (fs.existsSync(p)) return p;
            }
        } else if (process.platform === 'win32') {
            const paths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
            ];
            for (const p of paths) {
                if (fs.existsSync(p)) return p;
            }
        }
        return 'google-chrome';
    }

    /**
     * Reset all state
     */
    async resetState() {
        console.log('[UnifiedCapture] 🧹 Resetting state...');
        this.isClosing = true;

        // Flush any remaining stream data
        if (this.streamWriter) {
            await this.streamWriter.flush();
            this.streamWriter = null;
        }

        try {
            if (this.cdpSession) {
                await this.cdpSession.detach().catch(() => { });
                this.cdpSession = null;
            }
            if (this.page) {
                await this.page.close().catch(() => { });
                this.page = null;
            }
            if (this.context) {
                await this.context.close().catch(() => { });
                this.context = null;
            }
            if (this.browser) {
                await this.browser.close().catch(() => { });
                this.browser = null;
            }
        } catch (e) {
            console.log('[UnifiedCapture] Reset error:', e.message);
        }

        this.currentSession = null;
        this.pendingAPIs = [];
        this.sessionAPICount = 0;
        this.pendingActions = [];
        this.sessionActionCount = 0;
        this.captureCounter = 0;
        this.frozenState = null;
        this.isClosing = false;
    }

    /**
     * Start a new capture session
     */
    async startSession(projectName, startUrl, deviceProfile) {
        if (this.browser) {
            console.log('[UnifiedCapture] Session already running, resetting...');
            await this.resetState();
        }

        this.isClosing = false;
        this.pendingAPIs = [];
        this.sessionAPICount = 0;
        this.pendingActions = [];
        this.sessionActionCount = 0;
        this.captureCounter = 0;
        this.frozenState = null;

        console.log(`[UnifiedCapture] 🚀 Starting session: ${projectName} -> ${startUrl}`);

        // Get auth data
        const authData = await storageService.getAuth(projectName);

        // Create new section
        const section = await storageService.createSection(projectName);

        try {
            // Launch browser
            const chromePath = this.getChromePath();
            this.browser = await chromium.launch({
                headless: false,
                executablePath: chromePath,
                args: [
                    '--no-sandbox',
                    '--disable-infobars',
                    '--disable-features=TranslateUI',
                    `--remote-debugging-port=${CHROME_DEBUG_PORT}`,
                    '--start-maximized',
                    // Performance optimizations
                    '--disable-extensions',
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-breakpad',
                    '--disable-component-update',
                    '--disable-default-apps',
                    '--disable-dev-shm-usage',
                    '--disable-hang-monitor',
                    '--disable-ipc-flooding-protection',
                    '--disable-popup-blocking',
                    '--disable-prompt-on-repost',
                    '--disable-renderer-backgrounding',
                    '--disable-sync',
                    '--metrics-recording-only',
                    '--no-first-run',
                    '--password-store=basic',
                    '--use-mock-keychain'
                ]
            });

            // Resolve device profile for viewport/userAgent
            const DEVICE_PRESETS = {
                desktop: { viewport: null, userAgent: null },
                tablet: { viewport: { width: 768, height: 1024 }, userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15' },
                mobile: { viewport: { width: 375, height: 812 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' }
            };

            const profileName = (deviceProfile && deviceProfile.name) || 'desktop';
            let resolved = DEVICE_PRESETS[profileName] || DEVICE_PRESETS.desktop;

            // Custom profile with user-provided dimensions
            if (profileName === 'custom' && deviceProfile) {
                const w = Math.max(280, Math.min(3840, parseInt(deviceProfile.width) || 1440));
                const h = Math.max(400, Math.min(2560, parseInt(deviceProfile.height) || 900));
                resolved = { viewport: { width: w, height: h }, userAgent: null };
            }

            const contextOptions = {
                viewport: resolved.viewport,
                ignoreHTTPSErrors: true
            };
            if (resolved.userAgent) {
                contextOptions.userAgent = resolved.userAgent;
            }

            this.context = await this.browser.newContext(contextOptions);

            this.page = await this.context.newPage();

            // Track URL changes for logging (do NOT clear pendingActions/pendingAPIs here —
            // actions must persist across URL changes until user captures the next section.
            // API filtering by page is handled via originPath in __freezeState.)
            this.lastPagePath = null;
            this.page.on('framenavigated', (frame) => {
                if (frame !== this.page.mainFrame()) return;
                const newUrl = frame.url();
                if (!newUrl || newUrl === 'about:blank') return;
                const newPath = this.extractPath(newUrl);
                if (this.lastPagePath && newPath !== this.lastPagePath) {
                    console.log(`[UnifiedCapture] URL changed: ${this.lastPagePath} → ${newPath}`);
                }
                this.lastPagePath = newPath;
            });

            // Extract domain and path from startUrl
            let domain = '';
            let startPath = '/';
            try {
                const urlObj = new URL(startUrl);
                domain = urlObj.origin;
                startPath = urlObj.pathname + urlObj.search;
            } catch (e) {
                domain = startUrl;
                startPath = '/';
            }

            // Initialize session data
            this.currentSession = {
                projectName,
                sectionTimestamp: section.timestamp,
                sectionPath: section.path,
                startUrl,
                domain,
                startTime: new Date(),

                // Flow structure
                captures: [],
                flowGraph: {
                    domain,
                    deviceProfile: profileName,
                    nodes: [{ id: 'start', name: 'Start', type: 'start', path: startPath }],
                    edges: []
                },

                lastCaptureId: 'start',
                lastCaptureUrl: startUrl,

                // Map: urlPath → { captureId, folderPath } for retroactive API assignment
                capturedPathsMap: new Map()
            };

            // Initialize incremental stream writer
            this.streamWriter = new StreamWriter(section.path);

            // Setup CDP for network capture FIRST (before navigation)
            await this.setupCDPNetworkCapture();

            // Inject auth
            await this.injectAuth(authData);

            // Setup action recorder (batched)
            await this.setupActionRecorder();

            // Setup ESC key capture modal
            await this.setupCaptureModal();

            // Handle browser disconnect
            this.browser.on('disconnected', async () => {
                if (!this.isClosing) {
                    console.log('[UnifiedCapture] 🔴 Browser closed by user');
                    await this.handleBrowserClose();
                }
            });

            // Navigate to start URL
            console.log(`[UnifiedCapture] Navigating to: ${startUrl}`);
            await this.page.goto(startUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 45000
            }).catch(e => console.log('[UnifiedCapture] Navigation warning:', e.message));

            // Save URL history
            await storageService.saveUrlToHistory(projectName, startUrl);

            return {
                status: 'started',
                projectName,
                sectionTimestamp: section.timestamp,
                startUrl,
                message: 'Nhấn ESC để capture màn hình. APIs đang được theo dõi từ bây giờ.'
            };

        } catch (error) {
            console.error('[UnifiedCapture] Start failed:', error);
            await this.resetState();
            throw error;
        }
    }

    /**
     * Setup CDP for network capture - FULL DATA for testing
     * Captures ALL headers, full request/response bodies, clear screen assignment
     */
    async setupCDPNetworkCapture() {
        if (!this.page) return;

        try {
            this.cdpSession = await this.context.newCDPSession(this.page);
            await this.cdpSession.send('Network.enable');

            const pendingRequests = new Map();

            // ═══════════════════════════════════════
            // SMART CAPTURE: Tracker/Analytics blocking
            // ═══════════════════════════════════════
            const trackerPatterns = [
                /google-analytics\.com/i,
                /googletagmanager\.com/i,
                /gtag\/js/i,
                /analytics\.google\.com/i,
                /facebook\.com\/tr/i,
                /connect\.facebook\.net/i,
                /pixel\.facebook\.com/i,
                /doubleclick\.net/i,
                /hotjar\.com/i,
                /clarity\.ms/i,
                /sentry\.io\/api/i,
                /amplitude\.com/i,
                /mixpanel\.com/i,
                /segment\.io/i,
                /segment\.com/i,
                /intercom\.io/i,
                /crisp\.chat/i,
                /tawk\.to/i,
                /newrelic\.com/i,
                /datadog/i,
                /bugsnag/i,
                /rollbar\.com/i,
                /fullstory\.com/i,
                /logrocket/i,
                /appsflyer\.com/i,
                /branch\.io/i,
                /bat\.bing\.com/i,
                /ads\.linkedin\.com/i,
                /snap\.licdn\.com/i
            ];

            const isTracker = (url) => trackerPatterns.some(p => p.test(url));

            // ═══════════════════════════════════════
            // SMART CAPTURE: API response deduplication
            // ═══════════════════════════════════════
            const apiResponseHashes = new Map(); // hash → count
            let trackerBlockedCount = 0;
            let dedupCount = 0;

            // Request started
            this.cdpSession.on('Network.requestWillBeSent', (params) => {
                const { requestId, request, type, documentURL } = params;

                // Only track API calls (XHR, Fetch)
                const isAPI = request.url.includes('/api/') ||
                    request.url.includes('/graphql') ||
                    ['XHR', 'Fetch'].includes(type);

                if (isAPI) {
                    // Smart Capture: Skip tracker/analytics URLs
                    if (isTracker(request.url)) {
                        trackerBlockedCount++;
                        debugLog(`[API] 🚫 Blocked tracker: ${this.shortenUrl(request.url)}`);
                        return;
                    }

                    const originUrl = documentURL || this.page?.url() || '';

                    const apiEntry = {
                        id: requestId,
                        method: request.method,
                        url: request.url,
                        reqHeaders: this.extractHeaders(request.headers),
                        requestBody: this.parseRequestBody(request.postData),
                        time: Date.now(),
                        originUrl: originUrl,
                        originPath: this.extractPath(originUrl)
                    };

                    pendingRequests.set(requestId, apiEntry);

                    // CDP may not include postData in the event even for POST requests.
                    // When hasPostData is true but postData is missing, fetch it explicitly.
                    // Store the promise so loadingFinished can await it before saving.
                    if (!request.postData && request.hasPostData) {
                        apiEntry._postDataPromise = this.cdpSession.send('Network.getRequestPostData', { requestId })
                            .then(({ postData }) => {
                                if (postData) {
                                    apiEntry.requestBody = this.parseRequestBody(postData);
                                    debugLog(`[API] 📦 Fetched postData for ${this.shortenUrl(request.url)}`);
                                }
                            })
                            .catch(() => { /* requestId may no longer be valid */ });
                    }

                    debugLog(`[API] 📤 ${request.method} ${this.shortenUrl(request.url)}${request.hasPostData && !request.postData ? ' (postData pending)' : ''}`);
                }
            });

            // Response received
            this.cdpSession.on('Network.responseReceived', (params) => {
                const { requestId, response } = params;
                const apiEntry = pendingRequests.get(requestId);
                if (apiEntry) {
                    apiEntry.status = response.status;
                    apiEntry.statusText = response.statusText || '';
                    apiEntry.mimeType = response.mimeType || '';
                    // Save ALL response headers for testing
                    apiEntry.resHeaders = this.extractHeaders(response.headers);
                }
            });

            // Response body loaded - Save FULL body (no truncation)
            this.cdpSession.on('Network.loadingFinished', async (params) => {
                const { requestId } = params;
                const apiEntry = pendingRequests.get(requestId);

                if (apiEntry) {
                    // Wait for any pending postData fetch to complete before saving
                    if (apiEntry._postDataPromise) {
                        await apiEntry._postDataPromise;
                        delete apiEntry._postDataPromise;
                    }

                    try {
                        const { body, base64Encoded } = await this.cdpSession.send('Network.getResponseBody', { requestId });
                        if (body) {
                            let responseBody = base64Encoded ? Buffer.from(body, 'base64').toString('utf-8') : body;
                            try {
                                apiEntry.responseBody = JSON.parse(responseBody);
                            } catch {
                                apiEntry.responseBody = responseBody;
                            }
                        }
                    } catch (e) { /* ignore - body may not be available */ }

                    apiEntry.duration = Date.now() - apiEntry.time;

                    // Smart Capture: API deduplication by hash
                    const dedupKey = `${apiEntry.method}:${apiEntry.url}:${apiEntry.status}`;
                    const bodyStr = typeof apiEntry.responseBody === 'object'
                        ? JSON.stringify(apiEntry.responseBody)
                        : String(apiEntry.responseBody || '');
                    const hash = crypto.createHash('md5').update(dedupKey + bodyStr).digest('hex');

                    const prevCount = apiResponseHashes.get(hash) || 0;
                    apiResponseHashes.set(hash, prevCount + 1);

                    if (prevCount > 0) {
                        // Duplicate response — store lightweight marker instead of full body
                        apiEntry.deduplicated = true;
                        apiEntry.dedupHash = hash;
                        apiEntry.dedupOccurrence = prevCount + 1;
                        // Keep responseBody for first occurrence, strip for duplicates
                        apiEntry.responseBody = `[DEDUP #${prevCount + 1}] Same as previous ${apiEntry.method} ${this.shortenUrl(apiEntry.url)}`;
                        dedupCount++;
                        debugLog(`[API] ♻️ Dedup #${prevCount + 1}: ${apiEntry.method} ${this.shortenUrl(apiEntry.url)}`);
                    }

                    this.pendingAPIs.push(apiEntry);
                    this.allSessionAPIs.push(apiEntry);
                    this.sessionAPICount++;
                    pendingRequests.delete(requestId);

                    if (this.streamWriter) {
                        this.streamWriter.appendAPI(apiEntry);
                    }

                    debugLog(`[API] ✅ ${apiEntry.status} ${this.shortenUrl(apiEntry.url)} (${apiEntry.duration}ms)`);
                }
            });

            // Request failed
            this.cdpSession.on('Network.loadingFailed', async (params) => {
                const { requestId, errorText } = params;
                const apiEntry = pendingRequests.get(requestId);

                if (apiEntry) {
                    // Wait for any pending postData fetch
                    if (apiEntry._postDataPromise) {
                        await apiEntry._postDataPromise;
                        delete apiEntry._postDataPromise;
                    }

                    apiEntry.status = 0;
                    apiEntry.error = errorText;
                    apiEntry.duration = Date.now() - apiEntry.time;

                    this.pendingAPIs.push(apiEntry);
                    this.allSessionAPIs.push(apiEntry);
                    this.sessionAPICount++;
                    pendingRequests.delete(requestId);

                    // Stream to disk
                    if (this.streamWriter) {
                        this.streamWriter.appendAPI(apiEntry);
                    }

                    debugLog(`[API] ❌ FAILED ${this.shortenUrl(apiEntry.url)}`);
                }
            });

            console.log('[UnifiedCapture] ✅ CDP Network capture enabled (Full Data Mode + Smart Filtering)');
        } catch (e) {
            console.log('[UnifiedCapture] ⚠️ CDP setup failed:', e.message);
        }
    }

    /**
     * Extract ALL headers for complete testing comparison
     * Excludes only noise headers that change every request
     */
    extractHeaders(headers) {
        if (!headers) return {};
        const noiseHeaders = ['date', 'age', 'x-request-id', 'x-trace-id', 'cf-ray', 'server-timing'];
        const result = {};
        for (const key of Object.keys(headers)) {
            if (!noiseHeaders.includes(key.toLowerCase())) {
                result[key] = headers[key];
            }
        }
        return result;
    }

    /**
     * Parse request body to JSON if possible — NO TRUNCATION for testing
     */
    parseRequestBody(postData) {
        if (!postData) return null;
        try {
            return JSON.parse(postData);
        } catch {
            return postData;  // Keep full body for testing
        }
    }

    /**
     * Shorten URL for logging
     */
    shortenUrl(url) {
        try {
            const u = new URL(url);
            return u.pathname.substring(0, 50) + (u.search ? '?' + u.search.substring(0, 20) : '');
        } catch {
            return url.substring(0, 60);
        }
    }

    /**
     * Extract path from URL for API assignment
     */
    extractPath(url) {
        try {
            return new URL(url).pathname;
        } catch {
            return url;
        }
    }

    /**
     * Inject authentication data
     */
    async injectAuth(authData) {
        if (!authData) return;

        if (authData.cookies?.length > 0) {
            await this.context.addCookies(authData.cookies).catch(() => { });
        }

        if (authData.localStorage || authData.sessionStorage) {
            await this.page.addInitScript((storage) => {
                if (storage.localStorage) {
                    Object.entries(storage.localStorage).forEach(([k, v]) => {
                        try { window.localStorage.setItem(k, v); } catch { }
                    });
                }
                if (storage.sessionStorage) {
                    Object.entries(storage.sessionStorage).forEach(([k, v]) => {
                        try { window.sessionStorage.setItem(k, v); } catch { }
                    });
                }
            }, { localStorage: authData.localStorage, sessionStorage: authData.sessionStorage });
        }
    }

    /**
     * Setup action recorder - BATCHED for performance
     * 
     * Key optimization: Actions are buffered in browser and sent as a batch
     * every 500ms via a single IPC call, instead of 1 IPC per event.
     * On a weak machine this reduces IPC overhead by ~95%.
     */
    async setupActionRecorder() {
        // BATCHED: Receive multiple actions in one IPC call
        await this.context.exposeBinding('__recordActions', ({ page }, actions) => {
            if (!this.currentSession) return;

            for (const action of actions) {
                // Deduplicate consecutive inputs to same field
                const last = this.pendingActions[this.pendingActions.length - 1];
                if (last?.type === 'input' && action.type === 'input' && last.selector === action.selector) {
                    last.value = action.value;
                    last.time = action.time;
                    continue;
                }

                this.pendingActions.push(action);
                this.sessionActionCount++;

                // Stream to disk for crash safety
                if (this.streamWriter) {
                    this.streamWriter.appendAction(action);
                }

                debugLog(`[Action] 🖱️ ${action.type}: ${action.selector?.substring(0, 40) || ''}`);
            }
        });

        // Inject BATCHED action tracking into browser
        await this.page.addInitScript(() => {
            // ===== ACTION BUFFER (Key perf optimization) =====
            // Buffer actions in browser, send batch every 500ms
            let actionBuffer = [];
            let batchTimer = null;

            function flushActions() {
                if (actionBuffer.length > 0) {
                    try {
                        window.__recordActions(actionBuffer);
                    } catch (e) { /* binding not ready yet */ }
                    actionBuffer = [];
                }
                batchTimer = null;
            }

            function queueAction(action) {
                actionBuffer.push(action);
                if (!batchTimer) {
                    batchTimer = setTimeout(flushActions, 500);
                }
            }

            // Flush immediately before page unload to prevent data loss
            window.addEventListener('beforeunload', () => {
                if (actionBuffer.length > 0) {
                    flushActions();
                }
            });

            // ===== SELECTOR GENERATION =====
            // Generates robust selectors with nth-child for uniqueness
            function getSelector(el) {
                if (!el || el === document.body) return 'body';
                if (el.dataset?.testid) return `[data-testid="${el.dataset.testid}"]`;
                if (el.id && !/^\d/.test(el.id)) {
                    // Verify ID is unique on page
                    try {
                        if (document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) {
                            return '#' + CSS.escape(el.id);
                        }
                    } catch { }
                    return '#' + el.id;
                }
                if (el.name) {
                    try {
                        if (document.querySelectorAll(`[name="${el.name}"]`).length === 1) {
                            return `[name="${el.name}"]`;
                        }
                    } catch { }
                }

                // Build path with nth-child for uniqueness (max 4 levels)
                const parts = [];
                let current = el;
                let depth = 0;
                while (current && current !== document.body && depth < 4) {
                    let seg = current.tagName.toLowerCase();

                    if (current.id && !/^\d/.test(current.id)) {
                        parts.unshift('#' + current.id);
                        break;
                    }
                    if (current.dataset?.testid) {
                        parts.unshift(`[data-testid="${current.dataset.testid}"]`);
                        break;
                    }

                    // Add nth-child if siblings have same tag
                    const parent = current.parentElement;
                    if (parent) {
                        const siblings = parent.children;
                        let sameTagCount = 0;
                        let index = 0;
                        for (let i = 0; i < siblings.length; i++) {
                            if (siblings[i].tagName === current.tagName) {
                                sameTagCount++;
                                if (siblings[i] === current) index = sameTagCount;
                            }
                        }
                        if (sameTagCount > 1) {
                            seg += `:nth-of-type(${index})`;
                        }
                    }

                    parts.unshift(seg);
                    current = current.parentElement;
                    depth++;
                }

                return parts.join(' > ') || el.tagName.toLowerCase();
            }

            let lastInputEl = null;
            let lastInputValue = '';

            // Record input when COMPLETED (blur or Enter)
            function recordInput(el) {
                if (!el || !el.value) return;
                if (el === lastInputEl && el.value === lastInputValue) return;

                lastInputEl = el;
                lastInputValue = el.value;

                queueAction({
                    type: 'input',
                    selector: getSelector(el),
                    value: el.value,
                    time: Date.now()
                });
            }

            // ===== EVENT LISTENERS (passive, minimal) =====

            // CLICK — flush buffer first to prevent data loss on navigation
            document.addEventListener('click', (e) => {
                if (e.target.closest('#capture-modal')) return;
                if (e.target.closest('#capture-overlay')) return;

                // Flush any pending input actions BEFORE recording click
                // This prevents losing input values when click triggers navigation
                flushActions();

                const tag = e.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;

                const rawText = (e.target.innerText || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

                queueAction({
                    type: 'click',
                    selector: getSelector(e.target),
                    text: rawText.substring(0, 30),
                    time: Date.now()
                });
            }, { capture: true, passive: true });

            // INPUT completed on BLUR
            document.addEventListener('blur', (e) => {
                if (e.target.closest('#capture-modal')) return;
                const tag = e.target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
                    recordInput(e.target);
                }
            }, { capture: true, passive: true });

            // INPUT completed on ENTER
            document.addEventListener('keydown', (e) => {
                if (e.target.closest('#capture-modal')) return;
                if (e.key === 'Enter') {
                    const tag = e.target.tagName;
                    if (tag === 'INPUT' || tag === 'TEXTAREA') {
                        recordInput(e.target);
                    }
                }
            }, { capture: true, passive: true });

            // SELECT change
            document.addEventListener('change', (e) => {
                if (e.target.closest('#capture-modal')) return;
                if (e.target.tagName === 'SELECT') {
                    queueAction({
                        type: 'select',
                        selector: getSelector(e.target),
                        value: e.target.value,
                        time: Date.now()
                    });
                }
            }, { capture: true, passive: true });

            // INPUT real-time (debounced) — catches Vue/React components that don't fire blur
            let inputDebounceTimer = null;
            document.addEventListener('input', (e) => {
                if (e.target.closest('#capture-modal')) return;
                const tag = e.target.tagName;
                if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;

                clearTimeout(inputDebounceTimer);
                inputDebounceTimer = setTimeout(() => {
                    recordInput(e.target);
                }, 300);
            }, { capture: true, passive: true });

            // ===== NAVIGATION TRACKING (for replay) =====
            let lastUrl = location.href;

            // Track SPA navigation (pushState/replaceState)
            const origPushState = history.pushState;
            const origReplaceState = history.replaceState;

            function trackNavigation(trigger) {
                if (location.href !== lastUrl) {
                    queueAction({
                        type: 'navigation',
                        from: lastUrl,
                        to: location.href,
                        trigger: trigger,
                        time: Date.now()
                    });
                    lastUrl = location.href;
                }
            }

            history.pushState = function (...args) {
                origPushState.apply(this, args);
                trackNavigation('pushState');
            };
            history.replaceState = function (...args) {
                origReplaceState.apply(this, args);
                trackNavigation('replaceState');
            };
            window.addEventListener('popstate', () => trackNavigation('popstate'));

            // ===== SCROLL TRACKING (debounced, for replay) =====
            let scrollTimer = null;
            window.addEventListener('scroll', () => {
                if (scrollTimer) clearTimeout(scrollTimer);
                scrollTimer = setTimeout(() => {
                    queueAction({
                        type: 'scroll',
                        position: { x: Math.round(scrollX), y: Math.round(scrollY) },
                        time: Date.now()
                    });
                    scrollTimer = null;
                }, 500); // 500ms debounce - only record when scroll stops
            }, { passive: true });
        });
    }

    /**
     * Setup capture modal - ESC key to capture
     * Optimized: CSS pointer-events freeze instead of 30 event listeners
     */
    async setupCaptureModal() {
        // Get capture context
        await this.context.exposeBinding('__getCaptureContext', async ({ page }) => {
            if (!this.currentSession) return { nodes: [] };
            return {
                nodes: this.currentSession.flowGraph.nodes,
                parentId: this.currentSession.lastCaptureId || 'start',
                actions: this.pendingActions.length,
                apis: this.pendingAPIs.length
            };
        });

        // Freeze DOM state - OPTIMIZED: no getComputedStyle, no outerHTML during freeze
        await this.context.exposeBinding('__freezeState', async ({ page }) => {
            debugLog('[UnifiedCapture] ❄️ Freezing...');
            try {
                const currentUrl = this.page?.url() || '';
                const currentPath = this.extractPath(currentUrl);
                const lastCapturePath = this.extractPath(this.currentSession?.lastCaptureUrl || this.currentSession?.startUrl || '');

                // OPTIMIZED: Only capture minimal metadata during freeze
                // Full HTML will be captured AFTER user confirms (in captureCurrentScreen)
                const meta = await this.page.evaluate(() => {
                    return {
                        url: location.href,
                        title: document.title,
                        scroll: { x: Math.round(scrollX), y: Math.round(scrollY) },
                        viewport: { w: innerWidth, h: innerHeight }
                    };
                });

                // Filter APIs: only include APIs that originated from the CURRENT page
                // APIs from previous pages (e.g. login POST when capturing home) are excluded
                const relevantAPIs = this.pendingAPIs.filter(api => {
                    const apiOriginPath = api.originPath || '';
                    // Include ONLY if origin matches current page exactly
                    return apiOriginPath === currentPath;
                });

                const remainingAPIs = this.pendingAPIs.filter(api => {
                    const apiOriginPath = api.originPath || '';
                    // Keep APIs whose origin does NOT match current page
                    // (includes APIs with empty origin — they'll be assigned retroactively)
                    return apiOriginPath !== currentPath;
                });

                this.frozenState = {
                    meta,
                    actions: [...this.pendingActions],
                    apis: relevantAPIs,
                    remainingAPIs: remainingAPIs,
                    time: Date.now()
                };

                console.log('[UnifiedCapture] ❄️ Frozen:', {
                    actions: this.frozenState.actions.length,
                    apis: relevantAPIs.length,
                    remaining: remainingAPIs.length,
                    currentPath
                });
                return true;
            } catch (e) {
                console.error('[UnifiedCapture] Freeze failed:', e);
                return false;
            }
        });

        // Execute capture
        await this.context.exposeBinding('__executeCapture', async ({ page }, options) => {
            return await this.captureCurrentScreen(options);
        });

        // Cancel capture — clear frozen state AND pending data so next ESC re-freezes fresh
        await this.context.exposeBinding('__cancelCapture', async () => {
            this.frozenState = null;
            this.pendingActions = [];
            this.pendingAPIs = [];
            debugLog('[UnifiedCapture] Cancel — frozenState + pending data cleared');
        });

        // Inject minimal capture UI
        await this.page.addInitScript(() => {
            let modal = null;
            let isOpen = false;
            let isCapturing = false;

            function log(...args) { console.log('[Capture]', ...args); }

            // Create modal — uses CSS-only icons (no emoji) for cross-browser/system compatibility
            function createModal() {
                if (modal) return;

                modal = document.createElement('div');
                modal.id = 'capture-modal';
                modal.style.cssText = 'display:none;';
                modal.innerHTML = `
                    <div id="cap-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif">
                        <div style="background:#fff;padding:24px;border-radius:14px;width:380px;max-width:90vw;box-shadow:0 12px 40px rgba(0,0,0,0.3);position:relative" onclick="event.stopPropagation()">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                                <h3 style="margin:0;font-size:16px;color:#333;display:flex;align-items:center;gap:8px">
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style="flex-shrink:0"><rect x="2" y="5" width="16" height="12" rx="2" stroke="#1890ff" stroke-width="1.5"/><path d="M6 5V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" stroke="#1890ff" stroke-width="1.5"/><circle cx="10" cy="11" r="3" stroke="#1890ff" stroke-width="1.5"/></svg>
                                    Capture Screen
                                </h3>
                                <span id="cap-esc-hint" style="font-size:11px;color:#aaa;background:#f5f5f5;padding:2px 8px;border-radius:4px">ESC</span>
                            </div>
                            <div id="cap-stats" style="display:flex;gap:12px;padding:10px;background:#f5f5f5;border-radius:8px;margin-bottom:16px;font-size:13px;color:#555">
                                <span style="display:flex;align-items:center;gap:6px">
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v4M4 3l1.5 1.5M10 3L8.5 4.5M3 7h2m4 0h2M4.5 10L6 8.5M9.5 10L8 8.5M7 9v3" stroke="#fa8c16" stroke-width="1.2" stroke-linecap="round"/></svg>
                                    <b id="stat-actions" style="color:#fa8c16">0</b> actions
                                </span>
                                <span style="display:flex;align-items:center;gap:6px">
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5.5 8.5l3-3M6 5.5H4.5a2.5 2.5 0 0 0 0 5H6m2-5h1.5a2.5 2.5 0 0 1 0 5H8" stroke="#1890ff" stroke-width="1.2" stroke-linecap="round"/></svg>
                                    <b id="stat-apis" style="color:#1890ff">0</b> APIs
                                </span>
                            </div>
                            <div style="margin-bottom:12px">
                                <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;font-weight:500">Type</label>
                                <select id="cap-type" style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:14px;background:#fff;color:#333;outline:none;box-sizing:border-box">
                                    <option value="page">Page</option>
                                    <option value="modal">Modal / Dialog</option>
                                    <option value="form">Form</option>
                                    <option value="list">List / Table</option>
                                </select>
                            </div>
                            <div style="margin-bottom:12px">
                                <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;font-weight:500">Name</label>
                                <input id="cap-name" type="text" autocomplete="off" spellcheck="false"
                                    style="width:100%;padding:8px 10px;border:2px solid #1890ff;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;color:#333;background:#fff"
                                    placeholder="Enter screen name...">
                            </div>
                            <div style="margin-bottom:16px">
                                <label style="display:block;font-size:12px;color:#666;margin-bottom:4px;font-weight:500">Parent</label>
                                <div id="cap-tree" style="max-height:120px;overflow-y:auto;border:1px solid #eee;border-radius:8px;background:#fafafa"></div>
                                <input type="hidden" id="cap-parent">
                            </div>
                            <div style="display:flex;gap:8px;justify-content:flex-end">
                                <button id="btn-cancel" style="padding:8px 20px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;font-size:13px;color:#666">Cancel</button>
                                <button id="btn-capture" style="padding:8px 20px;border:none;border-radius:8px;background:#1890ff;color:#fff;cursor:pointer;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px">
                                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="white" stroke-width="1.5"/><circle cx="7" cy="7" r="2.5" fill="white"/></svg>
                                    Capture
                                </button>
                            </div>
                            <div id="cap-warning" style="display:none;margin-top:8px;padding:8px 12px;border-radius:8px;font-size:12px;line-height:1.4"></div>
                            <div id="cap-progress" style="display:none;position:absolute;inset:0;background:rgba(255,255,255,0.95);border-radius:14px;flex-direction:column;align-items:center;justify-content:center;gap:12px">
                                <div style="width:32px;height:32px;border:3px solid #e0e0e0;border-top-color:#1890ff;border-radius:50%;animation:capspin 0.8s linear infinite"></div>
                                <div style="font-size:13px;color:#666">Capturing...</div>
                            </div>
                        </div>
                    </div>
                    <style>@keyframes capspin{to{transform:rotate(360deg)}}</style>
                `;
                document.body.appendChild(modal);
            }

            // ============================================================
            // EVENT BLOCKER — "Disable page JS" when modal is open
            // Registered at WINDOW level with capture:true = fires BEFORE
            // any document/element handlers, effectively blocking the page
            // from seeing ANY events while our modal is active.
            //
            // For events INSIDE the modal: stopImmediatePropagation blocks
            // page JS handlers, but NO preventDefault so browser defaults
            // (text input, focus) still work. Enter/Escape are handled here
            // since events won't propagate to modal element handlers.
            // ============================================================
            const BLOCKED_EVENTS = [
                'keydown', 'keyup', 'keypress',
                'input', 'textInput', 'beforeinput',
                'compositionstart', 'compositionend', 'compositionupdate',
                'focus', 'blur', 'focusin', 'focusout',
                'mousedown', 'mouseup', 'click', 'dblclick',
                'pointerdown', 'pointerup',
                'touchstart', 'touchend'
            ];

            function eventBlocker(e) {
                if (!isOpen) return; // Only block when modal is open

                const isInsideModal = modal && modal.contains(e.target);

                if (isInsideModal) {
                    // Block page JS from seeing modal events, but allow
                    // browser default behavior (text input, focus, clicks)
                    e.stopImmediatePropagation();

                    // Handle Enter/Escape directly here since propagation is stopped
                    if (e.type === 'keydown') {
                        if (e.key === 'Enter' && !isCapturing) {
                            // Only trigger capture from name input or capture button
                            const id = e.target.id;
                            if (id === 'cap-name' || id === 'btn-capture') {
                                e.preventDefault();
                                doCapture();
                            }
                            // For SELECT, let Enter work normally (open/close dropdown)
                        }
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            hideModal();
                        }
                    }

                    // Handle button clicks directly since propagation is stopped
                    if (e.type === 'click') {
                        const target = e.target;
                        if (target.id === 'btn-cancel' || target.closest('#btn-cancel')) {
                            hideModal();
                        } else if (target.id === 'btn-capture' || target.closest('#btn-capture')) {
                            doCapture();
                        } else if (target.id === 'cap-backdrop' && target === e.target) {
                            hideModal();
                        }
                        // Handle parent tree item clicks
                        const treeItem = target.closest('#cap-tree > div');
                        if (treeItem && modal) {
                            const tree = modal.querySelector('#cap-tree');
                            if (tree) {
                                tree.querySelectorAll('div').forEach(d => {
                                    d.style.background = '';
                                    d.style.color = '#555';
                                    d.style.fontWeight = '';
                                });
                                treeItem.style.background = '#e6f7ff';
                                treeItem.style.color = '#1890ff';
                                treeItem.style.fontWeight = '500';
                                // Find the node id from the tree item
                                const allTreeItems = Array.from(tree.children);
                                const idx = allTreeItems.indexOf(treeItem);
                                if (idx >= 0 && modal._treeNodes && modal._treeNodes[idx]) {
                                    modal.querySelector('#cap-parent').value = modal._treeNodes[idx].id;
                                }
                            }
                        }
                    }
                    return;
                }

                // Block everything else — page JS never sees this event
                e.stopImmediatePropagation();
                e.preventDefault();
            }

            // Register on WINDOW (parent of document in DOM hierarchy)
            // capture:true = fires first in capture phase, before all other handlers
            BLOCKED_EVENTS.forEach(evt => {
                window.addEventListener(evt, eventBlocker, { capture: true });
            });

            // bindModalEvents is no longer needed — all click/keyboard handling
            // is done in eventBlocker to ensure events work even when page JS
            // would otherwise interfere. Kept as no-op for call compatibility.
            function bindModalEvents() { }

            // Show modal
            async function showModal() {
                if (isCapturing) return;

                if (!window.__freezeState || !window.__getCaptureContext) {
                    alert('Capture not ready. Please wait...');
                    return;
                }

                createModal();
                bindModalEvents();

                try {
                    // Freeze state (collect pending actions/APIs metadata)
                    await window.__freezeState();
                    const ctx = await window.__getCaptureContext();

                    // Update stats
                    modal.querySelector('#stat-actions').textContent = ctx.actions || 0;
                    modal.querySelector('#stat-apis').textContent = ctx.apis || 0;

                    // Auto-generate name from URL path
                    let name = location.pathname.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'home';
                    if (ctx.nodes?.some(n => n.id === name)) name += '_' + Date.now().toString().slice(-4);
                    modal.querySelector('#cap-name').value = name;

                    // Build parent tree
                    const tree = modal.querySelector('#cap-tree');
                    tree.innerHTML = '';
                    const treeNodes = ctx.nodes || [];
                    modal._treeNodes = treeNodes; // Store for eventBlocker access
                    treeNodes.forEach(node => {
                        const div = document.createElement('div');
                        div.style.cssText = 'padding:6px 10px;cursor:pointer;font-size:13px;border-radius:4px;transition:background 0.15s;' +
                            (node.id === ctx.parentId ? 'background:#e6f7ff;color:#1890ff;font-weight:500;' : 'color:#555;');
                        const marker = node.type === 'start' ? '\u25B6' : '\u25CB';
                        div.textContent = `${marker} ${node.name}`;
                        tree.appendChild(div);
                        if (node.id === ctx.parentId) modal.querySelector('#cap-parent').value = node.id;
                    });

                    // Hide progress overlay if shown from previous capture
                    const progress = modal.querySelector('#cap-progress');
                    if (progress) progress.style.display = 'none';

                    // Show modal (this activates the event blocker)
                    modal.style.display = 'block';
                    isOpen = true;

                    // Focus the name input after a short delay
                    setTimeout(() => {
                        const nameInput = modal.querySelector('#cap-name');
                        if (nameInput) {
                            nameInput.focus();
                            nameInput.select();
                        }
                    }, 150);

                } catch (e) {
                    console.error('[Capture] Show error:', e);
                    // Show modal with error if modal exists, let user see & decide
                    if (modal) {
                        modal.style.display = 'block';
                        isOpen = true;
                        showWarning('Không thể mở capture: ' + e.message, 'error');
                    }
                }
            }

            function hideModal() {
                if (modal) modal.style.display = 'none';
                isOpen = false; // This deactivates the event blocker → page JS works again
                clearWarning();
                // Clear frozen state + pending actions/APIs on server
                // so next ESC captures fresh data, not accumulated old data
                if (window.__cancelCapture) {
                    window.__cancelCapture().catch(() => { });
                }
            }

            // Show inline warning/error in modal
            function showWarning(msg, type = 'error') {
                const el = modal?.querySelector('#cap-warning');
                if (!el) return;
                const colors = {
                    error: { bg: '#fff2f0', border: '#ffccc7', color: '#cf1322' },
                    warn: { bg: '#fffbe6', border: '#ffe58f', color: '#ad6800' },
                    info: { bg: '#e6f7ff', border: '#91d5ff', color: '#0050b3' }
                };
                const c = colors[type] || colors.error;
                el.style.cssText = `display:block;margin-top:8px;padding:8px 12px;border-radius:8px;font-size:12px;line-height:1.4;background:${c.bg};border:1px solid ${c.border};color:${c.color}`;
                el.textContent = msg;
            }

            function clearWarning() {
                const el = modal?.querySelector('#cap-warning');
                if (el) el.style.display = 'none';
            }

            async function doCapture() {
                if (isCapturing) return;
                clearWarning();

                const nameInput = modal.querySelector('#cap-name');
                const name = nameInput.value.trim();

                // Validate: name is required
                if (!name) {
                    nameInput.style.borderColor = '#ff4d4f';
                    nameInput.focus();
                    showWarning('Vui lòng nhập tên màn hình trước khi capture.', 'error');
                    setTimeout(() => { nameInput.style.borderColor = '#1890ff'; }, 2000);
                    return;
                }

                // Validate: no special chars that break folder names
                if (/[\/\\:*?"<>|]/.test(name)) {
                    nameInput.style.borderColor = '#ff4d4f';
                    nameInput.focus();
                    showWarning('Tên không được chứa ký tự đặc biệt: / \\ : * ? " < > |', 'error');
                    setTimeout(() => { nameInput.style.borderColor = '#1890ff'; }, 2000);
                    return;
                }

                const captureOptions = {
                    name,
                    type: modal.querySelector('#cap-type').value,
                    parentId: modal.querySelector('#cap-parent').value
                };

                isCapturing = true;
                clearWarning();

                // Step 1: HIDE modal & re-enable page JS (isOpen = false deactivates blocker)
                modal.style.display = 'none';
                isOpen = false;

                // Step 2: Wait for the page to render cleanly without modal
                await new Promise(r => setTimeout(r, 300));

                // Step 3: Execute capture on the CLEAN page (no modal visible)
                try {
                    log('📸 Capturing:', name);
                    const result = await window.__executeCapture(captureOptions);

                    if (result?.error) {
                        // Show modal again with error, wait for user to fix/retry
                        modal.style.display = 'block';
                        isOpen = true;
                        showWarning('Capture thất bại: ' + result.error + '\nVui lòng thử lại hoặc Cancel.', 'error');
                        nameInput.focus();
                    } else {
                        log('✅ Captured:', name, '- actions:', result.actions, 'apis:', result.apis);
                    }
                } catch (e) {
                    console.error('[Capture] Failed:', e);
                    // Show modal again with error, wait for user to fix/retry
                    modal.style.display = 'block';
                    isOpen = true;
                    showWarning('Lỗi capture: ' + e.message + '\nVui lòng thử lại hoặc Cancel.', 'error');
                    nameInput.focus();
                } finally {
                    isCapturing = false;
                }
            }

            // ESC key — open modal when not already open
            // When modal IS open, Escape is handled by eventBlocker
            // This handler only fires when isOpen=false (eventBlocker inactive)
            window.addEventListener('keydown', (e) => {
                if (e.key !== 'Escape') return;
                if (isOpen || isCapturing) return;

                e.preventDefault();
                e.stopImmediatePropagation();
                showModal();
            }, { capture: true });

            log('Ready! Press ESC to capture');
        });
    }

    /**
     * Capture current screen - MAXIMUM DATA for testing
     *
     * Saves:
     * 1. screen.html — full HTML for preview, compare & replay
     * 2. dom.json — structured DOM tree for element-level comparison
     * 3. apis.json — FULL API data with all headers, bodies, screen assignment
     * 4. actions.json — user actions for replay
     * 5. meta.json — metadata
     *
     * Performance: DOM serialized AFTER user confirms, parallel writes
     */

    /**
     * Build nested folder path from flowGraph edges
     * Traverses parent chain: start → login → home → captureId
     * Returns relative path like "start/login/home"
     */
    _buildNestedPath(captureId, parentId) {
        const flowGraph = this.currentSession.flowGraph;

        // Build parent lookup from edges: childId → parentId
        const parentMap = new Map();
        for (const edge of flowGraph.edges) {
            parentMap.set(edge.to, edge.from);
        }

        // Also add the new edge (not yet in flowGraph)
        const effectiveParent = parentId || this.currentSession.lastCaptureId;
        parentMap.set(captureId, effectiveParent);

        // Walk up from captureId to root, collecting path segments
        const segments = [];
        let current = captureId;
        const visited = new Set();

        while (current && !visited.has(current)) {
            visited.add(current);
            segments.unshift(current);
            current = parentMap.get(current);
        }

        // Join segments: "start/login/home/inquiry-list"
        return segments.join('/');
    }
    async captureCurrentScreen(options) {
        if (!this.currentSession || !this.page) {
            return { error: 'No active session' };
        }

        const { name, type, parentId } = options;
        const captureId = name || `screen_${this.captureCounter++}`;

        console.log(`[UnifiedCapture] 📸 Capturing: ${captureId}`);

        try {
            let meta, actions, apis;

            if (this.frozenState) {
                meta = this.frozenState.meta;
                actions = this.frozenState.actions;
                apis = this.frozenState.apis;
            } else {
                meta = await this.page.evaluate(() => ({
                    url: location.href,
                    title: document.title,
                    scroll: { x: Math.round(scrollX), y: Math.round(scrollY) },
                    viewport: { w: innerWidth, h: innerHeight }
                }));
                actions = [...this.pendingActions];
                apis = [...this.pendingAPIs];
            }

            // Capture BOTH HTML and DOM tree (after user confirmed, not during freeze)
            // HTML = exact reproduction for preview/replay
            // DOM = structured tree for element-level comparison (with computed styles)
            const { html, dom } = await this.page.evaluate(async () => {
                // CSS properties critical for visual comparison
                const STYLE_PROPS = [
                    'color', 'backgroundColor', 'fontSize', 'fontWeight', 'fontFamily',
                    'padding', 'margin', 'border', 'borderRadius',
                    'display', 'position', 'top', 'left', 'right', 'bottom',
                    'width', 'height', 'maxWidth', 'maxHeight', 'minWidth', 'minHeight',
                    'opacity', 'visibility', 'overflow',
                    'textAlign', 'lineHeight', 'textDecoration', 'letterSpacing',
                    'boxShadow', 'transform', 'zIndex',
                    'flexDirection', 'justifyContent', 'alignItems', 'gap'
                ];

                // Only capture styles for CONTENT elements (not every wrapper div)
                const STYLED_TAGS = new Set([
                    'a', 'button', 'input', 'select', 'textarea', 'label',
                    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    'p', 'span', 'strong', 'em', 'b', 'i', 'u',
                    'td', 'th', 'li', 'img', 'svg',
                    'nav', 'header', 'footer', 'main', 'section', 'aside'
                ]);

                function extractStyles(el, tag) {
                    // Only get computed styles for content-bearing elements
                    if (!STYLED_TAGS.has(tag)) return null;
                    // Skip hidden elements
                    if (el.offsetWidth === 0 && el.offsetHeight === 0) return null;

                    try {
                        const computed = getComputedStyle(el);
                        const styles = {};
                        let hasStyles = false;

                        for (const prop of STYLE_PROPS) {
                            const val = computed[prop];
                            if (val && val !== '' && val !== 'none' && val !== 'normal' &&
                                val !== 'auto' && val !== '0px' && val !== 'rgba(0, 0, 0, 0)' &&
                                val !== 'static' && val !== 'visible' && val !== 'ltr') {
                                styles[prop] = val;
                                hasStyles = true;
                            }
                        }

                        return hasStyles ? styles : null;
                    } catch {
                        return null;
                    }
                }

                // OPTIMIZED DOM serializer — selective getComputedStyle
                function serialize(el, depth = 0) {
                    if (depth > 30) return null; // Prevent infinite recursion

                    if (el.nodeType === 3) { // Text node
                        const text = el.textContent.trim();
                        if (!text) return null;
                        return { t: '#text', v: text };
                    }

                    if (el.nodeType !== 1) return null; // Skip non-element nodes

                    const tag = el.tagName.toLowerCase();
                    // Skip script, style, svg internals
                    if (['script', 'style', 'noscript', 'link'].includes(tag)) return null;
                    // Skip our capture UI
                    if (el.id === 'capture-modal' || el.id === 'capture-overlay') return null;

                    const node = { t: tag };

                    // Capture ALL meaningful attributes for comparison
                    const attrs = {};
                    for (const attr of el.attributes) {
                        const name = attr.name;
                        // Skip event handlers and internal attributes
                        if (name.startsWith('on') || name.startsWith('data-v-')) continue;
                        // Keep essential attributes
                        if (['id', 'class', 'name', 'type', 'href', 'src', 'alt', 'title',
                            'value', 'placeholder', 'role', 'aria-label', 'data-testid',
                            'action', 'method', 'target', 'disabled', 'checked', 'selected',
                            'readonly', 'required', 'for', 'colspan', 'rowspan'].includes(name) ||
                            name.startsWith('data-')) {
                            attrs[name] = attr.value;
                        }
                    }
                    if (Object.keys(attrs).length > 0) node.a = attrs;

                    // Check visibility with offsetParent (fast check)
                    if (el.offsetParent === null && tag !== 'body' && tag !== 'html' &&
                        tag !== 'thead' && tag !== 'tbody' && tag !== 'tr' &&
                        !el.closest('thead') && !el.closest('tbody')) {
                        if (el.offsetWidth === 0 && el.offsetHeight === 0) {
                            node.hidden = true;
                        }
                    }

                    // Capture COMPUTED STYLES for content elements
                    // Only calls getComputedStyle for ~20% of elements (buttons, text, inputs, etc.)
                    if (!node.hidden) {
                        const styles = extractStyles(el, tag);
                        if (styles) node.css = styles;
                    }

                    // Capture bounding rect for position comparison
                    if (STYLED_TAGS.has(tag) && !node.hidden) {
                        const rect = el.getBoundingClientRect();
                        node.rect = {
                            x: Math.round(rect.x),
                            y: Math.round(rect.y),
                            w: Math.round(rect.width),
                            h: Math.round(rect.height)
                        };
                    }

                    // Capture form element values for comparison
                    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
                        const val = el.value;
                        if (val) node.val = val;
                        if (el.checked) node.checked = true;
                    }

                    // Process children
                    const children = [];
                    for (const child of el.childNodes) {
                        const serialized = serialize(child, depth + 1);
                        if (serialized) children.push(serialized);
                    }
                    if (children.length > 0) node.c = children;

                    return node;
                }

                // Remove capture UI elements before capturing HTML and DOM
                const captureModal = document.getElementById('capture-modal');
                const captureOverlay = document.getElementById('capture-overlay');
                if (captureModal) captureModal.remove();
                if (captureOverlay) captureOverlay.remove();

                // Inline all @font-face fonts as base64 so preview works without original server
                try {
                    const fontPromises = [];
                    for (const sheet of document.styleSheets) {
                        try {
                            for (const rule of sheet.cssRules) {
                                if (rule instanceof CSSFontFaceRule) {
                                    const family = rule.style.getPropertyValue('font-family');
                                    const weight = rule.style.getPropertyValue('font-weight') || 'normal';
                                    const style = rule.style.getPropertyValue('font-style') || 'normal';
                                    const src = rule.style.getPropertyValue('src');
                                    // Extract woff2 URL first, fallback to woff
                                    const woff2 = src.match(/url\(["']?([^"')]+\.woff2)["']?\)/);
                                    const woff = src.match(/url\(["']?([^"')]+\.woff)["']?\)/);
                                    const fontUrl = (woff2 && woff2[1]) || (woff && woff[1]);
                                    if (fontUrl && family) {
                                        fontPromises.push({ family, weight, style, url: fontUrl, format: woff2 ? 'woff2' : 'woff' });
                                    }
                                }
                            }
                        } catch (e) { /* cross-origin stylesheet — skip */ }
                    }

                    // Fetch and inline each font (limit to 5 to avoid slowness)
                    const toInline = fontPromises.slice(0, 5);
                    for (const ff of toInline) {
                        try {
                            const resp = await fetch(ff.url);
                            if (!resp.ok) continue;
                            const blob = await resp.blob();
                            // Skip if too large (> 2MB)
                            if (blob.size > 2 * 1024 * 1024) continue;
                            const base64 = await new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = () => resolve(reader.result);
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });
                            const inlineStyle = document.createElement('style');
                            inlineStyle.setAttribute('data-inlined-font', 'true');
                            inlineStyle.textContent = `@font-face{font-family:${ff.family};font-style:${ff.style};font-weight:${ff.weight};src:url(${base64}) format("${ff.format}")}`;
                            document.head.appendChild(inlineStyle);
                        } catch (e) { /* font fetch failed — skip */ }
                    }
                } catch (e) { /* font inlining failed — continue without */ }

                // Capture HTML and DOM while UI elements are removed
                const html = document.documentElement.outerHTML;
                const dom = serialize(document.body);

                // Re-add them after capture
                if (captureModal) document.body.appendChild(captureModal);
                if (captureOverlay) document.body.appendChild(captureOverlay);

                return { html, dom };
            });

            // Inject <base> tag so relative URLs (fonts, images, scripts) resolve to original server
            // This fixes icon fonts (MDI, Font Awesome) that use url(/_nuxt/fonts/...) paths
            let processedHtml = html;
            try {
                const origin = new URL(meta.url).origin;
                if (origin && !html.includes('<base ')) {
                    processedHtml = html.replace(/<head([^>]*)>/i, `<head$1><base href="${origin}/">`);
                }
            } catch (e) { /* URL parse error — use raw html */ }


            // Create folder — NESTED based on parent chain from flowGraph
            const nestedRelPath = this._buildNestedPath(captureId, parentId);
            const capturePath = path.join(this.currentSession.sectionPath, nestedRelPath);
            await fs.ensureDir(capturePath);

            // Extract path from URL
            let metaPath = '/';
            try {
                const urlObj = new URL(meta.url);
                metaPath = urlObj.pathname + urlObj.search;
            } catch (e) {
                metaPath = meta.url;
            }

            // Find last click text for edge label
            const clickActions = actions.filter(a => a.type === 'click' && a.text);
            const clickedText = clickActions.length > 0 ? clickActions[clickActions.length - 1].text : '';

            // Prepare FULL API data with clear screen assignment
            const fullAPIs = apis.map(api => ({
                method: api.method,
                url: api.url,
                status: api.status,
                statusText: api.statusText || '',
                duration: api.duration,
                mimeType: api.mimeType || '',
                // Request data
                reqHeaders: api.reqHeaders,
                requestBody: api.requestBody,
                // Response data - FULL, no truncation
                resHeaders: api.resHeaders,
                responseBody: api.responseBody,
                // Screen assignment
                originUrl: api.originUrl,
                originPath: api.originPath,
                // Error info (if failed)
                error: api.error || undefined,
                // Timing
                time: api.time
            }));

            // PARALLEL file writes — all independent writes at once
            const writePromises = [
                // 1. Save full HTML for preview, compare & replay (with <base> tag for fonts/icons)
                fs.writeFile(path.join(capturePath, 'screen.html'), processedHtml, 'utf-8'),

                // 2. Save structured DOM tree for element-level comparison
                fs.writeJson(path.join(capturePath, 'dom.json'), {
                    body: dom,
                    url: meta.url,
                    title: meta.title,
                    viewport: meta.viewport
                }, { spaces: 0 }),

                // 3. Save metadata
                fs.writeJson(path.join(capturePath, 'meta.json'), {
                    id: captureId,
                    name,
                    type: type || 'page',
                    path: metaPath,
                    url: meta.url,
                    title: meta.title,
                    scrollPosition: meta.scroll,
                    viewport: meta.viewport,
                    parentId: parentId || this.currentSession.lastCaptureId,
                    nestedPath: nestedRelPath,
                    time: new Date().toISOString(),
                    stats: {
                        actions: actions.length,
                        apis: fullAPIs.length,
                        actionTypes: this.summarizeActionTypes(actions),
                        apiEndpoints: this.summarizeAPIEndpoints(fullAPIs)
                    }
                }, { spaces: 2 }),

                // 4. Save actions (for replay) — ALWAYS save for consistency
                fs.writeJson(path.join(capturePath, 'actions.json'), actions, { spaces: 0 }),

                // 5. Save APIs (for comparison & mock) — ALWAYS save, FULL data
                fs.writeJson(path.join(capturePath, 'apis.json'), fullAPIs, { spaces: 0 }),
            ];

            // Execute all writes in parallel
            await Promise.all(writePromises);

            // Update flow graph
            let urlPath = '/';
            try {
                const urlObj = new URL(meta.url);
                urlPath = urlObj.pathname + urlObj.search;
            } catch (e) {
                urlPath = meta.url;
            }

            const node = {
                id: captureId,
                name,
                type: type || 'page',
                path: urlPath,
                nestedPath: nestedRelPath, // Nested folder path relative to section root
                domOrder: this.currentSession.captures.length // Add DOM order index
            };
            this.currentSession.flowGraph.nodes.push(node);
            this.currentSession.flowGraph.edges.push({
                from: parentId || this.currentSession.lastCaptureId,
                to: captureId,
                label: clickedText,
                actions: actions.length,
                apis: fullAPIs.length
            });

            this.currentSession.captures.push(captureId);
            this.currentSession.lastCaptureId = captureId;
            this.currentSession.lastCaptureUrl = meta.url;

            // Register this screen's path for retroactive API assignment
            const capturePathNormalized = this.extractPath(meta.url);
            this.currentSession.capturedPathsMap.set(capturePathNormalized, {
                captureId,
                folderPath: capturePath
            });

            // Retroactively assign remaining APIs to previously captured screens
            const remainingAPIs = this.frozenState?.remainingAPIs || [];
            const unmatched = [];
            if (remainingAPIs.length > 0) {
                const byPath = {};
                for (const api of remainingAPIs) {
                    const op = api.originPath || '';
                    if (op && this.currentSession.capturedPathsMap.has(op)) {
                        if (!byPath[op]) byPath[op] = [];
                        byPath[op].push(api);
                    } else {
                        unmatched.push(api);
                    }
                }

                for (const [originPath, apis] of Object.entries(byPath)) {
                    const capInfo = this.currentSession.capturedPathsMap.get(originPath);
                    try {
                        const apisFile = path.join(capInfo.folderPath, 'apis.json');
                        const existing = await fs.readJson(apisFile).catch(() => []);
                        const formatted = apis.map(api => ({
                            method: api.method, url: api.url,
                            status: api.status, statusText: api.statusText || '',
                            duration: api.duration, mimeType: api.mimeType || '',
                            reqHeaders: api.reqHeaders, requestBody: api.requestBody,
                            resHeaders: api.resHeaders, responseBody: api.responseBody,
                            originUrl: api.originUrl, originPath: api.originPath,
                            error: api.error || undefined, time: api.time
                        }));
                        await fs.writeJson(apisFile, [...existing, ...formatted], { spaces: 0 });

                        // Update meta.json stats
                        const metaFile = path.join(capInfo.folderPath, 'meta.json');
                        const metaData = await fs.readJson(metaFile).catch(() => null);
                        if (metaData) {
                            metaData.stats.apis = existing.length + formatted.length;
                            metaData.stats.apiEndpoints = [
                                ...(metaData.stats.apiEndpoints || []),
                                ...this.summarizeAPIEndpoints(formatted)
                            ];
                            await fs.writeJson(metaFile, metaData, { spaces: 2 });
                        }

                        // Update flow graph edge stats
                        const edge = this.currentSession.flowGraph.edges.find(e => e.to === capInfo.captureId);
                        if (edge) edge.apis = existing.length + formatted.length;

                        console.log(`[UnifiedCapture] Retroactively assigned ${apis.length} APIs to ${capInfo.captureId}`);
                    } catch (e) {
                        console.error(`[UnifiedCapture] Failed to assign APIs to ${capInfo.captureId}:`, e.message);
                    }
                }
            }

            // Save flow graph (depends on updated data, must be after)
            await fs.writeJson(
                path.join(this.currentSession.sectionPath, 'flow.json'),
                this.currentSession.flowGraph,
                { spaces: 2 }
            );

            // Clear pending data after capture
            // Collect IDs of all APIs that were in the frozen snapshot (both relevant + remaining)
            const frozenApiIds = new Set([
                ...this.frozenState.apis.map(a => a.id),
                ...(this.frozenState.remainingAPIs || []).map(a => a.id)
            ]);
            // Keep APIs that arrived AFTER freeze (not in snapshot) + unmatched remaining
            const newApis = this.pendingAPIs.filter(a => !frozenApiIds.has(a.id));
            this.pendingActions = [];
            this.pendingAPIs = [...newApis, ...unmatched];
            this.frozenState = null;

            // Clear live stream files (data now saved to capture folder)
            if (this.streamWriter) {
                this.streamWriter.clearLiveFiles();
            }

            console.log(`[UnifiedCapture] ✅ Captured: ${captureId} (${actions.length} actions, ${fullAPIs.length} APIs, dom.json + screen.html)`);

            return {
                success: true,
                captureId,
                path: capturePath,
                actions: actions.length,
                apis: fullAPIs.length
            };

        } catch (error) {
            console.error('[UnifiedCapture] Capture failed:', error);
            return { error: error.message };
        }
    }

    /**
     * Summarize action types for metadata stats
     */
    summarizeActionTypes(actions) {
        const summary = {};
        for (const a of actions) {
            summary[a.type] = (summary[a.type] || 0) + 1;
        }
        return summary;
    }

    /**
     * Summarize API endpoints for metadata stats
     */
    summarizeAPIEndpoints(apis) {
        return apis.map(a => `${a.method} ${this.extractPath(a.url)
            } → ${a.status} `);
    }

    /**
     * Handle browser close
     */
    async handleBrowserClose() {
        console.log('[UnifiedCapture] Handling browser close...');
        await this.stopSession();
    }

    /**
     * Stop session and cleanup
     */
    async stopSession() {
        this.isClosing = true;  // Signal 'closing' status to frontend

        const result = {
            success: true,
            projectName: this.currentSession?.projectName,
            sectionTimestamp: this.currentSession?.sectionTimestamp,
            captures: this.currentSession?.captures?.length || 0,
            actions: this.sessionActionCount,
            apis: this.sessionAPICount
        };

        if (this.currentSession) {
            try {
                await fs.writeJson(
                    path.join(this.currentSession.sectionPath, 'session.json'),
                    {
                        project: this.currentSession.projectName,
                        section: this.currentSession.sectionTimestamp,
                        domain: this.currentSession.domain,
                        startPath: this.extractPath(this.currentSession.startUrl),
                        startTime: this.currentSession.startTime,
                        endTime: new Date().toISOString(),
                        captures: this.currentSession.captures,
                        stats: { actions: this.sessionActionCount, apis: this.sessionAPICount }
                    },
                    { spaces: 2 }
                );
            } catch (e) {
                console.log('[UnifiedCapture] Session save failed:', e.message);
            }
        }

        await this.resetState();
        this.isClosing = false;  // Reset closing flag
        return result;
    }

    /**
     * Trigger capture via API (simulates ESC key)
     */
    async triggerScreenshot() {
        if (!this.page) throw new Error('No active browser session');

        console.log('[UnifiedCapture] 📸 Manual trigger');
        await this.page.keyboard.press('Escape');
        return { success: true };
    }

    /**
     * Get current status
     */
    async getStatus() {
        const isRunning = !!this.browser;

        // Determine status: closing if isClosing flag set, otherwise running/idle
        let status = 'idle';
        if (this.isClosing) {
            status = 'closing';
        } else if (isRunning) {
            status = 'running';
        }

        // Build savedItems with rich metadata from captured screens
        const savedItems = [];
        const captures = this.currentSession?.captures || [];
        const flowNodes = this.currentSession?.flowGraph?.nodes || [];
        for (const captureId of captures) {
            const item = {
                path: captureId,
                name: captureId,
                requestsCount: 0,
                actionsCount: 0
            };

            // Read meta.json — use nestedPath from flow graph for correct folder
            if (this.currentSession?.sectionPath) {
                try {
                    const flowNode = flowNodes.find(n => n.id === captureId);
                    const relPath = flowNode?.nestedPath || captureId;
                    const metaPath = path.join(this.currentSession.sectionPath, relPath, 'meta.json');
                    if (await fs.pathExists(metaPath)) {
                        const meta = await fs.readJson(metaPath);
                        item.name = meta.name || captureId;
                        item.title = meta.title || meta.name || captureId;
                        item.type = meta.type || 'page';
                        item.urlPath = meta.path || meta.url || '';
                        item.url = meta.url || '';
                        item.savedAt = meta.time || '';
                        item.actionsCount = meta.stats?.actions || 0;
                        item.requestsCount = meta.stats?.apis || 0;
                        item.apiCount = meta.stats?.apis || 0;
                    }
                } catch (e) {
                    // Ignore read errors, use defaults
                }
            }

            savedItems.push(item);
        }

        return {
            status,
            running: isRunning,
            project: this.currentSession?.projectName,
            section: this.currentSession?.sectionTimestamp,
            url: this.page?.url() || null,
            // Fields the frontend expects
            capturedPagesCount: this.currentSession?.captures?.length || 0,
            networkRequestsCount: this.sessionAPICount || 0,
            actionsCount: this.sessionActionCount || 0,
            savedItems: savedItems,
            // Also keep original fields for other consumers
            captures: this.currentSession?.captures?.length || 0,
            pending: { actions: this.pendingActions?.length || 0, apis: this.pendingAPIs?.length || 0 },
            total: { actions: this.sessionActionCount || 0, apis: this.sessionAPICount || 0 }
        };
    }
}


/**
 * StreamWriter - Incremental JSONL writer for crash safety
 * 
 * Writes actions and APIs to JSONL files as they happen.
 * Uses micro-batching (100ms) to reduce I/O syscalls.
 * If browser crashes, data is recoverable from these files.
 */
class StreamWriter {
    constructor(sectionPath) {
        this.sectionPath = sectionPath;
        this.actionFile = path.join(sectionPath, '_live_actions.jsonl');
        this.apiFile = path.join(sectionPath, '_live_apis.jsonl');
        this.writeQueue = [];
        this.flushTimer = null;
        this.isFlushing = false;
    }

    appendAction(action) {
        const line = JSON.stringify({
            ...action,
            _ts: Date.now()
        }) + '\n';
        this.writeQueue.push({ file: this.actionFile, data: line });
        this.scheduleFlush();
    }

    appendAPI(apiEntry) {
        // Write only summary to stream (full data saved during capture)
        const line = JSON.stringify({
            method: apiEntry.method,
            url: apiEntry.url,
            status: apiEntry.status,
            duration: apiEntry.duration,
            time: apiEntry.time,
            originPath: apiEntry.originPath
        }) + '\n';
        this.writeQueue.push({ file: this.apiFile, data: line });
        this.scheduleFlush();
    }

    scheduleFlush() {
        if (this.flushTimer) return;
        this.flushTimer = setTimeout(() => this.flush(), 100);
    }

    async flush() {
        this.flushTimer = null;
        if (this.isFlushing || this.writeQueue.length === 0) return;

        this.isFlushing = true;
        const batch = [...this.writeQueue];
        this.writeQueue = [];

        try {
            // Group by file for efficient writing
            const grouped = {};
            for (const { file, data } of batch) {
                grouped[file] = (grouped[file] || '') + data;
            }

            // Write all files in parallel
            await Promise.all(
                Object.entries(grouped).map(([file, data]) =>
                    fs.appendFile(file, data).catch(() => { })
                )
            );
        } catch (e) {
            debugLog('[StreamWriter] Flush error:', e.message);
        }

        this.isFlushing = false;

        // If more data was queued during flush, schedule again
        if (this.writeQueue.length > 0) {
            this.scheduleFlush();
        }
    }

    /**
     * Clear live files after data is saved to capture folder
     */
    async clearLiveFiles() {
        try {
            await Promise.all([
                fs.remove(this.actionFile).catch(() => { }),
                fs.remove(this.apiFile).catch(() => { })
            ]);
        } catch (e) { }
    }
}


module.exports = new UnifiedCaptureService();
