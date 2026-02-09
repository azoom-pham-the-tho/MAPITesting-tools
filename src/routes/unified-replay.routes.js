/**
 * Unified Replay Routes
 */

const express = require('express');
const router = express.Router();
const unifiedReplayService = require('../services/unified-replay.service');

/**
 * Start replay session
 * POST /api/unified-replay/start
 */
router.post('/start', async (req, res, next) => {
    try {
        const { projectName, sectionId, options } = req.body;

        if (!projectName || !sectionId) {
            return res.status(400).json({ error: 'Project name and section ID are required' });
        }

        const result = await unifiedReplayService.startReplay(projectName, sectionId, options || {});
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

/**
 * Run full test replay (legacy — with API mocking)
 * POST /api/unified-replay/run/:projectName/:sectionId
 */
router.post('/run/:projectName/:sectionId', async (req, res, next) => {
    try {
        const { projectName, sectionId } = req.params;
        const { mode, deviceProfile } = req.body;

        const options = {
            interactive: false,
            mockAPIs: mode !== 'live', // 'live' mode = no mocking
            deviceProfile
        };

        const result = await unifiedReplayService.runFullReplay(projectName, sectionId, options);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

/**
 * Run regression test (auto replay + capture + compare + report)
 * POST /api/unified-replay/regression/:projectName/:sectionId
 * 
 * Body: { deviceProfile?: 'desktop'|'mobile'|'tablet', keepBrowserOpen?: boolean }
 * 
 * Returns: Full test report with UI/CSS/Pixel/API comparison for each screen
 */
router.post('/regression/:projectName/:sectionId', async (req, res, next) => {
    try {
        const { projectName, sectionId } = req.params;
        const { deviceProfile, keepBrowserOpen } = req.body;

        const options = {
            deviceProfile: deviceProfile || 'original',
            keepBrowserOpen: keepBrowserOpen || false
        };

        console.log(`[Route] 🧪 Starting regression test: ${projectName}/${sectionId}`);
        const result = await unifiedReplayService.runRegressionTest(projectName, sectionId, options);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

/**
 * Stop replay session
 * POST /api/unified-replay/stop
 */
router.post('/stop', async (req, res, next) => {
    try {
        const result = await unifiedReplayService.stopReplay();
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

/**
 * Get replay status
 * GET /api/unified-replay/status
 */
router.get('/status', (req, res) => {
    const status = unifiedReplayService.getStatus();
    res.json({ success: true, ...status });
});

/**
 * Navigate to a specific screen
 * POST /api/unified-replay/navigate
 */
router.post('/navigate', async (req, res, next) => {
    try {
        const { screenId } = req.body;

        if (!screenId) {
            return res.status(400).json({ error: 'Screen ID is required' });
        }

        const result = await unifiedReplayService.navigateToScreen(screenId);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

/**
 * Replay actions on current screen
 * POST /api/unified-replay/replay-actions
 */
router.post('/replay-actions', async (req, res, next) => {
    try {
        const { screenId } = req.body;
        const result = await unifiedReplayService.replayActions(screenId);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

/**
 * Compare two captures
 * POST /api/unified-replay/compare
 */
router.post('/compare', async (req, res, next) => {
    try {
        const { projectName, section1, screen1, section2, screen2 } = req.body;

        if (!projectName || !section1 || !screen1 || !section2 || !screen2) {
            return res.status(400).json({ error: 'All comparison parameters are required' });
        }

        const result = await unifiedReplayService.compareCaptures(
            projectName, section1, screen1, section2, screen2
        );
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

/**
 * Load capture data for a screen
 * GET /api/unified-replay/capture/:projectName/:sectionId/:screenId
 */
router.get('/capture/:projectName/:sectionId/:screenId', async (req, res, next) => {
    try {
        const { projectName, sectionId, screenId } = req.params;
        const data = await unifiedReplayService.loadCaptureData(projectName, sectionId, screenId);

        // Don't send full HTML in JSON response
        const { html, ...rest } = data;
        rest.hasHtml = !!html;
        rest.htmlSize = html ? html.length : 0;

        res.json({ success: true, ...rest });
    } catch (error) {
        next(error);
    }
});

/**
 * Load flow data for a section
 * GET /api/unified-replay/flow/:projectName/:sectionId
 */
router.get('/flow/:projectName/:sectionId', async (req, res, next) => {
    try {
        const { projectName, sectionId } = req.params;
        const flow = await unifiedReplayService.loadFlowData(projectName, sectionId);
        res.json({ success: true, ...flow });
    } catch (error) {
        next(error);
    }
});

/**
 * Get test run history for a section
 * GET /api/replay/history/:projectName/:sectionId
 */
router.get('/history/:projectName/:sectionId', async (req, res, next) => {
    try {
        const { projectName, sectionId } = req.params;
        const history = await unifiedReplayService.getHistory(projectName, sectionId);
        res.json({ success: true, history });
    } catch (error) {
        next(error);
    }
});

/**
 * Delete a test run
 * DELETE /api/replay/replay/:projectName/:originalSection/:replaySection
 */
router.delete('/replay/:projectName/:originalSection/:replaySection', async (req, res, next) => {
    try {
        const { projectName, replaySection } = req.params;
        const result = await unifiedReplayService.deleteTestRun(projectName, replaySection);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
