const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { execSync } = require('child_process');
const storageService = require('./storage.service');

class DocumentService {
    // Get documents directory for a project
    getDocumentsPath(projectName) {
        return path.join(storageService.getProjectPath(projectName), 'documents');
    }

    getDocPath(projectName, docId) {
        return path.join(this.getDocumentsPath(projectName), docId);
    }

    getVersionPath(projectName, docId, version) {
        return path.join(this.getDocPath(projectName, docId), `v${version}`);
    }

    // Upload a new document or add a new version
    async upload(projectName, file, originalName) {
        const docsPath = this.getDocumentsPath(projectName);
        await fs.ensureDir(docsPath);

        const ext = path.extname(originalName).toLowerCase();
        const baseName = path.basename(originalName, ext);
        const fileType = this._getFileType(ext);

        if (!fileType) {
            throw new Error('Dinh dang khong ho tro. Chi ho tro: .docx, .xlsx, .xls, .pdf, .txt, .csv');
        }

        // Check if document with same name already exists
        let docId = null;
        let meta = null;
        const existingDocs = await this.list(projectName);
        const existing = existingDocs.find(d => d.name === originalName);

        if (existing) {
            docId = existing.id;
            meta = await fs.readJson(path.join(this.getDocPath(projectName, docId), 'meta.json'));
        } else {
            docId = uuidv4().slice(0, 8);
            meta = {
                id: docId,
                name: originalName,
                baseName,
                ext,
                type: fileType,
                versions: [],
                createdAt: new Date().toISOString()
            };
        }

        // Create new version
        const version = meta.versions.length + 1;
        const versionPath = this.getVersionPath(projectName, docId, version);
        await fs.ensureDir(versionPath);

        // Save original file
        const filePath = path.join(versionPath, `original${ext}`);
        if (Buffer.isBuffer(file)) {
            await fs.writeFile(filePath, file);
        } else {
            await fs.copy(file, filePath);
        }

        // Extract text for comparison
        let extractedText = '';
        try {
            extractedText = await this._extractText(filePath, fileType);
            await fs.writeFile(path.join(versionPath, 'extracted.txt'), extractedText, 'utf8');
        } catch (e) {
            console.error(`[Doc] Text extraction failed for ${originalName}:`, e.message);
        }

        // Update meta
        meta.versions.push({
            version,
            uploadedAt: new Date().toISOString(),
            size: (await fs.stat(filePath)).size,
            hasText: extractedText.length > 0
        });
        meta.updatedAt = new Date().toISOString();

        await fs.writeJson(path.join(this.getDocPath(projectName, docId), 'meta.json'), meta, { spaces: 2 });

        return { id: docId, version, name: originalName, type: fileType };
    }

    // List all documents for a project
    async list(projectName) {
        const docsPath = this.getDocumentsPath(projectName);
        if (!await fs.pathExists(docsPath)) return [];

        const entries = await fs.readdir(docsPath, { withFileTypes: true });
        const docs = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const metaPath = path.join(docsPath, entry.name, 'meta.json');
            if (await fs.pathExists(metaPath)) {
                const meta = await fs.readJson(metaPath);
                docs.push(meta);
            }
        }

        docs.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        return docs;
    }

    // Get document info
    async getDocument(projectName, docId) {
        const metaPath = path.join(this.getDocPath(projectName, docId), 'meta.json');
        if (!await fs.pathExists(metaPath)) {
            throw new Error('Document not found');
        }
        return await fs.readJson(metaPath);
    }

    // Get file path for download
    async getFilePath(projectName, docId, version) {
        const meta = await this.getDocument(projectName, docId);
        const versionPath = this.getVersionPath(projectName, docId, version);
        const filePath = path.join(versionPath, `original${meta.ext}`);
        if (!await fs.pathExists(filePath)) {
            throw new Error('File not found');
        }
        return { filePath, fileName: `${meta.baseName}_v${version}${meta.ext}` };
    }

    // Get preview data
    async getPreview(projectName, docId, version) {
        const meta = await this.getDocument(projectName, docId);
        const versionPath = this.getVersionPath(projectName, docId, version);
        const filePath = path.join(versionPath, `original${meta.ext}`);

        if (!await fs.pathExists(filePath)) {
            throw new Error('File not found');
        }

        if (meta.type === 'word') {
            const mammoth = require('mammoth');
            const result = await mammoth.convertToHtml({ path: filePath });
            return { type: 'html', content: result.value };
        }

        if (meta.type === 'excel') {
            const XLSX = require('xlsx');
            const workbook = XLSX.readFile(filePath);
            const sheets = {};
            for (const name of workbook.SheetNames) {
                sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 });
            }
            return { type: 'excel', sheets, sheetNames: workbook.SheetNames };
        }

        if (meta.type === 'pdf') {
            // Return file path for PDF.js viewer
            return { type: 'pdf', url: `/api/documents/${encodeURIComponent(projectName)}/${docId}/${version}/download` };
        }

        if (meta.type === 'text' || meta.type === 'csv') {
            const content = await fs.readFile(filePath, 'utf8');
            return { type: 'text', content };
        }

        return { type: 'unknown' };
    }

    // Compare two versions
    async compareVersions(projectName, docId, v1, v2) {
        const meta = await this.getDocument(projectName, docId);

        const v1Path = path.join(this.getVersionPath(projectName, docId, v1), 'extracted.txt');
        const v2Path = path.join(this.getVersionPath(projectName, docId, v2), 'extracted.txt');

        if (!await fs.pathExists(v1Path) || !await fs.pathExists(v2Path)) {
            throw new Error('Khong the so sanh: chua extract duoc text tu 1 hoac 2 version');
        }

        const text1 = await fs.readFile(v1Path, 'utf8');
        const text2 = await fs.readFile(v2Path, 'utf8');

        const Diff = require('diff');

        // Line-by-line diff
        const lineDiff = Diff.diffLines(text1, text2);

        // Word-level diff for detailed view
        const wordDiff = Diff.diffWords(text1, text2);

        // Stats
        let added = 0, removed = 0, unchanged = 0;
        lineDiff.forEach(part => {
            const lines = part.count || part.value.split('\n').length - 1;
            if (part.added) added += lines;
            else if (part.removed) removed += lines;
            else unchanged += lines;
        });

        return {
            documentName: meta.name,
            v1: { version: v1, uploadedAt: meta.versions[v1 - 1]?.uploadedAt },
            v2: { version: v2, uploadedAt: meta.versions[v2 - 1]?.uploadedAt },
            stats: { added, removed, unchanged, total: added + removed + unchanged },
            lineDiff,
            wordDiff: wordDiff.map(p => ({
                value: p.value,
                added: !!p.added,
                removed: !!p.removed
            }))
        };
    }

    // Delete a document
    async deleteDocument(projectName, docId) {
        const docPath = this.getDocPath(projectName, docId);
        if (await fs.pathExists(docPath)) {
            await fs.remove(docPath);
            return true;
        }
        return false;
    }

    // Delete a specific version
    async deleteVersion(projectName, docId, version) {
        const meta = await this.getDocument(projectName, docId);
        const versionPath = this.getVersionPath(projectName, docId, version);

        if (meta.versions.length <= 1) {
            throw new Error('Khong the xoa version cuoi cung. Hay xoa ca document.');
        }

        if (await fs.pathExists(versionPath)) {
            await fs.remove(versionPath);
        }

        meta.versions = meta.versions.filter(v => v.version !== version);
        meta.updatedAt = new Date().toISOString();
        await fs.writeJson(path.join(this.getDocPath(projectName, docId), 'meta.json'), meta, { spaces: 2 });
        return true;
    }

    // Extract text from file based on type
    async _extractText(filePath, fileType) {
        if (fileType === 'word') {
            const mammoth = require('mammoth');
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        }

        if (fileType === 'excel') {
            const XLSX = require('xlsx');
            const workbook = XLSX.readFile(filePath);
            let text = '';
            for (const name of workbook.SheetNames) {
                text += `=== Sheet: ${name} ===\n`;
                const data = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
                text += data + '\n\n';
            }
            return text;
        }

        if (fileType === 'pdf') {
            const PDFParser = require('pdf2json');
            return new Promise((resolve, reject) => {
                const pdfParser = new PDFParser();
                pdfParser.on('pdfParser_dataReady', (pdfData) => {
                    resolve(pdfParser.getRawTextContent());
                });
                pdfParser.on('pdfParser_dataError', (err) => {
                    reject(new Error(err.parserError || 'PDF parse error'));
                });
                pdfParser.loadPDF(filePath);
            });
        }

        if (fileType === 'text' || fileType === 'csv') {
            return await fs.readFile(filePath, 'utf8');
        }

        return '';
    }

    // Detect file type from extension
    _getFileType(ext) {
        const types = {
            '.docx': 'word',
            '.doc': 'word',
            '.xlsx': 'excel',
            '.xls': 'excel',
            '.pdf': 'pdf',
            '.txt': 'text',
            '.csv': 'csv'
        };
        return types[ext.toLowerCase()] || null;
    }
}

module.exports = new DocumentService();
