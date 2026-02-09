const express = require('express');
const router = express.Router();
const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const shareService = require('../services/share.service');

// Get network info (IPs, WiFi SSID, port)
router.get('/network', (req, res) => {
    try {
        const info = shareService.getNetworkInfo();
        res.json({ success: true, ...info });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a share
router.post('/create', async (req, res, next) => {
    try {
        const { projectName, type, sectionId } = req.body;
        if (!projectName || !type) {
            return res.status(400).json({ error: 'projectName and type are required' });
        }
        const result = await shareService.createShare(projectName, type, sectionId);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// List active shares
router.get('/list', (req, res) => {
    res.json({ success: true, shares: shareService.listShares() });
});

// Get share info + file list (for the download page)
router.get('/info/:token', async (req, res, next) => {
    try {
        const data = await shareService.listShareFiles(req.params.token);
        if (!data) {
            return res.status(404).json({ error: 'Share not found or expired' });
        }
        res.json({ success: true, ...data });
    } catch (error) {
        next(error);
    }
});

// Download a single file from a share
router.get('/file/:token/*', async (req, res, next) => {
    try {
        const share = shareService.getShare(req.params.token);
        if (!share) {
            return res.status(404).json({ error: 'Share not found' });
        }
        // Get the file path from the URL (everything after /file/:token/)
        const filePath = req.params[0];
        if (!filePath) {
            return res.status(400).json({ error: 'File path required' });
        }
        const fullPath = path.join(share.sharePath, filePath);
        // Security: ensure the resolved path is within sharePath
        const resolved = path.resolve(fullPath);
        if (!resolved.startsWith(path.resolve(share.sharePath))) {
            return res.status(403).json({ error: 'Access denied' });
        }
        res.download(resolved);
    } catch (error) {
        next(error);
    }
});

// Download all as zip
router.get('/download/:token', async (req, res, next) => {
    try {
        const result = await shareService.createZip(req.params.token);
        if (!result) {
            return res.status(404).json({ error: 'Share not found' });
        }
        res.download(result.path, result.name);
    } catch (error) {
        next(error);
    }
});

// Remove a share
router.delete('/:token', (req, res) => {
    const removed = shareService.removeShare(req.params.token);
    res.json({ success: removed });
});

// ========================================
// IMPORT
// ========================================

// Import from share link (pull from another MAPIT instance)
router.post('/import/link', async (req, res, next) => {
    try {
        const { projectName, targetType, shareUrl } = req.body;
        if (!projectName || !targetType || !shareUrl) {
            return res.status(400).json({ error: 'projectName, targetType, and shareUrl are required' });
        }
        const result = await shareService.importFromShareLink(projectName, targetType, shareUrl);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Import from uploaded zip file
router.post('/import/upload', async (req, res, next) => {
    try {
        const { projectName, targetType } = req.query;
        if (!projectName || !targetType) {
            return res.status(400).json({ error: 'projectName and targetType query params are required' });
        }

        // Read raw body as buffer
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        if (buffer.length === 0) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Save to temp file
        const tmpDir = path.join(os.tmpdir(), 'mapit-imports');
        await fs.ensureDir(tmpDir);
        const tmpFile = path.join(tmpDir, `upload_${Date.now()}.zip`);
        await fs.writeFile(tmpFile, buffer);

        try {
            const result = await shareService.importFromZip(projectName, targetType, tmpFile);
            res.json({ success: true, ...result });
        } finally {
            await fs.remove(tmpFile).catch(() => {});
        }
    } catch (error) {
        next(error);
    }
});

// Scan network for other MAPIT instances
router.get('/scan', async (req, res, next) => {
    try {
        const instances = await shareService.scanNetwork();
        res.json({ success: true, instances });
    } catch (error) {
        next(error);
    }
});

// List shares on a remote MAPIT instance (proxy)
router.get('/remote-shares', async (req, res, next) => {
    try {
        const { host } = req.query;
        if (!host) {
            return res.status(400).json({ error: 'host query param is required' });
        }
        const http = require('http');
        const url = `http://${host}/api/share/list`;

        const data = await new Promise((resolve, reject) => {
            http.get(url, { timeout: 3000 }, (resp) => {
                let body = '';
                resp.on('data', (c) => { body += c; });
                resp.on('end', () => {
                    try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid response')); }
                });
            }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('Timeout')); });
        });

        res.json(data);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
