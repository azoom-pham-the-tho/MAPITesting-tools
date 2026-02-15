const express = require('express');
const router = express.Router();
const multer = require('multer');
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const documentService = require('../services/document.service');

// Helper: decode Multer's latin1 originalname to utf8
function decodeFileName(rawName) {
    try {
        // Multer stores originalname as latin1 bytes, convert back to utf8
        const decoded = Buffer.from(rawName, 'latin1').toString('utf8');
        // Verify it's valid UTF-8 by checking for replacement character
        if (!decoded.includes('\ufffd')) return decoded;
    } catch { /* fall through */ }

    // Try decoding as URI-encoded string (some browsers encode this way)
    try {
        const uriDecoded = decodeURIComponent(rawName);
        if (uriDecoded !== rawName) return uriDecoded;
    } catch { /* fall through */ }

    return rawName;
}

// Multer config: store in temp dir
const upload = multer({
    dest: path.join(os.tmpdir(), 'mapit-doc-uploads'),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (req, file, cb) => {
        const allowed = ['.docx', '.doc', '.xlsx', '.xls', '.pdf', '.txt', '.csv'];
        // Decode filename first to handle Vietnamese chars in extension path
        const decoded = decodeFileName(file.originalname);
        const ext = path.extname(decoded).toLowerCase();
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

        // Fix Vietnamese filename encoding (Multer default is latin1)
        const originalname = decodeFileName(req.file.originalname);
        // Optional: force add version to an existing document
        const targetDocId = req.query.docId || null;

        const result = await documentService.upload(
            req.params.project,
            req.file.path,
            originalname,
            targetDocId
        );
        // Clean up temp file
        await fs.remove(req.file.path).catch(() => { });
        res.json({ success: true, ...result });
    } catch (error) {
        if (req.file) await fs.remove(req.file.path).catch(() => { });
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

// Update document category
router.put('/:project/:docId/category', async (req, res, next) => {
    try {
        const { category } = req.body;
        if (!category) {
            return res.status(400).json({ error: 'Category required' });
        }
        const result = await documentService.updateCategory(req.params.project, req.params.docId, category);
        res.json({ success: true, document: result });
    } catch (error) {
        next(error);
    }
});

// Rename document (set display name)
router.put('/:project/:docId/rename', async (req, res, next) => {
    try {
        const { displayName } = req.body;
        if (!displayName) {
            return res.status(400).json({ error: 'displayName required' });
        }
        const result = await documentService.renameDocument(req.params.project, req.params.docId, displayName);
        res.json({ success: true, document: result });
    } catch (error) {
        next(error);
    }
});

// Compare two versions (visual mode - structured data)
// MUST be before /:version routes to avoid "compare-visual" matching as :version
router.get('/:project/:docId/compare-visual', async (req, res, next) => {
    try {
        const { v1, v2 } = req.query;
        if (!v1 || !v2) {
            return res.status(400).json({ error: 'v1 and v2 query params required' });
        }
        const result = await documentService.compareVisual(
            req.params.project, req.params.docId,
            parseInt(v1), parseInt(v2)
        );
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// GitHub-style text diff (works for all file types: text, word, pdf)
router.get('/:project/:docId/compare-text-diff', async (req, res, next) => {
    try {
        const { v1, v2 } = req.query;
        if (!v1 || !v2) {
            return res.status(400).json({ error: 'v1 and v2 query params required' });
        }
        const result = await documentService.compareTextDiff(
            req.params.project, req.params.docId,
            parseInt(v1), parseInt(v2)
        );
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Compare two versions (text diff mode)
router.get('/:project/:docId/compare', async (req, res, next) => {
    try {
        const { v1, v2, force } = req.query;
        if (!v1 || !v2) {
            return res.status(400).json({ error: 'v1 and v2 query params required' });
        }
        const result = await documentService.compareVersions(
            req.params.project, req.params.docId,
            parseInt(v1), parseInt(v2),
            force === 'true'
        );
        res.json({ success: true, ...result });
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
        const encodedName = encodeURIComponent(fileName).replace(/'/g, '%27');
        const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, '_');
        res.setHeader('Content-Disposition', `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`);
        res.sendFile(path.resolve(filePath));
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

// Get more Excel rows (lazy load)
router.get('/:project/:docId/:version/excel-rows', async (req, res, next) => {
    try {
        const version = parseInt(req.params.version);
        const { sheet, offset, limit } = req.query;
        if (!sheet) return res.status(400).json({ error: 'sheet query param required' });

        const meta = await documentService.getDocument(req.params.project, req.params.docId);
        const versionPath = documentService.getVersionPath(req.params.project, req.params.docId, version);
        const filePath = require('path').join(versionPath, `original${meta.ext}`);

        const XLSX = require('xlsx');
        const workbook = XLSX.readFile(filePath);
        const allRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1 });

        const start = parseInt(offset) || 0;
        const count = parseInt(limit) || 50;
        const rows = allRows.slice(start, start + count);

        res.json({ success: true, rows, hasMore: start + count < allRows.length, total: allRows.length });
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
