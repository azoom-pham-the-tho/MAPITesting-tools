/**
 * Electron Main Process
 * UI & API Reconstruction Testing Tool
 */

const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

// Keep global reference to prevent garbage collection
let mainWindow;
let expressApp;
let server;

const PORT = 8888;
const APP_NAME = 'MAPI-Testing-Tool';

/**
 * Get user data path for storage - in Documents folder for easy access
 * - macOS: ~/Documents/MAPI-Testing-Tool/
 * - Windows: C:\Users\{user}\Documents\MAPI-Testing-Tool\
 * - Linux: ~/Documents/MAPI-Testing-Tool/
 */
function getStoragePath() {
    return path.join(os.homedir(), 'Documents', APP_NAME);
}

/**
 * Initialize storage directory
 */
async function initStorage() {
    const storagePath = getStoragePath();
    await fs.ensureDir(storagePath);
    console.log(`📁 Storage path: ${storagePath}`);
    
    // Set global storage path for other modules
    global.STORAGE_PATH = storagePath;
    
    return storagePath;
}

/**
 * Start Express server
 */
async function startServer() {
    return new Promise((resolve, reject) => {
        try {
            // Set storage path before requiring server
            process.env.STORAGE_PATH = getStoragePath();
            
            expressApp = require('./server');
            
            // Check if server is already listening (from server.js)
            // If so, just resolve
            if (expressApp.listening) {
                resolve();
                return;
            }
            
            // Server is already started in server.js, just wait a bit
            setTimeout(() => {
                console.log(`✅ Server ready at http://localhost:${PORT}`);
                resolve();
            }, 500);
            
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Create main application window
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        title: 'UI & API Testing Tool',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            spellcheck: false
        },
        backgroundColor: '#1a1a2e',
        show: false, // Show after ready-to-show
    });

    // Load the app
    mainWindow.loadURL(`http://localhost:${PORT}`);

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    // Open DevTools in dev mode
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://localhost')) {
            return { action: 'allow' };
        }
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Handle window close
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/**
 * Create application menu
 */
function createMenu() {
    const isMac = process.platform === 'darwin';
    
    const template = [
        // App menu (macOS only)
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        
        // File menu
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Storage Folder',
                    accelerator: 'CmdOrCtrl+Shift+S',
                    click: () => {
                        shell.openPath(getStoragePath());
                    }
                },
                { type: 'separator' },
                {
                    label: 'Import Project...',
                    accelerator: 'CmdOrCtrl+I',
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            title: 'Import Project Folder',
                            properties: ['openDirectory'],
                            message: 'Select a project folder to import'
                        });
                        
                        if (!result.canceled && result.filePaths.length > 0) {
                            const sourcePath = result.filePaths[0];
                            const projectName = path.basename(sourcePath);
                            const destPath = path.join(getStoragePath(), projectName);
                            
                            // Check if exists
                            if (await fs.pathExists(destPath)) {
                                const overwrite = await dialog.showMessageBox(mainWindow, {
                                    type: 'question',
                                    buttons: ['Cancel', 'Overwrite'],
                                    title: 'Project Exists',
                                    message: `Project "${projectName}" already exists.`,
                                    detail: 'Do you want to overwrite it?'
                                });
                                if (overwrite.response === 0) return;
                                await fs.remove(destPath);
                            }
                            
                            await fs.copy(sourcePath, destPath);
                            await dialog.showMessageBox(mainWindow, {
                                type: 'info',
                                title: 'Import Success',
                                message: `Project "${projectName}" imported successfully!`
                            });
                            mainWindow.reload();
                        }
                    }
                },
                {
                    label: 'Export Project...',
                    accelerator: 'CmdOrCtrl+E',
                    click: async () => {
                        // List projects
                        const storagePath = getStoragePath();
                        const items = await fs.readdir(storagePath, { withFileTypes: true });
                        const projects = items.filter(i => i.isDirectory()).map(i => i.name);
                        
                        if (projects.length === 0) {
                            await dialog.showMessageBox(mainWindow, {
                                type: 'info',
                                title: 'No Projects',
                                message: 'No projects to export.'
                            });
                            return;
                        }
                        
                        // Select destination
                        const result = await dialog.showOpenDialog(mainWindow, {
                            title: 'Select Export Destination',
                            properties: ['openDirectory', 'createDirectory'],
                            message: 'Choose where to export projects'
                        });
                        
                        if (!result.canceled && result.filePaths.length > 0) {
                            const destDir = result.filePaths[0];
                            
                            // Export all projects
                            for (const project of projects) {
                                const src = path.join(storagePath, project);
                                const dest = path.join(destDir, project);
                                await fs.copy(src, dest);
                            }
                            
                            await dialog.showMessageBox(mainWindow, {
                                type: 'info',
                                title: 'Export Success',
                                message: `Exported ${projects.length} project(s) to:\n${destDir}`
                            });
                            shell.openPath(destDir);
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Clear All Data...',
                    click: async () => {
                        const result = await dialog.showMessageBox(mainWindow, {
                            type: 'warning',
                            buttons: ['Cancel', 'Clear All'],
                            defaultId: 0,
                            cancelId: 0,
                            title: 'Clear All Data',
                            message: 'Are you sure you want to clear all project data?',
                            detail: 'This action cannot be undone.'
                        });
                        
                        if (result.response === 1) {
                            const storagePath = getStoragePath();
                            await fs.emptyDir(storagePath);
                            mainWindow.reload();
                        }
                    }
                },
                { type: 'separator' },
                isMac ? { role: 'close' } : { role: 'quit' }
            ]
        },
        
        // Edit menu
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        
        // View menu
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        
        // Window menu
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac ? [
                    { type: 'separator' },
                    { role: 'front' }
                ] : [
                    { role: 'close' }
                ])
            ]
        },
        
        // Help menu
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Storage Location',
                    click: async () => {
                        await dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Storage Location',
                            message: 'Project data is stored at:',
                            detail: getStoragePath()
                        });
                    }
                },
                {
                    label: 'View Logs',
                    click: () => {
                        mainWindow.webContents.openDevTools();
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

/**
 * App ready handler
 */
app.whenReady().then(async () => {
    try {
        // Initialize storage first
        await initStorage();
        
        // Start Express server
        await startServer();
        
        // Create menu
        createMenu();
        
        // Create window
        createWindow();
        
        // macOS: Re-create window on dock click
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
        
    } catch (error) {
        console.error('Failed to start app:', error);
        dialog.showErrorBox('Startup Error', error.message);
        app.quit();
    }
});

/**
 * Quit when all windows are closed (except macOS)
 */
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

/**
 * Cleanup before quit
 */
app.on('before-quit', () => {
    if (server) {
        server.close();
    }
});

/**
 * Handle certificate errors (for localhost)
 */
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    if (url.startsWith('http://localhost')) {
        event.preventDefault();
        callback(true);
    } else {
        callback(false);
    }
});
