const express = require('express');
const router = express.Router();
const gdriveService = require('../services/gdrive.service');

// Get Drive connection status
router.get('/status', async (req, res, next) => {
    try {
        const status = await gdriveService.getStatus();
        res.json({ success: true, ...status });
    } catch (error) {
        next(error);
    }
});

// Get OAuth2 auth URL (to redirect user)
router.get('/auth-url', async (req, res, next) => {
    try {
        const url = await gdriveService.getAuthUrl();
        res.json({ success: true, url });
    } catch (error) {
        next(error);
    }
});

// OAuth2 callback
router.get('/callback', async (req, res, next) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).send('Missing authorization code');
        }
        await gdriveService.handleCallback(code);
        // Redirect back to main app
        res.send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#0f172a;color:#e2e8f0;">
                <h2>Google Drive da ket noi thanh cong!</h2>
                <p>Ban co the dong tab nay va quay lai MAPIT.</p>
                <script>setTimeout(()=>window.close(),2000)</script>
            </body></html>
        `);
    } catch (error) {
        res.status(500).send(`Auth failed: ${error.message}`);
    }
});

// Upload to Drive
router.post('/upload', async (req, res, next) => {
    try {
        const { projectName, type, sectionId } = req.body;
        if (!projectName || !type) {
            return res.status(400).json({ error: 'projectName and type are required' });
        }
        const result = await gdriveService.upload(projectName, type, sectionId);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// List files on Drive for a project
router.get('/files/:projectName', async (req, res, next) => {
    try {
        const files = await gdriveService.listFiles(req.params.projectName);
        res.json({ success: true, files });
    } catch (error) {
        next(error);
    }
});

// Download from Drive and import
router.post('/download', async (req, res, next) => {
    try {
        const { projectName, fileId, targetType } = req.body;
        if (!projectName || !fileId || !targetType) {
            return res.status(400).json({ error: 'projectName, fileId, and targetType are required' });
        }
        const result = await gdriveService.downloadAndImport(projectName, fileId, targetType);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Import from Drive share link
router.post('/import-link', async (req, res, next) => {
    try {
        const { projectName, targetType, driveLink } = req.body;
        if (!projectName || !targetType || !driveLink) {
            return res.status(400).json({ error: 'projectName, targetType, and driveLink are required' });
        }
        const result = await gdriveService.importFromLink(projectName, targetType, driveLink);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Disconnect
router.post('/disconnect', async (req, res, next) => {
    try {
        const result = await gdriveService.disconnect();
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
