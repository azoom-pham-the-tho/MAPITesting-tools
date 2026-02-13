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
                category: 'uncategorized', // Default category
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

    // Update document category
    async updateCategory(projectName, docId, category) {
        const metaPath = path.join(this.getDocPath(projectName, docId), 'meta.json');
        if (!await fs.pathExists(metaPath)) {
            throw new Error('Document not found');
        }
        const meta = await fs.readJson(metaPath);
        meta.category = category;
        meta.updatedAt = new Date().toISOString();
        await fs.writeJson(metaPath, meta, { spaces: 2 });
        return meta;
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
            return { type: 'html', content: result.value, totalLength: result.value.length };
        }

        if (meta.type === 'excel') {
            const XLSX = require('xlsx');
            const workbook = XLSX.readFile(filePath);
            const sheetNames = workbook.SheetNames;
            const sheetInfo = {};
            const sheets = {};
            for (const name of sheetNames) {
                const allRows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1 });
                // Send first batch + total count so frontend can lazy load
                const INITIAL_ROWS = 50;
                sheets[name] = allRows.slice(0, INITIAL_ROWS);
                sheetInfo[name] = { totalRows: allRows.length, colCount: allRows.reduce((m, r) => Math.max(m, r.length), 0) };
            }
            return { type: 'excel', sheets, sheetNames, sheetInfo };
        }

        if (meta.type === 'pdf') {
            // Return file path for PDF.js viewer
            return { type: 'pdf', url: `/api/documents/${encodeURIComponent(projectName)}/${docId}/${version}/download` };
        }

        if (meta.type === 'text' || meta.type === 'csv') {
            let content = await fs.readFile(filePath, 'utf8');
            // Strip UTF-8 BOM if present
            if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
            return { type: 'text', content };
        }

        return { type: 'unknown' };
    }

    // Compare two versions
    async compareVersions(projectName, docId, v1, v2, force = false) {
        const meta = await this.getDocument(projectName, docId);

        // Get meta info for versions
        const metaV1 = meta.versions.find(v => v.version === v1);
        const metaV2 = meta.versions.find(v => v.version === v2);

        // Quick check for different file formats
        // We assume file extension stored in 'originalName' property if available, or try to infer
        // For simplicity, we can check the file paths or store extension in version meta (which we should do ideally)
        // Here we'll read the files first (as we need stats anyway) and check extensions if possible
        
        const v1Path = path.join(this.getVersionPath(projectName, docId, v1), 'extracted.txt');
        const v2Path = path.join(this.getVersionPath(projectName, docId, v2), 'extracted.txt');

        if (!await fs.pathExists(v1Path) || !await fs.pathExists(v2Path)) {
            throw new Error('Khong the so sanh: chua extract duoc text tu 1 hoac 2 version');
        }

        let text1 = await fs.readFile(v1Path, 'utf8');
        let text2 = await fs.readFile(v2Path, 'utf8');

        // Simple format detection via first line or content heuristics if meta doesn't help
        // But better rely on meta if we stored it properly. Let's assume we proceed to content check.
        // Heuristic: If one looks like CSV and other like Prose, or huge size diff
        
        // Detect significant structural difference or format mismatch
        // For now, let's use a simple size/line-count heuristic for "Overview Mode"
        // In real app, we should check file extensions from upload metadata
        
        // --- OVERVIEW MODE Check ---
        // If not forced, and (Length diff > 50% OR Line count diff > 50%), suggest Overview
        // Or if we explicitly stored format/ext in version meta (we added 'ext' to doc meta, but versions might differ in update?)
        // Let's assume versions can be different formats (e.g. v1 docx, v2 pdf)
        
        // NOTE: In current upload(), we don't store per-version extension, we assume doc ext. 
        // If user uploads v2 with diff ext, our code saves as 'original.ext'.
        // Let's check files in directory to be sure.
        
        const getRealExt = async (ver) => {
            const vp = this.getVersionPath(projectName, docId, ver);
            const files = await fs.readdir(vp);
            const orig = files.find(f => f.startsWith('original'));
            return orig ? path.extname(orig) : '';
        };

        const ext1 = await getRealExt(v1);
        const ext2 = await getRealExt(v2);

        if (!force && ext1 !== ext2 && ext1 && ext2) {
            // Different formats detected! Return Overview instead of heavy diff.
            return {
                mode: 'overview',
                documentName: meta.name,
                v1: { 
                    version: v1, 
                    ext: ext1,
                    size: text1.length,
                    lines: text1.split('\n').length,
                    uploadedAt: metaV1?.uploadedAt 
                },
                v2: { 
                    version: v2, 
                    ext: ext2,
                    size: text2.length,
                    lines: text2.split('\n').length,
                    uploadedAt: metaV2?.uploadedAt 
                },
                message: `Phát hiện khác định dạng file (${ext1} vs ${ext2}). So sánh chi tiết có thể không chính xác.`
            };
        }

        // Optimization for weak machines: Truncate large files
        const MAX_CHARS = 200000;
        const isTruncated = text1.length > MAX_CHARS || text2.length > MAX_CHARS;
        
        if (text1.length > MAX_CHARS) text1 = text1.substring(0, MAX_CHARS) + '\n...[TRUNCATED]...';
        if (text2.length > MAX_CHARS) text2 = text2.substring(0, MAX_CHARS) + '\n...[TRUNCATED]...';

        const Diff = require('diff');

        // Line-by-line diff - First pass (Low Memory Usage)
        const lineDiff = Diff.diffLines(text1, text2);

        // Process diff to identify modifications (Remove followed by Add)
        const changes = [];
        let added = 0, removed = 0, modified = 0, unchanged = 0;

        for (let i = 0; i < lineDiff.length; i++) {
            const part = lineDiff[i];
            
            // Check for modification pattern: Removed then Added
            // Optimization: Only group as modification if size is reasonable (< 10 lines)
            const isSmallChange = part.count < 10;
            
            if (part.removed && i + 1 < lineDiff.length && lineDiff[i + 1].added && isSmallChange) {
                const nextPart = lineDiff[i + 1];
                
                // Detailed Word-Level Diff for Modifications (Run only on small chunks to save RAM)
                const wordDiff = Diff.diffWordsWithSpace(part.value, nextPart.value);
                
                changes.push({
                    type: 'modify',
                    oldValue: part.value,
                    newValue: nextPart.value,
                    details: wordDiff // Send detailed word diff to frontend
                });
                modified++;
                i++; // Skip next part as we handled it
                continue;
            } 
            
            if (part.added) {
                changes.push({ type: 'add', value: part.value });
                added++;
            } else if (part.removed) {
                changes.push({ type: 'remove', value: part.value });
                removed++;
            } else {
                // Keep unchanged parts for context, split if too long to avoid huge DOM nodes
                const lines = part.value.split('\n');
                // Remove empty last element from split if exists
                if (lines.length > 0 && lines[lines.length-1] === '') lines.pop();
                
                lines.forEach(line => {
                    changes.push({ type: 'unchanged', value: line });
                });
                unchanged += lines.length;
            }
        }

        return {
            mode: 'detail',
            documentName: meta.name,
            v1: { version: v1, uploadedAt: meta.versions[v1 - 1]?.uploadedAt },
            v2: { version: v2, uploadedAt: meta.versions[v2 - 1]?.uploadedAt },
            stats: { added, removed, modified, unchanged, total: added + removed + modified + unchanged },
            changes, // New structured changes with detailed word diff
            isTruncated // Flag to warn user
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
                    let text = pdfParser.getRawTextContent();
                    // pdf2json URI-encodes text, decode it for proper Vietnamese display
                    try { text = decodeURIComponent(text); } catch (_) { /* already decoded */ }
                    resolve(text);
                });
                pdfParser.on('pdfParser_dataError', (err) => {
                    reject(new Error(err.parserError || 'PDF parse error'));
                });
                pdfParser.loadPDF(filePath);
            });
        }

        if (fileType === 'text' || fileType === 'csv') {
            let content = await fs.readFile(filePath, 'utf8');
            // Strip UTF-8 BOM if present
            if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
            return content;
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
