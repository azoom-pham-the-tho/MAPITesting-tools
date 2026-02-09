const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { execSync } = require('child_process');
const crypto = require('crypto');
const http = require('http');
const storageService = require('./storage.service');

class ShareService {
    constructor() {
        // In-memory share store: token -> { projectName, type, sectionId, createdAt }
        this.shares = new Map();
    }

    // Get local network info (IPs + WiFi SSID)
    getNetworkInfo() {
        const interfaces = os.networkInterfaces();
        const addresses = [];

        for (const [name, nets] of Object.entries(interfaces)) {
            for (const net of nets) {
                // Skip internal and IPv6
                if (net.internal || net.family !== 'IPv4') continue;
                addresses.push({
                    interface: name,
                    ip: net.address
                });
            }
        }

        // Get WiFi SSID (macOS)
        let ssid = null;
        try {
            if (process.platform === 'darwin') {
                const result = execSync(
                    'networksetup -getairportnetwork en0 2>/dev/null || networksetup -getairportnetwork en1 2>/dev/null',
                    { encoding: 'utf8', timeout: 3000 }
                ).trim();
                const match = result.match(/Current Wi-Fi Network:\s*(.+)/);
                if (match) ssid = match[1].trim();
            } else if (process.platform === 'win32') {
                const result = execSync('netsh wlan show interfaces', { encoding: 'utf8', timeout: 3000 });
                const match = result.match(/SSID\s*:\s*(.+)/);
                if (match) ssid = match[1].trim();
            } else {
                const result = execSync('iwgetid -r 2>/dev/null || nmcli -t -f active,ssid dev wifi | grep yes', { encoding: 'utf8', timeout: 3000 });
                ssid = result.trim().replace('yes:', '');
            }
        } catch (e) {
            // Could not get SSID
        }

        return { addresses, ssid, port: 8888 };
    }

    // Create a share entry
    async createShare(projectName, type, sectionId = null) {
        // Validate the path exists
        let sharePath;
        if (type === 'main') {
            sharePath = storageService.getMainPath(projectName);
        } else if (type === 'section' && sectionId) {
            sharePath = storageService.getSectionPath(projectName, sectionId);
        } else {
            throw new Error('Invalid share type. Use "main" or "section" with sectionId.');
        }

        if (!await fs.pathExists(sharePath)) {
            throw new Error('Data not found');
        }

        // Generate token
        const token = crypto.randomBytes(6).toString('hex');

        this.shares.set(token, {
            projectName,
            type,
            sectionId,
            sharePath,
            createdAt: new Date().toISOString()
        });

        return { token };
    }

    // Get share info by token
    getShare(token) {
        return this.shares.get(token) || null;
    }

    // List active shares
    listShares() {
        const list = [];
        for (const [token, info] of this.shares) {
            list.push({ token, ...info });
        }
        return list;
    }

    // Remove a share
    removeShare(token) {
        return this.shares.delete(token);
    }

    // List files in the shared directory
    async listShareFiles(token) {
        const share = this.shares.get(token);
        if (!share) return null;

        const files = [];
        await this._walkDir(share.sharePath, share.sharePath, files);
        return {
            projectName: share.projectName,
            type: share.type,
            sectionId: share.sectionId,
            files
        };
    }

    async _walkDir(basePath, currentPath, files) {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            const relativePath = path.relative(basePath, fullPath);
            if (entry.isDirectory()) {
                files.push({ name: relativePath, type: 'directory' });
                await this._walkDir(basePath, fullPath, files);
            } else {
                const stat = await fs.stat(fullPath);
                files.push({
                    name: relativePath,
                    type: 'file',
                    size: stat.size
                });
            }
        }
    }

    // Create a zip of the shared data and return the path
    async createZip(token) {
        const share = this.shares.get(token);
        if (!share) return null;

        const zipName = `${share.projectName}_${share.type}${share.sectionId ? '_' + share.sectionId.replace(/[:.]/g, '-') : ''}.zip`;
        const tmpDir = path.join(os.tmpdir(), 'mapit-shares');
        await fs.ensureDir(tmpDir);
        const zipPath = path.join(tmpDir, zipName);

        // Remove old zip if exists
        await fs.remove(zipPath);

        // Use system zip command
        try {
            execSync(`cd "${share.sharePath}" && zip -r "${zipPath}" . -x ".*"`, {
                timeout: 60000,
                stdio: 'pipe'
            });
        } catch (e) {
            // Fallback: try tar
            try {
                const tarPath = zipPath.replace('.zip', '.tar.gz');
                execSync(`tar -czf "${tarPath}" -C "${share.sharePath}" .`, {
                    timeout: 60000,
                    stdio: 'pipe'
                });
                return { path: tarPath, name: zipName.replace('.zip', '.tar.gz') };
            } catch (e2) {
                throw new Error('Cannot create archive: ' + e2.message);
            }
        }

        return { path: zipPath, name: zipName };
    }

    // ========================================
    // IMPORT
    // ========================================

    // Import from uploaded zip buffer
    async importFromZip(projectName, targetType, zipFilePath) {
        // Determine target path
        let targetPath;
        if (targetType === 'main') {
            targetPath = storageService.getMainPath(projectName);
            await fs.ensureDir(targetPath);
        } else {
            // Create new section with current timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('Z', 'Z');
            targetPath = storageService.getSectionPath(projectName, timestamp);
            await fs.ensureDir(targetPath);
        }

        // Extract zip
        try {
            execSync(`unzip -o "${zipFilePath}" -d "${targetPath}"`, {
                timeout: 60000,
                stdio: 'pipe'
            });
        } catch (e) {
            // Fallback: try tar
            try {
                execSync(`tar -xzf "${zipFilePath}" -C "${targetPath}"`, {
                    timeout: 60000,
                    stdio: 'pipe'
                });
            } catch (e2) {
                throw new Error('Cannot extract archive: ' + e2.message);
            }
        }

        // Clean up __MACOSX folder if created by zip
        const macosxDir = path.join(targetPath, '__MACOSX');
        if (await fs.pathExists(macosxDir)) {
            await fs.remove(macosxDir);
        }

        return {
            targetType,
            targetPath: path.relative(storageService.getStoragePath(), targetPath),
            imported: true
        };
    }

    // Import from another MAPIT instance's share link
    async importFromShareLink(projectName, targetType, shareUrl) {
        // Parse share URL: http://192.168.x.x:8888/share/abc123
        const urlMatch = shareUrl.match(/^(https?:\/\/[^/]+)\/share\/([a-f0-9]+)/);
        if (!urlMatch) {
            throw new Error('Invalid share URL format');
        }

        const baseUrl = urlMatch[1];
        const token = urlMatch[2];
        const downloadUrl = `${baseUrl}/api/share/download/${token}`;

        // Download zip to temp file
        const tmpDir = path.join(os.tmpdir(), 'mapit-imports');
        await fs.ensureDir(tmpDir);
        const tmpFile = path.join(tmpDir, `import_${Date.now()}.zip`);

        await this._downloadFile(downloadUrl, tmpFile);

        try {
            // Import the downloaded zip
            const result = await this.importFromZip(projectName, targetType, tmpFile);
            return result;
        } finally {
            // Clean up temp file
            await fs.remove(tmpFile).catch(() => {});
        }
    }

    // Download a file from URL to local path
    _downloadFile(url, destPath) {
        return new Promise((resolve, reject) => {
            const file = require('fs').createWriteStream(destPath);
            const client = url.startsWith('https') ? require('https') : http;

            const request = client.get(url, { timeout: 30000 }, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    file.close();
                    return this._downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
                }
                if (response.statusCode !== 200) {
                    file.close();
                    return reject(new Error(`Download failed: HTTP ${response.statusCode}`));
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            });

            request.on('error', (err) => {
                file.close();
                fs.remove(destPath).catch(() => {});
                reject(new Error('Download failed: ' + err.message));
            });

            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Download timeout'));
            });
        });
    }

    // Scan local network for other MAPIT instances
    async scanNetwork() {
        const info = this.getNetworkInfo();
        if (!info.addresses || info.addresses.length === 0) return [];

        const localIp = info.addresses[0].ip;
        const subnet = localIp.split('.').slice(0, 3).join('.');
        const found = [];

        // Scan common IPs in parallel (quick scan)
        const scanPromises = [];
        for (let i = 1; i <= 254; i++) {
            const ip = `${subnet}.${i}`;
            if (ip === localIp) continue;

            scanPromises.push(
                this._probeHost(ip, info.port)
                    .then((result) => { if (result) found.push(result); })
                    .catch(() => {})
            );
        }

        await Promise.all(scanPromises);
        return found;
    }

    // Probe a single host for MAPIT instance
    _probeHost(ip, port) {
        return new Promise((resolve, reject) => {
            const req = http.get(`http://${ip}:${port}/api/share/network`, {
                timeout: 800
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.success) {
                            resolve({ ip, port, ssid: json.ssid });
                        } else {
                            resolve(null);
                        }
                    } catch (e) {
                        resolve(null);
                    }
                });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
        });
    }
}

module.exports = new ShareService();
