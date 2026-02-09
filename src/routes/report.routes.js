const express = require('express');
const router = express.Router();
const reportService = require('../services/report.service');

// Generate report
router.post('/generate', async (req, res) => {
    try {
        const { projectName, type, section1, section2, format, includeScreenshots, includeCharts } = req.body;

        if (!projectName || !type) {
            return res.status(400).json({
                error: 'projectName and type are required'
            });
        }

        const result = await reportService.generateReport(projectName, {
            type,
            section1,
            section2,
            format,
            includeScreenshots,
            includeCharts
        });
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List all reports
router.get('/:projectName/list', async (req, res) => {
    try {
        const { projectName } = req.params;

        const reports = await reportService.listReports(projectName);
        res.json({ success: true, reports });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get HTML report file (serve as HTML)
router.get('/:projectName/:reportId/html', async (req, res) => {
    try {
        const { projectName, reportId } = req.params;

        const filePath = await reportService.getReportFile(projectName, reportId);
        res.sendFile(filePath);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get PDF report file (serve as download)
router.get('/:projectName/:reportId/pdf', async (req, res) => {
    try {
        const { projectName, reportId } = req.params;

        const filePath = await reportService.getReportFile(projectName, reportId);
        res.download(filePath);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get report metadata
router.get('/:projectName/:reportId', async (req, res) => {
    try {
        const { projectName, reportId } = req.params;

        const report = await reportService.getReportFile(projectName, reportId);
        res.json({ success: true, report });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete report
router.delete('/:projectName/:reportId', async (req, res) => {
    try {
        const { projectName, reportId } = req.params;

        await reportService.deleteReport(projectName, reportId);
        res.json({ success: true, deleted: reportId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
