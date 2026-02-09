const express = require('express');
const router = express.Router();
const versionService = require('../services/version.service');

// Commit current main
router.post('/:projectName/commit', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { message, author } = req.body;

        if (!message || !author) {
            return res.status(400).json({
                error: 'message and author are required'
            });
        }

        const result = await versionService.commit(projectName, message, author);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get version history
router.get('/:projectName/history', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { page, limit, search } = req.query;

        const options = {};
        if (page) options.page = parseInt(page, 10);
        if (limit) options.limit = parseInt(limit, 10);
        if (search) options.search = search;

        const result = await versionService.getHistory(projectName, options);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get version details
router.get('/:projectName/versions/:versionId', async (req, res) => {
    try {
        const { projectName, versionId } = req.params;

        const version = await versionService.getVersion(projectName, versionId);
        res.json({ success: true, version });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rollback to version
router.post('/:projectName/rollback/:versionId', async (req, res) => {
    try {
        const { projectName, versionId } = req.params;

        const result = await versionService.rollback(projectName, versionId);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Diff between versions
router.get('/:projectName/diff/:v1/:v2', async (req, res) => {
    try {
        const { projectName, v1, v2 } = req.params;

        const result = await versionService.diff(projectName, v1, v2);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add tag to version
router.post('/:projectName/versions/:versionId/tag', async (req, res) => {
    try {
        const { projectName, versionId } = req.params;
        const { tagName } = req.body;

        if (!tagName) {
            return res.status(400).json({
                error: 'tagName is required'
            });
        }

        const result = await versionService.tag(projectName, versionId, tagName);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete version
router.delete('/:projectName/versions/:versionId', async (req, res) => {
    try {
        const { projectName, versionId } = req.params;

        await versionService.deleteVersion(projectName, versionId);
        res.json({ success: true, deleted: versionId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
