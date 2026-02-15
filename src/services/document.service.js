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
    async upload(projectName, file, originalName, targetDocId = null) {
        const docsPath = this.getDocumentsPath(projectName);
        await fs.ensureDir(docsPath);

        const ext = path.extname(originalName).toLowerCase();
        const baseName = path.basename(originalName, ext);
        const fileType = this._getFileType(ext);

        if (!fileType) {
            throw new Error('Dinh dang khong ho tro. Chi ho tro: .docx, .xlsx, .xls, .pdf, .txt, .csv');
        }

        // Check if document with same name already exists, or if a specific docId was provided
        let docId = null;
        let meta = null;

        if (targetDocId) {
            // Force add version to existing document
            const docPath = this.getDocPath(projectName, targetDocId);
            if (await fs.pathExists(path.join(docPath, 'meta.json'))) {
                docId = targetDocId;
                meta = await fs.readJson(path.join(docPath, 'meta.json'));
            }
        }

        if (!docId) {
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

    // Rename document (display name only, original filename preserved)
    async renameDocument(projectName, docId, displayName) {
        const metaPath = path.join(this.getDocPath(projectName, docId), 'meta.json');
        if (!await fs.pathExists(metaPath)) {
            throw new Error('Document not found');
        }
        const meta = await fs.readJson(metaPath);
        meta.displayName = displayName;
        meta.updatedAt = new Date().toISOString();
        await fs.writeJson(metaPath, meta, { spaces: 2 });
        return meta;
    }

    // List all documents for a project
    async list(projectName) {
        const docsPath = this.getDocumentsPath(projectName);
        if (!await fs.pathExists(docsPath)) return [];

        const entries = await fs.readdir(docsPath, { withFileTypes: true });
        const dirs = entries.filter(e => e.isDirectory());

        // Read all meta.json files in parallel
        const results = await Promise.all(dirs.map(async (entry) => {
            const metaPath = path.join(docsPath, entry.name, 'meta.json');
            try {
                if (await fs.pathExists(metaPath)) {
                    return await fs.readJson(metaPath);
                }
            } catch (_) { /* skip corrupted meta */ }
            return null;
        }));

        const docs = results.filter(Boolean);
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
                const allRows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' });
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
                if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

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

    // GitHub-style text diff — works for ALL file types (text, word, pdf)
    // Returns side-by-side diff hunks with line numbers and word-level highlights
    async compareTextDiff(projectName, docId, v1, v2) {
        const meta = await this.getDocument(projectName, docId);
        const v1Path = path.join(this.getVersionPath(projectName, docId, v1), 'extracted.txt');
        const v2Path = path.join(this.getVersionPath(projectName, docId, v2), 'extracted.txt');

        let text1 = '', text2 = '';
        if (await fs.pathExists(v1Path)) text1 = await fs.readFile(v1Path, 'utf8');
        if (await fs.pathExists(v2Path)) text2 = await fs.readFile(v2Path, 'utf8');

        // Strip BOM
        if (text1.charCodeAt(0) === 0xFEFF) text1 = text1.slice(1);
        if (text2.charCodeAt(0) === 0xFEFF) text2 = text2.slice(1);

        // Truncate for performance
        const MAX_CHARS = 300000;
        const isTruncated = text1.length > MAX_CHARS || text2.length > MAX_CHARS;
        if (text1.length > MAX_CHARS) text1 = text1.substring(0, MAX_CHARS) + '\n...[TRUNCATED]...';
        if (text2.length > MAX_CHARS) text2 = text2.substring(0, MAX_CHARS) + '\n...[TRUNCATED]...';

        const Diff = require('diff');
        const lineDiff = Diff.diffLines(text1, text2);

        // Build GitHub-style hunks
        // Each hunk = array of rows: { type, leftNum, rightNum, leftContent, rightContent, wordDiff }
        const CONTEXT = 4; // lines of context around changes
        const allRows = [];
        let leftNum = 1, rightNum = 1;

        for (let i = 0; i < lineDiff.length; i++) {
            const part = lineDiff[i];
            const lines = part.value.split('\n');
            // Remove trailing empty from split
            if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

            if (!part.added && !part.removed) {
                // Unchanged
                for (const line of lines) {
                    allRows.push({ type: 'equal', leftNum: leftNum++, rightNum: rightNum++, content: line });
                }
            } else if (part.removed && i + 1 < lineDiff.length && lineDiff[i + 1].added) {
                // Modification: removed followed by added
                const nextPart = lineDiff[i + 1];
                const oldLines = lines;
                const newLines = nextPart.value.split('\n');
                if (newLines.length > 0 && newLines[newLines.length - 1] === '') newLines.pop();

                const maxLen = Math.max(oldLines.length, newLines.length);
                for (let j = 0; j < maxLen; j++) {
                    const oldLine = j < oldLines.length ? oldLines[j] : null;
                    const newLine = j < newLines.length ? newLines[j] : null;

                    if (oldLine !== null && newLine !== null) {
                        // Modified line — compute word-level diff
                        const wordDiff = Diff.diffWordsWithSpace(oldLine, newLine);
                        const leftParts = [], rightParts = [];
                        for (const wd of wordDiff) {
                            if (wd.removed) {
                                leftParts.push({ type: 'del', value: wd.value });
                            } else if (wd.added) {
                                rightParts.push({ type: 'ins', value: wd.value });
                            } else {
                                leftParts.push({ type: 'eq', value: wd.value });
                                rightParts.push({ type: 'eq', value: wd.value });
                            }
                        }
                        allRows.push({
                            type: 'modify',
                            leftNum: leftNum++,
                            rightNum: rightNum++,
                            leftParts,
                            rightParts
                        });
                    } else if (oldLine !== null) {
                        allRows.push({ type: 'delete', leftNum: leftNum++, rightNum: null, content: oldLine });
                    } else {
                        allRows.push({ type: 'insert', leftNum: null, rightNum: rightNum++, content: newLine });
                    }
                }
                i++; // skip next (added) part
            } else if (part.removed) {
                for (const line of lines) {
                    allRows.push({ type: 'delete', leftNum: leftNum++, rightNum: null, content: line });
                }
            } else {
                for (const line of lines) {
                    allRows.push({ type: 'insert', leftNum: null, rightNum: rightNum++, content: line });
                }
            }
        }

        // Now build hunks with context collapsing (GitHub style)
        const hunks = [];
        let stats = { added: 0, removed: 0, modified: 0, unchanged: 0 };

        // Find change indices
        const changeIndices = [];
        allRows.forEach((row, idx) => {
            if (row.type !== 'equal') changeIndices.push(idx);
            if (row.type === 'insert') stats.added++;
            else if (row.type === 'delete') stats.removed++;
            else if (row.type === 'modify') stats.modified++;
            else stats.unchanged++;
        });

        if (changeIndices.length === 0) {
            // No changes
            return {
                mode: 'github-diff',
                type: meta.type,
                documentName: meta.name,
                v1: { version: v1 },
                v2: { version: v2 },
                hunks: [],
                stats,
                isTruncated,
                noChanges: true
            };
        }

        // Expand change indices to include context
        const visibleSet = new Set();
        for (const ci of changeIndices) {
            for (let j = Math.max(0, ci - CONTEXT); j <= Math.min(allRows.length - 1, ci + CONTEXT); j++) {
                visibleSet.add(j);
            }
        }

        // Build hunks from visible ranges
        let currentHunk = null;
        for (let i = 0; i < allRows.length; i++) {
            if (visibleSet.has(i)) {
                if (!currentHunk) {
                    currentHunk = { rows: [], collapsed: 0 };
                    if (i > 0 && !visibleSet.has(i - 1)) {
                        // Count preceding collapsed lines
                        let collapsedStart = currentHunk === hunks[hunks.length - 1]
                            ? hunks[hunks.length - 1].rows.length
                            : 0;
                        // Already handled above
                    }
                }
                currentHunk.rows.push(allRows[i]);
            } else {
                if (currentHunk) {
                    hunks.push(currentHunk);
                    currentHunk = null;
                }
                // Count collapsed
                let collapsedCount = 0;
                while (i < allRows.length && !visibleSet.has(i)) {
                    collapsedCount++;
                    i++;
                }
                hunks.push({ collapsed: collapsedCount });
                i--; // will be incremented by for loop
            }
        }
        if (currentHunk) hunks.push(currentHunk);

        return {
            mode: 'github-diff',
            type: meta.type,
            documentName: meta.name,
            v1: { version: v1 },
            v2: { version: v2 },
            hunks,
            stats,
            isTruncated
        };
    }

    // Visual compare - returns structured data for side-by-side preview
    async compareVisual(projectName, docId, v1, v2) {
        const meta = await this.getDocument(projectName, docId);
        const type = meta.type;

        if (type === 'excel') {
            return await this._compareExcelVisual(projectName, docId, meta, v1, v2);
        } else if (type === 'word') {
            return await this._compareWordVisual(projectName, docId, meta, v1, v2);
        } else {
            // Fallback to text diff for other types
            return { mode: 'text-fallback', type };
        }
    }

    async _compareExcelVisual(projectName, docId, meta, v1, v2) {
        const XLSX = require('xlsx');

        const readWorkbook = (ver) => {
            const vp = this.getVersionPath(projectName, docId, ver);
            const files = require('fs').readdirSync(vp);
            const orig = files.find(f => f.startsWith('original'));
            if (!orig) throw new Error(`Version ${ver} file not found`);
            return XLSX.readFile(path.join(vp, orig));
        };

        const wb1 = readWorkbook(v1);
        const wb2 = readWorkbook(v2);

        const allSheets = [...new Set([...wb1.SheetNames, ...wb2.SheetNames])];
        const MAX_ROWS = 200;
        const sheets = {};

        for (const name of allSheets) {
            const rows1 = wb1.Sheets[name]
                ? XLSX.utils.sheet_to_json(wb1.Sheets[name], { header: 1 }).slice(0, MAX_ROWS)
                : [];
            const rows2 = wb2.Sheets[name]
                ? XLSX.utils.sheet_to_json(wb2.Sheets[name], { header: 1 }).slice(0, MAX_ROWS)
                : [];

            const maxRows = Math.max(rows1.length, rows2.length);
            const maxCols = Math.max(
                rows1.reduce((m, r) => Math.max(m, r.length), 0),
                rows2.reduce((m, r) => Math.max(m, r.length), 0)
            );

            // Build change map: array of [row][col] = 'add' | 'remove' | 'modify' | null
            const changeMap = [];
            let stats = { added: 0, removed: 0, modified: 0 };

            for (let r = 0; r < maxRows; r++) {
                const rowChanges = [];
                const r1 = rows1[r] || [];
                const r2 = rows2[r] || [];

                for (let c = 0; c < maxCols; c++) {
                    const val1 = r1[c] !== undefined && r1[c] !== null ? String(r1[c]) : '';
                    const val2 = r2[c] !== undefined && r2[c] !== null ? String(r2[c]) : '';

                    if (val1 === val2) {
                        rowChanges.push(null);
                    } else if (val1 === '' && val2 !== '') {
                        rowChanges.push('add');
                        stats.added++;
                    } else if (val1 !== '' && val2 === '') {
                        rowChanges.push('remove');
                        stats.removed++;
                    } else {
                        rowChanges.push('modify');
                        stats.modified++;
                    }
                }
                changeMap.push(rowChanges);
            }

            // Check if entire rows are new or removed
            const isOnlyInV1 = !wb2.Sheets[name];
            const isOnlyInV2 = !wb1.Sheets[name];

            sheets[name] = {
                rows1, rows2, maxCols, changeMap, stats,
                isOnlyInV1, isOnlyInV2,
                totalRows1: wb1.Sheets[name]
                    ? XLSX.utils.sheet_to_json(wb1.Sheets[name], { header: 1 }).length
                    : 0,
                totalRows2: wb2.Sheets[name]
                    ? XLSX.utils.sheet_to_json(wb2.Sheets[name], { header: 1 }).length
                    : 0
            };
        }

        return {
            mode: 'visual',
            type: 'excel',
            v1: { version: v1 },
            v2: { version: v2 },
            sheetNames: allSheets,
            sheets
        };
    }

    async _compareWordVisual(projectName, docId, meta, v1, v2) {
        const mammoth = require('mammoth');
        const vp1 = this.getVersionPath(projectName, docId, v1);
        const vp2 = this.getVersionPath(projectName, docId, v2);

        const files1 = require('fs').readdirSync(vp1);
        const files2 = require('fs').readdirSync(vp2);
        const orig1 = files1.find(f => f.startsWith('original'));
        const orig2 = files2.find(f => f.startsWith('original'));

        if (!orig1 || !orig2) throw new Error('Version files not found');

        const [html1, html2] = await Promise.all([
            mammoth.convertToHtml({ path: path.join(vp1, orig1) }).then(r => r.value),
            mammoth.convertToHtml({ path: path.join(vp2, orig2) }).then(r => r.value)
        ]);

        return {
            mode: 'visual',
            type: 'word',
            v1: { version: v1, content: html1 },
            v2: { version: v2, content: html2 }
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
            const pdfParse = require('pdf-parse');
            const dataBuffer = await fs.readFile(filePath);
            const data = await pdfParse(dataBuffer);
            return data.text || '';
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
