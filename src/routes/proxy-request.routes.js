/**
 * Proxy Request Route
 * 
 * Proxies API requests from the API Tester to bypass CORS restrictions.
 * Accepts POST with { url, method, headers, body } and returns the response.
 */
const express = require('express');
const router = express.Router();

// Dynamic import for node-fetch (CommonJS compatible)
let fetchFn;
try {
    fetchFn = require('node-fetch');
} catch (e) {
    // Fallback to native fetch (Node 18+)
    fetchFn = globalThis.fetch;
}

// Use https module as fallback
const http = require('http');
const https = require('https');
const { URL } = require('url');

function makeRequest(options) {
    return new Promise(function (resolve, reject) {
        var parsedUrl = new URL(options.url);
        var isHttps = parsedUrl.protocol === 'https:';
        var lib = isHttps ? https : http;

        var reqHeaders = options.headers || {};
        // Remove host header to avoid conflicts
        delete reqHeaders['host'];
        delete reqHeaders['Host'];

        var reqOpts = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: reqHeaders,
            timeout: 30000,
            rejectUnauthorized: false // Allow self-signed certs
        };

        var req = lib.request(reqOpts, function (res) {
            var chunks = [];
            res.on('data', function (chunk) { chunks.push(chunk); });
            res.on('end', function () {
                var body = Buffer.concat(chunks).toString('utf8');
                var respHeaders = {};
                Object.keys(res.headers).forEach(function (k) {
                    respHeaders[k] = res.headers[k];
                });
                resolve({
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    headers: respHeaders,
                    body: body
                });
            });
        });

        req.on('error', function (err) {
            reject(err);
        });

        req.on('timeout', function () {
            req.destroy();
            reject(new Error('Request timeout (30s)'));
        });

        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

router.post('/', async function (req, res) {
    try {
        var url = req.body.url;
        var method = (req.body.method || 'GET').toUpperCase();
        var headers = req.body.headers || {};
        var body = req.body.body || null;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Validate URL
        try {
            new URL(url);
        } catch (e) {
            return res.status(400).json({ error: 'URL không hợp lệ: ' + url });
        }

        var result = await makeRequest({
            url: url,
            method: method,
            headers: headers,
            body: body
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({
            status: 0,
            statusText: 'Error',
            headers: {},
            body: 'Lỗi proxy: ' + err.message
        });
    }
});

/**
 * GET /captured-apis/:projectName
 * Returns all captured APIs from the project's main directory
 */
router.get('/captured-apis/:projectName', async function (req, res) {
    try {
        var projectName = req.params.projectName;
        var storageDir = process.env.STORAGE_PATH || global.STORAGE_PATH || require('path').join(__dirname, '..', '..', 'storage');
        var mainPath = require('path').join(storageDir, projectName, 'main');
        var fs = require('fs-extra');

        if (!await fs.pathExists(mainPath)) {
            return res.json({ apis: [] });
        }

        var apis = [];

        // Read flow.json to find screen folders
        var flowPath = require('path').join(storageDir, projectName, 'flow.json');
        var screenDirs = [];

        if (await fs.pathExists(flowPath)) {
            try {
                var flowData = await fs.readJson(flowPath);
                if (flowData.nodes) {
                    for (var node of flowData.nodes) {
                        if (node.type === 'start') continue;
                        var relativePath = node.nestedPath || node.id;
                        screenDirs.push({
                            path: require('path').join(mainPath, relativePath),
                            screenName: node.name || node.id,
                            screenUrl: node.url || node.path || ''
                        });
                    }
                }
            } catch (e) {
                console.error('[proxy] Error reading flow.json:', e);
            }
        }

        // Fallback: scan main directory for folders with apis.json
        if (screenDirs.length === 0) {
            var findDirs = async function (dir, prefix) {
                var items = await fs.readdir(dir, { withFileTypes: true });
                for (var item of items) {
                    if (!item.isDirectory()) continue;
                    var fullPath = require('path').join(dir, item.name);
                    var apisFile = require('path').join(fullPath, 'apis.json');
                    if (await fs.pathExists(apisFile)) {
                        screenDirs.push({
                            path: fullPath,
                            screenName: item.name,
                            screenUrl: ''
                        });
                    } else {
                        await findDirs(fullPath, (prefix ? prefix + '/' : '') + item.name);
                    }
                }
            };
            await findDirs(mainPath, '');
        }

        // Read apis.json from each screen folder IN PARALLEL
        var results = await Promise.all(screenDirs.map(async function (screen) {
            var apisPath = require('path').join(screen.path, 'apis.json');
            if (!await fs.pathExists(apisPath)) return [];
            try {
                var apisData = await fs.readJson(apisPath);
                if (!Array.isArray(apisData)) return [];
                return apisData.map(function (api) {
                    return {
                        method: (api.method || 'GET').toUpperCase(),
                        url: api.url || '',
                        status: api.status || 200,
                        statusText: api.statusText || '',
                        duration: api.duration || 0,
                        screenName: screen.screenName,
                        headers: api.reqHeaders || api.requestHeaders || api.headers || {},
                        body: api.requestBody || api.body || null,
                        resHeaders: api.resHeaders || {},
                        responseBody: api.responseBody || null
                    };
                });
            } catch (e) { return []; }
        }));
        var apis = [].concat.apply([], results);

        res.json({ apis: apis });
    } catch (err) {
        console.error('[proxy] Error listing captured APIs:', err);
        res.status(500).json({ apis: [], error: err.message });
    }
});

module.exports = router;
