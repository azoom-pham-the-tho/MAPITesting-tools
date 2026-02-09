const express = require('express');
const router = express.Router();
const storageService = require('../services/storage.service');

// List all projects
router.get('/', async (req, res, next) => {
    try {
        const projects = await storageService.listProjects();
        res.json({ success: true, projects });
    } catch (error) {
        next(error);
    }
});

// Create a new project
router.post('/', async (req, res, next) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        // Sanitize project name
        const sanitizedName = name.replace(/[<>:"/\\|?*]/g, '_').trim();

        if (!sanitizedName) {
            return res.status(400).json({ error: 'Invalid project name' });
        }

        const project = await storageService.createProject(sanitizedName);
        res.json({ success: true, project });
    } catch (error) {
        next(error);
    }
});

// Get project details
router.get('/:name', async (req, res, next) => {
    try {
        const { name } = req.params;
        const mainTree = await storageService.getMainTree(name);
        const sections = await storageService.listSections(name);
        const auth = await storageService.getAuth(name);

        res.json({
            success: true,
            project: {
                name,
                mainTree,
                sections,
                hasAuth: auth.cookies?.length > 0 || Object.keys(auth.localStorage || {}).length > 0
            }
        });
    } catch (error) {
        next(error);
    }
});

// Delete a project
router.delete('/:name', async (req, res, next) => {
    try {
        const { name } = req.params;
        await storageService.deleteProject(name);
        res.json({ success: true, deleted: name });
    } catch (error) {
        next(error);
    }
});

// Get main data tree
router.get('/:name/main', async (req, res, next) => {
    try {
        const { name } = req.params;
        const tree = await storageService.getMainTree(name);
        res.json({ success: true, tree });
    } catch (error) {
        next(error);
    }
});

// List sections
router.get('/:name/sections', async (req, res, next) => {
    try {
        const { name } = req.params;
        const sections = await storageService.listSections(name);
        res.json({ success: true, sections });
    } catch (error) {
        next(error);
    }
});

// Rename a section
router.put('/:name/sections/:timestamp/rename', async (req, res, next) => {
    try {
        const { name, timestamp } = req.params;
        const { newName } = req.body;

        if (!newName) {
            return res.status(400).json({ error: 'New name is required' });
        }

        const result = await storageService.renameSection(name, timestamp, newName);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
});

// Delete a section
router.delete('/:name/sections/:timestamp', async (req, res, next) => {
    try {
        const { name, timestamp } = req.params;
        await storageService.deleteSection(name, timestamp);
        res.json({ success: true, deleted: timestamp });
    } catch (error) {
        next(error);
    }
});

// Get section details (screens and APIs)
router.get('/:name/sections/:timestamp/details', async (req, res, next) => {
    try {
        const { name, timestamp } = req.params;
        const details = await storageService.getSectionDetails(name, timestamp);
        res.json({ success: true, details });
    } catch (error) {
        next(error);
    }
});

// Get UI snapshot data
router.get('/:name/snapshot', async (req, res, next) => {
    try {
        const { name } = req.params;
        const { path: snapshotPath, type } = req.query;

        console.log('[GET /snapshot] Params:', { name, snapshotPath, type });

        if (!snapshotPath) {
            return res.status(400).json({ error: 'Path is required' });
        }

        const data = await storageService.loadUISnapshot(snapshotPath);
        console.log('[GET /snapshot] Data loaded:', { hasSnapshot: !!data.snapshot, hasStyles: !!data.styles });

        res.json({ success: true, data });
    } catch (error) {
        console.error('[GET /snapshot] Error:', error);
        next(error);
    }
});

// Get API requests data
router.get('/:name/api-requests', async (req, res, next) => {
    try {
        const { name } = req.params;
        const { path: apiPath } = req.query;

        if (!apiPath) {
            return res.status(400).json({ error: 'Path is required' });
        }

        const requests = await storageService.loadAPIRequests(apiPath);
        res.json({ success: true, requests });
    } catch (error) {
        next(error);
    }
});

// Get project storage size
router.get('/:name/size', async (req, res, next) => {
    try {
        const { name } = req.params;
        const projectPath = storageService.getProjectPath(name);
        const mainPath = storageService.getMainPath(name);
        const sectionsPath = storageService.getSectionsPath(name);

        const totalSize = await storageService.getDirectorySize(projectPath);
        const mainSize = await storageService.getDirectorySize(mainPath);
        const sectionsSize = await storageService.getDirectorySize(sectionsPath);

        res.json({
            success: true,
            size: {
                total: storageService.formatSize(totalSize),
                main: storageService.formatSize(mainSize),
                sections: storageService.formatSize(sectionsSize)
            }
        });
    } catch (error) {
        next(error);
    }
});

// Get flow data
router.get('/:name/flow', async (req, res, next) => {
    try {
        const { name } = req.params;
        const flow = await storageService.getFlow(name);
        res.json({ success: true, flow });
    } catch (error) {
        next(error);
    }
});

// Save flow positions
router.post('/:name/flow/positions', async (req, res, next) => {
    try {
        const { name } = req.params;
        const { positions } = req.body;

        if (!positions) {
            return res.status(400).json({ error: 'Positions required' });
        }

        await storageService.saveFlowPositions(name, positions);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Reset flow positions
router.delete('/:name/flow/positions', async (req, res, next) => {
    try {
        const { name } = req.params;
        await storageService.resetFlowPositions(name);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Delete a node (file or directory)
router.delete('/:name/node', async (req, res, next) => {
    try {
        const { name } = req.params;
        const { path: nodePath } = req.body;

        if (!nodePath) {
            return res.status(400).json({ error: 'Path is required' });
        }

        await storageService.deleteNode(name, nodePath);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Move a node (file or directory)
router.put('/:name/node/move', async (req, res, next) => {
    try {
        const { name } = req.params;
        let { sourcePath, targetPath, sectionTimestamp } = req.body;

        if (!sourcePath || !targetPath) {
            return res.status(400).json({ error: 'Source and target paths are required' });
        }

        // If sectionTimestamp is provided, resolve relative paths to absolute
        if (sectionTimestamp) {
            const sectionPath = storageService.getSectionPath(name, sectionTimestamp);
            // If paths don't look absolute, prepend sectionPath
            if (!sourcePath.startsWith('/')) {
                sourcePath = require('path').join(sectionPath, sourcePath);
            }
            if (!targetPath.startsWith('/')) {
                targetPath = require('path').join(sectionPath, targetPath);
            }
        }

        await storageService.moveNode(name, sourcePath, targetPath);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// ============================================
// PROJECT CONFIG (Login, Auth settings)
// ============================================

// Get project config
router.get('/:name/config', async (req, res, next) => {
    try {
        const { name } = req.params;
        const config = await storageService.getProjectConfig(name);
        res.json({ success: true, config });
    } catch (error) {
        next(error);
    }
});

// Save project config
router.put('/:name/config', async (req, res, next) => {
    try {
        const { name } = req.params;
        const config = req.body;
        await storageService.saveProjectConfig(name, config);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Update partial project config
router.patch('/:name/config', async (req, res, next) => {
    try {
        const { name } = req.params;
        const updates = req.body;
        await storageService.updateProjectConfig(name, updates);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// Add auth page to config
router.post('/:name/config/auth-pages', async (req, res, next) => {
    try {
        const { name } = req.params;
        const { pagePath } = req.body;

        if (!pagePath) {
            return res.status(400).json({ error: 'pagePath is required' });
        }

        const config = await storageService.getProjectConfig(name);
        if (!config.authPages.includes(pagePath)) {
            config.authPages.push(pagePath);
            await storageService.saveProjectConfig(name, config);
        }

        res.json({ success: true, authPages: config.authPages });
    } catch (error) {
        next(error);
    }
});

// Remove auth page from config
router.delete('/:name/config/auth-pages', async (req, res, next) => {
    try {
        const { name } = req.params;
        const { pagePath } = req.body;

        const config = await storageService.getProjectConfig(name);
        config.authPages = config.authPages.filter(p => p !== pagePath);
        await storageService.saveProjectConfig(name, config);

        res.json({ success: true, authPages: config.authPages });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
