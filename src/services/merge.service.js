const fs = require('fs-extra');
const path = require('path');
const storageService = require('./storage.service');

class MergeService {
    /**
     * Build a map of nodeId → nestedPath from flow.json
     * Uses edges to reconstruct parent chain: start/login/home/...
     */
    _buildNestedPathMap(flowData) {
        const pathMap = new Map();
        if (!flowData || !flowData.nodes) return pathMap;

        // If nodes already have nestedPath (new format), use directly
        const hasNestedPaths = flowData.nodes.some(n => n.nestedPath);
        if (hasNestedPaths) {
            for (const node of flowData.nodes) {
                if (node.nestedPath) {
                    pathMap.set(node.id, node.nestedPath);
                } else if (node.type === 'start') {
                    pathMap.set(node.id, node.id);
                }
            }
            return pathMap;
        }

        // Fallback: build from edges (old format — flat folders)
        // For backward compatibility, flat folders use id directly
        for (const node of flowData.nodes) {
            pathMap.set(node.id, node.id);
        }
        return pathMap;
    }

    /**
     * Merge specific screen folders from section to main.
     * Supports nested folder structure (new) and flat folders (old/backward compat).
     */
    async merge(projectName, sectionTimestamp, foldersToMerge) {
        const mainPath = storageService.getMainPath(projectName);
        const sectionPath = storageService.getSectionPath(projectName, sectionTimestamp);

        if (!await fs.pathExists(sectionPath)) {
            throw new Error(`Section "${sectionTimestamp}" does not exist`);
        }

        await fs.ensureDir(mainPath);

        // Read section flow to get nested paths
        let sectionFlow = null;
        let nestedPathMap = new Map();
        try {
            sectionFlow = await storageService.getSectionFlow(projectName, sectionTimestamp);
            if (sectionFlow) {
                nestedPathMap = this._buildNestedPathMap(sectionFlow);
            }
        } catch (e) {
            console.warn('[Merge] Could not read section flow:', e.message);
        }

        const mergedFolders = [];
        const errors = [];

        for (const folderName of foldersToMerge) {
            try {
                // Determine source path: try nested path first, then flat
                const nestedPath = nestedPathMap.get(folderName) || folderName;
                const fullSourcePath = path.join(sectionPath, nestedPath);

                if (!await fs.pathExists(fullSourcePath)) {
                    // Fallback: try flat path (backward compat with old captures)
                    const flatSourcePath = path.join(sectionPath, folderName);
                    if (await fs.pathExists(flatSourcePath)) {
                        // Old format: copy flat to nested in main
                        const fullDestPath = path.join(mainPath, nestedPath);
                        await fs.ensureDir(path.dirname(fullDestPath));
                        if (await fs.pathExists(fullDestPath)) {
                            await fs.remove(fullDestPath);
                        }
                        await fs.copy(flatSourcePath, fullDestPath, { overwrite: true });
                        mergedFolders.push(folderName);
                        continue;
                    }
                    errors.push({ folder: folderName, error: 'Folder does not exist in section' });
                    continue;
                }

                // Copy nested structure to main (same nested path)
                const fullDestPath = path.join(mainPath, nestedPath);
                await fs.ensureDir(path.dirname(fullDestPath));

                if (await fs.pathExists(fullDestPath)) {
                    await fs.remove(fullDestPath);
                }

                await fs.copy(fullSourcePath, fullDestPath, { overwrite: true });
                mergedFolders.push(folderName);
            } catch (error) {
                errors.push({ folder: folderName, error: error.message });
            }
        }

        // --- MERGE FLOW LOGIC ---
        try {
            const sectionFlow = await storageService.getSectionFlow(projectName, sectionTimestamp);

            if (sectionFlow) {
                const mainFlow = await storageService.getFlow(projectName);

                // Preserve domain
                if (sectionFlow.domain && !mainFlow.domain) {
                    mainFlow.domain = sectionFlow.domain;
                }

                // Merge Nodes (add new, update existing)
                if (sectionFlow.nodes) {
                    sectionFlow.nodes.forEach(node => {
                        if (!node) return;
                        const nodeId = typeof node === 'object' ? node.id : node;
                        if (!nodeId) return;

                        // Only merge nodes whose folders were selected
                        if (nodeId !== 'start' && !foldersToMerge.includes(nodeId)) return;

                        const existIdx = mainFlow.nodes.findIndex(n => {
                            if (!n) return false;
                            return (typeof n === 'object' ? n.id : n) === nodeId;
                        });

                        if (existIdx === -1) {
                            mainFlow.nodes.push(node);
                        } else {
                            mainFlow.nodes[existIdx] = node;
                        }
                    });
                }

                // Merge Edges (match by from+to)
                if (sectionFlow.edges) {
                    sectionFlow.edges.forEach(edge => {
                        // Only merge edges where both endpoints are in the merged set or already in main
                        const mainNodeIds = new Set(mainFlow.nodes.map(n => typeof n === 'object' ? n.id : n));

                        if (!mainNodeIds.has(edge.from) || !mainNodeIds.has(edge.to)) return;

                        const existIdx = mainFlow.edges.findIndex(e =>
                            e.from === edge.from && e.to === edge.to
                        );
                        if (existIdx === -1) {
                            mainFlow.edges.push(edge);
                        } else {
                            mainFlow.edges[existIdx] = edge;
                        }
                    });
                }

                // Save merged flow to project root
                const projectPath = storageService.getProjectPath(projectName);
                const flowPath = path.join(projectPath, 'flow.json');
                await fs.writeJson(flowPath, mainFlow, { spaces: 2 });
            }
        } catch (e) {
            console.error('[Merge] Failed to merge flow:', e);
            errors.push({ folder: 'flow.json', error: 'Failed to merge flow data' });
        }

        return {
            success: errors.length === 0,
            merged: mergedFolders,
            errors: errors
        };
    }

    /**
     * Merge entire section to main — copies everything from section to main.
     */
    async mergeAll(projectName, sectionTimestamp) {
        const sectionPath = storageService.getSectionPath(projectName, sectionTimestamp);

        if (!await fs.pathExists(sectionPath)) {
            throw new Error(`Section "${sectionTimestamp}" does not exist`);
        }

        // Get screen node IDs from flow.json (preferred) or fall back to top-level dirs
        let folders = [];
        try {
            const sectionFlow = await storageService.getSectionFlow(projectName, sectionTimestamp);
            if (sectionFlow && sectionFlow.nodes) {
                folders = sectionFlow.nodes
                    .filter(n => n.type !== 'start')
                    .map(n => n.id);
            }
        } catch (e) {
            console.warn('[Merge] Could not read section flow for mergeAll:', e.message);
        }

        // Fallback: list top-level directories
        if (folders.length === 0) {
            const entries = await fs.readdir(sectionPath, { withFileTypes: true });
            folders = entries
                .filter(e => e.isDirectory())
                .map(e => e.name);
        }

        return await this.merge(projectName, sectionTimestamp, folders);
    }

    /**
     * Delete section after merge.
     */
    async deleteSection(projectName, sectionTimestamp) {
        return await storageService.deleteSection(projectName, sectionTimestamp);
    }

    /**
     * Merge and optionally delete section.
     */
    async mergeAndDelete(projectName, sectionTimestamp, foldersToMerge, deleteAfter = false) {
        const mergeResult = await this.merge(projectName, sectionTimestamp, foldersToMerge);

        if (deleteAfter && mergeResult.success) {
            await this.deleteSection(projectName, sectionTimestamp);
            mergeResult.sectionDeleted = true;
        }

        return mergeResult;
    }

    /**
     * Preview what will be merged (dry run).
     */
    async previewMerge(projectName, sectionTimestamp, foldersToMerge) {
        const mainPath = storageService.getMainPath(projectName);
        const sectionPath = storageService.getSectionPath(projectName, sectionTimestamp);

        const preview = [];

        for (const folderName of foldersToMerge) {
            const fullSourcePath = path.join(sectionPath, folderName);
            const fullDestPath = path.join(mainPath, folderName);

            const item = {
                folder: folderName,
                action: 'create',
                overwrite: false
            };

            if (await fs.pathExists(fullDestPath)) {
                item.action = 'overwrite';
                item.overwrite = true;

                const sourceSize = await storageService.getDirectorySize(fullSourcePath);
                const destSize = await storageService.getDirectorySize(fullDestPath);

                item.sourceSize = storageService.formatSize(sourceSize);
                item.destSize = storageService.formatSize(destSize);
            } else {
                if (await fs.pathExists(fullSourcePath)) {
                    const sourceSize = await storageService.getDirectorySize(fullSourcePath);
                    item.sourceSize = storageService.formatSize(sourceSize);
                }
            }

            preview.push(item);
        }

        return preview;
    }
}

module.exports = new MergeService();
