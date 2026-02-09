const express = require('express');
const router = express.Router();
const compareService = require('../services/compare.service');

// Compare two sections
router.post('/sections', async (req, res, next) => {
    try {
        const { projectName, section1, section2 } = req.body;

        if (!projectName || !section1 || !section2) {
            return res.status(400).json({
                error: 'projectName, section1, và section2 là bắt buộc'
            });
        }

        const result = await compareService.compareSections(projectName, section1, section2);
        res.json({ success: true, result });
    } catch (error) {
        next(error);
    }
});

// Compare Section against Main
router.post('/all', async (req, res, next) => {
    try {
        const { projectName, sectionTimestamp } = req.body;

        if (!projectName || !sectionTimestamp) {
            return res.status(400).json({
                error: 'projectName và sectionTimestamp là bắt buộc'
            });
        }

        const result = await compareService.compareAgainstMain(projectName, sectionTimestamp);
        res.json({ success: true, result });
    } catch (error) {
        next(error);
    }
});

// Get detailed diff for a specific page
router.post('/page-diff', async (req, res, next) => {
    try {
        const { projectName, section1, section2, path1, path2 } = req.body;

        if (!projectName || !section1 || !section2) {
            return res.status(400).json({
                error: 'Thiếu tham số bắt buộc'
            });
        }

        const result = await compareService.getPageDiff(projectName, section1, section2, path1, path2);
        res.json({ success: true, result });
    } catch (error) {
        next(error);
    }
});

// Get screenshot
router.get('/screenshot/:projectName/:section/*', async (req, res, next) => {
    try {
        const { projectName, section } = req.params;
        const pagePath = req.params[0];

        const storageService = require('../services/storage.service');
        const path = require('path');
        const fs = require('fs-extra');

        let basePath;
        if (section === 'main') {
            basePath = storageService.getMainPath(projectName);
        } else {
            basePath = storageService.getSectionPath(projectName, section);
        }

        const screenshotPath = path.join(
            basePath,
            pagePath,
            'UI',
            'screenshot.jpg'
        );

        if (await fs.pathExists(screenshotPath)) {
            res.sendFile(screenshotPath);
        } else {
            res.status(404).json({ error: 'Screenshot không tồn tại' });
        }
    } catch (error) {
        next(error);
    }
});

module.exports = router;
