/**
 * Merge Routes
 *
 * Handles merging section data into main reference data
 *
 * Features:
 * - Selective folder merge (choose specific screens)
 * - Full section merge (merge everything)
 * - Preview merge (dry run)
 * - Optional section deletion after merge
 *
 * @module routes/merge
 */

const express = require('express');
const router = express.Router();
const mergeService = require('../services/merge.service');

/**
 * POST /
 * Merge specific folders from section to main
 *
 * Request body:
 * - projectName: string (required)
 * - sectionTimestamp: string (required)
 * - folders: string[] (required) - Array of folder IDs to merge
 * - deleteAfter: boolean (optional) - Delete section after merge
 *
 * Response:
 * - success: boolean
 * - result: object with merge details
 */
router.post('/', async (req, res, next) => {
    try {
        const { projectName, sectionTimestamp, folders, deleteAfter } = req.body;

        // Validate required fields
        if (!projectName || !sectionTimestamp || !folders || !Array.isArray(folders)) {
            return res.status(400).json({
                error: 'Project name, section timestamp, and folders array are required'
            });
        }

        // Validate folders array is not empty
        if (folders.length === 0) {
            return res.status(400).json({
                error: 'Folders array cannot be empty'
            });
        }

        const result = await mergeService.mergeAndDelete(
            projectName,
            sectionTimestamp,
            folders,
            deleteAfter || false
        );

        res.json({ success: true, result });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /all
 * Merge entire section to main
 *
 * Request body:
 * - projectName: string (required)
 * - sectionTimestamp: string (required)
 * - deleteAfter: boolean (optional) - Delete section after merge
 *
 * Response:
 * - success: boolean
 * - result: object with merge details
 * - sectionDeleted: boolean (if deleteAfter was true)
 */
router.post('/all', async (req, res, next) => {
    try {
        const { projectName, sectionTimestamp, deleteAfter } = req.body;

        // Validate required fields
        if (!projectName || !sectionTimestamp) {
            return res.status(400).json({
                error: 'Project name and section timestamp are required'
            });
        }

        const result = await mergeService.mergeAll(projectName, sectionTimestamp);

        // Delete section if requested and merge was successful
        if (deleteAfter && result.success) {
            await mergeService.deleteSection(projectName, sectionTimestamp);
            result.sectionDeleted = true;
        }

        res.json({ success: true, result });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /preview
 * Preview merge (dry run)
 *
 * Shows what changes will be made without actually merging
 *
 * Request body:
 * - projectName: string (required)
 * - sectionTimestamp: string (required)
 * - folders: string[] (required) - Array of folder IDs to preview
 *
 * Response:
 * - success: boolean
 * - preview: object with merge preview details
 */
router.post('/preview', async (req, res, next) => {
    try {
        const { projectName, sectionTimestamp, folders } = req.body;

        // Validate required fields
        if (!projectName || !sectionTimestamp || !folders) {
            return res.status(400).json({
                error: 'Project name, section timestamp, and folders are required'
            });
        }

        const preview = await mergeService.previewMerge(projectName, sectionTimestamp, folders);
        res.json({ success: true, preview });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
