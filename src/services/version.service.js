/**
 * Version Service
 *
 * Provides git-like version control for the "main" data directory of projects.
 * Creates snapshots of project main data with manifests, checksums, and metadata.
 *
 * Storage Structure:
 * storage/{project}/.versions/
 *   index.json          - version history index
 *   v-{timestamp}/      - snapshot of main data at commit time
 *     manifest.json     - list of files in this version with checksums
 *     data/             - copy of changed files
 *
 * @module services/version
 */

const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const storageService = require('./storage.service');

/**
 * VersionService Class
 *
 * Singleton service managing version control for project main data
 */
class VersionService {

    // ============================================
    // PATH HELPERS
    // ============================================

    /**
     * Get the .versions directory path for a project
     * @param {string} projectName - Name of the project
     * @returns {string} Absolute path to .versions directory
     */
    getVersionsPath(projectName) {
        return path.join(storageService.getProjectPath(projectName), '.versions');
    }

    /**
     * Get the index.json path for a project's version history
     * @param {string} projectName - Name of the project
     * @returns {string} Absolute path to index.json
     */
    getIndexPath(projectName) {
        return path.join(this.getVersionsPath(projectName), 'index.json');
    }

    // ============================================
    // CORE OPERATIONS
    // ============================================

    /**
     * Create a version snapshot (commit) of current main data
     *
     * 1. Generates version ID from ISO timestamp
     * 2. Builds manifest with MD5 checksums for all files
     * 3. Copies all main data files to version snapshot directory
     * 4. Updates index.json with new version entry
     *
     * @param {string} projectName - Name of the project
     * @param {string} message - Commit message describing the changes
     * @param {string} author - Author name for the commit
     * @returns {Promise<Object>} Version info: { versionId, message, author, date, fileCount, totalSize }
     */
    async commit(projectName, message, author) {
        const mainPath = storageService.getMainPath(projectName);
        const versionsPath = this.getVersionsPath(projectName);

        // Ensure main directory exists
        if (!await fs.pathExists(mainPath)) {
            throw new Error(`Project "${projectName}" has no main data directory`);
        }

        // Generate version ID from current timestamp
        const now = new Date();
        const versionId = 'v-' + now.toISOString().replace(/[:.]/g, '-');
        const versionPath = path.join(versionsPath, versionId);
        const dataPath = path.join(versionPath, 'data');

        // Ensure version directories exist
        await fs.ensureDir(dataPath);

        // Build manifest of all files in main directory
        const manifest = await this._buildManifest(mainPath);

        // Copy all main data files in parallel batches
        let totalSize = 0;
        const COPY_CONCURRENCY = 8;

        // Pre-collect unique directories to avoid redundant ensureDir calls
        const dirsNeeded = new Set();
        for (const entry of manifest) {
            dirsNeeded.add(path.dirname(path.join(dataPath, entry.relativePath)));
            totalSize += entry.size;
        }
        await Promise.all([...dirsNeeded].map(d => fs.ensureDir(d)));

        // Copy files in parallel batches
        for (let i = 0; i < manifest.length; i += COPY_CONCURRENCY) {
            const batch = manifest.slice(i, i + COPY_CONCURRENCY);
            await Promise.all(batch.map(entry => {
                const srcFile = path.join(mainPath, entry.relativePath);
                const destFile = path.join(dataPath, entry.relativePath);
                return fs.copy(srcFile, destFile);
            }));
        }

        // Save manifest.json
        const manifestData = {
            versionId,
            createdAt: now.toISOString(),
            files: manifest
        };
        await fs.writeJson(path.join(versionPath, 'manifest.json'), manifestData, { spaces: 2 });

        // Update index.json
        const indexPath = this.getIndexPath(projectName);
        let index = { versions: [] };
        if (await fs.pathExists(indexPath)) {
            try {
                index = await fs.readJson(indexPath);
            } catch (e) {
                index = { versions: [] };
            }
        }

        const versionEntry = {
            versionId,
            message: message || 'No message',
            author: author || 'Unknown',
            date: now.toISOString(),
            fileCount: manifest.length,
            totalSize,
            totalSizeFormatted: storageService.formatSize(totalSize),
            tags: [],
            type: 'commit'
        };

        // Add new version to the beginning of the list (newest first)
        index.versions.unshift(versionEntry);
        await fs.writeJson(indexPath, index, { spaces: 2 });

        console.log(`[Version] Committed ${versionId}: "${message}" (${manifest.length} files, ${storageService.formatSize(totalSize)})`);

        return versionEntry;
    }

    /**
     * Get version history with pagination and search
     *
     * @param {string} projectName - Name of the project
     * @param {Object} options - Query options
     * @param {number} [options.page=1] - Page number (1-based)
     * @param {number} [options.limit=20] - Items per page
     * @param {string} [options.search] - Search term to filter by message, author, or tag
     * @returns {Promise<Object>} Paginated results: { versions, total, page, limit }
     */
    async getHistory(projectName, options = {}) {
        const page = Math.max(1, options.page || 1);
        const limit = Math.max(1, Math.min(100, options.limit || 20));
        const search = (options.search || '').toLowerCase().trim();

        const indexPath = this.getIndexPath(projectName);

        if (!await fs.pathExists(indexPath)) {
            return { versions: [], total: 0, page, limit };
        }

        let index;
        try {
            index = await fs.readJson(indexPath);
        } catch (e) {
            return { versions: [], total: 0, page, limit };
        }

        let versions = index.versions || [];

        // Apply search filter
        if (search) {
            versions = versions.filter(v => {
                const messageMatch = (v.message || '').toLowerCase().includes(search);
                const authorMatch = (v.author || '').toLowerCase().includes(search);
                const tagMatch = (v.tags || []).some(t => t.toLowerCase().includes(search));
                const idMatch = (v.versionId || '').toLowerCase().includes(search);
                return messageMatch || authorMatch || tagMatch || idMatch;
            });
        }

        const total = versions.length;

        // Apply pagination
        const startIndex = (page - 1) * limit;
        const paginatedVersions = versions.slice(startIndex, startIndex + limit);

        return {
            versions: paginatedVersions,
            total,
            page,
            limit
        };
    }

    /**
     * Get full version details including file manifest
     *
     * @param {string} projectName - Name of the project
     * @param {string} versionId - Version ID to retrieve
     * @returns {Promise<Object>} Version details: { versionId, message, author, date, files }
     * @throws {Error} If version not found
     */
    async getVersion(projectName, versionId) {
        const versionPath = path.join(this.getVersionsPath(projectName), versionId);
        const manifestPath = path.join(versionPath, 'manifest.json');

        if (!await fs.pathExists(versionPath)) {
            throw new Error(`Version "${versionId}" not found`);
        }

        // Read manifest
        let manifest;
        try {
            manifest = await fs.readJson(manifestPath);
        } catch (e) {
            throw new Error(`Version "${versionId}" manifest is corrupted or missing`);
        }

        // Read index entry for metadata
        const indexPath = this.getIndexPath(projectName);
        let versionMeta = {};
        if (await fs.pathExists(indexPath)) {
            try {
                const index = await fs.readJson(indexPath);
                versionMeta = (index.versions || []).find(v => v.versionId === versionId) || {};
            } catch (e) {
                // Index unreadable, continue with manifest data only
            }
        }

        return {
            versionId,
            message: versionMeta.message || 'No message',
            author: versionMeta.author || 'Unknown',
            date: versionMeta.date || manifest.createdAt,
            type: versionMeta.type || 'commit',
            tags: versionMeta.tags || [],
            fileCount: (manifest.files || []).length,
            totalSize: versionMeta.totalSize || 0,
            totalSizeFormatted: versionMeta.totalSizeFormatted || '0 B',
            files: manifest.files || []
        };
    }

    /**
     * Rollback to a previous version
     *
     * 1. Auto-commits current state as "Pre-rollback backup"
     * 2. Clears current main data
     * 3. Restores files from the specified version snapshot
     * 4. Records rollback entry in index
     *
     * @param {string} projectName - Name of the project
     * @param {string} versionId - Version ID to rollback to
     * @returns {Promise<Object>} { success, backupVersionId, restoredVersionId }
     * @throws {Error} If version not found
     */
    async rollback(projectName, versionId) {
        const versionPath = path.join(this.getVersionsPath(projectName), versionId);
        const versionDataPath = path.join(versionPath, 'data');
        const mainPath = storageService.getMainPath(projectName);

        if (!await fs.pathExists(versionPath)) {
            throw new Error(`Version "${versionId}" not found`);
        }

        if (!await fs.pathExists(versionDataPath)) {
            throw new Error(`Version "${versionId}" data directory is missing`);
        }

        // Step 1: Auto-commit current state as backup
        let backupVersionId = null;
        try {
            const backup = await this.commit(
                projectName,
                `Pre-rollback backup (before restoring ${versionId})`,
                'system'
            );
            backupVersionId = backup.versionId;

            // Mark the backup entry type as 'rollback-backup' in index
            await this._updateIndexEntry(projectName, backupVersionId, { type: 'rollback-backup' });
        } catch (e) {
            // If main is empty, commit will fail - that's OK, no backup needed
            console.log(`[Version] No backup created (main may be empty): ${e.message}`);
        }

        // Step 2: Clear current main data
        await fs.emptyDir(mainPath);

        // Step 3: Restore files from version snapshot
        await fs.copy(versionDataPath, mainPath);

        // Step 4: Record rollback in index
        const now = new Date();
        const indexPath = this.getIndexPath(projectName);
        let index = { versions: [] };
        if (await fs.pathExists(indexPath)) {
            try {
                index = await fs.readJson(indexPath);
            } catch (e) {
                index = { versions: [] };
            }
        }

        const rollbackEntry = {
            versionId: 'v-' + now.toISOString().replace(/[:.]/g, '-'),
            message: `Rollback to ${versionId}`,
            author: 'system',
            date: now.toISOString(),
            fileCount: 0,
            totalSize: 0,
            tags: [],
            type: 'rollback',
            restoredFrom: versionId
        };

        index.versions.unshift(rollbackEntry);
        await fs.writeJson(indexPath, index, { spaces: 2 });

        console.log(`[Version] Rolled back to ${versionId}. Backup: ${backupVersionId || 'none'}`);

        return {
            success: true,
            backupVersionId,
            restoredVersionId: versionId
        };
    }

    /**
     * Compare two versions' manifests to find differences
     *
     * @param {string} projectName - Name of the project
     * @param {string} versionId1 - First version ID (older)
     * @param {string} versionId2 - Second version ID (newer)
     * @returns {Promise<Object>} { added, removed, modified, unchanged }
     * @throws {Error} If either version not found
     */
    async diff(projectName, versionId1, versionId2) {
        // Load both manifests
        const manifest1Path = path.join(this.getVersionsPath(projectName), versionId1, 'manifest.json');
        const manifest2Path = path.join(this.getVersionsPath(projectName), versionId2, 'manifest.json');

        if (!await fs.pathExists(manifest1Path)) {
            throw new Error(`Version "${versionId1}" not found or has no manifest`);
        }
        if (!await fs.pathExists(manifest2Path)) {
            throw new Error(`Version "${versionId2}" not found or has no manifest`);
        }

        let manifest1, manifest2;
        try {
            manifest1 = await fs.readJson(manifest1Path);
        } catch (e) {
            throw new Error(`Version "${versionId1}" manifest is corrupted`);
        }
        try {
            manifest2 = await fs.readJson(manifest2Path);
        } catch (e) {
            throw new Error(`Version "${versionId2}" manifest is corrupted`);
        }

        // Build lookup maps by relative path
        const files1 = new Map();
        for (const f of (manifest1.files || [])) {
            files1.set(f.relativePath, f);
        }

        const files2 = new Map();
        for (const f of (manifest2.files || [])) {
            files2.set(f.relativePath, f);
        }

        const added = [];
        const removed = [];
        const modified = [];
        const unchanged = [];

        // Check files in version 2 against version 1
        for (const [filePath, fileInfo2] of files2) {
            if (!files1.has(filePath)) {
                // File exists in v2 but not v1 => added
                added.push({
                    path: filePath,
                    size: fileInfo2.size,
                    checksum: fileInfo2.checksum
                });
            } else {
                const fileInfo1 = files1.get(filePath);
                if (fileInfo1.checksum !== fileInfo2.checksum) {
                    // File exists in both but checksums differ => modified
                    modified.push({
                        path: filePath,
                        oldSize: fileInfo1.size,
                        newSize: fileInfo2.size,
                        oldChecksum: fileInfo1.checksum,
                        newChecksum: fileInfo2.checksum
                    });
                } else {
                    // File exists in both with same checksum => unchanged
                    unchanged.push({
                        path: filePath,
                        size: fileInfo2.size,
                        checksum: fileInfo2.checksum
                    });
                }
            }
        }

        // Check files in version 1 that are not in version 2 => removed
        for (const [filePath, fileInfo1] of files1) {
            if (!files2.has(filePath)) {
                removed.push({
                    path: filePath,
                    size: fileInfo1.size,
                    checksum: fileInfo1.checksum
                });
            }
        }

        return {
            versionId1,
            versionId2,
            summary: {
                added: added.length,
                removed: removed.length,
                modified: modified.length,
                unchanged: unchanged.length
            },
            added,
            removed,
            modified,
            unchanged
        };
    }

    /**
     * Add a tag/label to a version
     *
     * @param {string} projectName - Name of the project
     * @param {string} versionId - Version ID to tag
     * @param {string} tagName - Tag name to add
     * @returns {Promise<Object>} Updated version entry
     * @throws {Error} If version not found or tag already exists
     */
    async tag(projectName, versionId, tagName) {
        if (!tagName || typeof tagName !== 'string' || !tagName.trim()) {
            throw new Error('Tag name is required');
        }

        const sanitizedTag = tagName.trim();
        const indexPath = this.getIndexPath(projectName);

        if (!await fs.pathExists(indexPath)) {
            throw new Error(`No version history found for project "${projectName}"`);
        }

        let index;
        try {
            index = await fs.readJson(indexPath);
        } catch (e) {
            throw new Error('Version index is corrupted');
        }

        const versionEntry = (index.versions || []).find(v => v.versionId === versionId);
        if (!versionEntry) {
            throw new Error(`Version "${versionId}" not found in index`);
        }

        // Check for duplicate tag on this version
        if (!versionEntry.tags) {
            versionEntry.tags = [];
        }
        if (versionEntry.tags.includes(sanitizedTag)) {
            throw new Error(`Tag "${sanitizedTag}" already exists on version "${versionId}"`);
        }

        // Check that the tag name is not used on any other version
        for (const v of (index.versions || [])) {
            if (v.versionId !== versionId && (v.tags || []).includes(sanitizedTag)) {
                throw new Error(`Tag "${sanitizedTag}" is already used on version "${v.versionId}"`);
            }
        }

        versionEntry.tags.push(sanitizedTag);
        await fs.writeJson(indexPath, index, { spaces: 2 });

        console.log(`[Version] Tagged ${versionId} as "${sanitizedTag}"`);

        return versionEntry;
    }

    /**
     * Delete a version snapshot
     *
     * Removes the version directory and its entry from the index.
     * Cannot delete versions that have tags.
     *
     * @param {string} projectName - Name of the project
     * @param {string} versionId - Version ID to delete
     * @returns {Promise<Object>} { success, deleted }
     * @throws {Error} If version not found or has tags
     */
    async deleteVersion(projectName, versionId) {
        const indexPath = this.getIndexPath(projectName);
        const versionPath = path.join(this.getVersionsPath(projectName), versionId);

        if (!await fs.pathExists(indexPath)) {
            throw new Error(`No version history found for project "${projectName}"`);
        }

        let index;
        try {
            index = await fs.readJson(indexPath);
        } catch (e) {
            throw new Error('Version index is corrupted');
        }

        const versionIndex = (index.versions || []).findIndex(v => v.versionId === versionId);
        if (versionIndex === -1) {
            throw new Error(`Version "${versionId}" not found in index`);
        }

        const versionEntry = index.versions[versionIndex];

        // Cannot delete tagged versions
        if (versionEntry.tags && versionEntry.tags.length > 0) {
            throw new Error(
                `Cannot delete version "${versionId}" because it has tags: ${versionEntry.tags.join(', ')}. ` +
                'Remove all tags before deleting.'
            );
        }

        // Remove from index
        index.versions.splice(versionIndex, 1);
        await fs.writeJson(indexPath, index, { spaces: 2 });

        // Remove version directory from disk
        if (await fs.pathExists(versionPath)) {
            await fs.remove(versionPath);
        }

        console.log(`[Version] Deleted version ${versionId}`);

        return {
            success: true,
            deleted: versionId
        };
    }

    // ============================================
    // HELPERS
    // ============================================

    /**
     * Build a manifest of all files in a directory
     *
     * Recursively walks the directory and creates a list of all files
     * with their relative paths, MD5 checksums, and sizes.
     *
     * @param {string} dirPath - Absolute path to directory to scan
     * @returns {Promise<Array>} Array of file entries: [{ relativePath, checksum, size }]
     */
    async _buildManifest(dirPath) {
        // Phase 1: Collect all file paths (fast, no I/O per file)
        const filePaths = [];

        const walkDir = async (currentPath) => {
            if (!await fs.pathExists(currentPath)) return;
            const entries = await fs.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    await walkDir(fullPath);
                } else if (entry.isFile()) {
                    filePaths.push(fullPath);
                }
            }
        };
        await walkDir(dirPath);

        // Phase 2: Parallel stat + checksum with concurrency limit
        const CONCURRENCY = 8;
        const manifest = [];
        for (let i = 0; i < filePaths.length; i += CONCURRENCY) {
            const batch = filePaths.slice(i, i + CONCURRENCY);
            const results = await Promise.all(batch.map(async (fullPath) => {
                const [stats, checksum] = await Promise.all([
                    fs.stat(fullPath),
                    this._generateChecksum(fullPath)
                ]);
                return {
                    relativePath: path.relative(dirPath, fullPath).replace(/\\/g, '/'),
                    checksum,
                    size: stats.size
                };
            }));
            manifest.push(...results);
        }

        manifest.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
        return manifest;
    }

    /**
     * Generate MD5 checksum for a file
     *
     * @param {string} filePath - Absolute path to the file
     * @returns {Promise<string>} MD5 hex digest
     */
    async _generateChecksum(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('md5');
            const stream = fs.createReadStream(filePath);

            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', (err) => reject(err));
        });
    }

    /**
     * Update a specific entry in the version index
     *
     * @param {string} projectName - Name of the project
     * @param {string} versionId - Version ID to update
     * @param {Object} updates - Fields to update
     * @returns {Promise<void>}
     * @private
     */
    async _updateIndexEntry(projectName, versionId, updates) {
        const indexPath = this.getIndexPath(projectName);

        if (!await fs.pathExists(indexPath)) {
            return;
        }

        try {
            const index = await fs.readJson(indexPath);
            const entry = (index.versions || []).find(v => v.versionId === versionId);
            if (entry) {
                Object.assign(entry, updates);
                await fs.writeJson(indexPath, index, { spaces: 2 });
            }
        } catch (e) {
            console.error(`[Version] Failed to update index entry for ${versionId}:`, e);
        }
    }
}

module.exports = new VersionService();
