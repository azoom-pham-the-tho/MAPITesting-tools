/**
 * Unified Replay Service
 * 
 * Supports replaying captured screens with:
 * - UI reconstruction from saved HTML
 * - API mocking from saved responses  
 * - Action replay from saved interactions (including navigation & scroll)
 * - Visual comparison between captures
 * 
 * Compatible with both old and new capture formats.
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs-extra');
const storageService = require('./storage.service');

class UnifiedReplayService {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.currentReplay = null;
        this.apiMocks = new Map();
        this.isRunning = false;
        this._continueExposed = false;
        this._continueResolve = null;

        console.log('[UnifiedReplay] ✅ Service initialized');
    }

    /**
     * Get Chrome executable path
     */
    getChromePath() {
        if (process.platform === 'darwin') {
            const paths = [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome'
            ];
            for (const p of paths) {
                if (fs.existsSync(p)) return p;
            }
        }
        return 'google-chrome';
    }

    /**
     * Load capture data for a screen
     * Supports both old format (dom.json + screen.html) and new format (screen.html only)
     */
    async loadCaptureData(projectName, sectionId, screenId) {
        const basePath = path.join(
            storageService.getSectionPath(projectName, sectionId),
            screenId
        );

        const data = {
            id: screenId,
            html: null,
            metadata: null,
            actions: [],
            apis: [],
            navigation: null
        };

        // Load HTML
        const htmlPath = path.join(basePath, 'screen.html');
        if (await fs.pathExists(htmlPath)) {
            data.html = await fs.readFile(htmlPath, 'utf-8');
        }

        // Load metadata (new: meta.json, old: screen.json)
        let metaPath = path.join(basePath, 'meta.json');
        if (!await fs.pathExists(metaPath)) {
            metaPath = path.join(basePath, 'screen.json');
        }
        if (await fs.pathExists(metaPath)) {
            data.metadata = await fs.readJson(metaPath);
        }

        // Load actions
        const actionsPath = path.join(basePath, 'actions.json');
        if (await fs.pathExists(actionsPath)) {
            const actionsData = await fs.readJson(actionsPath);
            // Support both old {actions: [...]} and new [...] format
            data.actions = Array.isArray(actionsData) ? actionsData : (actionsData.actions || []);
        }

        // Load APIs (support full format, compact format, and old format)
        const apisPath = path.join(basePath, 'apis.json');
        if (await fs.pathExists(apisPath)) {
            const apisData = await fs.readJson(apisPath);
            const apisList = Array.isArray(apisData) ? apisData : (apisData.requests || []);
            // Normalize ALL formats to standard for mocking
            data.apis = apisList.map(a => ({
                method: a.m || a.method,
                url: a.u || a.url,
                status: a.s || a.status,
                duration: a.d || a.duration,
                requestBody: a.req || a.requestBody || a.body,
                response: a.res || a.responseBody || a.response,
                mimeType: a.mimeType || 'application/json',
                originUrl: a.originUrl || '',
                originPath: a.originPath || ''
            }));
        }

        // Load navigation
        const navPath = path.join(basePath, 'navigation.json');
        if (await fs.pathExists(navPath)) {
            data.navigation = await fs.readJson(navPath);
        }

        return data;
    }

    /**
     * Load flow data for a section
     */
    async loadFlowData(projectName, sectionId) {
        const flowPath = path.join(
            storageService.getSectionPath(projectName, sectionId),
            'flow.json'
        );

        if (await fs.pathExists(flowPath)) {
            return await fs.readJson(flowPath);
        }

        return { nodes: [], edges: [] };
    }

    /**
     * Start replay session
     */
    async startReplay(projectName, sectionId, options = {}) {
        if (this.isRunning) {
            throw new Error('A replay session is already running');
        }

        console.log(`[UnifiedReplay] 🎬 Starting replay: ${projectName}/${sectionId}`);

        // Load flow data
        const flowData = await this.loadFlowData(projectName, sectionId);

        // Load all screens data
        const screensData = {};
        for (const node of flowData.nodes) {
            if (node.id !== 'start') {
                screensData[node.id] = await this.loadCaptureData(projectName, sectionId, node.id);
            }
        }

        // Launch browser
        this.browser = await chromium.launch({
            headless: false,
            executablePath: this.getChromePath(),
            args: ['--no-sandbox', '--start-maximized']
        });

        // Determine viewport and user agent
        let viewport = null;
        let userAgent = undefined;

        if (options.deviceProfile === 'mobile') {
            viewport = { width: 375, height: 812 };
            userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1';
        } else if (options.deviceProfile === 'tablet') {
            viewport = { width: 768, height: 1024 };
        } else if (options.deviceProfile === 'desktop') {
            viewport = { width: 1440, height: 900 };
        }

        this.context = await this.browser.newContext({
            viewport: viewport,
            userAgent: userAgent
        });

        this.page = await this.context.newPage();

        // Setup API mocking if enabled
        if (options.mockAPIs) {
            await this.setupAPIMocking(screensData);
        }

        // Store current replay state
        this.currentReplay = {
            projectName,
            sectionId,
            flowData,
            screensData,
            currentScreenId: null,
            options
        };

        this.isRunning = true;

        // Navigate to first screen
        const firstEdge = flowData.edges.find(e => e.source === 'start' || e.from === 'start');
        if (firstEdge) {
            await this.navigateToScreen(firstEdge.target || firstEdge.to);
        }

        return {
            success: true,
            projectName,
            sectionId,
            screensCount: Object.keys(screensData).length
        };
    }

    /**
     * Setup API mocking from captured data
     */
    async setupAPIMocking(screensData) {
        // Collect all APIs from all screens
        const allAPIs = [];
        for (const [screenId, data] of Object.entries(screensData)) {
            for (const api of data.apis) {
                allAPIs.push({
                    ...api,
                    screenId
                });
            }
        }

        // Route handler for mocking
        await this.page.route('**/*', async (route, request) => {
            const url = request.url();
            const method = request.method();

            // Find matching captured API
            const match = allAPIs.find(api => {
                try {
                    const capturedUrl = new URL(api.url);
                    const requestUrl = new URL(url);
                    return capturedUrl.pathname === requestUrl.pathname && api.method === method;
                } catch {
                    return false;
                }
            });

            if (match && match.response) {
                console.log(`[UnifiedReplay] 🔄 Mocking: ${method} ${url}`);

                const body = typeof match.response === 'object'
                    ? JSON.stringify(match.response)
                    : String(match.response);

                await route.fulfill({
                    status: match.status || 200,
                    contentType: match.mimeType || 'application/json',
                    body: body
                });
            } else {
                await route.continue();
            }
        });

        console.log(`[UnifiedReplay] ✅ API mocking enabled with ${allAPIs.length} captured APIs`);
    }

    /**
     * Navigate to a specific captured screen
     */
    async navigateToScreen(screenId) {
        if (!this.currentReplay || !this.isRunning) {
            throw new Error('No replay session running');
        }

        const screenData = this.currentReplay.screensData[screenId];
        if (!screenData) {
            throw new Error(`Screen ${screenId} not found`);
        }

        console.log(`[UnifiedReplay] 📄 Navigating to: ${screenId}`);

        // Option 1: Load from saved HTML
        if (screenData.html) {
            await this.page.setContent(screenData.html, {
                waitUntil: 'domcontentloaded'
            });

            // Restore scroll position
            const scrollPos = screenData.metadata?.scrollPosition || screenData.metadata?.scroll;
            if (scrollPos) {
                await this.page.evaluate((pos) => {
                    window.scrollTo(pos.x, pos.y);
                }, scrollPos);
            }
        }
        // Option 2: Navigate to original URL
        else if (screenData.metadata?.url) {
            await this.page.goto(screenData.metadata.url, {
                waitUntil: 'domcontentloaded'
            });
        }

        this.currentReplay.currentScreenId = screenId;

        // Inject navigation overlay if interactive mode
        if (this.currentReplay.options.interactive) {
            await this.injectNavigationOverlay(screenId);
        }

        return {
            success: true,
            screenId,
            url: screenData.metadata?.url
        };
    }

    /**
     * Inject interactive navigation overlay
     */
    async injectNavigationOverlay(currentScreenId) {
        const flowData = this.currentReplay.flowData;

        // Find outgoing edges - support both 'source/target' and 'from/to' edge format
        const outgoingEdges = flowData.edges.filter(e =>
            (e.source === currentScreenId || e.from === currentScreenId)
        );
        const nextScreens = outgoingEdges.map(e => {
            const targetId = e.target || e.to;
            const node = flowData.nodes.find(n => n.id === targetId);
            return {
                id: targetId,
                name: node?.name || targetId,
                actions: e.actions
            };
        });

        await this.page.evaluate((screens) => {
            const existing = document.getElementById('replay-nav-overlay');
            if (existing) existing.remove();

            if (screens.length === 0) return;

            const overlay = document.createElement('div');
            overlay.id = 'replay-nav-overlay';
            overlay.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 16px;
                border-radius: 12px;
                font-family: sans-serif;
                z-index: 999999;
                max-width: 300px;
            `;

            overlay.innerHTML = `
                <div style="font-size: 12px; color: #888; margin-bottom: 8px;">Navigate to:</div>
                ${screens.map(s => `
                    <button onclick="window.__navigateTo('${s.id}')" style="
                        display: block;
                        width: 100%;
                        padding: 10px;
                        margin-bottom: 6px;
                        background: #3b82f6;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        text-align: left;
                        font-size: 13px;
                    ">
                        📄 ${s.name}
                        <span style="font-size: 10px; color: #bbb; display: block;">
                            ${typeof s.actions === 'number' ? s.actions + ' actions' : ''}
                        </span>
                    </button>
                `).join('')}
            `;

            document.body.appendChild(overlay);
        }, nextScreens);

        // Expose navigation function
        try {
            await this.page.exposeFunction('__navigateTo', async (screenId) => {
                await this.navigateToScreen(screenId);
            });
        } catch {
            // Function may already be exposed
        }
    }

    /**
     * Replay actions on current screen
     * Filtered to only execute KEY interactions (Input & Navigation)
     * Optimized to coalesce sequential inputs
     * NEW: Supports navigation and scroll events
     */
    async replayActions(screenId, isNavigationAction = false) {
        if (!this.currentReplay || !this.isRunning) {
            throw new Error('No replay session running');
        }

        const screenData = this.currentReplay.screensData[screenId || this.currentReplay.currentScreenId];
        if (!screenData || !screenData.actions) {
            return { success: true, actionsReplayed: 0 };
        }

        // 1. Filter Key Actions (include new types: navigation, scroll)
        const rawActions = screenData.actions.filter(a =>
            ['input', 'change', 'keydown', 'click', 'dblclick', 'select', 'scroll', 'navigation'].includes(a.type)
        );

        // 2. Optimize: Coalesce sequential inputs to the same selector
        const optimizedActions = [];
        for (let i = 0; i < rawActions.length; i++) {
            const current = rawActions[i];

            if (current.type === 'input' || current.type === 'change') {
                // Look ahead for subsequent inputs to the same selector
                let lastInputIndex = i;
                for (let j = i + 1; j < rawActions.length; j++) {
                    const next = rawActions[j];
                    if ((next.type === 'input' || next.type === 'change') && next.selector === current.selector) {
                        lastInputIndex = j;
                    } else {
                        break;
                    }
                }

                // Use the value from the last input in the sequence
                const finalAction = rawActions[lastInputIndex];
                optimizedActions.push(finalAction);
                i = lastInputIndex;
            } else if (current.type === 'scroll') {
                // Coalesce consecutive scrolls - only keep the last one
                let lastScrollIndex = i;
                for (let j = i + 1; j < rawActions.length; j++) {
                    if (rawActions[j].type === 'scroll') {
                        lastScrollIndex = j;
                    } else {
                        break;
                    }
                }
                optimizedActions.push(rawActions[lastScrollIndex]);
                i = lastScrollIndex;
            } else {
                optimizedActions.push(current);
            }
        }

        console.log(`[UnifiedReplay] ▶️ Replaying ${optimizedActions.length} actions (optimized from ${rawActions.length})`);

        let replayed = 0;
        for (const action of optimizedActions) {
            try {
                await this.replayAction(action);
                replayed++;
            } catch (error) {
                console.log(`[UnifiedReplay] ⚠️ Action failed (skipping): ${action.type} ${action.selector || ''}`);
            }
        }

        return { success: true, actionsReplayed: replayed };
    }

    /**
     * Replay a single action with stability waits
     * NEW: Supports navigation, scroll, and select events
     */
    async replayAction(action) {
        switch (action.type) {
            case 'click':
            case 'dblclick':
                if (!action.selector) return;
                try {
                    await this.page.waitForSelector(action.selector, { state: 'visible', timeout: 5000 }).catch(() => { });
                } catch { }
                await this.page.click(action.selector, {
                    clickCount: action.type === 'dblclick' ? 2 : 1,
                    timeout: 2000
                });
                break;

            case 'input':
            case 'change':
                if (!action.selector || action.value === undefined || action.value === null) return;
                try {
                    await this.page.waitForSelector(action.selector, { state: 'visible', timeout: 5000 }).catch(() => { });
                } catch { }
                console.log(`[UnifiedReplay] ⌨️ Filling ${action.selector} = "${action.value}"`);
                await this.page.fill(action.selector, String(action.value), { timeout: 2000 });
                break;

            case 'select':
                if (!action.selector || !action.value) return;
                try {
                    await this.page.waitForSelector(action.selector, { state: 'visible', timeout: 5000 }).catch(() => { });
                } catch { }
                await this.page.selectOption(action.selector, action.value, { timeout: 2000 });
                break;

            case 'keydown':
                if (action.key) {
                    await this.page.keyboard.press(action.key);
                }
                break;

            case 'scroll':
                if (action.position) {
                    await this.page.evaluate((pos) => {
                        window.scrollTo({ left: pos.x, top: pos.y, behavior: 'smooth' });
                    }, action.position);
                    // Wait for smooth scroll to complete
                    await new Promise(r => setTimeout(r, 300));
                } else if (action.scrollPosition) {
                    // Legacy format
                    await this.page.evaluate((pos) => {
                        window.scrollTo(pos.x, pos.y);
                    }, action.scrollPosition);
                }
                break;

            case 'navigation':
                // Navigation events are informational during replay from HTML
                // But useful when replaying on live site
                console.log(`[UnifiedReplay] 🔀 Navigation: ${action.from} → ${action.to}`);
                break;
        }
    }

    /**
     * Stop replay session
     */
    async stopReplay() {
        console.log('[UnifiedReplay] 🛑 Stopping replay');

        if (this.browser) {
            await this.browser.close().catch(() => { });
            this.browser = null;
        }

        this.context = null;
        this.page = null;
        this.currentReplay = null;
        this.apiMocks.clear();
        this.isRunning = false;
        this._continueExposed = false;
        this._continueResolve = null;

        return { success: true };
    }

    /**
     * Get replay status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            projectName: this.currentReplay?.projectName,
            sectionId: this.currentReplay?.sectionId,
            currentScreenId: this.currentReplay?.currentScreenId,
            screensCount: this.currentReplay ? Object.keys(this.currentReplay.screensData).length : 0
        };
    }

    /**
     * Get test run history for a section
     */
    async getHistory(projectName, sectionId) {
        const testRunsDir = path.join(storageService.getStoragePath(), projectName, 'test-runs');
        if (!await fs.pathExists(testRunsDir)) {
            return [];
        }

        const dirs = await fs.readdir(testRunsDir);
        const history = [];

        for (const dir of dirs) {
            const reportPath = path.join(testRunsDir, dir, 'report.json');
            if (!await fs.pathExists(reportPath)) continue;

            try {
                const report = await fs.readJson(reportPath);
                if (report.sectionId !== sectionId) continue;

                history.push({
                    timestamp: report.timestamp,
                    replaySection: report.testRunId,
                    status: (report.summary?.overallStatus || 'unknown').toLowerCase(),
                    duration: report.duration,
                    comparison: {
                        changed: (report.summary?.failed || 0) + (report.summary?.warnings || 0),
                        added: 0,
                        removed: 0,
                        unchanged: report.summary?.passed || 0
                    }
                });
            } catch (e) {
                // Skip corrupted reports
            }
        }

        // Sort newest first
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return history;
    }

    /**
     * Delete a test run
     */
    async deleteTestRun(projectName, testRunId) {
        const testRunPath = path.join(storageService.getStoragePath(), projectName, 'test-runs', testRunId);
        if (!await fs.pathExists(testRunPath)) {
            throw new Error('Test run not found');
        }
        await fs.remove(testRunPath);
        return { success: true };
    }

    /**
     * Compare two captures visually
     */
    async compareCaptures(projectName, section1, screen1, section2, screen2) {
        const data1 = await this.loadCaptureData(projectName, section1, screen1);
        const data2 = await this.loadCaptureData(projectName, section2, screen2);

        const differences = {
            metadata: this.compareMeta(data1.metadata, data2.metadata),
            actions: this.compareActions(data1.actions, data2.actions),
            apis: this.compareAPIs(data1.apis, data2.apis),
            navigation: this.compareNavigation(data1.navigation, data2.navigation)
        };

        return {
            screen1: { id: screen1, section: section1 },
            screen2: { id: screen2, section: section2 },
            differences
        };
    }

    compareMeta(m1, m2) {
        const diff = {};
        if (m1?.url !== m2?.url) diff.url = { old: m1?.url, new: m2?.url };
        if (m1?.type !== m2?.type) diff.type = { old: m1?.type, new: m2?.type };
        return Object.keys(diff).length > 0 ? diff : null;
    }

    compareActions(a1, a2) {
        return {
            count1: a1?.length || 0,
            count2: a2?.length || 0,
            difference: (a2?.length || 0) - (a1?.length || 0)
        };
    }

    compareAPIs(api1, api2) {
        const getEndpoint = (a) => {
            try {
                return `${a.method} ${new URL(a.url).pathname}`;
            } catch {
                return `${a.method} ${a.url}`;
            }
        };

        const endpoints1 = new Set((api1 || []).map(getEndpoint));
        const endpoints2 = new Set((api2 || []).map(getEndpoint));

        const added = [...endpoints2].filter(e => !endpoints1.has(e));
        const removed = [...endpoints1].filter(e => !endpoints2.has(e));

        return { added, removed, unchanged: endpoints1.size - removed.length };
    }

    compareNavigation(n1, n2) {
        const links1 = (n1?.links || []).length;
        const links2 = (n2?.links || []).length;
        const buttons1 = (n1?.buttons || []).length;
        const buttons2 = (n2?.buttons || []).length;

        return {
            links: { old: links1, new: links2 },
            buttons: { old: buttons1, new: buttons2 }
        };
    }

    /**
     * ═══════════════════════════════════════════════════════════════
     * AUTOMATED REGRESSION TEST
     * ═══════════════════════════════════════════════════════════════
     * 
     * Replays an entire captured flow on the LIVE site,
     * captures fresh DOM/CSS/Screenshot/API data at each screen,
     * compares with original captures, and generates a report.
     * 
     * Flow: Start → Screen1 (replay actions) → Screen2 → ... → Report
     */
    async runRegressionTest(projectName, sectionId, options = {}) {
        const testStartTime = Date.now();
        const testRunId = new Date().toISOString().replace(/[:.]/g, '-');

        console.log(`\n[RegressionTest] ╔═══════════════════════════════════════════╗`);
        console.log(`[RegressionTest] ║  🧪 Starting Regression Test              ║`);
        console.log(`[RegressionTest] ║  Project: ${projectName.padEnd(32)}║`);
        console.log(`[RegressionTest] ║  Section: ${sectionId.substring(0, 32).padEnd(32)}║`);
        console.log(`[RegressionTest] ╚═══════════════════════════════════════════╝\n`);

        // Load compare service
        const compareService = require('./compare.service');

        // Load flow data
        const flowData = await this.loadFlowData(projectName, sectionId);
        if (!flowData.nodes || flowData.nodes.length === 0) {
            throw new Error('Flow data is empty — chưa capture screen nào');
        }

        // Load all original screen data
        const originalScreens = {};
        const sectionPath = storageService.getSectionPath(projectName, sectionId);
        for (const node of flowData.nodes) {
            if (node.id !== 'start') {
                originalScreens[node.id] = await this.loadCaptureData(projectName, sectionId, node.id);
            }
        }

        // Create test run directory
        const testRunPath = path.join(storageService.getStoragePath(), projectName, 'test-runs', testRunId);
        await fs.ensureDir(testRunPath);

        // Launch browser
        this.browser = await chromium.launch({
            headless: false,
            executablePath: this.getChromePath(),
            args: ['--no-sandbox', '--start-maximized']
        });

        // Determine viewport based on device profile
        const orderedScreens = this.getScreenOrder(flowData);
        const firstScreenId = orderedScreens.length > 0 ? orderedScreens[0].id : null;
        const firstScreenData = firstScreenId ? originalScreens[firstScreenId] : null;
        const originalViewport = firstScreenData?.metadata?.viewport;

        let viewport = { width: 1440, height: 900 }; // fallback
        let userAgent = undefined;

        if (options.deviceProfile === 'mobile') {
            viewport = { width: 375, height: 812 };
            userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X)';
        } else if (options.deviceProfile === 'tablet') {
            viewport = { width: 768, height: 1024 };
        } else if (options.deviceProfile === 'desktop') {
            viewport = { width: 1440, height: 900 };
        } else {
            // 'original' or default — use original capture viewport
            if (originalViewport && originalViewport.w && originalViewport.h) {
                viewport = { width: originalViewport.w, height: originalViewport.h };
            }
        }
        console.log(`[RegressionTest] Viewport: ${viewport.width}x${viewport.height} (profile: ${options.deviceProfile})`);

        this.context = await this.browser.newContext({ viewport, userAgent });
        this.page = await this.context.newPage();
        this.isRunning = true;

        // ═══════════════════════════════════════
        // Setup CDP for API capture during test
        // ═══════════════════════════════════════
        const capturedAPIs = {};  // screenId -> apis[]
        let currentScreenId = null;
        const cdp = await this.page.context().newCDPSession(this.page);
        await cdp.send('Network.enable');

        const pendingRequests = new Map();
        cdp.on('Network.requestWillBeSent', (params) => {
            const { request, requestId } = params;
            if (!request.url.startsWith('http')) return;
            const urlObj = (() => { try { return new URL(request.url); } catch { return null; } })();
            if (!urlObj) return;
            // Skip static resources
            if (/\.(js|css|png|jpg|gif|svg|ico|woff|ttf|eot)(\?|$)/.test(urlObj.pathname)) return;

            pendingRequests.set(requestId, {
                method: request.method,
                url: request.url,
                time: Date.now(),
                screenId: currentScreenId
            });
        });

        cdp.on('Network.responseReceived', (params) => {
            const { requestId, response } = params;
            const req = pendingRequests.get(requestId);
            if (!req) return;

            req.status = response.status;
            req.mimeType = response.mimeType;
            req.duration = Date.now() - req.time;
        });

        cdp.on('Network.loadingFinished', async (params) => {
            const { requestId } = params;
            const req = pendingRequests.get(requestId);
            if (!req) return;
            pendingRequests.delete(requestId);

            // Try to get response body
            try {
                const body = await cdp.send('Network.getResponseBody', { requestId });
                try {
                    req.responseBody = JSON.parse(body.body);
                } catch {
                    req.responseBody = body.body?.substring(0, 5000);
                }
            } catch { }

            const sid = req.screenId || 'unknown';
            if (!capturedAPIs[sid]) capturedAPIs[sid] = [];
            capturedAPIs[sid].push(req);
        });

        // ═══════════════════════════════════════
        // Walk through the flow
        // ═══════════════════════════════════════
        const screenResults = [];
        let stepIndex = 0;

        // Find the ordered list of screens from flow edges
        const screenOrder = this.getScreenOrder(flowData);
        console.log(`[RegressionTest] 📋 Flow: ${screenOrder.map(s => s.id).join(' → ')}\n`);

        for (const screenInfo of screenOrder) {
            stepIndex++;
            const { id: screenId, edge } = screenInfo;
            const originalData = originalScreens[screenId];
            const node = flowData.nodes.find(n => n.id === screenId);
            currentScreenId = screenId;

            console.log(`[RegressionTest] ─────────────────────────────────────`);
            console.log(`[RegressionTest] 📄 Step ${stepIndex}/${screenOrder.length}: ${node?.name || screenId}`);

            const screenTestPath = path.join(testRunPath, screenId);
            await fs.ensureDir(screenTestPath);

            const screenResult = {
                step: stepIndex,
                screenId,
                name: node?.name || screenId,
                originalUrl: originalData?.metadata?.url || '',
                status: 'unknown',
                comparison: null,
                timings: {},
                errors: []
            };

            try {
                // ─── Step 1: Navigate ───
                // ─── Step 2: Replay actions ───
                // These are wrapped together: if either fails, we ask the user
                // to manually navigate to the target screen before capturing.
                try {
                    const navStart = Date.now();
                    if (stepIndex === 1 && originalData?.metadata?.url) {
                        // First screen: navigate to URL directly
                        console.log(`[RegressionTest]   🌐 Navigating to: ${originalData.metadata.url}`);
                        await this.page.goto(originalData.metadata.url, {
                            waitUntil: 'networkidle',
                            timeout: 30000
                        });
                    } else if (stepIndex > 1) {
                        // Subsequent screens: wait for page to settle after actions
                        await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
                        await new Promise(r => setTimeout(r, 1500));
                    }
                    screenResult.timings.navigation = Date.now() - navStart;

                    // Replay actions
                    if (originalData?.actions?.length > 0 && edge?.actions !== 0) {
                        const actionStart = Date.now();
                        console.log(`[RegressionTest]   ▶️ Replaying ${originalData.actions.length} actions...`);

                        this.currentReplay = {
                            projectName, sectionId, flowData,
                            screensData: originalScreens,
                            currentScreenId: screenId,
                            options
                        };

                        const actionResult = await this.replayActions(screenId);
                        screenResult.actionsReplayed = actionResult.actionsReplayed;
                        screenResult.timings.actions = Date.now() - actionStart;

                        // Wait for effects of actions to settle
                        await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
                        await new Promise(r => setTimeout(r, 1000));
                    }
                } catch (err) {
                    console.warn(`[RegressionTest]   ⚠️ Navigation/Action error: ${err.message}`);
                    console.log(`[RegressionTest]   ⏸️ Waiting for user to navigate manually...`);

                    // Show warning overlay and wait for user
                    const targetUrl = originalData?.metadata?.url || '';
                    const shouldContinue = await this.waitForUserNavigation(
                        node?.name || screenId,
                        targetUrl,
                        err.message
                    );

                    if (!shouldContinue) {
                        console.log(`[RegressionTest]   ⏭️ User skipped: ${screenId}`);
                        screenResult.status = 'skipped';
                        screenResult.errors.push('Skipped by user: ' + err.message);
                        screenResults.push(screenResult);
                        continue;
                    }

                    console.log(`[RegressionTest]   ▶️ User confirmed — continuing`);
                    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
                    await new Promise(r => setTimeout(r, 500));

                    // After user's manual action, check if user navigated PAST this screen
                    // (e.g., completed login → now on home). If so, skip this screen's capture.
                    if (originalData?.metadata?.url) {
                        try {
                            const expPath = new URL(originalData.metadata.url).pathname;
                            const curPath = new URL(this.page.url()).pathname;
                            if (curPath !== expPath) {
                                console.log(`[RegressionTest]   ↪️ User navigated past ${screenId} (expected ${expPath}, now on ${curPath}) — skipping capture`);
                                screenResult.status = 'skipped';
                                screenResult.errors.push(`User navigated past this screen (now on ${curPath})`);
                                screenResults.push(screenResult);
                                continue;
                            }
                        } catch (e) { /* ignore URL parse errors */ }
                    }
                }

                // ─── URL mismatch check (login redirect detection) ───
                // Only check if NO actions were replayed on this screen.
                // If actions were replayed, URL change is EXPECTED (e.g. login → home).
                const actionsWereReplayed = screenResult.actionsReplayed > 0;
                if (!actionsWereReplayed && originalData?.metadata?.url) {
                    let expectedPathname, currentPathname;
                    try {
                        expectedPathname = new URL(originalData.metadata.url).pathname;
                        currentPathname = new URL(this.page.url()).pathname;
                    } catch (e) { /* URL parse error — skip check */ }

                    if (expectedPathname && currentPathname && currentPathname !== expectedPathname) {
                        console.log(`[RegressionTest]   ⚠️ URL mismatch: expected ${expectedPathname}, got ${currentPathname}`);
                        console.log(`[RegressionTest]   ⏸️ Waiting for user to navigate to correct page...`);

                        const shouldContinue = await this.waitForUserNavigation(
                            node?.name || screenId,
                            originalData.metadata.url,
                            `URL mismatch — expected "${expectedPathname}" but currently on "${currentPathname}". Please navigate to the correct page (e.g. complete login) then press Continue.`
                        );

                        if (!shouldContinue) {
                            console.log(`[RegressionTest]   ⏭️ User skipped: ${screenId}`);
                            screenResult.status = 'skipped';
                            screenResult.errors.push('Skipped by user: URL mismatch (possible login redirect)');
                            screenResults.push(screenResult);
                            continue;
                        }

                        await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
                        await new Promise(r => setTimeout(r, 500));
                    }
                }

                // ─── Step 3: Capture current state ───
                const captureStart = Date.now();
                console.log(`[RegressionTest]   📸 Capturing current state...`);

                // 3a. Capture DOM + CSS + HTML
                const captureData = await this.captureCurrentState();
                screenResult.timings.capture = Date.now() - captureStart;

                // 3b. Save captured data for comparison
                const savePromises = [
                    fs.writeFile(path.join(screenTestPath, 'screen.html'), captureData.html, 'utf-8'),
                    fs.writeJson(path.join(screenTestPath, 'dom.json'), {
                        body: captureData.dom,
                        url: captureData.meta.url,
                        title: captureData.meta.title,
                        viewport: captureData.meta.viewport
                    }, { spaces: 0 }),
                    fs.writeJson(path.join(screenTestPath, 'meta.json'), captureData.meta, { spaces: 2 })
                ];

                // Save APIs captured during this screen
                const screenAPIs = capturedAPIs[screenId] || [];
                savePromises.push(
                    fs.writeJson(path.join(screenTestPath, 'apis.json'), screenAPIs.map(a => ({
                        method: a.method,
                        url: a.url,
                        status: a.status,
                        duration: a.duration,
                        mimeType: a.mimeType,
                        responseBody: a.responseBody
                    })), { spaces: 0 })
                );

                await Promise.all(savePromises);

                // ─── Step 4: Compare with original ───
                const compareStart = Date.now();
                console.log(`[RegressionTest]   🔍 Comparing with original...`);

                const originalPath = path.join(sectionPath, screenId);

                // Run all 3 comparison levels
                const [uiResult, apiResult] = await Promise.all([
                    compareService.compareUI(originalPath, screenTestPath).catch(e => ({ hasChanges: false, error: e.message })),
                    compareService.compareAPI(originalPath, screenTestPath).catch(e => ({ hasChanges: false, error: e.message }))
                ]);

                screenResult.timings.compare = Date.now() - compareStart;

                screenResult.comparison = {
                    ui: uiResult,
                    api: apiResult
                };

                // Determine overall status
                const uiChanged = uiResult?.hasChanges === true;
                const apiChanged = apiResult?.hasChanges === true;
                const cssChanged = uiResult?.cssDiff?.totalChanges > 0;

                if (!uiChanged && !apiChanged) {
                    screenResult.status = 'passed';
                    console.log(`[RegressionTest]   ✅ PASSED — no changes`);
                } else if (cssChanged) {
                    screenResult.status = 'failed';
                    const reasons = [];
                    if (cssChanged) reasons.push(`CSS: ${uiResult.cssDiff.summary}`);
                    if (apiChanged) reasons.push(`API: ${apiResult.summary}`);
                    console.log(`[RegressionTest]   ❌ FAILED — ${reasons.join(' | ')}`);
                } else {
                    screenResult.status = 'warning';
                    const reasons = [];
                    if (uiChanged) reasons.push(`DOM: ${uiResult.domDiff?.summary || 'changed'}`);
                    if (apiChanged) reasons.push(`API: ${apiResult.summary}`);
                    console.log(`[RegressionTest]   ⚠️ WARNING — ${reasons.join(' | ')}`);
                }

            } catch (error) {
                console.error(`[RegressionTest]   💥 ERROR: ${error.message}`);

                // Save error state HTML for debugging
                try {
                    const errorHtml = await this.page.content();
                    await fs.writeFile(path.join(screenTestPath, 'error_page.html'), errorHtml, 'utf-8');
                } catch { }

                // Pause and ask the user what to do
                console.log(`[RegressionTest]   ⏸️ Pausing — waiting for user decision...`);
                try {
                    const targetUrl = originalData?.metadata?.url || '';
                    const shouldContinue = await this.waitForUserNavigation(
                        node?.name || screenId,
                        targetUrl,
                        `Error at screen "${node?.name || screenId}": ${error.message}. You can navigate to the correct page and press Continue to retry capture, or Skip to move on.`
                    );

                    if (!shouldContinue) {
                        console.log(`[RegressionTest]   ⏭️ User skipped: ${screenId}`);
                        screenResult.status = 'skipped';
                        screenResult.errors.push('Skipped by user: ' + error.message);
                        screenResults.push(screenResult);
                        continue;
                    }

                    // User chose Continue — retry capture & compare for this screen
                    console.log(`[RegressionTest]   ▶️ User confirmed — retrying capture...`);
                    await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
                    await new Promise(r => setTimeout(r, 500));

                    try {
                        // Retry capture
                        const captureData = await this.captureCurrentState();

                        const savePromises = [
                            fs.writeFile(path.join(screenTestPath, 'screen.html'), captureData.html, 'utf-8'),
                            fs.writeJson(path.join(screenTestPath, 'dom.json'), {
                                body: captureData.dom,
                                url: captureData.meta.url,
                                title: captureData.meta.title,
                                viewport: captureData.meta.viewport
                            }, { spaces: 0 }),
                            fs.writeJson(path.join(screenTestPath, 'meta.json'), captureData.meta, { spaces: 2 })
                        ];

                        const screenAPIs = capturedAPIs[screenId] || [];
                        savePromises.push(
                            fs.writeJson(path.join(screenTestPath, 'apis.json'), screenAPIs.map(a => ({
                                method: a.method, url: a.url, status: a.status,
                                duration: a.duration, mimeType: a.mimeType,
                                responseBody: a.responseBody
                            })), { spaces: 0 })
                        );
                        await Promise.all(savePromises);

                        // Retry compare
                        const compareService = require('./compare.service');
                        const originalPath = path.join(sectionPath, screenId);
                        const [uiResult, apiResult] = await Promise.all([
                            compareService.compareUI(originalPath, screenTestPath).catch(e => ({ hasChanges: false, error: e.message })),
                            compareService.compareAPI(originalPath, screenTestPath).catch(e => ({ hasChanges: false, error: e.message }))
                        ]);

                        screenResult.comparison = { ui: uiResult, api: apiResult };
                        const uiChanged = uiResult?.hasChanges === true;
                        const apiChanged = apiResult?.hasChanges === true;
                        const cssChanged = uiResult?.cssDiff?.totalChanges > 0;

                        if (!uiChanged && !apiChanged) {
                            screenResult.status = 'passed';
                            console.log(`[RegressionTest]   ✅ PASSED (after retry) — no changes`);
                        } else if (cssChanged) {
                            screenResult.status = 'failed';
                            console.log(`[RegressionTest]   ❌ FAILED (after retry)`);
                        } else {
                            screenResult.status = 'warning';
                            console.log(`[RegressionTest]   ⚠️ WARNING (after retry)`);
                        }
                    } catch (retryError) {
                        screenResult.status = 'error';
                        screenResult.errors.push('Retry failed: ' + retryError.message);
                        console.error(`[RegressionTest]   💥 Retry also failed: ${retryError.message}`);
                    }
                } catch (overlayError) {
                    // If even the overlay fails (page crashed, browser closed), mark as error
                    screenResult.status = 'error';
                    screenResult.errors.push(error.message);
                    console.error(`[RegressionTest]   💥 Cannot show overlay: ${overlayError.message}`);
                }
            }

            screenResults.push(screenResult);
        }

        // ═══════════════════════════════════════
        // Generate test report
        // ═══════════════════════════════════════
        const testEndTime = Date.now();
        const duration = testEndTime - testStartTime;

        const passed = screenResults.filter(r => r.status === 'passed').length;
        const failed = screenResults.filter(r => r.status === 'failed').length;
        const warnings = screenResults.filter(r => r.status === 'warning').length;
        const errors = screenResults.filter(r => r.status === 'error').length;
        const skipped = screenResults.filter(r => r.status === 'skipped').length;

        const report = {
            testRunId,
            projectName,
            sectionId,
            timestamp: new Date().toISOString(),
            duration: `${(duration / 1000).toFixed(1)}s`,
            durationMs: duration,
            summary: {
                total: screenResults.length,
                passed,
                failed,
                warnings,
                errors,
                skipped,
                overallStatus: failed > 0 || errors > 0 ? 'FAILED' : warnings > 0 ? 'WARNING' : 'PASSED'
            },
            screens: screenResults
        };

        // Save JSON report
        await fs.writeJson(path.join(testRunPath, 'report.json'), report, { spaces: 2 });

        // Generate HTML report
        const htmlReport = this.generateHTMLReport(report);
        await fs.writeFile(path.join(testRunPath, 'report.html'), htmlReport, 'utf-8');

        // Clean up
        if (!options.keepBrowserOpen) {
            await this.stopReplay();
        }

        console.log(`\n[RegressionTest] ╔═══════════════════════════════════════════╗`);
        console.log(`[RegressionTest] ║  🧪 Regression Test Complete              ║`);
        console.log(`[RegressionTest] ║  Status: ${report.summary.overallStatus.padEnd(33)}║`);
        console.log(`[RegressionTest] ║  ✅ ${String(passed).padEnd(3)} passed  ❌ ${String(failed).padEnd(3)} failed       ║`);
        console.log(`[RegressionTest] ║  ⚠️  ${String(warnings).padEnd(3)} warnings 💥 ${String(errors).padEnd(3)} errors     ║`);
        console.log(`[RegressionTest] ║  Duration: ${report.duration.padEnd(31)}║`);
        console.log(`[RegressionTest] ║  Report: test-runs/${testRunId.substring(0, 23)}║`);
        console.log(`[RegressionTest] ╚═══════════════════════════════════════════╝\n`);

        return {
            success: true,
            testRunId,
            testRunPath,
            reportPath: path.join(testRunPath, 'report.html'),
            ...report
        };
    }

    /**
     * Legacy full replay (keeps backward compatibility)
     */
    async runFullReplay(projectName, sectionId, options = {}) {
        return this.runRegressionTest(projectName, sectionId, options);
    }

    /**
     * Get ordered screen list from flow edges
     */
    getScreenOrder(flowData) {
        const order = [];
        const visited = new Set();

        let currentEdge = flowData.edges.find(e => e.source === 'start' || e.from === 'start');
        while (currentEdge) {
            const screenId = currentEdge.target || currentEdge.to;
            if (visited.has(screenId)) break; // Prevent loops
            visited.add(screenId);

            order.push({ id: screenId, edge: currentEdge });

            // Find next edge
            const outgoing = flowData.edges.filter(e =>
                (e.source === screenId || e.from === screenId) &&
                !visited.has(e.target || e.to)
            );
            currentEdge = outgoing.length > 0 ? outgoing[0] : null;
        }

        return order;
    }

    /**
     * Capture current page state (DOM + CSS + HTML + meta)
     * Uses same logic as capture service for consistency
     */
    async captureCurrentState() {
        const { html, dom, meta } = await this.page.evaluate(() => {
            // CSS properties for comparison
            const STYLE_PROPS = [
                'color', 'backgroundColor', 'fontSize', 'fontWeight', 'fontFamily',
                'padding', 'margin', 'border', 'borderRadius',
                'display', 'position', 'top', 'left', 'right', 'bottom',
                'width', 'height', 'opacity', 'visibility',
                'textAlign', 'lineHeight', 'textDecoration',
                'boxShadow', 'transform', 'zIndex',
                'flexDirection', 'justifyContent', 'alignItems', 'gap'
            ];

            const STYLED_TAGS = new Set([
                'a', 'button', 'input', 'select', 'textarea', 'label',
                'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                'p', 'span', 'strong', 'em', 'b', 'i', 'u',
                'td', 'th', 'li', 'img', 'svg',
                'nav', 'header', 'footer', 'main', 'section', 'aside'
            ]);

            function extractStyles(el, tag) {
                if (!STYLED_TAGS.has(tag)) return null;
                if (el.offsetWidth === 0 && el.offsetHeight === 0) return null;
                try {
                    const computed = getComputedStyle(el);
                    const styles = {};
                    let has = false;
                    for (const prop of STYLE_PROPS) {
                        const val = computed[prop];
                        if (val && val !== '' && val !== 'none' && val !== 'normal' &&
                            val !== 'auto' && val !== '0px' && val !== 'rgba(0, 0, 0, 0)' &&
                            val !== 'static' && val !== 'visible') {
                            styles[prop] = val;
                            has = true;
                        }
                    }
                    return has ? styles : null;
                } catch { return null; }
            }

            function serialize(el, depth = 0) {
                if (depth > 30) return null;
                if (el.nodeType === 3) {
                    const text = el.textContent.trim();
                    return text ? { t: '#text', v: text } : null;
                }
                if (el.nodeType !== 1) return null;

                const tag = el.tagName.toLowerCase();
                if (['script', 'style', 'noscript', 'link'].includes(tag)) return null;

                const node = { t: tag };

                // Attributes
                const attrs = {};
                for (const attr of el.attributes) {
                    const name = attr.name;
                    if (name.startsWith('on') || name.startsWith('data-v-')) continue;
                    if (['id', 'class', 'name', 'type', 'href', 'src', 'alt', 'title',
                        'value', 'placeholder', 'role', 'aria-label', 'data-testid',
                        'disabled', 'checked', 'selected'].includes(name) || name.startsWith('data-')) {
                        attrs[name] = attr.value;
                    }
                }
                if (Object.keys(attrs).length > 0) node.a = attrs;

                // Visibility
                if (el.offsetParent === null && tag !== 'body' && tag !== 'html' &&
                    !['thead', 'tbody', 'tr'].includes(tag)) {
                    if (el.offsetWidth === 0 && el.offsetHeight === 0) {
                        node.hidden = true;
                    }
                }

                // CSS
                if (!node.hidden) {
                    const css = extractStyles(el, tag);
                    if (css) node.css = css;
                }

                // Bounding rect
                if (STYLED_TAGS.has(tag) && !node.hidden) {
                    const r = el.getBoundingClientRect();
                    node.rect = {
                        x: Math.round(r.x), y: Math.round(r.y),
                        w: Math.round(r.width), h: Math.round(r.height)
                    };
                }

                // Form values
                if (['input', 'textarea', 'select'].includes(tag)) {
                    if (el.value) node.val = el.value;
                    if (el.checked) node.checked = true;
                }

                // Children
                const children = [];
                for (const child of el.childNodes) {
                    const s = serialize(child, depth + 1);
                    if (s) children.push(s);
                }
                if (children.length > 0) node.c = children;

                return node;
            }

            return {
                html: document.documentElement.outerHTML,
                dom: serialize(document.body),
                meta: {
                    url: location.href,
                    title: document.title,
                    scroll: { x: Math.round(scrollX), y: Math.round(scrollY) },
                    viewport: { w: innerWidth, h: innerHeight },
                    timestamp: Date.now()
                }
            };
        });

        // Inject <base> tag so relative URLs (fonts, images) resolve to original server
        let processedHtml = html;
        try {
            const origin = new URL(meta.url).origin;
            if (origin && !html.includes('<base ')) {
                processedHtml = html.replace(/<head([^>]*)>/i, `<head$1><base href="${origin}/">`);
            }
        } catch (e) { /* URL parse error — use raw html */ }

        return { html: processedHtml, dom, meta };
    }

    /**
     * Generate beautiful HTML test report
     */
    generateHTMLReport(report) {
        const statusColors = {
            passed: '#10b981', failed: '#ef4444',
            warning: '#f59e0b', error: '#dc2626', skipped: '#94a3b8'
        };
        const statusIcons = {
            passed: '✅', failed: '❌', warning: '⚠️', error: '💥', skipped: '⏭️'
        };
        const overallColor = report.summary.overallStatus === 'PASSED' ? '#10b981' :
            report.summary.overallStatus === 'WARNING' ? '#f59e0b' : '#ef4444';

        return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🧪 Regression Test Report — ${report.projectName}</title>
    <style>
        :root {
            --bg: #0f172a; --surface: #1e293b; --card: #334155;
            --text: #e2e8f0; --muted: #94a3b8; --accent: #3b82f6;
            --success: #10b981; --danger: #ef4444; --warning: #f59e0b;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            background: var(--bg); color: var(--text);
            line-height: 1.6; padding: 24px;
        }
        .container { max-width: 1200px; margin: 0 auto; }

        /* Header */
        .header {
            background: linear-gradient(135deg, var(--surface), var(--card));
            border-radius: 16px; padding: 32px;
            border: 1px solid rgba(255,255,255,0.05);
            margin-bottom: 24px;
        }
        .header h1 { font-size: 28px; margin-bottom: 8px; }
        .header .meta { color: var(--muted); font-size: 14px; }
        .header .meta span { margin-right: 24px; }

        /* Summary bar */
        .summary {
            display: flex; gap: 16px; margin-bottom: 24px;
            flex-wrap: wrap;
        }
        .summary-card {
            flex: 1; min-width: 140px;
            background: var(--surface); border-radius: 12px;
            padding: 20px; text-align: center;
            border: 1px solid rgba(255,255,255,0.05);
        }
        .summary-card .number { font-size: 36px; font-weight: 700; }
        .summary-card .label { color: var(--muted); font-size: 13px; margin-top: 4px; }
        .overall-badge {
            display: inline-block; padding: 6px 16px; border-radius: 20px;
            font-weight: 700; font-size: 14px; letter-spacing: 0.5px;
        }

        /* Screen cards */
        .screen-card {
            background: var(--surface); border-radius: 12px;
            margin-bottom: 16px; overflow: hidden;
            border: 1px solid rgba(255,255,255,0.05);
            transition: border-color 0.2s;
        }
        .screen-card:hover { border-color: rgba(255,255,255,0.1); }
        .screen-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 16px 20px; cursor: pointer;
            user-select: none;
        }
        .screen-header:hover { background: rgba(255,255,255,0.02); }
        .screen-title { font-size: 16px; font-weight: 600; }
        .screen-title .step { color: var(--muted); font-weight: 400; margin-right: 8px; }
        .status-badge {
            padding: 4px 12px; border-radius: 12px;
            font-size: 12px; font-weight: 600; text-transform: uppercase;
        }

        /* Collapsible detail */
        .screen-detail {
            display: none; padding: 0 20px 20px;
            border-top: 1px solid rgba(255,255,255,0.05);
        }
        .screen-card.open .screen-detail { display: block; }

        /* Diff sections */
        .diff-section {
            background: var(--card); border-radius: 8px;
            padding: 16px; margin-top: 12px;
        }
        .diff-section h4 {
            font-size: 14px; color: var(--accent); margin-bottom: 8px;
            display: flex; align-items: center; gap: 6px;
        }
        .diff-items { font-size: 13px; }
        .diff-item {
            padding: 6px 10px; border-radius: 4px;
            margin-bottom: 4px; display: flex; justify-content: space-between;
            align-items: center;
        }
        .diff-item.add { background: rgba(16, 185, 129, 0.1); color: var(--success); }
        .diff-item.remove { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
        .diff-item.modify { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
        .diff-item .path { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
        .diff-item .values { font-size: 11px; color: var(--muted); }
        .diff-item .arrow { margin: 0 4px; }

        /* DOM Previews */
        .screenshots {
            display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
            margin-top: 12px;
        }
        .screenshot-box {
            background: var(--card); border-radius: 8px; overflow: hidden;
        }
        .screenshot-box .label {
            padding: 8px 12px; font-size: 12px; color: var(--muted);
            background: rgba(0,0,0,0.2);
        }
        .screenshot-box iframe {
            width: 100%; height: 400px; border: none; display: block;
            background: white; pointer-events: none;
        }

        /* Timing */
        .timing-bar {
            display: flex; gap: 12px; margin-top: 8px; font-size: 12px; color: var(--muted);
        }
        .timing-bar span { display: flex; align-items: center; gap: 4px; }

        @media (max-width: 768px) {
            .screenshots { grid-template-columns: 1fr; }
            .summary { flex-direction: column; }
        }
    </style>
</head>
<body>
<div class="container">
    <!-- Header -->
    <div class="header">
        <h1>🧪 Regression Test Report</h1>
        <div class="meta">
            <span>📦 ${report.projectName}</span>
            <span>📋 ${report.sectionId}</span>
            <span>🕐 ${report.timestamp}</span>
            <span>⏱️ ${report.duration}</span>
        </div>
        <div style="margin-top: 16px;">
            <span class="overall-badge" style="background: ${overallColor}20; color: ${overallColor};">
                ${report.summary.overallStatus === 'PASSED' ? '✅' : report.summary.overallStatus === 'WARNING' ? '⚠️' : '❌'}
                ${report.summary.overallStatus}
            </span>
        </div>
    </div>

    <!-- Summary -->
    <div class="summary">
        <div class="summary-card">
            <div class="number">${report.summary.total}</div>
            <div class="label">Screens</div>
        </div>
        <div class="summary-card">
            <div class="number" style="color: var(--success)">${report.summary.passed}</div>
            <div class="label">Passed</div>
        </div>
        <div class="summary-card">
            <div class="number" style="color: var(--danger)">${report.summary.failed}</div>
            <div class="label">Failed</div>
        </div>
        <div class="summary-card">
            <div class="number" style="color: var(--warning)">${report.summary.warnings}</div>
            <div class="label">Warnings</div>
        </div>
    </div>

    <!-- Screen Results -->
    ${report.screens.map(screen => {
            const color = statusColors[screen.status] || '#94a3b8';
            const icon = statusIcons[screen.status] || '❓';
            const ui = screen.comparison?.ui;
            const api = screen.comparison?.api;
            const css = ui?.cssDiff;

            return `
    <div class="screen-card open" onclick="this.classList.toggle('open')">
        <div class="screen-header">
            <div class="screen-title">
                <span class="step">#${screen.step}</span>
                ${icon} ${screen.name}
                <span style="color: var(--muted); font-weight: 400; font-size: 13px; margin-left: 8px;">
                    ${screen.originalUrl ? new URL(screen.originalUrl).pathname : ''}
                </span>
            </div>
            <span class="status-badge" style="background: ${color}20; color: ${color};">
                ${screen.status}
            </span>
        </div>

        <div class="screen-detail">
            ${screen.errors.length > 0 ? `
                <div class="diff-section" style="border-left: 3px solid var(--danger);">
                    <h4>💥 Errors</h4>
                    <div class="diff-items">
                        ${screen.errors.map(e => `<div class="diff-item remove">${e}</div>`).join('')}
                    </div>
                </div>
            ` : ''}

            ${ui?.summary ? `
                <div class="diff-section">
                    <h4>📊 So sánh tổng quan</h4>
                    <div class="diff-items">
                        <div class="diff-item">${ui.summary}</div>
                        <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">
                            Similarity: ${ui.similarity || '—'}%
                        </div>
                    </div>
                </div>
            ` : ''}

            ${css && css.totalChanges > 0 ? `
                <div class="diff-section" style="border-left: 3px solid var(--warning);">
                    <h4>🎨 CSS Changes (${css.totalChanges})</h4>
                    <div class="diff-items">
                        ${(css.changes || []).slice(0, 15).map(c => `
                            <div class="diff-item modify">
                                <span class="path">${c.element || ''} → <strong>${c.property}</strong></span>
                                <span class="values">${c.old} <span class="arrow">→</span> ${c.new}${c.diff !== undefined ? ` (${c.diff > 0 ? '+' : ''}${c.diff}px)` : ''}</span>
                            </div>
                        `).join('')}
                        ${css.changes.length > 15 ? `<div style="color: var(--muted); padding: 4px 10px; font-size: 12px;">... và ${css.changes.length - 15} thay đổi khác</div>` : ''}
                    </div>
                </div>
            ` : ''}

            ${api && api.hasChanges ? `
                <div class="diff-section" style="border-left: 3px solid var(--accent);">
                    <h4>🔌 API Changes</h4>
                    <div class="diff-items">
                        <div class="diff-item">${api.summary}</div>
                        ${(api.added || []).map(a => `<div class="diff-item add">+ ${typeof a === 'string' ? a : a.endpoint} ${a.count ? `(${a.count}x)` : ''}</div>`).join('')}
                        ${(api.removed || []).map(a => `<div class="diff-item remove">- ${typeof a === 'string' ? a : a.endpoint}</div>`).join('')}
                        ${(api.modified || []).map(m => `
                            <div class="diff-item modify">~ ${m.endpoint}: ${m.changes?.map(c => c.detail).join(', ')}</div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="timing-bar">
                ${screen.timings?.navigation ? `<span>🌐 Nav: ${screen.timings.navigation}ms</span>` : ''}
                ${screen.timings?.actions ? `<span>▶️ Actions: ${screen.timings.actions}ms</span>` : ''}
                ${screen.timings?.capture ? `<span>📸 Capture: ${screen.timings.capture}ms</span>` : ''}
                ${screen.timings?.compare ? `<span>🔍 Compare: ${screen.timings.compare}ms</span>` : ''}
                ${screen.actionsReplayed !== undefined ? `<span>⌨️ ${screen.actionsReplayed} actions</span>` : ''}
            </div>

            <!-- DOM Preview (screen.html) -->
            <div class="screenshots">
                <div class="screenshot-box">
                    <div class="label">Original</div>
                    <iframe src="../${report.sectionId}/${screen.screenId}/screen.html"
                         sandbox="allow-same-origin" loading="lazy"></iframe>
                </div>
                <div class="screenshot-box">
                    <div class="label">Current</div>
                    <iframe src="${screen.screenId}/screen.html"
                         sandbox="allow-same-origin" loading="lazy"></iframe>
                </div>
            </div>
        </div>
    </div>`;
        }).join('')}
</div>

<script>
    // Auto-open failed screens
    document.querySelectorAll('.screen-card').forEach(card => {
        card.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });
</script>
</body>
</html>`;
    }

    /**
     * Show a warning overlay in the browser and wait for the user
     * to manually navigate to the target screen, then click Continue.
     *
     * Returns a promise that resolves when the user clicks Continue.
     */
    async waitForUserNavigation(screenName, targetUrl, errorMessage) {
        if (!this.page) throw new Error('No page available');

        // Expose continue function (once per session)
        if (!this._continueExposed) {
            this._continueResolve = null;
            await this.context.exposeBinding('__replayContinue', ({ page }, confirmed) => {
                if (this._continueResolve) {
                    this._continueResolve(confirmed);
                    this._continueResolve = null;
                }
            });
            this._continueExposed = true;
        }

        // Inject warning overlay into the page
        await this.page.evaluate(({ screenName, targetUrl, errorMessage }) => {
            // Remove previous overlay if any
            const old = document.getElementById('replay-wait-overlay');
            if (old) old.remove();

            const overlay = document.createElement('div');
            overlay.id = 'replay-wait-overlay';
            overlay.style.cssText = `
                position: fixed; inset: 0; z-index: 2147483647;
                display: flex; align-items: center; justify-content: center;
                background: rgba(0,0,0,0.6);
                font-family: system-ui, -apple-system, sans-serif;
            `;
            overlay.innerHTML = `
                <div style="background:#fff;padding:28px;border-radius:16px;width:460px;max-width:92vw;box-shadow:0 16px 48px rgba(0,0,0,0.4);text-align:center">
                    <div style="width:48px;height:48px;margin:0 auto 16px;border-radius:50%;background:#fff7ed;display:flex;align-items:center;justify-content:center">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <path d="M14 6v10M14 20v2" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/>
                            <path d="M3.5 24.5h21L14 3.5 3.5 24.5z" stroke="#f59e0b" stroke-width="2" stroke-linejoin="round" fill="none"/>
                        </svg>
                    </div>
                    <h3 style="margin:0 0 8px;font-size:18px;color:#333">Navigation Error</h3>
                    <p style="margin:0 0 12px;font-size:13px;color:#ef4444;background:#fef2f2;padding:8px 12px;border-radius:8px;word-break:break-word">${errorMessage}</p>
                    <div style="margin-bottom:16px;text-align:left;background:#f8fafc;padding:12px;border-radius:8px;font-size:13px;color:#555">
                        <div style="margin-bottom:6px"><strong>Target screen:</strong> ${screenName}</div>
                        ${targetUrl ? `<div style="margin-bottom:6px;word-break:break-all"><strong>URL:</strong> ${targetUrl}</div>` : ''}
                        <div style="color:#64748b;font-size:12px;margin-top:8px">
                            Please navigate to the target screen manually in this browser, then click <strong>Continue</strong>.
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;justify-content:center">
                        <button id="replay-skip-btn" style="padding:10px 24px;border:1px solid #ddd;border-radius:8px;background:#fff;cursor:pointer;font-size:14px;color:#666">Skip</button>
                        <button id="replay-continue-btn" style="padding:10px 24px;border:none;border-radius:8px;background:#3b82f6;color:#fff;cursor:pointer;font-size:14px;font-weight:600">Continue Capture</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            // Button handlers
            document.getElementById('replay-continue-btn').addEventListener('click', () => {
                overlay.remove();
                window.__replayContinue(true);
            });
            document.getElementById('replay-skip-btn').addEventListener('click', () => {
                overlay.remove();
                window.__replayContinue(false);
            });
        }, { screenName, targetUrl, errorMessage });

        // Wait for user to click Continue or Skip
        return new Promise((resolve) => {
            this._continueResolve = resolve;
        });
    }

    /**
     * Helper: Smooth auto-scroll to bottom and back to top
     */
    async autoScroll(page) {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        window.scrollTo(0, 0);
                        resolve();
                    }
                }, 50);
            });
        });
        await new Promise(r => setTimeout(r, 500));
    }
}

module.exports = new UnifiedReplayService();
