/**
 * Storage Service
 *
 * Manages all file system operations for the MAPI Testing Tool
 *
 * Features:
 * - Project management (create, delete, list)
 * - Main data tree operations
 * - Section management (create, delete, list, rename)
 * - Data storage (UI snapshots, API requests, metadata)
 * - Flow graph persistence
 * - Auth data management
 * - URL history tracking
 *
 * Directory Structure:
 * storage/
 *   ├── {projectName}/
 *   │   ├── main/                    # Main reference data
 *   │   │   └── {screenId}/
 *   │   │       ├── screen.html
 *   │   │       ├── dom.json
 *   │   │       ├── apis.json
 *   │   │       └── meta.json
 *   │   ├── sections/                # Test sections
 *   │   │   └── {timestamp}/
 *   │   │       ├── flow.json
 *   │   │       └── {screenId}/
 *   │   ├── auth.json
 *   │   └── url_history.json
 *
 * @module services/storage
 */

const path = require('path');
const fs = require('fs-extra');
const os = require('os');
const { pathExistsCached, batchWrite, writeJsonFast, invalidatePathCacheDir, batchPathExists } = require('../utils/file-io-optimizer');

/**
 * Get storage directory path
 *
 * Priority:
 * 1. Environment variable (STORAGE_PATH)
 * 2. Global variable (global.STORAGE_PATH)
 * 3. Default: {projectRoot}/storage
 *
 * @returns {string} Absolute path to storage directory
 */
function getStorageDir() {
    // Priority: env var > global > Project's internal storage folder
    if (process.env.STORAGE_PATH) {
        return process.env.STORAGE_PATH;
    }
    if (global.STORAGE_PATH) {
        return global.STORAGE_PATH;
    }
    // Default: {ProjectRoot}/storage
    return path.join(__dirname, '..', '..', 'storage');
}

/**
 * StorageService Class
 *
 * Singleton service managing all file system operations
 */
class StorageService {
    /**
     * Initialize storage service
     * Creates storage directory if it doesn't exist
     */
    constructor() {
        const storageDir = getStorageDir();
        fs.ensureDirSync(storageDir);
        console.log(`📁 Storage: ${storageDir}`);
    }

    /**
     * Get storage directory path
     * @returns {string} Absolute path to storage root
     */
    getStoragePath() {
        return getStorageDir();
    }

    /**
     * Get project directory path
     * @param {string} projectName - Name of the project
     * @returns {string} Absolute path to project directory
     */
    getProjectPath(projectName) {
        return path.join(getStorageDir(), projectName);
    }

    /**
     * Get main data directory path
     * @param {string} projectName - Name of the project
     * @returns {string} Absolute path to main directory
     */
    getMainPath(projectName) {
        return path.join(this.getProjectPath(projectName), 'main');
    }

    /**
     * Get sections directory path
     * @param {string} projectName - Name of the project
     * @returns {string} Absolute path to sections directory
     */
    getSectionsPath(projectName) {
        return path.join(this.getProjectPath(projectName), 'sections');
    }

    /**
     * Get specific section directory path
     * @param {string} projectName - Name of the project
     * @param {string} sectionTimestamp - Section timestamp identifier
     * @returns {string} Absolute path to section directory
     */
    getSectionPath(projectName, sectionTimestamp) {
        return path.join(this.getSectionsPath(projectName), sectionTimestamp);
    }

    /**
     * Get auth file path
     * @param {string} projectName - Name of the project
     * @returns {string} Absolute path to auth.json
     */
    getAuthPath(projectName) {
        return path.join(this.getProjectPath(projectName), 'auth.json');
    }

    /**
     * List all projects
     *
     * @returns {Promise<Array>} Array of project objects with name, path, size
     */
    async listProjects() {
        const projects = [];
        const storageDir = getStorageDir();

        if (!await fs.pathExists(storageDir)) {
            return projects;
        }

        const items = await fs.readdir(storageDir, { withFileTypes: true });

        for (const item of items) {
            if (item.isDirectory()) {
                const projectPath = path.join(storageDir, item.name);
                const size = await this.getDirectorySize(projectPath);

                projects.push({
                    name: item.name,
                    path: projectPath,
                    size: size,
                    sizeFormatted: this.formatSize(size)
                });
            }
        }

        return projects;
    }

    /**
     * Create a new project
     *
     * Initializes directory structure:
     * - Main directory for reference data
     * - Sections directory for test runs
     * - Empty auth.json file
     *
     * @param {string} projectName - Name of the project to create
     * @returns {Promise<Object>} Created project info
     * @throws {Error} If project already exists
     */
    async createProject(projectName) {
        const projectPath = this.getProjectPath(projectName);

        if (await fs.pathExists(projectPath)) {
            throw new Error(`Project "${projectName}" already exists`);
        }

        // Create directory structure
        await fs.ensureDir(projectPath);
        await fs.ensureDir(this.getMainPath(projectName));
        await fs.ensureDir(this.getSectionsPath(projectName));

        // Initialize auth file with empty data
        await fs.writeJson(this.getAuthPath(projectName), {
            cookies: [],
            localStorage: {},
            sessionStorage: {}
        });

        return { name: projectName, path: projectPath };
    }

    /**
     * Delete a project
     *
     * @param {string} projectName - Name of the project to delete
     * @returns {Promise<Object>} Deletion confirmation
     * @throws {Error} If project doesn't exist
     */
    async deleteProject(projectName) {
        const projectPath = this.getProjectPath(projectName);

        if (!await fs.pathExists(projectPath)) {
            throw new Error(`Project "${projectName}" does not exist`);
        }

        await fs.remove(projectPath);
        return { deleted: projectName };
    }

    // Get main data tree
    async getMainTree(projectName) {
        const mainPath = this.getMainPath(projectName);
        if (!await fs.pathExists(mainPath)) {
            return [];
        }

        // Try to build tree from flow.json first (if exists)
        const projectPath = this.getProjectPath(projectName);
        const flowPath = path.join(projectPath, 'flow.json');

        if (await fs.pathExists(flowPath)) {
            try {
                const flowData = await fs.readJson(flowPath);
                if (flowData.nodes && flowData.nodes.length > 0) {
                    // Build tree from flow data (same logic as listSections)
                    const nodeMap = new Map();

                    for (const node of flowData.nodes) {
                        // Use nestedPath if available (new format), otherwise flat (old format)
                        const relativePath = node.nestedPath || node.id;
                        let screenDir = path.join(mainPath, relativePath);

                        // If directory doesn't exist in main, search sections for fallback
                        if (!await fs.pathExists(screenDir)) {
                            const sectionsPath = this.getSectionsPath(projectName);
                            if (await fs.pathExists(sectionsPath)) {
                                const sectionFolders = await fs.readdir(sectionsPath, { withFileTypes: true });
                                // Sort descending to check latest sections first
                                const sorted = sectionFolders
                                    .filter(d => d.isDirectory())
                                    .map(d => d.name)
                                    .sort()
                                    .reverse();
                                for (const sf of sorted) {
                                    const candidate = path.join(sectionsPath, sf, relativePath);
                                    if (await fs.pathExists(candidate)) {
                                        screenDir = candidate;
                                        break;
                                    }
                                }
                            }
                        }

                        // Check if this screen has actual captured data
                        const hasUI = node.type !== 'start' && await fs.pathExists(path.join(screenDir, 'screen.html'));
                        const hasAPI = node.type !== 'start' && await fs.pathExists(path.join(screenDir, 'apis.json'));

                        const treeNode = {
                            id: node.id,
                            name: node.name || node.id,
                            type: node.type === 'start' ? 'folder' : 'ui',
                            nodeType: node.type || 'page',
                            path: screenDir,
                            urlPath: node.path || '',
                            hasUI,
                            hasAPI,
                            children: []
                        };
                        nodeMap.set(node.id, treeNode);
                    }

                    // Build tree from edges (parent-child relationships)
                    const childIds = new Set();
                    if (flowData.edges) {
                        for (const edge of flowData.edges) {
                            const parent = nodeMap.get(edge.from);
                            const child = nodeMap.get(edge.to);
                            if (parent && child) {
                                child.edgeLabel = edge.label || '';
                                child.edgeActions = edge.actions || 0;
                                child.edgeApis = edge.apis || 0;
                                parent.children.push(child);
                                childIds.add(edge.to);
                            }
                        }
                        // Sort children by domOrder for proper display sequence
                        for (const [id, node] of nodeMap) {
                            if (node.children && node.children.length > 0) {
                                node.children.sort((a, b) => {
                                    const aNode = flowData.nodes.find(n => n.id === a.id);
                                    const bNode = flowData.nodes.find(n => n.id === b.id);
                                    const aDomOrder = aNode?.domOrder ?? Infinity;
                                    const bDomOrder = bNode?.domOrder ?? Infinity;
                                    return aDomOrder - bDomOrder;
                                });
                            }
                        }
                    }

                    // Root nodes = nodes not referenced as children
                    const screenTree = [];
                    for (const [id, node] of nodeMap) {
                        if (!childIds.has(id)) {
                            screenTree.push(node);
                        }
                    }

                    // Clean up empty children arrays
                    const cleanTree = (nodes) => {
                        if (!nodes || !Array.isArray(nodes)) return;
                        for (const n of nodes) {
                            if (!n) continue;
                            if (n.children && n.children.length === 0) {
                                delete n.children;
                            } else if (n.children && n.children.length > 0) {
                                cleanTree(n.children);
                            }
                        }
                    };
                    cleanTree(screenTree);

                    return screenTree;
                }
            } catch (e) {
                console.error('[Storage] Error reading flow.json for main tree:', e);
                // Fall through to buildTree
            }
        }

        // Fallback: build tree from file system (old behavior)
        return await this.buildTree(mainPath, mainPath);
    }

    // Get sections list
    async listSections(projectName) {
        const sectionsPath = this.getSectionsPath(projectName);
        if (!await fs.pathExists(sectionsPath)) {
            return [];
        }

        const allFolders = await fs.readdir(sectionsPath, { withFileTypes: true });
        const sectionMap = new Map();
        const derivatives = [];

        for (const item of allFolders) {
            if (item.isDirectory()) {
                const sectionPath = path.join(sectionsPath, item.name);
                const size = await this.getDirectorySize(sectionPath);

                // Read flow.json to get screens list
                const flowPath = path.join(sectionPath, 'flow.json');
                let screens = [];
                let screenTree = [];
                let screenCount = 0;
                let apiCount = 0;

                if (await fs.pathExists(flowPath)) {
                    try {
                        const flowData = await fs.readJson(flowPath);
                        if (flowData.nodes) {
                            screenCount = flowData.nodes.filter(n => n.type !== 'start').length;

                            // Build node map and count APIs
                            const nodeMap = new Map();
                            for (const node of flowData.nodes) {
                                // Use nestedPath if available (new format), otherwise flat (old format)
                                const relativePath = node.nestedPath || node.id;
                                const screenDir = path.join(sectionPath, relativePath);
                                const exists = await fs.pathExists(screenDir);

                                // Count APIs
                                if (exists && node.type !== 'start') {
                                    const apisPath = path.join(screenDir, 'apis.json');
                                    if (await fs.pathExists(apisPath)) {
                                        try {
                                            const apisData = await fs.readJson(apisPath);
                                            apiCount += (apisData || []).length;
                                        } catch (e) { }
                                    }
                                }

                                const treeNode = {
                                    id: node.id,
                                    name: node.name || node.id,
                                    type: node.type === 'start' ? 'folder' : 'ui',
                                    nodeType: node.type || 'page',
                                    path: relativePath,
                                    urlPath: node.path || '',
                                    children: []
                                };
                                nodeMap.set(node.id, treeNode);

                                if (node.type !== 'start') {
                                    screens.push({
                                        id: node.id,
                                        name: node.name || node.id,
                                        type: node.type || 'page',
                                        url: node.url || ''
                                    });
                                }
                            }

                            // Build tree from edges (parent-child relationships)
                            const childIds = new Set();
                            if (flowData.edges) {
                                for (const edge of flowData.edges) {
                                    const parent = nodeMap.get(edge.from);
                                    const child = nodeMap.get(edge.to);
                                    if (parent && child) {
                                        child.edgeLabel = edge.label || '';
                                        child.edgeActions = edge.actions || 0;
                                        child.edgeApis = edge.apis || 0;
                                        parent.children.push(child);
                                        childIds.add(edge.to);
                                    }
                                }
                                // Sort children by domOrder for proper display sequence
                                for (const [id, node] of nodeMap) {
                                    if (node.children && node.children.length > 0) {
                                        node.children.sort((a, b) => {
                                            const aNode = flowData.nodes.find(n => n.id === a.id);
                                            const bNode = flowData.nodes.find(n => n.id === b.id);
                                            const aDomOrder = aNode?.domOrder ?? Infinity;
                                            const bDomOrder = bNode?.domOrder ?? Infinity;
                                            return aDomOrder - bDomOrder;
                                        });
                                    }
                                }
                            }

                            // Root nodes = nodes not referenced as children
                            // Usually just "start"
                            for (const [id, node] of nodeMap) {
                                if (!childIds.has(id)) {
                                    screenTree.push(node);
                                }
                            }

                            // Clean up empty children arrays
                            const cleanTree = (nodes) => {
                                for (const n of nodes) {
                                    if (n.children.length === 0) delete n.children;
                                    else cleanTree(n.children);
                                }
                            };
                            cleanTree(screenTree);
                        }
                    } catch (e) {
                        console.error(`[Storage] Error reading flow.json for ${item.name}:`, e);
                    }
                }

                const sectionData = {
                    timestamp: item.name,
                    path: sectionPath,
                    size: size,
                    sizeFormatted: this.formatSize(size),
                    screens: screens,
                    screenTree: screenTree,
                    screenCount: screenCount,
                    apiCount: apiCount,
                    history: []
                };

                // Phân loại: Nếu có chứa _replay hoặc _backup thì là phái sinh
                if (item.name.includes('_replay') || item.name.includes('_backup')) {
                    derivatives.push(sectionData);
                } else {
                    sectionMap.set(item.name, sectionData);
                }
            }
        }

        // Ghép derivatives vào section gốc tương ứng
        for (const der of derivatives) {
            // Tìm gốc bằng cách cắt chuỗi trước dấu _ đầu tiên (ví dụ 2026-02-02...Z_replay -> 2026-02-02...Z)
            const rootTimestamp = der.timestamp.split('_')[0];
            if (sectionMap.has(rootTimestamp)) {
                sectionMap.get(rootTimestamp).history.push(der);
            } else {
                // Nếu không tìm thấy gốc (bị xóa), coi như một section độc lập
                sectionMap.set(der.timestamp, der);
            }
        }

        const sections = Array.from(sectionMap.values());

        // Sort by timestamp descending (newest first)
        sections.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        // Sort history inside each section (newest replay first)
        sections.forEach(s => {
            if (s.history) s.history.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        });

        return sections;
    }

    // Create a new section
    async createSection(projectName) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sectionPath = this.getSectionPath(projectName, timestamp);
        await fs.ensureDir(sectionPath);
        return { timestamp, path: sectionPath };
    }

    async deleteSection(projectName, sectionTimestamp) {
        const sectionPath = this.getSectionPath(projectName, sectionTimestamp);
        if (!await pathExistsCached(sectionPath)) {
            throw new Error(`Section "${sectionTimestamp}" does not exist`);
        }
        await fs.remove(sectionPath);
        invalidatePathCacheDir(sectionPath);
        return { deleted: sectionTimestamp };
    }

    async getSectionDetails(projectName, sectionTimestamp) {
        const sectionPath = this.getSectionPath(projectName, sectionTimestamp);
        if (!await pathExistsCached(sectionPath)) {
            throw new Error(`Section "${sectionTimestamp}" does not exist`);
        }

        const screens = [];
        let totalApiRequests = 0;

        // Read flow.json to get screen list
        const flowPath = path.join(sectionPath, 'flow.json');
        let flowData = null;
        if (await pathExistsCached(flowPath)) {
            try {
                flowData = await fs.readJson(flowPath);
            } catch (e) {
                console.error('[Storage] Error reading flow.json:', e);
            }
        }

        // If flow.json exists, use it to get screens
        if (flowData && flowData.nodes) {
            for (const node of flowData.nodes) {
                if (node.type === 'start') continue; // Skip start node

                const relativePath = node.nestedPath || node.id;
                const screenPath = path.join(sectionPath, relativePath);
                if (!await pathExistsCached(screenPath)) continue;

                // Batch check all possible files for this screen
                const metaJsonPath = path.join(screenPath, 'meta.json');
                const screenJsonPath = path.join(screenPath, 'screen.json');
                const previewPath = path.join(screenPath, 'screen.html');
                const apisPath = path.join(screenPath, 'apis.json');
                const actionsPath = path.join(screenPath, 'actions.json');
                const existsMap = await batchPathExists([metaJsonPath, screenJsonPath, previewPath, apisPath, actionsPath]);

                // Load screen metadata
                let metadata = {};
                const metaPath = existsMap.get(metaJsonPath) ? metaJsonPath : (existsMap.get(screenJsonPath) ? screenJsonPath : null);
                if (metaPath) {
                    try { metadata = await fs.readJson(metaPath); } catch (e) { }
                }

                const hasPreview = existsMap.get(previewPath);

                // Load API requests
                let apis = [];
                if (existsMap.get(apisPath)) {
                    try {
                        const apisData = await fs.readJson(apisPath);
                        apis = (apisData || []).map(r => ({
                            method: r.method,
                            path: r.url ? new URL(r.url).pathname : r.path || 'unknown',
                            status: r.status || 200
                        }));
                        totalApiRequests += apis.length;
                    } catch (e) { }
                }

                // Load actions
                let actionsCount = 0;
                if (existsMap.get(actionsPath)) {
                    try {
                        const actionsData = await fs.readJson(actionsPath);
                        actionsCount = (actionsData || []).length;
                    } catch (e) { }
                }

                screens.push({
                    name: node.name || node.id,
                    path: relativePath,
                    type: metadata.type || node.type || 'page',
                    url: metadata.url || node.url || '',
                    hasPreview,
                    apiCount: apis.length,
                    actionsCount,
                    apis
                });
            }
        } else {
            // Fallback: Recursively find all screens (folders with dom.json, screen.html or UI subfolder for old structure)
            const findScreens = async (dir, relativePath = '') => {
                const items = await fs.readdir(dir, { withFileTypes: true });

                for (const item of items) {
                    if (!item.isDirectory()) continue;

                    const itemPath = path.join(dir, item.name);
                    const itemRelPath = relativePath ? `${relativePath}/${item.name}` : item.name;

                    // Check for new compact format (dom.json)
                    const domJsonPath = path.join(itemPath, 'dom.json');
                    const hasCompactFormat = await fs.pathExists(domJsonPath);

                    // Check for unified capture structure (screen.html)
                    const screenHtmlPath = path.join(itemPath, 'screen.html');
                    const hasUnifiedFormat = await fs.pathExists(screenHtmlPath);

                    // Check for old structure (UI subfolder)
                    const uiPath = path.join(itemPath, 'UI');
                    const hasOldStructure = await fs.pathExists(uiPath);

                    if (hasCompactFormat || hasUnifiedFormat) {
                        // New format (compact or unified)
                        let metadata = {};

                        // Try meta.json first, then screen.json
                        let metaPath = path.join(itemPath, 'meta.json');
                        if (!await fs.pathExists(metaPath)) {
                            metaPath = path.join(itemPath, 'screen.json');
                        }
                        if (await fs.pathExists(metaPath)) {
                            try {
                                metadata = await fs.readJson(metaPath);
                            } catch (e) { }
                        }

                        // Check for preview (screen.html)
                        const previewPath = path.join(itemPath, 'screen.html');
                        const hasPreview = await fs.pathExists(previewPath);

                        let apis = [];
                        const apisPath = path.join(itemPath, 'apis.json');
                        if (await fs.pathExists(apisPath)) {
                            try {
                                const apisData = await fs.readJson(apisPath);
                                apis = (apisData || []).map(r => ({
                                    method: r.method,
                                    path: r.url ? new URL(r.url).pathname : r.path || 'unknown',
                                    status: r.status || 200
                                }));
                                totalApiRequests += apis.length;
                            } catch (e) { }
                        }

                        let actionsCount = 0;
                        const actionsPath = path.join(itemPath, 'actions.json');
                        if (await fs.pathExists(actionsPath)) {
                            try {
                                const actionsData = await fs.readJson(actionsPath);
                                actionsCount = (actionsData || []).length;
                            } catch (e) { }
                        }

                        screens.push({
                            name: item.name,
                            path: itemRelPath,
                            type: metadata.type || 'page',
                            url: metadata.url || '',
                            hasPreview,
                            apiCount: apis.length,
                            actionsCount,
                            apis
                        });
                    } else if (hasOldStructure) {
                        // Old structure with UI subfolder
                        const apiPath = path.join(itemPath, 'API');
                        let metadata = {};
                        const metaPath = path.join(itemPath, 'metadata.json');
                        if (await fs.pathExists(metaPath)) {
                            try {
                                metadata = await fs.readJson(metaPath);
                            } catch (e) { }
                        }

                        // Old structure uses screenshot.jpg - check for preview
                        const screenshotPath = path.join(uiPath, 'screenshot.jpg');
                        const hasPreview = await fs.pathExists(screenshotPath);

                        let apis = [];
                        const requestsPath = path.join(apiPath, 'requests.json');
                        if (await fs.pathExists(requestsPath)) {
                            try {
                                const requestsData = await fs.readJson(requestsPath);
                                apis = (requestsData.requests || requestsData || []).map(r => ({
                                    method: r.method,
                                    path: r.url ? new URL(r.url).pathname : r.path || 'unknown',
                                    status: r.response?.status || r.status || 200
                                }));
                                totalApiRequests += apis.length;
                            } catch (e) { }
                        }

                        screens.push({
                            name: item.name,
                            path: itemRelPath,
                            type: metadata.type || 'page',
                            url: metadata.url || '',
                            hasPreview,
                            apiCount: apis.length,
                            actionsCount: 0,
                            apis
                        });
                    } else {
                        // Continue searching in subdirectories
                        await findScreens(itemPath, itemRelPath);
                    }
                }
            };

            await findScreens(sectionPath);
        }

        // Get section size
        const sectionSize = await this.getDirectorySize(sectionPath);

        return {
            timestamp: sectionTimestamp,
            screens,
            totalApiRequests,
            size: sectionSize,
            sizeFormatted: this.formatSize(sectionSize)
        };
    }

    // Rename a section
    async renameSection(projectName, oldTimestamp, newName) {
        // Sanitize new name
        const sanitizedName = newName.replace(/[<>:"/\\|?*]/g, '_').trim();
        if (!sanitizedName) throw new Error('Invalid section name');

        const oldPath = this.getSectionPath(projectName, oldTimestamp);
        const newPath = path.join(this.getSectionsPath(projectName), sanitizedName);

        if (!await fs.pathExists(oldPath)) {
            throw new Error(`Section "${oldTimestamp}" does not exist`);
        }

        if (await fs.pathExists(newPath)) {
            throw new Error(`Section "${sanitizedName}" already exists`);
        }

        await fs.rename(oldPath, newPath);
        return { success: true, newName: sanitizedName };
    }

    // Delete a node (file or directory)
    async deleteNode(projectName, fullPath) {
        const projectPath = this.getProjectPath(projectName);

        // Security check
        if (!fullPath.startsWith(projectPath)) {
            throw new Error('Invalid path: Outside project directory');
        }

        // Remove from disk if exists
        if (await fs.pathExists(fullPath)) {
            await fs.remove(fullPath);
        }

        // Update flow.json: remove deleted node and its edges
        const mainRoot = this.getMainPath(projectName);
        if (fullPath.startsWith(mainRoot)) {
            const nodeId = path.relative(mainRoot, fullPath).replace(/\\/g, '/');
            await this.removeNodeFromFlow(projectName, nodeId);
        }

        return { success: true };
    }

    async removeNodeFromFlow(projectName, nodeId) {
        const flowPath = path.join(this.getProjectPath(projectName), 'flow.json');
        if (!(await fs.pathExists(flowPath))) return;

        try {
            const flow = await fs.readJson(flowPath);

            // Remove the node
            flow.nodes = flow.nodes.filter(node => node.id !== nodeId);

            // Remove edges referencing this node
            if (flow.edges) {
                flow.edges = flow.edges.filter(edge => edge.from !== nodeId && edge.to !== nodeId);
            }

            await fs.writeJson(flowPath, flow, { spaces: 2 });
        } catch (e) {
            console.error('Failed to update flow.json after delete:', e);
        }
    }

    // Move a node: drag A to B → A becomes child of B
    async moveNode(projectName, sourcePath, targetPath) {
        const projectPath = this.getProjectPath(projectName);

        // Security check
        if (!sourcePath.startsWith(projectPath) || !targetPath.startsWith(projectPath)) {
            throw new Error('Invalid path: Outside project directory');
        }

        // Check if moving into itself
        if (targetPath.startsWith(sourcePath + path.sep) || targetPath === sourcePath) {
            throw new Error('Cannot move a folder into itself or its subdirectories');
        }

        const mainRoot = this.getMainPath(projectName);
        const sectionsRoot = this.getSectionsPath(projectName);
        const sourceExists = await fs.pathExists(sourcePath);
        const targetExists = await fs.pathExists(targetPath);

        // Update flow.json edges
        if (sourcePath.startsWith(sectionsRoot) && targetPath.startsWith(sectionsRoot)) {
            // Section tree move — reparent in flow.json
            const sourceRelative = path.relative(sectionsRoot, sourcePath);
            const targetRelative = path.relative(sectionsRoot, targetPath);
            const sectionTimestamp = sourceRelative.split(path.sep)[0];
            const targetSectionTimestamp = targetRelative.split(path.sep)[0];

            if (sectionTimestamp === targetSectionTimestamp) {
                const sectionPath = path.join(sectionsRoot, sectionTimestamp);
                const sourceNodeId = path.basename(sourcePath);
                const targetNodeId = path.basename(targetPath);

                const flowPath = path.join(sectionPath, 'flow.json');
                if (await fs.pathExists(flowPath)) {
                    try {
                        const flow = await fs.readJson(flowPath);

                        // Remove old edge to source, add new edge from target to source
                        const oldEdge = flow.edges.find(e => e.to === sourceNodeId);
                        flow.edges = flow.edges.filter(e => e.to !== sourceNodeId);
                        flow.edges.push({
                            from: targetNodeId,
                            to: sourceNodeId,
                            label: oldEdge?.label || '',
                            actions: oldEdge?.actions || 0,
                            apis: oldEdge?.apis || 0
                        });

                        // Update nestedPath for moved node and all descendants
                        const updateNestedPaths = (nodeId, parentNestedPath) => {
                            const node = flow.nodes.find(n => n.id === nodeId);
                            if (!node) return;
                            node.nestedPath = parentNestedPath + '/' + nodeId;
                            const childEdges = flow.edges.filter(e => e.from === nodeId);
                            for (const ce of childEdges) {
                                updateNestedPaths(ce.to, node.nestedPath);
                            }
                        };

                        const parentNode = flow.nodes.find(n => n.id === targetNodeId);
                        if (parentNode) {
                            updateNestedPaths(sourceNodeId, parentNode.nestedPath || targetNodeId);
                        }

                        await fs.writeJson(flowPath, flow, { spaces: 2 });
                    } catch (e) {
                        console.error('Failed to update section flow.json for move:', e);
                    }
                }
            }
        } else if (sourcePath.startsWith(mainRoot) && targetPath.startsWith(mainRoot)) {
            const sourceId = path.relative(mainRoot, sourcePath).replace(/\\/g, '/');
            const targetId = path.relative(mainRoot, targetPath).replace(/\\/g, '/');
            await this.moveNodeInFlow(projectName, sourceId, targetId);
        }

        // Move folder on disk: source goes INTO target
        if (sourceExists && targetExists) {
            const targetStat = await fs.stat(targetPath);
            if (!targetStat.isDirectory()) {
                throw new Error('Target must be a directory');
            }

            const itemName = path.basename(sourcePath);
            const destinationPath = path.join(targetPath, itemName);

            if (sourcePath === destinationPath) {
                return { success: true };
            }

            if (await fs.pathExists(destinationPath)) {
                throw new Error(`Destination already contains an item named "${itemName}"`);
            }

            await fs.move(sourcePath, destinationPath);
        }

        return { success: true };
    }


    async moveNodeInFlow(projectName, sourceId, targetId) {
        const flowPath = path.join(this.getProjectPath(projectName), 'flow.json');
        if (!(await fs.pathExists(flowPath))) return;

        try {
            const flow = await fs.readJson(flowPath);

            // Remove existing edges where sourceId is a child (edge.to === sourceId)
            const oldEdge = flow.edges.find(e => e.to === sourceId);
            flow.edges = flow.edges.filter(e => e.to !== sourceId);

            // Add new edge from targetId to sourceId
            flow.edges.push({
                from: targetId,
                to: sourceId,
                label: oldEdge?.label || '',
                actions: oldEdge?.actions || 0,
                apis: oldEdge?.apis || 0
            });

            await fs.writeJson(flowPath, flow, { spaces: 2 });
        } catch (e) {
            console.error('Failed to update flow.json for move:', e);
        }
    }

    // Build tree structure from directory
    async buildTree(basePath, currentPath, urlPath = '') {
        const items = [];

        if (!await fs.pathExists(currentPath)) {
            return items;
        }

        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            const newUrlPath = urlPath ? `${urlPath}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
                // Check if this is a UI or API folder (OLD FORMAT)
                if (entry.name === 'UI' || entry.name === 'API') {
                    const size = await this.getDirectorySize(fullPath);
                    items.push({
                        name: entry.name,
                        type: entry.name.toLowerCase(),
                        path: fullPath,
                        urlPath: urlPath,
                        size: size,
                        sizeFormatted: this.formatSize(size)
                    });
                } else {
                    // Check if this is a NEW FORMAT screen folder (has dom.json, screen.html, or apis.json)
                    const hasDomJson = await fs.pathExists(path.join(fullPath, 'dom.json'));
                    const hasScreenHtml = await fs.pathExists(path.join(fullPath, 'screen.html'));
                    const hasApisJson = await fs.pathExists(path.join(fullPath, 'apis.json'));

                    if (hasDomJson || hasScreenHtml || hasApisJson) {
                        // This is a unified capture screen folder
                        const size = await this.getDirectorySize(fullPath);
                        items.push({
                            name: entry.name,
                            type: 'screen', // New type for unified format screens
                            path: fullPath,
                            urlPath: newUrlPath,
                            size: size,
                            sizeFormatted: this.formatSize(size),
                            hasUI: hasDomJson || hasScreenHtml,
                            hasAPI: hasApisJson
                        });
                    } else {
                        // It's a URL path segment (folder)
                        const children = await this.buildTree(basePath, fullPath, newUrlPath);
                        if (children.length > 0) {
                            items.push({
                                name: entry.name,
                                type: 'folder',
                                path: fullPath,
                                urlPath: newUrlPath,
                                children: children
                            });
                        }
                    }
                }
            }
        }

        // Sort items: screens/UI/API first, then folders
        items.sort((a, b) => {
            const isAssetA = a.type === 'ui' || a.type === 'api' || a.type === 'screen';
            const isAssetB = b.type === 'ui' || b.type === 'api' || b.type === 'screen';

            if (isAssetA && !isAssetB) return -1;
            if (!isAssetA && isAssetB) return 1;
            return a.name.localeCompare(b.name);
        });

        return items;
    }

    // Save UI snapshot
    async saveUISnapshot(projectName, urlPath, snapshotData, stylesData, isMain = false) {
        const basePath = isMain ? this.getMainPath(projectName) : null;
        const uiPath = path.join(basePath || '', this.urlToPath(urlPath), 'UI');

        await fs.ensureDir(uiPath);
        await fs.writeJson(path.join(uiPath, 'snapshot.json'), snapshotData, { spaces: 2 });

        if (stylesData) {
            await fs.writeFile(path.join(uiPath, 'styles.css'), stylesData);
        }

        return { path: uiPath };
    }

    // Save API requests
    async saveAPIRequests(projectName, urlPath, requestsData, isMain = false) {
        const basePath = isMain ? this.getMainPath(projectName) : null;
        const apiPath = path.join(basePath || '', this.urlToPath(urlPath), 'API');

        await fs.ensureDir(apiPath);
        await fs.writeJson(path.join(apiPath, 'requests.json'), requestsData, { spaces: 2 });

        return { path: apiPath };
    }

    async saveToSection(projectName, sectionTimestamp, urlPath, data) {
        const sectionPath = this.getSectionPath(projectName, sectionTimestamp);
        const pagePath = path.join(sectionPath, this.urlToPath(urlPath));
        let uiPath = null;

        const writes = [];

        // Prepare UI data
        if (data.ui) {
            uiPath = path.join(pagePath, 'UI');
            await fs.ensureDir(uiPath);
            writes.push({ path: path.join(uiPath, 'snapshot.json'), data: data.ui.snapshot, options: { spaces: 2 } });
            if (data.ui.styles) {
                writes.push({ path: path.join(uiPath, 'styles.css'), data: data.ui.styles });
            }
        }

        // Prepare API data
        if (data.api && data.api.length > 0) {
            const apiPath = path.join(pagePath, 'API');
            await fs.ensureDir(apiPath);
            writes.push({ path: path.join(apiPath, 'requests.json'), data: data.api, options: { spaces: 2 } });
        }

        // Prepare metadata
        writes.push({
            path: path.join(pagePath, 'metadata.json'),
            data: {
                url: data.url,
                fullUrl: data.fullUrl,
                captureId: data.captureId,
                capturedAt: data.capturedAt,
                type: data.type,
                activeTab: data.activeTab,
                breadcrumb: data.breadcrumb,
                apiCount: data.api ? data.api.length : 0,
                modalCount: data.modals ? data.modals.length : 0
            },
            options: { spaces: 2 }
        });

        // Write all files in parallel
        await batchWrite(writes);

        return { path: pagePath, uiPath: uiPath };
    }

    // Save data to section with pre-built path (path already includes query, tab, modal info)
    async saveToSectionWithPath(projectName, sectionTimestamp, fullPath, data) {
        const sectionPath = this.getSectionPath(projectName, sectionTimestamp);
        const pagePath = path.join(sectionPath, fullPath);
        let uiPath = null;

        const writes = [];

        // Prepare UI data
        if (data.ui) {
            uiPath = path.join(pagePath, 'UI');
            await fs.ensureDir(uiPath);
            writes.push({ path: path.join(uiPath, 'snapshot.json'), data: data.ui.snapshot, options: { spaces: 2 } });
            if (data.ui.styles) {
                writes.push({ path: path.join(uiPath, 'styles.css'), data: data.ui.styles });
            }
        }

        // Prepare API data
        if (data.api && data.api.length > 0) {
            const apiPath = path.join(pagePath, 'API');
            await fs.ensureDir(apiPath);
            writes.push({ path: path.join(apiPath, 'requests.json'), data: data.api, options: { spaces: 2 } });
        }

        // Prepare modals
        if (data.modals && data.modals.length > 0) {
            for (let i = 0; i < data.modals.length; i++) {
                const modal = data.modals[i];
                const modalPath = path.join(pagePath, 'modals', `modal_${i + 1}`);
                await fs.ensureDir(modalPath);
                writes.push({
                    path: path.join(modalPath, 'modal.json'),
                    data: { title: modal.title, selector: modal.selector, html: modal.html },
                    options: { spaces: 2 }
                });
            }
        }

        // Prepare metadata
        writes.push({
            path: path.join(pagePath, 'metadata.json'),
            data: {
                url: data.url, fullUrl: data.fullUrl,
                captureId: data.captureId, capturedAt: data.capturedAt,
                type: data.type, activeTab: data.activeTab,
                breadcrumb: data.breadcrumb,
                apiCount: data.api ? data.api.length : 0,
                modalCount: data.modals ? data.modals.length : 0
            },
            options: { spaces: 2 }
        });

        // Write all files in parallel
        await batchWrite(writes);

        console.log(`   💾 Saved to: ${fullPath}`);

        return { path: pagePath, uiPath: uiPath };
    }

    // Load UI snapshot (optimized with batch pathExists)
    async loadUISnapshot(snapshotPath) {
        const snapshotFile = path.join(snapshotPath, 'snapshot.json');
        const stylesFile = path.join(snapshotPath, 'styles.css');
        const screenHtmlFile = path.join(snapshotPath, 'screen.html');
        const domJsonFile = path.join(snapshotPath, 'dom.json');
        const metaFile = path.join(snapshotPath, 'meta.json');

        // Check all paths in parallel (5 checks → 1 round-trip)
        const existsMap = await batchPathExists([snapshotFile, stylesFile, screenHtmlFile, domJsonFile, metaFile]);

        const result = { snapshot: null, styles: null };

        // Try old format first (snapshot.json + styles.css)
        if (existsMap.get(snapshotFile)) {
            result.snapshot = await fs.readJson(snapshotFile);
        }

        if (existsMap.get(stylesFile)) {
            result.styles = await fs.readFile(stylesFile, 'utf-8');
        }

        // If old format not found, try new format (screen.html + dom.json)
        if (!result.snapshot && existsMap.get(screenHtmlFile)) {
            const html = await fs.readFile(screenHtmlFile, 'utf-8');
            let domTree = null;
            let metadata = {};

            if (existsMap.get(domJsonFile)) {
                domTree = await fs.readJson(domJsonFile);
            }

            if (existsMap.get(metaFile)) {
                metadata = await fs.readJson(metaFile);
            }

            result.snapshot = {
                html,
                dom: domTree,
                url: metadata.url || '',
                timestamp: metadata.timestamp || new Date().toISOString(),
                viewport: metadata.viewport || { width: 1920, height: 1080 }
            };

            result.styles = '';
        }

        return result;
    }

    // Load API requests
    async loadAPIRequests(apiPath) {
        const requestsFile = path.join(apiPath, 'requests.json');

        if (await fs.pathExists(requestsFile)) {
            return await fs.readJson(requestsFile);
        }

        return [];
    }

    // Get and save auth data
    async getAuth(projectName) {
        const authPath = this.getAuthPath(projectName);
        if (await fs.pathExists(authPath)) {
            return await fs.readJson(authPath);
        }
        return { cookies: [], localStorage: {}, sessionStorage: {} };
    }

    async saveAuth(projectName, authData) {
        const authPath = this.getAuthPath(projectName);
        await fs.writeJson(authPath, authData, { spaces: 2 });
        return { saved: true };
    }

    // Convert URL to file path (ignores query params for base folder)
    urlToPath(url) {
        // Remove protocol and domain
        let urlPath = url.replace(/^https?:\/\/[^\/]+/, '');

        // Split path and query - we only care about the path part for the folder
        const [pathPart] = urlPath.split('?');

        // Clean path part
        let cleanPath = pathPart.replace(/^\/+|\/+$/g, '');
        cleanPath = cleanPath.replace(/\//g, path.sep);

        // Handle empty path (root)
        if (!cleanPath) {
            cleanPath = 'home';
        }

        return cleanPath;
    }

    // Get directory size recursively
    async getDirectorySize(dirPath) {
        let size = 0;

        if (!await fs.pathExists(dirPath)) {
            return size;
        }

        const items = await fs.readdir(dirPath, { withFileTypes: true });

        for (const item of items) {
            const itemPath = path.join(dirPath, item.name);
            if (item.isDirectory()) {
                size += await this.getDirectorySize(itemPath);
            } else {
                const stats = await fs.stat(itemPath);
                size += stats.size;
            }
        }

        return size;
    }

    // Format size to human readable
    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Get URL history
    async getUrlHistory(projectName) {
        if (!projectName) return [];
        const historyPath = path.join(this.getProjectPath(projectName), 'url_history.json');
        if (await fs.pathExists(historyPath)) {
            return await fs.readJson(historyPath);
        }
        return [];
    }

    // Save URL to history (keep last 10)
    async saveUrlToHistory(projectName, url) {
        if (!projectName || !url || typeof url !== 'string') return;
        const historyPath = path.join(this.getProjectPath(projectName), 'url_history.json');
        let history = await this.getUrlHistory(projectName);

        // Remove if already exists and add to top
        history = [url, ...history.filter(u => u !== url)].slice(0, 10);

        await fs.writeJson(historyPath, history, { spaces: 2 });
        return history;
    }

    // Save Flow Connection
    async saveFlow(projectName, flowData) {
        const flowPath = path.join(this.getProjectPath(projectName), 'flow.json');
        let flow = { nodes: [], edges: [] };

        if (await fs.pathExists(flowPath)) {
            try {
                flow = await fs.readJson(flowPath);
            } catch (e) { }
        }

        // Add Nodes (Source and Target) if distinct and not existing
        if (!flow.nodes.includes(flowData.source)) flow.nodes.push(flowData.source);
        if (!flow.nodes.includes(flowData.target)) flow.nodes.push(flowData.target);

        // Add Edge
        // Only if it's a real transition (not self-refresh, unless interaction is meaningful)
        if (flowData.source !== flowData.target || flowData.interaction) {
            flow.edges.push({
                source: flowData.source,
                target: flowData.target,
                interaction: flowData.interaction,
                timestamp: new Date().toISOString()
            });
        }

        await fs.writeJson(flowPath, flow, { spaces: 2 });
    }

    // Save Flow Node Positions
    async saveFlowPositions(projectName, positions) {
        const flowPath = path.join(this.getProjectPath(projectName), 'flow.json');
        let flow = { nodes: [], edges: [], positions: {} };

        if (await fs.pathExists(flowPath)) {
            try {
                flow = await fs.readJson(flowPath);
            } catch (e) { }
        }

        flow.positions = {
            ...(flow.positions || {}),
            ...positions
        };

        await fs.writeJson(flowPath, flow, { spaces: 2 });
        await fs.writeJson(flowPath, flow, { spaces: 2 });
        return flow.positions;
    }

    // Reset Flow Node Positions
    async resetFlowPositions(projectName) {
        const flowPath = path.join(this.getProjectPath(projectName), 'flow.json');

        if (await fs.pathExists(flowPath)) {
            try {
                const flow = await fs.readJson(flowPath);
                flow.positions = {}; // Clear all positions
                await fs.writeJson(flowPath, flow, { spaces: 2 });
            } catch (e) {
                console.error('Failed to reset flow positions', e);
            }
        }
        return { success: true };
    }

    // Get Flow Data
    async getFlow(projectName) {
        const flowPath = path.join(this.getProjectPath(projectName), 'flow.json');
        if (await fs.pathExists(flowPath)) {
            return await fs.readJson(flowPath);
        }
        return { nodes: [], edges: [] };
    }

    // Overwrite Section Flow (for full updates from capture)
    async overwriteSectionFlow(projectName, sectionTimestamp, fullFlowData) {
        const sectionPath = this.getSectionPath(projectName, sectionTimestamp);
        const flowPath = path.join(sectionPath, 'section_flow.json');

        // Ensure directory exists
        await fs.ensureDir(sectionPath);

        await fs.writeJson(flowPath, fullFlowData, { spaces: 2 });
    }

    // Save Section-specific Flow (Incremental)
    async saveSectionFlow(projectName, sectionTimestamp, flowData) {
        const sectionPath = this.getSectionPath(projectName, sectionTimestamp);
        const flowPath = path.join(sectionPath, 'section_flow.json');

        let flow = { nodes: [], edges: [], captureOrder: [] };

        if (await fs.pathExists(flowPath)) {
            try {
                flow = await fs.readJson(flowPath);
            } catch (e) { }
        }

        // Add Nodes
        if (!flow.nodes.includes(flowData.source)) flow.nodes.push(flowData.source);
        if (!flow.nodes.includes(flowData.target)) flow.nodes.push(flowData.target);

        // Add Edge with order index
        const edgeIndex = flow.edges.length;
        if (flowData.source !== flowData.target || flowData.interaction) {
            flow.edges.push({
                source: flowData.source,
                target: flowData.target,
                interaction: flowData.interaction,
                timestamp: new Date().toISOString(),
                order: edgeIndex
            });
        }

        // Track capture order for replay sequence
        if (!flow.captureOrder.includes(flowData.target)) {
            flow.captureOrder.push(flowData.target);
        }

        await fs.writeJson(flowPath, flow, { spaces: 2 });
    }

    // Get Section-specific Flow
    async getSectionFlow(projectName, sectionTimestamp) {
        const sectionPath = this.getSectionPath(projectName, sectionTimestamp);
        // Check section_flow.json first (legacy), then flow.json (current capture)
        const sectionFlowPath = path.join(sectionPath, 'section_flow.json');
        if (await fs.pathExists(sectionFlowPath)) {
            return await fs.readJson(sectionFlowPath);
        }
        const flowPath = path.join(sectionPath, 'flow.json');
        if (await fs.pathExists(flowPath)) {
            return await fs.readJson(flowPath);
        }
        return null;
    }

    // ============================================
    // PROJECT CONFIG MANAGEMENT
    // ============================================

    getProjectConfigPath(projectName) {
        return path.join(this.getProjectPath(projectName), 'project_config.json');
    }

    async getProjectConfig(projectName) {
        const configPath = this.getProjectConfigPath(projectName);
        const defaultConfig = {
            loginConfig: {
                entryPoint: 'login',
                loginUrl: '/login',
                successIndicator: { type: 'url', value: '/' },
                authTokenKey: 'token',
                skipInReplay: true
            },
            authPages: ['login', 'signin', 'auth', 'forget-password', 'register'],
            protectedPages: [],
            startPage: 'home'
        };

        if (await fs.pathExists(configPath)) {
            try {
                const config = await fs.readJson(configPath);
                return { ...defaultConfig, ...config };
            } catch (e) {
                return defaultConfig;
            }
        }
        return defaultConfig;
    }

    async saveProjectConfig(projectName, config) {
        const configPath = this.getProjectConfigPath(projectName);
        await fs.writeJson(configPath, config, { spaces: 2 });
        return { success: true };
    }

    async updateProjectConfig(projectName, updates) {
        const currentConfig = await this.getProjectConfig(projectName);
        const newConfig = { ...currentConfig, ...updates };
        await this.saveProjectConfig(projectName, newConfig);
        return newConfig;
    }

    // Check if a page path is an auth/login page
    async isAuthPage(projectName, pagePath) {
        const config = await this.getProjectConfig(projectName);
        const normalizedPath = pagePath.replace(/\\/g, '/').toLowerCase();

        return config.authPages.some(authPage =>
            normalizedPath === authPage.toLowerCase() ||
            normalizedPath.includes(`/${authPage.toLowerCase()}`) ||
            normalizedPath.startsWith(authPage.toLowerCase())
        );
    }
}

module.exports = new StorageService();
