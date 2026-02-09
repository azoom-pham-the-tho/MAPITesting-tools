const { drive: googleDrive, auth: googleAuth } = require('@googleapis/drive');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const storageService = require('./storage.service');

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const TOKENS_FILE = 'gdrive_tokens.json';

class GDriveService {
    constructor() {
        this.oAuth2Client = null;
        this.drive = null;
    }

    // Get app credentials from config/gdrive.json (set by developer)
    _getAppCredentials() {
        const configPath = path.join(__dirname, '../../config/gdrive.json');
        if (fs.pathExistsSync(configPath)) {
            const config = fs.readJsonSync(configPath);
            if (config.clientId && config.clientSecret) {
                return config;
            }
        }
        return null;
    }

    // Get tokens path (per-user, stored in storage)
    _getTokensPath() {
        return path.join(storageService.getStoragePath(), TOKENS_FILE);
    }

    // Load user tokens
    async _loadTokens() {
        const tokensPath = this._getTokensPath();
        if (await fs.pathExists(tokensPath)) {
            return await fs.readJson(tokensPath);
        }
        return null;
    }

    // Save user tokens
    async _saveTokens(tokens, email) {
        const data = { tokens, email: email || null };
        await fs.writeJson(this._getTokensPath(), data, { spaces: 2 });
    }

    // Check if Drive is configured and authenticated
    async getStatus() {
        const creds = this._getAppCredentials();
        if (!creds) {
            return { configured: false, authenticated: false };
        }

        const tokenData = await this._loadTokens();
        if (!tokenData || !tokenData.tokens) {
            return { configured: true, authenticated: false };
        }

        // Verify token is valid
        try {
            this._initClient(creds, tokenData.tokens);
            await this.drive.about.get({ fields: 'user' });
            return { configured: true, authenticated: true, email: tokenData.email || null };
        } catch (e) {
            // Token might be expired, try refresh
            try {
                this._initClient(creds, tokenData.tokens);
                const { credentials } = await this.oAuth2Client.refreshAccessToken();
                await this._saveTokens(credentials, tokenData.email);
                return { configured: true, authenticated: true, email: tokenData.email || null };
            } catch (e2) {
                return { configured: true, authenticated: false };
            }
        }
    }

    // Initialize OAuth2 client
    _initClient(creds, tokens) {
        this.oAuth2Client = new googleAuth.OAuth2(
            creds.clientId,
            creds.clientSecret,
            creds.redirectUri || 'http://localhost:8888/api/gdrive/callback'
        );
        if (tokens) {
            this.oAuth2Client.setCredentials(tokens);
        }
        this.drive = googleDrive({ version: 'v3', auth: this.oAuth2Client });
    }

    // Get OAuth2 authorization URL
    async getAuthUrl() {
        const creds = this._getAppCredentials();
        if (!creds) {
            throw new Error('Google Drive chua duoc cau hinh. Lien he quan tri vien.');
        }
        this._initClient(creds);
        const url = this.oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent'
        });
        return url;
    }

    // Handle OAuth2 callback
    async handleCallback(code) {
        const creds = this._getAppCredentials();
        if (!creds) throw new Error('Not configured');
        this._initClient(creds);

        const { tokens } = await this.oAuth2Client.getToken(code);
        this.oAuth2Client.setCredentials(tokens);

        // Get user email
        let email = null;
        try {
            this.drive = googleDrive({ version: 'v3', auth: this.oAuth2Client });
            const about = await this.drive.about.get({ fields: 'user' });
            email = about.data.user.emailAddress;
        } catch (e) {}

        await this._saveTokens(tokens, email);
        return { success: true, email };
    }

    // Ensure client is ready
    async _ensureClient() {
        const creds = this._getAppCredentials();
        if (!creds) {
            throw new Error('Google Drive chua duoc cau hinh');
        }
        const tokenData = await this._loadTokens();
        if (!tokenData || !tokenData.tokens) {
            throw new Error('Chua ket noi Google Drive. Vui long dang nhap.');
        }
        this._initClient(creds, tokenData.tokens);
    }

    // Get or create the MAPIT root folder on Drive
    async _getOrCreateFolder(parentId, folderName) {
        await this._ensureClient();

        // Search for existing folder
        const query = parentId
            ? `name='${folderName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
            : `name='${folderName}' and 'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

        const res = await this.drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        if (res.data.files.length > 0) {
            return res.data.files[0].id;
        }

        // Create folder
        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: parentId ? [parentId] : []
        };
        const folder = await this.drive.files.create({
            resource: fileMetadata,
            fields: 'id'
        });
        return folder.data.id;
    }

    // Upload project data to Drive
    async upload(projectName, type, sectionId = null) {
        await this._ensureClient();

        // Create MAPIT root folder
        const rootFolderId = await this._getOrCreateFolder(null, 'MAPIT-Shared');
        // Create project folder
        const projectFolderId = await this._getOrCreateFolder(rootFolderId, projectName);

        // Determine source path
        let sourcePath, zipName;
        if (type === 'main') {
            sourcePath = storageService.getMainPath(projectName);
            zipName = `${projectName}_main.zip`;
        } else if (type === 'section' && sectionId) {
            sourcePath = storageService.getSectionPath(projectName, sectionId);
            zipName = `${projectName}_${sectionId.replace(/[:.]/g, '-')}.zip`;
        } else {
            throw new Error('Invalid type');
        }

        if (!await fs.pathExists(sourcePath)) {
            throw new Error('Data not found');
        }

        // Create zip
        const tmpDir = path.join(os.tmpdir(), 'mapit-gdrive');
        await fs.ensureDir(tmpDir);
        const zipPath = path.join(tmpDir, zipName);
        await fs.remove(zipPath);

        execSync(`cd "${sourcePath}" && zip -r "${zipPath}" . -x ".*"`, {
            timeout: 60000,
            stdio: 'pipe'
        });

        // Upload zip to Drive (replace if exists)
        const existingFiles = await this.drive.files.list({
            q: `name='${zipName}' and '${projectFolderId}' in parents and trashed=false`,
            fields: 'files(id)'
        });

        let fileId;
        const media = {
            mimeType: 'application/zip',
            body: require('fs').createReadStream(zipPath)
        };

        if (existingFiles.data.files.length > 0) {
            // Update existing
            fileId = existingFiles.data.files[0].id;
            await this.drive.files.update({
                fileId,
                media,
                fields: 'id'
            });
        } else {
            // Create new
            const res = await this.drive.files.create({
                resource: {
                    name: zipName,
                    parents: [projectFolderId]
                },
                media,
                fields: 'id'
            });
            fileId = res.data.id;
        }

        // Make file shareable (anyone with link)
        await this.drive.permissions.create({
            fileId,
            resource: { type: 'anyone', role: 'reader' }
        });

        const shareLink = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;

        // Clean up
        await fs.remove(zipPath);

        return { fileId, shareLink, zipName };
    }

    // List files in the MAPIT Drive folder
    async listFiles(projectName) {
        await this._ensureClient();

        const rootFolderId = await this._getOrCreateFolder(null, 'MAPIT-Shared');
        const projectFolderId = await this._getOrCreateFolder(rootFolderId, projectName);

        const res = await this.drive.files.list({
            q: `'${projectFolderId}' in parents and trashed=false`,
            fields: 'files(id, name, size, modifiedTime, mimeType)',
            orderBy: 'modifiedTime desc'
        });

        return res.data.files.map(f => ({
            id: f.id,
            name: f.name,
            size: parseInt(f.size || 0),
            modifiedTime: f.modifiedTime,
            link: `https://drive.google.com/file/d/${f.id}/view`
        }));
    }

    // Download a file from Drive and import
    async downloadAndImport(projectName, fileId, targetType) {
        await this._ensureClient();

        const tmpDir = path.join(os.tmpdir(), 'mapit-gdrive');
        await fs.ensureDir(tmpDir);
        const tmpFile = path.join(tmpDir, `gdrive_${Date.now()}.zip`);

        // Download file
        const res = await this.drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        await new Promise((resolve, reject) => {
            const dest = require('fs').createWriteStream(tmpFile);
            res.data.pipe(dest);
            dest.on('finish', resolve);
            dest.on('error', reject);
        });

        // Validate: check zip contains expected structure
        try {
            const listOutput = execSync(`unzip -l "${tmpFile}" 2>/dev/null | head -20`, {
                encoding: 'utf8',
                timeout: 5000
            });
            const validFiles = ['actions.json', 'apis.json', 'screen.html', 'dom.json', 'flow.json', 'meta.json'];
            const hasValidContent = validFiles.some(f => listOutput.includes(f));
            if (!hasValidContent) {
                await fs.remove(tmpFile);
                throw new Error('File khong dung dinh dang MAPIT. Can co cac file: actions.json, apis.json, screen.html, ...');
            }
        } catch (e) {
            if (e.message.includes('dinh dang')) throw e;
        }

        // Import using share service
        const shareService = require('./share.service');
        try {
            const result = await shareService.importFromZip(projectName, targetType, tmpFile);
            return result;
        } finally {
            await fs.remove(tmpFile).catch(() => {});
        }
    }

    // Import from a Google Drive share link
    async importFromLink(projectName, targetType, driveLink) {
        let fileId = null;
        const match1 = driveLink.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const match2 = driveLink.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        fileId = (match1 && match1[1]) || (match2 && match2[1]);

        if (!fileId) {
            throw new Error('Link Google Drive khong hop le');
        }

        return await this.downloadAndImport(projectName, fileId, targetType);
    }

    // Disconnect / remove tokens
    async disconnect() {
        const tokensPath = this._getTokensPath();
        if (await fs.pathExists(tokensPath)) {
            await fs.remove(tokensPath);
        }
        this.oAuth2Client = null;
        this.drive = null;
        return { success: true };
    }
}

module.exports = new GDriveService();
