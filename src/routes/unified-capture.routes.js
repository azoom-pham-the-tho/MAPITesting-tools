/**
 * Unified Capture Routes
 * 
 * Replaces old capture.routes.js with the new unified capture service
 */

const express = require('express');
const router = express.Router();
const unifiedCaptureService = require('../services/unified-capture.service');
const storageService = require('../services/storage.service');
const path = require('path');
const fs = require('fs-extra');

/**
 * Resolve screen folder path — supports nested folder structure.
 * Capture saves screens in nested paths: sectionPath/start/login/home/screenId/
 * but the API only receives screenId. This helper finds the actual folder.
 *
 * Strategy:
 * 1. Try reading flow.json for nestedPath (fastest)
 * 2. Recursively scan directories for meta.json with matching id (fallback)
 * 3. Try flat path sectionPath/screenId/ (legacy compatibility)
 */
async function resolveScreenPath(sectionPath, screenId) {
    // 1. Try flow.json first — O(1) lookup
    const flowPath = path.join(sectionPath, 'flow.json');
    if (await fs.pathExists(flowPath)) {
        try {
            const flow = await fs.readJson(flowPath);
            const node = (flow.nodes || []).find(n => n.id === screenId);
            if (node?.nestedPath) {
                const nested = path.join(sectionPath, node.nestedPath);
                if (await fs.pathExists(nested)) return nested;
            }
        } catch (e) { /* ignore parse errors */ }
    }

    // 2. Recursive scan — find any directory named screenId
    async function findDir(dir, target, depth = 0) {
        if (depth > 10) return null;
        try {
            const items = await fs.readdir(dir, { withFileTypes: true });
            for (const item of items) {
                if (!item.isDirectory()) continue;
                if (item.name === target) {
                    const candidate = path.join(dir, item.name);
                    // Verify it's a screen folder (has meta.json)
                    if (await fs.pathExists(path.join(candidate, 'meta.json')) ||
                        await fs.pathExists(path.join(candidate, 'screen.json'))) {
                        return candidate;
                    }
                }
                // Recurse into subdirectories
                const found = await findDir(path.join(dir, item.name), target, depth + 1);
                if (found) return found;
            }
        } catch (e) { /* ignore */ }
        return null;
    }
    const found = await findDir(sectionPath, screenId);
    if (found) return found;

    // 3. Legacy flat path
    const flat = path.join(sectionPath, screenId);
    if (await fs.pathExists(flat)) return flat;

    return null;
}

/**
 * Recursively collect all screen folders (any directory with meta.json or screen.json)
 */
async function collectAllScreens(dir, results = [], depth = 0) {
    if (depth > 10) return results;
    try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        for (const item of items) {
            if (!item.isDirectory()) continue;
            // Skip hidden/system dirs
            if (item.name.startsWith('_') || item.name.startsWith('.')) continue;

            const fullPath = path.join(dir, item.name);

            // Check if this dir is a screen folder
            let metaPath = path.join(fullPath, 'meta.json');
            if (!await fs.pathExists(metaPath)) {
                metaPath = path.join(fullPath, 'screen.json');
            }

            if (await fs.pathExists(metaPath)) {
                const metadata = await fs.readJson(metaPath);
                results.push({
                    id: metadata.id || item.name,
                    ...metadata
                });
            }

            // Always recurse — screens can be nested inside other screens
            await collectAllScreens(fullPath, results, depth + 1);
        }
    } catch (e) { /* ignore */ }
    return results;
}

/**
 * Start a capture session
 * POST /api/capture/start
 */
router.post('/start', async (req, res, next) => {
    try {
        const { projectName, startUrl } = req.body;

        if (!projectName) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        if (!startUrl) {
            return res.status(400).json({ error: 'Start URL is required' });
        }

        // Validate URL
        try {
            new URL(startUrl);
        } catch {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        const result = await unifiedCaptureService.startSession(projectName, startUrl);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

/**
 * Stop the capture session
 * POST /api/capture/stop
 */
router.post('/stop', async (req, res, next) => {
    try {
        const result = await unifiedCaptureService.stopSession();
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

/**
 * Trigger manual screenshot (simulate ESC key)
 * POST /api/capture/trigger-screenshot
 */
router.post('/trigger-screenshot', async (req, res, next) => {
    try {
        const result = await unifiedCaptureService.triggerScreenshot();
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

/**
 * Get current session status
 * GET /api/capture/status
 */
router.get('/status', async (req, res) => {
    const status = await unifiedCaptureService.getStatus();
    res.json({ success: true, ...status });
});

/**
 * Get URL history
 * GET /api/capture/history
 */
router.get('/history', async (req, res, next) => {
    try {
        const { projectName } = req.query;
        const history = await storageService.getUrlHistory(projectName);
        res.json({ success: true, history });
    } catch (error) {
        next(error);
    }
});

/**
 * Get captured screen HTML
 * GET /api/capture/screen/:projectName/:section/:screenId
 */
router.get('/screen/:projectName/:section/:screenId', async (req, res, next) => {
    try {
        const { projectName, section, screenId } = req.params;
        const sectionPath = storageService.getSectionPath(projectName, section);
        const basePath = await resolveScreenPath(sectionPath, screenId);

        if (!basePath) {
            return res.status(404).json({ error: 'Screen not found' });
        }

        // Prefer screen.html (full HTML for preview & reproduction)
        const screenHtmlPath = path.join(basePath, 'screen.html');
        const domJsonPath = path.join(basePath, 'dom.json');

        if (await fs.pathExists(screenHtmlPath)) {
            const html = await fs.readFile(screenHtmlPath, 'utf-8');
            res.type('text/html').send(html);
        } else if (await fs.pathExists(domJsonPath)) {
            const domData = await fs.readJson(domJsonPath);
            res.json({ success: true, format: 'json', ...domData });
        } else {
            return res.status(404).json({ error: 'Screen not found' });
        }
    } catch (error) {
        next(error);
    }
});

/**
 * Get screen metadata
 * GET /api/capture/screen-info/:projectName/:section/:screenId
 */
router.get('/screen-info/:projectName/:section/:screenId', async (req, res, next) => {
    try {
        const { projectName, section, screenId } = req.params;
        const sectionPath = storageService.getSectionPath(projectName, section);
        const basePath = await resolveScreenPath(sectionPath, screenId);

        if (!basePath) {
            return res.status(404).json({ error: 'Screen not found', id: screenId });
        }

        const result = {
            id: screenId,
            section: section
        };

        // Load metadata (new: meta.json, old: screen.json)
        let metaPath = path.join(basePath, 'meta.json');
        if (!await fs.pathExists(metaPath)) {
            metaPath = path.join(basePath, 'screen.json');
        }
        if (await fs.pathExists(metaPath)) {
            result.metadata = await fs.readJson(metaPath);
        }

        // Load actions summary
        const actionsPath = path.join(basePath, 'actions.json');
        if (await fs.pathExists(actionsPath)) {
            const actionsData = await fs.readJson(actionsPath);
            const actionsList = Array.isArray(actionsData) ? actionsData : (actionsData.actions || []);
            result.actions = {
                count: actionsList.length,
                summary: actionsData.summary || { total: actionsList.length }
            };
        }

        // Load APIs summary
        const apisPath = path.join(basePath, 'apis.json');
        if (await fs.pathExists(apisPath)) {
            const apisData = await fs.readJson(apisPath);
            const apisList = Array.isArray(apisData) ? apisData : (apisData.requests || []);
            result.apis = {
                count: apisList.length,
                summary: apisData.summary || { total: apisList.length }
            };
        }

        // Load navigation info
        const navPath = path.join(basePath, 'navigation.json');
        if (await fs.pathExists(navPath)) {
            result.navigation = await fs.readJson(navPath);
        }

        // Check for preview (screen.html — the only format, no screenshots)
        const previewPath = path.join(basePath, 'screen.html');
        result.hasPreview = await fs.pathExists(previewPath);

        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

/**
 * Get screen actions
 * GET /api/capture/actions/:projectName/:section/:screenId
 */
router.get('/actions/:projectName/:section/:screenId', async (req, res, next) => {
    try {
        const { projectName, section, screenId } = req.params;
        const sectionPath = storageService.getSectionPath(projectName, section);
        const basePath = await resolveScreenPath(sectionPath, screenId);

        if (!basePath) {
            return res.json({ success: true, actions: [], summary: {} });
        }

        const actionsPath = path.join(basePath, 'actions.json');
        if (!await fs.pathExists(actionsPath)) {
            return res.json({ success: true, actions: [], summary: {} });
        }

        const data = await fs.readJson(actionsPath);
        res.json({ success: true, ...data });
    } catch (error) {
        next(error);
    }
});

/**
 * Get screen APIs
 * GET /api/capture/apis/:projectName/:section/:screenId
 */
router.get('/apis/:projectName/:section/:screenId', async (req, res, next) => {
    try {
        const { projectName, section, screenId } = req.params;
        const sectionPath = storageService.getSectionPath(projectName, section);
        const basePath = await resolveScreenPath(sectionPath, screenId);

        if (!basePath) {
            return res.json({ success: true, requests: [], summary: {} });
        }

        const apisPath = path.join(basePath, 'apis.json');
        if (!await fs.pathExists(apisPath)) {
            return res.json({ success: true, requests: [], summary: {} });
        }

        const data = await fs.readJson(apisPath);
        res.json({ success: true, ...data });
    } catch (error) {
        next(error);
    }
});

/**
 * Get session flow graph
 * GET /api/capture/flow/:projectName/:section
 */
router.get('/flow/:projectName/:section', async (req, res, next) => {
    try {
        const { projectName, section } = req.params;

        const flowPath = path.join(
            storageService.getSectionPath(projectName, section),
            'flow.json'
        );

        if (!await fs.pathExists(flowPath)) {
            return res.json({
                success: true,
                nodes: [{ id: 'start', name: 'Start', type: 'start' }],
                edges: []
            });
        }

        const data = await fs.readJson(flowPath);
        res.json({ success: true, ...data });
    } catch (error) {
        next(error);
    }
});

/**
 * Update domain in flow.json (for environment switching)
 * POST /api/capture/update-domain/:projectName/:section
 */
router.post('/update-domain/:projectName/:section', async (req, res, next) => {
    try {
        const { projectName, section } = req.params;
        const { domain } = req.body;

        if (!domain) {
            return res.status(400).json({ error: 'Domain is required' });
        }

        const flowPath = path.join(
            storageService.getSectionPath(projectName, section),
            'flow.json'
        );

        if (!await fs.pathExists(flowPath)) {
            return res.status(404).json({ error: 'Flow file not found' });
        }

        // Update domain in flow.json
        const flowData = await fs.readJson(flowPath);
        flowData.domain = domain;
        await fs.writeJson(flowPath, flowData, { spaces: 2 });

        // Also update session.json if exists
        const sessionPath = path.join(
            storageService.getSectionPath(projectName, section),
            'session.json'
        );
        if (await fs.pathExists(sessionPath)) {
            const sessionData = await fs.readJson(sessionPath);
            sessionData.domain = domain;
            await fs.writeJson(sessionPath, sessionData, { spaces: 2 });
        }

        res.json({ success: true, domain });
    } catch (error) {
        next(error);
    }
});

/**
 * Get screen preview (HTML for iframe rendering)
 * GET /api/capture/preview/:projectName/:section/:screenId
 * Also supports nested paths: /api/capture/preview/:projectName/:section/path/to/screen
 */
router.get('/preview/:projectName/:section/*', async (req, res, next) => {
    try {
        const { projectName, section } = req.params;
        const screenPath = req.params[0]; // everything after section/
        const isThumbnail = req.query.mode === 'thumbnail';

        // Resolve section path: 'main' uses main folder, others use sections folder
        let sectionPath;
        if (section === 'main') {
            sectionPath = storageService.getMainPath(projectName);
        } else {
            sectionPath = storageService.getSectionPath(projectName, section);
        }

        // Try to find screen.html
        let html = null;

        // Strategy 1: Try the full nested path directly
        const directPath = path.join(sectionPath, screenPath);
        if (await fs.pathExists(path.join(directPath, 'screen.html'))) {
            html = await fs.readFile(path.join(directPath, 'screen.html'), 'utf-8');
        }

        // Strategy 2: Try with 'start/' prefix
        if (!html) {
            const withStartPath = path.join(sectionPath, 'start', screenPath);
            if (await fs.pathExists(path.join(withStartPath, 'screen.html'))) {
                html = await fs.readFile(path.join(withStartPath, 'screen.html'), 'utf-8');
            }
        }

        // Strategy 3: Extract just the last segment as screenId, use resolveScreenPath
        if (!html) {
            const screenId = screenPath.split('/').pop();
            const basePath = await resolveScreenPath(sectionPath, screenId);
            if (basePath) {
                const htmlPath = path.join(basePath, 'screen.html');
                if (await fs.pathExists(htmlPath)) {
                    html = await fs.readFile(htmlPath, 'utf-8');
                }
            }
        }

        if (html) {
            // If thumbnail mode, strip heavy content for lightweight preview
            if (isThumbnail) {
                html = stripForThumbnail(html);
            }
            return res.type('text/html').send(html);
        }

        // Fallback: render basic info from dom.json
        const screenId = screenPath.split('/').pop();
        const basePath = await resolveScreenPath(sectionPath, screenId);
        if (basePath) {
            const domPath = path.join(basePath, 'dom.json');
            if (await fs.pathExists(domPath)) {
                const domData = await fs.readJson(domPath);
                const fallbackHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${domData.title || 'Screen Preview'}</title>
    <style>
        body { font-family: system-ui, sans-serif; padding: 20px; background: #0f172a; color: #e2e8f0; }
        .preview-info { background: #1e293b; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #334155; }
        .preview-info h3 { margin: 0 0 10px 0; }
    </style>
</head>
<body>
    <div class="preview-info">
        <h3>📸 ${screenId}</h3>
        <p><strong>URL:</strong> ${domData.url || 'N/A'}</p>
        <p><strong>Title:</strong> ${domData.title || 'N/A'}</p>
        <p><strong>Viewport:</strong> ${domData.viewport?.w || 0}x${domData.viewport?.h || 0}</p>
    </div>
    <p>DOM data available for comparison. Full HTML preview not captured.</p>
</body>
</html>`;
                return res.type('text/html').send(fallbackHtml);
            }
        }

        return res.status(404).json({ error: 'Preview not found' });
    } catch (error) {
        next(error);
    }
});

/**
 * Strip heavy content from HTML for lightweight thumbnail preview
 * Removes: scripts, external links, icon fonts (MDI/FA), animations, transitions
 */
function stripForThumbnail(html) {
    // 1. Remove all <script> tags and content
    html = html.replace(/<script[\s\S]*?<\/script>/gi, '');

    // 2. Remove <link> tags (external stylesheets, fonts)
    html = html.replace(/<link[^>]*>/gi, '');

    // 3. Remove massive icon font CSS rules (MDI, FontAwesome, Material Icons)
    // These can be 500KB+ of CSS that's unnecessary for a thumbnail
    html = html.replace(/\.mdi-[^{]*\{[^}]*\}/g, '');
    html = html.replace(/\.fa-[^{]*\{[^}]*\}/g, '');
    html = html.replace(/\.material-icons[^{]*\{[^}]*\}/g, '');
    html = html.replace(/\.v-icon[^{]*\{[^}]*\}/g, '');

    // 4. Remove @font-face declarations
    html = html.replace(/@font-face\s*\{[^}]*\}/g, '');

    // 5. Remove @keyframes (animations)
    html = html.replace(/@keyframes\s+[\w-]+\s*\{[^}]*(\{[^}]*\}[^}]*)*\}/g, '');

    // 6. Remove @import rules
    html = html.replace(/@import\s+[^;]+;/g, '');

    // 7. Add thumbnail-specific styles: no animations, no scroll, no pointer events
    const thumbStyles = `<style>
        * { animation: none !important; transition: none !important; }
        body { overflow: hidden !important; pointer-events: none !important; }
        img { loading: eager; }
    </style>`;

    // Insert before </head> or at start
    if (html.includes('</head>')) {
        html = html.replace('</head>', thumbStyles + '</head>');
    } else {
        html = thumbStyles + html;
    }

    return html;
}

/**
 * List all screens in a section (recursively scans nested folders)
 * GET /api/capture/screens/:projectName/:section
 */
router.get('/screens/:projectName/:section', async (req, res, next) => {
    try {
        const { projectName, section } = req.params;

        const sectionPath = storageService.getSectionPath(projectName, section);

        if (!await fs.pathExists(sectionPath)) {
            return res.status(404).json({ error: 'Section not found' });
        }

        // Recursively collect all screen folders (nested structure)
        const screens = await collectAllScreens(sectionPath);

        // Sort by capture time (support both 'time' and 'capturedAt' fields)
        screens.sort((a, b) => new Date(a.time || a.capturedAt || 0) - new Date(b.time || b.capturedAt || 0));

        res.json({ success: true, screens });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
