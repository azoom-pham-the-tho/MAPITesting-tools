const express = require('express');
const router = express.Router();
const multer = require('multer');
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const documentService = require('../services/document.service');

// Multer config: store in temp dir
const upload = multer({
    dest: path.join(os.tmpdir(), 'mapit-doc-uploads'),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['.docx', '.doc', '.xlsx', '.xls', '.pdf', '.txt', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Dinh dang khong ho tro. Chi ho tro: docx, xlsx, xls, pdf, txt, csv'));
        }
    }
});

// Upload document
router.post('/:project/upload', upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const result = await documentService.upload(
            req.params.project,
            req.file.path,
            req.file.originalname
        );
        // Clean up temp file
        await fs.remove(req.file.path).catch(() => {});
        res.json({ success: true, ...result });
    } catch (error) {
        if (req.file) await fs.remove(req.file.path).catch(() => {});
        next(error);
    }
});

// List documents
router.get('/:project', async (req, res, next) => {
    try {
        const docs = await documentService.list(req.params.project);
        res.json({ success: true, documents: docs });
    } catch (error) {
        next(error);
    }
});

// Get document info
router.get('/:project/:docId', async (req, res, next) => {
    try {
        const doc = await documentService.getDocument(req.params.project, req.params.docId);
        res.json({ success: true, document: doc });
    } catch (error) {
        next(error);
    }
});

// Download version
router.get('/:project/:docId/:version/download', async (req, res, next) => {
    try {
        const version = parseInt(req.params.version);
        const { filePath, fileName } = await documentService.getFilePath(
            req.params.project, req.params.docId, version
        );
        res.download(filePath, fileName);
    } catch (error) {
        next(error);
    }
});

// Preview version
router.get('/:project/:docId/:version/preview', async (req, res, next) => {
    try {
        const version = parseInt(req.params.version);
        const preview = await documentService.getPreview(
            req.params.project, req.params.docId, version
        );
        res.json({ success: true, ...preview });
    } catch (error) {
        next(error);
    }
});

// Compare two versions
router.get('/:project/:docId/compare', async (req, res, next) => {
    try {
        const { v1, v2 } = req.query;
        if (!v1 || !v2) {
            return res.status(400).json({ error: 'v1 and v2 query params required' });
        }
        const result = await documentService.compareVersions(
            req.params.project, req.params.docId,
            parseInt(v1), parseInt(v2)
        );
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Delete document
router.delete('/:project/:docId', async (req, res, next) => {
    try {
        await documentService.deleteDocument(req.params.project, req.params.docId);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Delete version
router.delete('/:project/:docId/:version', async (req, res, next) => {
    try {
        const version = parseInt(req.params.version);
        await documentService.deleteVersion(req.params.project, req.params.docId, version);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
