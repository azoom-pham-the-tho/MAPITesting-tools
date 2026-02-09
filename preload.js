/**
 * Electron Preload Script
 * Provides secure bridge between renderer and main process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // Platform info
    platform: process.platform,
    isElectron: true,
    
    // App info
    getVersion: () => ipcRenderer.invoke('get-version'),
    
    // Storage info
    getStoragePath: () => ipcRenderer.invoke('get-storage-path'),
});

// Log that preload ran
console.log('🔌 Electron preload script loaded');
