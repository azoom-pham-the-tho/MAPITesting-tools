const express = require('express');
const router = express.Router();
const testRunnerService = require('../services/test-runner.service');

// Run a test
router.post('/run', async (req, res) => {
    try {
        const { projectName, sectionTimestamp, baselineTimestamp, threshold } = req.body;

        if (!projectName || !sectionTimestamp) {
            return res.status(400).json({
                error: 'projectName and sectionTimestamp are required'
            });
        }

        const result = await testRunnerService.runTest({
            projectName,
            sectionTimestamp,
            baselineTimestamp,
            threshold
        });
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get test history
router.get('/:projectName/results', async (req, res) => {
    try {
        const { projectName } = req.params;
        const { page, limit, status } = req.query;

        const options = {};
        if (page) options.page = parseInt(page, 10);
        if (limit) options.limit = parseInt(limit, 10);
        if (status) options.status = status;

        const result = await testRunnerService.getTestHistory(projectName, options);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get specific test result
router.get('/:projectName/results/:testId', async (req, res) => {
    try {
        const { projectName, testId } = req.params;

        const result = await testRunnerService.getTestResult(projectName, testId);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete test result
router.delete('/:projectName/results/:testId', async (req, res) => {
    try {
        const { projectName, testId } = req.params;

        await testRunnerService.deleteTestResult(projectName, testId);
        res.json({ success: true, deleted: testId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get test statistics
router.get('/:projectName/statistics', async (req, res) => {
    try {
        const { projectName } = req.params;

        const result = await testRunnerService.getTestStatistics(projectName);
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
