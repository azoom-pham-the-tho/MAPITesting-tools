/**
 * API Tester Module
 *
 * Postman-like API testing interface integrated with MAPIT's captured API data.
 * - Click any captured API → auto-fill everything (method, URL, headers, body)
 * - Save creates localStorage copies only — never modifies captured data
 * - Search/filter across all APIs
 * - Grouped by screen for easy navigation
 */
(function () {
    'use strict';

    var historyData = [];
    var savedData = [];
    var capturedApis = [];
    var _capturedResponse = null; // Store captured response for diff comparison
    var STORAGE_KEY_HISTORY = 'mapit_api_tester_history';
    var STORAGE_KEY_SAVED = 'mapit_api_tester_saved';

    // Load from localStorage
    try {
        historyData = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)) || [];
        savedData = JSON.parse(localStorage.getItem(STORAGE_KEY_SAVED)) || [];
    } catch (e) { /* ignore */ }

    function init() {
        setupConfigTabs();
        setupResponseTabs();
        setupAddRowButtons();
        setupBodyTypeToggle();
        setupAuthTypeToggle();
        setupSendButton();
        setupSaveButton();
        setupSearch();
        setupSectionToggles();
        setupClearHistory();
        setupCurlPaste();
        setupAuthSettings();
        addInitialRows();
        renderHistory();
        renderSaved();
        populateCapturedApis();
    }

    // ==========================================
    //  cURL paste support
    // ==========================================
    function setupCurlPaste() {
        var urlInput = document.getElementById('apiUrl');
        if (!urlInput) return;

        urlInput.addEventListener('paste', function (e) {
            setTimeout(function () {
                var val = urlInput.value.trim();
                // Detect multi-line or single-line curl command
                if (/^curl\s/i.test(val)) {
                    e.preventDefault && e.preventDefault();
                    var parsed = parseCurl(val);
                    if (parsed) {
                        loadFullRequest(parsed);
                        urlInput.classList.add('curl-detected');
                        setTimeout(function () { urlInput.classList.remove('curl-detected'); }, 1500);
                        if (typeof showToast === 'function') {
                            showToast('✨ cURL đã được parse: ' + parsed.method + ' ' + (parsed.url.length > 40 ? parsed.url.substring(0, 40) + '…' : parsed.url), 'success');
                        }
                    }
                }
            }, 0);
        });
    }

    function parseCurl(curlStr) {
        // Normalize: join continuation lines (\), collapse whitespace
        var cmd = curlStr.replace(/\\\s*\n/g, ' ').replace(/\s+/g, ' ').trim();

        // Remove leading "curl"
        cmd = cmd.replace(/^curl\s+/i, '');

        var method = 'GET';
        var url = '';
        var headers = {};
        var body = null;
        var i = 0;
        var tokens = tokenize(cmd);

        while (i < tokens.length) {
            var t = tokens[i];

            if (t === '-X' || t === '--request') {
                i++;
                if (i < tokens.length) method = tokens[i].toUpperCase();
            } else if (t === '-H' || t === '--header') {
                i++;
                if (i < tokens.length) {
                    var hdr = tokens[i];
                    var colonIdx = hdr.indexOf(':');
                    if (colonIdx > 0) {
                        var hKey = hdr.substring(0, colonIdx).trim();
                        var hVal = hdr.substring(colonIdx + 1).trim();
                        headers[hKey] = hVal;
                    }
                }
            } else if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary') {
                i++;
                if (i < tokens.length) {
                    body = tokens[i];
                    if (method === 'GET') method = 'POST'; // -d implies POST
                }
            } else if (t === '-u' || t === '--user') {
                i++;
                if (i < tokens.length) {
                    headers['Authorization'] = 'Basic ' + btoa(tokens[i]);
                }
            } else if (t === '-k' || t === '--insecure' || t === '-L' || t === '--location' || t === '-v' || t === '--verbose' || t === '-s' || t === '--silent') {
                // Skip flags without args
            } else if (t === '-o' || t === '--output' || t === '--connect-timeout' || t === '--max-time') {
                i++; // Skip flag + its argument
            } else if (!t.startsWith('-') && !url) {
                url = t;
            }
            i++;
        }

        if (!url) return null;
        return { method: method, url: url, headers: headers, body: body };
    }

    function tokenize(str) {
        // Split respecting quotes (single and double)
        var tokens = [];
        var current = '';
        var inQuote = null;
        for (var i = 0; i < str.length; i++) {
            var c = str[i];
            if (inQuote) {
                if (c === inQuote) { inQuote = null; }
                else if (c === '\\' && i + 1 < str.length) { current += str[++i]; }
                else { current += c; }
            } else {
                if (c === '"' || c === "'") { inQuote = c; }
                else if (c === ' ') {
                    if (current) { tokens.push(current); current = ''; }
                } else {
                    current += c;
                }
            }
        }
        if (current) tokens.push(current);
        return tokens;
    }

    // ==========================================
    //  Auth Settings (global token + cookie support)
    // ==========================================
    function getAuthStorageKey() {
        var proj = (typeof state !== 'undefined' && state.currentProject) ? state.currentProject : '_default';
        return 'apiTester_authToken_' + proj;
    }

    function getAuthTypeKey() {
        var proj = (typeof state !== 'undefined' && state.currentProject) ? state.currentProject : '_default';
        return 'apiTester_authType_' + proj;
    }

    function getGlobalToken() {
        var el = document.getElementById('apiGlobalToken');
        return (el && el.value.trim()) || '';
    }

    /**
     * Get saved auth type: 'bearer' or 'cookie:cookieName'
     */
    function getAuthType() {
        try { return localStorage.getItem(getAuthTypeKey()) || 'bearer'; } catch (e) { return 'bearer'; }
    }

    function setAuthType(type) {
        try { localStorage.setItem(getAuthTypeKey(), type); } catch (e) { }
    }

    function updateAuthStatus() {
        var statusEl = document.getElementById('apiAuthStatus');
        if (!statusEl) return;
        var token = getGlobalToken();
        if (token) {
            var authType = getAuthType();
            statusEl.textContent = authType.startsWith('cookie:') ? '🍪 ON' : 'ON';
            statusEl.classList.add('active');
        } else {
            statusEl.textContent = 'OFF';
            statusEl.classList.remove('active');
        }
    }

    /**
     * Extract auth token from set-cookie header value.
     * Returns { cookieName, token } or null.
     * Looks for JWT-like values (eyJ...) or common auth cookie names.
     */
    function extractAuthFromSetCookie(setCookieValue) {
        if (!setCookieValue) return null;
        // set-cookie can be a string or array
        var cookies = Array.isArray(setCookieValue) ? setCookieValue : [setCookieValue];
        var authPatterns = /^(auth|token|session|access|jwt|sid)/i;
        for (var i = 0; i < cookies.length; i++) {
            var parts = cookies[i].split(';')[0].split('=');
            var name = (parts[0] || '').trim();
            var value = parts.slice(1).join('=').trim();
            // Match by cookie name pattern or JWT-like value
            if (name && value && (authPatterns.test(name) || /^eyJ/.test(value))) {
                return { cookieName: name, token: value };
            }
        }
        return null;
    }

    /**
     * Extract auth from captured request cookie header.
     * Returns { cookieName, token } or null.
     */
    function extractAuthFromRequestCookie(cookieHeader) {
        if (!cookieHeader) return null;
        var pairs = cookieHeader.split(';');
        var authPatterns = /^(auth|token|session|access|jwt|sid)/i;
        for (var i = 0; i < pairs.length; i++) {
            var parts = pairs[i].trim().split('=');
            var name = (parts[0] || '').trim();
            var value = parts.slice(1).join('=').trim();
            if (name && value && (authPatterns.test(name) || /^eyJ/.test(value))) {
                return { cookieName: name, token: value };
            }
        }
        return null;
    }

    /**
     * Save auth token with its type
     */
    function saveAuth(token, authType) {
        var tokenEl = document.getElementById('apiGlobalToken');
        if (tokenEl) tokenEl.value = token;
        try { localStorage.setItem(getAuthStorageKey(), token); } catch (e) { }
        setAuthType(authType || 'bearer');
        updateAuthStatus();
    }

    /**
     * Clear auth token (used when token expires and needs refresh)
     */
    function clearAuth() {
        var tokenEl = document.getElementById('apiGlobalToken');
        if (tokenEl) tokenEl.value = '';
        try { localStorage.removeItem(getAuthStorageKey()); } catch (e) { }
        updateAuthStatus();
    }

    function setupAuthSettings() {
        var tokenEl = document.getElementById('apiGlobalToken');
        var extractBtn = document.getElementById('apiAutoExtractToken');
        var clearBtn = document.getElementById('apiClearToken');
        var loginBtn = document.getElementById('apiLoginBtn');
        var expandBtn = document.getElementById('apiAuthToggleExpand');
        var expandPanel = document.getElementById('apiAuthExpand');

        // Load saved token
        try {
            var saved = localStorage.getItem(getAuthStorageKey());
            if (saved && tokenEl) tokenEl.value = saved;
        } catch (e) { /* ignore */ }
        updateAuthStatus();

        // Save on change
        if (tokenEl) {
            tokenEl.addEventListener('input', function () {
                try { localStorage.setItem(getAuthStorageKey(), tokenEl.value.trim()); } catch (e) { }
                updateAuthStatus();
            });
        }

        // Expand / collapse toggle
        if (expandBtn && expandPanel) {
            expandBtn.addEventListener('click', function () {
                var visible = expandPanel.style.display !== 'none';
                expandPanel.style.display = visible ? 'none' : '';
                expandBtn.classList.toggle('expanded', !visible);
            });
        }

        // 🔓 Login button - find login API and call it
        if (loginBtn) {
            loginBtn.addEventListener('click', function () {
                // Find the login API from captured
                var loginApi = null;
                for (var i = 0; i < capturedApis.length; i++) {
                    var api = capturedApis[i];
                    if (api.method === 'POST' && /\/(auth|login|sign-?in)/i.test(api.url)) {
                        loginApi = api;
                        break;
                    }
                }
                if (!loginApi) {
                    if (typeof showToast === 'function') showToast('Không tìm thấy login API trong captured data', 'warning');
                    return;
                }

                loginBtn.classList.add('loading');
                loginBtn.textContent = '⏳ Đang login...';

                // Call the login API via proxy
                fetch('/api/proxy-request', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: loginApi.url,
                        method: loginApi.method,
                        headers: loginApi.headers || loginApi.reqHeaders || {},
                        body: (loginApi.body || loginApi.requestBody) ? (typeof (loginApi.body || loginApi.requestBody) === 'string' ? (loginApi.body || loginApi.requestBody) : JSON.stringify(loginApi.body || loginApi.requestBody)) : null
                    })
                })
                    .then(function (res) { return res.json(); })
                    .then(function (result) {
                        loginBtn.classList.remove('loading');
                        loginBtn.textContent = '🔓 Login';

                        // Try to extract token from response body first
                        var token = '';
                        var authType = 'bearer';
                        var resBody = result.body;
                        if (typeof resBody === 'string') {
                            try { resBody = JSON.parse(resBody); } catch (e) { }
                        }
                        if (resBody && typeof resBody === 'object') {
                            token = resBody.accessToken || resBody.access_token || resBody.token ||
                                (resBody.data && (resBody.data.accessToken || resBody.data.access_token || resBody.data.token)) || '';
                        }

                        // Fallback: extract from set-cookie response header
                        if (!token && result.headers) {
                            var setCookie = result.headers['set-cookie'] || result.headers['Set-Cookie'];
                            var cookieAuth = extractAuthFromSetCookie(setCookie);
                            if (cookieAuth) {
                                token = cookieAuth.token;
                                authType = 'cookie:' + cookieAuth.cookieName;
                                console.log('[ApiTester] Extracted auth cookie:', cookieAuth.cookieName);
                            }
                        }

                        if (token) {
                            saveAuth(token, authType);
                            var label = authType.startsWith('cookie:') ? '🍪 Cookie auth' : 'Bearer token';
                            if (typeof showToast === 'function') showToast('✅ Login thành công! ' + label + ' đã được lưu', 'success');
                        } else {
                            if (typeof showToast === 'function') showToast('Login trả về nhưng không tìm thấy token. Status: ' + result.status, 'warning');
                        }
                    })
                    .catch(function (err) {
                        loginBtn.classList.remove('loading');
                        loginBtn.textContent = '🔓 Login';
                        if (typeof showToast === 'function') showToast('Login thất bại: ' + err.message, 'error');
                    });
            });
        }

        // Auto-extract from captured headers (supports both Bearer and Cookie auth)
        if (extractBtn) {
            extractBtn.addEventListener('click', function () {
                var token = '';
                var authType = 'bearer';
                // Try Authorization header
                for (var i = 0; i < capturedApis.length; i++) {
                    var api = capturedApis[i];
                    var hdrs = api.headers || api.reqHeaders || {};
                    for (var key in hdrs) {
                        if (key.toLowerCase() === 'authorization') {
                            var val = hdrs[key];
                            if (/^bearer\s+/i.test(val)) {
                                token = val.replace(/^bearer\s+/i, '').trim();
                            } else {
                                token = val;
                            }
                            break;
                        }
                    }
                    if (token) break;
                }
                // Fallback: try cookie header
                if (!token) {
                    for (var j = 0; j < capturedApis.length; j++) {
                        var hdrs2 = capturedApis[j].headers || capturedApis[j].reqHeaders || {};
                        for (var k in hdrs2) {
                            if (k.toLowerCase() === 'cookie') {
                                var ca = extractAuthFromRequestCookie(hdrs2[k]);
                                if (ca) { token = ca.token; authType = 'cookie:' + ca.cookieName; break; }
                            }
                        }
                        if (token) break;
                    }
                }
                // Fallback: try set-cookie from login response
                if (!token) {
                    for (var m = 0; m < capturedApis.length; m++) {
                        if (capturedApis[m].method === 'POST' && /\/(auth|login|sign-?in)/i.test(capturedApis[m].url)) {
                            var rh = capturedApis[m].resHeaders || {};
                            var sc = rh['set-cookie'] || rh['Set-Cookie'];
                            var scA = extractAuthFromSetCookie(sc);
                            if (scA) { token = scA.token; authType = 'cookie:' + scA.cookieName; break; }
                        }
                    }
                }
                if (token) {
                    saveAuth(token, authType);
                    var label = authType.startsWith('cookie:') ? '🍪 Cookie: ' + authType.split(':')[1] : 'Bearer token';
                    if (typeof showToast === 'function') showToast('✅ ' + label + ' extracted', 'success');
                } else {
                    if (typeof showToast === 'function') showToast('Không tìm thấy auth token trong captured data', 'warning');
                }
            });
        }

        // Clear
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                if (tokenEl) tokenEl.value = '';
                try { localStorage.removeItem(getAuthStorageKey()); } catch (e) { }
                updateAuthStatus();
            });
        }
    }

    // ==========================================
    //  Config tab switching
    // ==========================================
    function setupConfigTabs() {
        var tabs = document.querySelectorAll('.api-config-tab');
        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                tabs.forEach(function (t) { t.classList.remove('active'); });
                tab.classList.add('active');
                var panes = document.querySelectorAll('.api-config-pane');
                panes.forEach(function (p) { p.style.display = 'none'; });
                var target = document.getElementById('apiPane' + capitalize(tab.dataset.config));
                if (target) target.style.display = '';
            });
        });
    }

    function setupResponseTabs() {
        var tabs = document.querySelectorAll('.api-resp-tab');
        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                tabs.forEach(function (t) { t.classList.remove('active'); });
                tab.classList.add('active');
                var panels = ['apiResponseBody', 'apiResponseHeaders', 'apiResponseInfo', 'apiResponseDiff'];
                panels.forEach(function (id) {
                    var el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
                var map = { body: 'apiResponseBody', headers: 'apiResponseHeaders', info: 'apiResponseInfo', diff: 'apiResponseDiff' };
                var active = document.getElementById(map[tab.dataset.resp]);
                if (active) active.style.display = '';
            });
        });
    }

    // ==========================================
    //  Sidebar: Section toggles
    // ==========================================
    function setupSectionToggles() {
        document.querySelectorAll('.api-section-toggle').forEach(function (toggle) {
            toggle.addEventListener('click', function (e) {
                if (e.target.closest('.api-clear-btn')) return; // Don't toggle when clicking clear
                var section = toggle.closest('.api-section-collapsible');
                if (section) section.classList.toggle('collapsed');
            });
        });
    }

    // ==========================================
    //  Sidebar: Search
    // ==========================================
    function setupSearch() {
        var input = document.getElementById('apiSearchInput');
        if (!input) return;
        var debounceTimer;
        input.addEventListener('input', function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function () {
                filterSidebar(input.value.trim().toLowerCase());
            }, 150);
        });
    }

    function filterSidebar(query) {
        // Filter captured APIs
        document.querySelectorAll('#apiCapturedList .api-history-item').forEach(function (item) {
            var text = (item.getAttribute('data-search') || '').toLowerCase();
            item.style.display = !query || text.indexOf(query) !== -1 ? '' : 'none';
        });
        // Show/hide screen groups based on whether they have visible children
        document.querySelectorAll('#apiCapturedList .api-screen-group').forEach(function (group) {
            var visibleItems = group.querySelectorAll('.api-history-item:not([style*="display: none"])');
            group.style.display = visibleItems.length > 0 ? '' : 'none';
        });
        // Filter saved
        document.querySelectorAll('#apiSavedList .api-history-item').forEach(function (item) {
            var text = (item.getAttribute('data-search') || '').toLowerCase();
            item.style.display = !query || text.indexOf(query) !== -1 ? '' : 'none';
        });
        // Filter history
        document.querySelectorAll('#apiHistoryList .api-history-item').forEach(function (item) {
            var text = (item.getAttribute('data-search') || '').toLowerCase();
            item.style.display = !query || text.indexOf(query) !== -1 ? '' : 'none';
        });
    }

    // ==========================================
    //  Sidebar: Captured APIs (from server)
    // ==========================================
    var _cachedProject = '';
    var _cachedApis = null;

    function populateCapturedApis(forceRefresh) {
        var container = document.getElementById('apiCapturedList');
        var countEl = document.getElementById('apiCapturedCount');
        if (!container) return;

        var projectName = '';
        if (typeof state !== 'undefined' && state.currentProject) {
            projectName = state.currentProject;
        }
        if (!projectName) {
            container.innerHTML = '<div class="api-empty-hint">Chọn project để xem APIs</div>';
            if (countEl) countEl.textContent = '0';
            _cachedProject = '';
            _cachedApis = null;
            return;
        }

        // Use cache if same project and not forced
        if (!forceRefresh && projectName === _cachedProject && _cachedApis) {
            renderCapturedApis(container, countEl, _cachedApis);
            return;
        }

        container.innerHTML = '<div class="api-empty-hint api-loading">⏳ Đang tải...</div>';

        fetch('/api/proxy-request/captured-apis/' + encodeURIComponent(projectName))
            .then(function (res) { return res.json(); })
            .then(function (data) {
                capturedApis = data.apis || [];
                _cachedProject = projectName;
                _cachedApis = capturedApis;
                renderCapturedApis(container, countEl, capturedApis);
                // Auto-login if no token saved
                autoLogin();
            })
            .catch(function (err) {
                console.error('[ApiTester] Error loading captured APIs:', err);
                container.innerHTML = '<div class="api-empty-hint" style="color:#ef5350">Lỗi tải APIs</div>';
                if (countEl) countEl.textContent = '!';
            });
    }

    /**
     * Auto-login: bypass auth automatically
     * 1. Try extracting token from captured request headers (fastest, no network)
     * 2. If no token found, call captured login API to get fresh token
     */
    function autoLogin() {
        // Skip if already have a token
        if (getGlobalToken()) {
            updateAuthStatus();
            return;
        }

        var tokenEl = document.getElementById('apiGlobalToken');
        var loginBtn = document.getElementById('apiLoginBtn');

        // Step 1: Try extract from captured request headers (no network needed)
        var extractedToken = '';
        var extractedAuthType = 'bearer';

        for (var i = 0; i < capturedApis.length; i++) {
            var hdrs = capturedApis[i].headers || capturedApis[i].reqHeaders || {};
            // Try Authorization header first
            for (var key in hdrs) {
                if (key.toLowerCase() === 'authorization' && /^bearer\s+/i.test(hdrs[key])) {
                    extractedToken = hdrs[key].replace(/^bearer\s+/i, '').trim();
                    extractedAuthType = 'bearer';
                    break;
                }
            }
            if (extractedToken) break;

            // Try cookie header (for cookie-based auth)
            for (var ck in hdrs) {
                if (ck.toLowerCase() === 'cookie') {
                    var cookieAuth = extractAuthFromRequestCookie(hdrs[ck]);
                    if (cookieAuth) {
                        extractedToken = cookieAuth.token;
                        extractedAuthType = 'cookie:' + cookieAuth.cookieName;
                        break;
                    }
                }
            }
            if (extractedToken) break;
        }

        // Step 1b: Try extract from captured response set-cookie (login response)
        if (!extractedToken) {
            for (var j2 = 0; j2 < capturedApis.length; j2++) {
                var api2 = capturedApis[j2];
                if (api2.method === 'POST' && /\/(auth|login|sign-?in)/i.test(api2.url)) {
                    var resHdrs = api2.resHeaders || {};
                    var sc = resHdrs['set-cookie'] || resHdrs['Set-Cookie'];
                    var scAuth = extractAuthFromSetCookie(sc);
                    if (scAuth) {
                        extractedToken = scAuth.token;
                        extractedAuthType = 'cookie:' + scAuth.cookieName;
                        break;
                    }
                }
            }
        }

        if (extractedToken) {
            saveAuth(extractedToken, extractedAuthType);
            console.log('[ApiTester] Auto-extracted token (' + extractedAuthType + ') from captured data');
            return;
        }

        // Step 2: Find login API and call it
        var loginApi = null;
        for (var j = 0; j < capturedApis.length; j++) {
            var api = capturedApis[j];
            if (api.method === 'POST' && /\/(auth|login|sign-?in)/i.test(api.url)) {
                loginApi = api;
                break;
            }
        }
        if (!loginApi) return; // No login API found, skip

        if (loginBtn) {
            loginBtn.classList.add('loading');
            loginBtn.textContent = '⏳ Auto-login...';
        }

        fetch('/api/proxy-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: loginApi.url,
                method: loginApi.method,
                headers: loginApi.headers || loginApi.reqHeaders || {},
                body: (loginApi.body || loginApi.requestBody) ? (typeof (loginApi.body || loginApi.requestBody) === 'string' ? (loginApi.body || loginApi.requestBody) : JSON.stringify(loginApi.body || loginApi.requestBody)) : null
            })
        })
            .then(function (res) { return res.json(); })
            .then(function (result) {
                if (loginBtn) {
                    loginBtn.classList.remove('loading');
                    loginBtn.textContent = '🔓 Login';
                }
                var token = '';
                var authType = 'bearer';
                var resBody = result.body;
                if (typeof resBody === 'string') { try { resBody = JSON.parse(resBody); } catch (e) { } }
                if (resBody && typeof resBody === 'object') {
                    token = resBody.accessToken || resBody.access_token || resBody.token ||
                        (resBody.data && (resBody.data.accessToken || resBody.data.access_token || resBody.data.token)) || '';
                }
                // Fallback: extract from set-cookie
                if (!token && result.headers) {
                    var sc = result.headers['set-cookie'] || result.headers['Set-Cookie'];
                    var scAuth = extractAuthFromSetCookie(sc);
                    if (scAuth) {
                        token = scAuth.token;
                        authType = 'cookie:' + scAuth.cookieName;
                    }
                }
                if (token) {
                    saveAuth(token, authType);
                    console.log('[ApiTester] Auto-login success (' + authType + ')');
                    if (typeof showToast === 'function') showToast('🔓 Auto-login thành công!', 'success');
                }
            })
            .catch(function () {
                if (loginBtn) {
                    loginBtn.classList.remove('loading');
                    loginBtn.textContent = '🔓 Login';
                }
            });
    }

    var _delegateAttached = false;

    function renderCapturedApis(container, countEl, apis) {
        capturedApis = apis;
        if (countEl) countEl.textContent = apis.length;

        if (apis.length === 0) {
            container.innerHTML = '<div class="api-empty-hint">Chưa có API nào</div>';
            return;
        }

        // Group by screen
        var groups = {};
        apis.forEach(function (api, i) {
            var screen = api.screenName || 'Unknown';
            if (!groups[screen]) groups[screen] = [];
            api._index = i;
            groups[screen].push(api);
        });

        var html = '';
        Object.keys(groups).forEach(function (screenName) {
            var items = groups[screenName];
            html += '<div class="api-screen-group">';
            html += '<div class="api-screen-label">' + escapeHtml(screenName) + ' <span class="api-screen-badge">' + items.length + '</span></div>';
            items.forEach(function (api) {
                var displayPath = smartPath(api.url);
                var statusCls = api.status >= 200 && api.status < 400 ? 'api-status-ok' : 'api-status-err';
                html += '<div class="api-history-item" data-captured="' + api._index + '" data-search="' + escapeAttr(api.method + ' ' + api.url + ' ' + screenName) + '" title="' + escapeAttr(api.url) + '">';
                html += '<span class="api-history-method api-method-' + api.method.toLowerCase() + '">' + api.method + '</span>';
                html += '<span class="api-history-url">' + escapeHtml(displayPath) + '</span>';
                html += '<span class="api-history-status ' + statusCls + '">' + api.status + '</span>';
                html += '</div>';
            });
            html += '</div>';
        });
        container.innerHTML = html;

        // Attach event delegation only once
        if (!_delegateAttached) {
            _delegateAttached = true;
            container.addEventListener('click', function (e) {
                var el = e.target.closest('.api-history-item[data-captured]');
                if (!el) return;
                var idx = parseInt(el.dataset.captured);
                var api = capturedApis[idx];
                if (!api) return;
                loadFullRequest(api);
                highlightActive(el);
            });
        }
    }

    // ==========================================
    //  Load full request (auto-fill everything)
    // ==========================================
    function loadFullRequest(api) {
        // Method + URL (strip query params — they go in Params tab)
        var methodEl = document.getElementById('apiMethod');
        var urlEl = document.getElementById('apiUrl');
        var cleanUrl = api.url || '';
        try {
            var parsed = new URL(cleanUrl);
            cleanUrl = parsed.origin + parsed.pathname;
        } catch (e) { /* keep original */ }
        if (methodEl) methodEl.value = api.method || 'GET';
        if (urlEl) urlEl.value = cleanUrl;

        // Query Params from URL
        var paramsRows = document.getElementById('apiParamsRows');
        if (paramsRows) {
            paramsRows.innerHTML = '';
            try {
                var u = new URL(api.url);
                u.searchParams.forEach(function (val, key) {
                    paramsRows.appendChild(createKvRow(key, val, ''));
                });
            } catch (e) { /* ignore */ }
            paramsRows.appendChild(createKvRow('', '', ''));
        }

        // Headers — filter out browser-internal ones
        var skipHeaders = ['sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform', 'sec-fetch-dest',
            'sec-fetch-mode', 'sec-fetch-site', 'user-agent', 'referer', 'origin',
            'x-client-path', 'x-client-is-admin-page', 'cookie', 'host', 'connection',
            'accept-encoding', 'accept-language', 'pragma', 'cache-control'];
        var headersRows = document.getElementById('apiHeadersRows');
        if (headersRows) {
            headersRows.innerHTML = '';
            var hdrs = api.headers || api.reqHeaders || {};
            var hasHeaders = false;
            Object.keys(hdrs).forEach(function (key) {
                if (skipHeaders.indexOf(key.toLowerCase()) === -1) {
                    headersRows.appendChild(createKvRow(key, hdrs[key], ''));
                    hasHeaders = true;
                }
            });
            if (!hasHeaders) {
                headersRows.appendChild(createKvRow('Content-Type', 'application/json', ''));
            }
            headersRows.appendChild(createKvRow('', '', ''));
        }

        // Body
        var editor = document.getElementById('apiBodyEditor');
        var formDataContainer = document.getElementById('apiFormDataContainer');
        var formDataRows = document.getElementById('apiFormDataRows');
        var apiBody = api.body || api.requestBody || null;

        if (apiBody && apiBody !== 'null') {
            var bodyObj = apiBody;
            if (typeof bodyObj === 'string') {
                try { bodyObj = JSON.parse(bodyObj); } catch (e) { bodyObj = null; }
            }

            // If flat object → use form-data table
            if (bodyObj && typeof bodyObj === 'object' && !Array.isArray(bodyObj)) {
                var allFlat = Object.keys(bodyObj).every(function (k) {
                    return typeof bodyObj[k] !== 'object' || bodyObj[k] === null;
                });
                if (allFlat) {
                    // Populate form-data rows
                    var formRadio = document.querySelector('input[name="apiBodyType"][value="form"]');
                    if (formRadio) formRadio.checked = true;
                    if (editor) editor.style.display = 'none';
                    if (formDataContainer) formDataContainer.style.display = '';
                    if (formDataRows) {
                        formDataRows.innerHTML = '';
                        Object.keys(bodyObj).forEach(function (k) {
                            formDataRows.appendChild(createFormDataRow(k, String(bodyObj[k] === null ? '' : bodyObj[k]), 'text'));
                        });
                        formDataRows.appendChild(createFormDataRow('', '', 'text'));
                    }
                    // Also keep JSON in editor as backup
                    if (editor) editor.value = JSON.stringify(bodyObj, null, 2);
                } else {
                    // Complex object → JSON editor
                    if (editor) { editor.value = JSON.stringify(bodyObj, null, 2); editor.style.display = ''; }
                    if (formDataContainer) formDataContainer.style.display = 'none';
                    var jsonRadio = document.querySelector('input[name="apiBodyType"][value="json"]');
                    if (jsonRadio) jsonRadio.checked = true;
                }
            } else {
                // String / non-parseable → raw editor
                var bodyStr = typeof apiBody === 'string' ? apiBody : JSON.stringify(apiBody, null, 2);
                if (editor) { editor.value = bodyStr; editor.style.display = ''; }
                if (formDataContainer) formDataContainer.style.display = 'none';
                var rawRadio = document.querySelector('input[name="apiBodyType"][value="json"]');
                if (rawRadio) rawRadio.checked = true;
            }
        } else {
            if (editor) { editor.value = ''; editor.style.display = 'none'; }
            if (formDataContainer) formDataContainer.style.display = 'none';
            if (formDataRows) formDataRows.innerHTML = '';
            var noneRadio = document.querySelector('input[name="apiBodyType"][value="none"]');
            if (noneRadio) noneRadio.checked = true;
        }

        // Switch to most relevant config tab
        var activeTab = 'params';
        if (apiBody) activeTab = 'body';
        else if (Object.keys(api.headers || api.reqHeaders || {}).length > 0) activeTab = 'headers';
        var tab = document.querySelector('.api-config-tab[data-tab="' + activeTab + '"]');
        if (tab) tab.click();

        // Store captured response for diff comparison later
        _capturedResponse = {
            status: api.status || 200,
            statusText: api.statusText || '',
            headers: api.resHeaders || {},
            body: api.responseBody || null
        };

        // Hide diff tab
        var diffTab = document.getElementById('apiDiffTab');
        if (diffTab) diffTab.style.display = 'none';
        var diffEl = document.getElementById('apiResponseDiff');
        if (diffEl) diffEl.innerHTML = '';

        // Display captured response as default
        displayCapturedResponse(_capturedResponse, api);
    }

    function highlightActive(el) {
        document.querySelectorAll('.api-tester-sidebar .api-history-item.active').forEach(function (item) {
            item.classList.remove('active');
        });
        el.classList.add('active');
    }

    // ==========================================
    //  Key-value rows
    // ==========================================
    function createKvRow(key, value, desc) {
        var row = document.createElement('div');
        row.className = 'api-kv-row';
        row.innerHTML =
            '<input type="text" placeholder="key" value="' + escapeAttr(key || '') + '" class="kv-key" />' +
            '<input type="text" placeholder="value" value="' + escapeAttr(value || '') + '" class="kv-value" />' +
            '<input type="text" placeholder="mô tả" value="' + escapeAttr(desc || '') + '" class="kv-desc" />' +
            '<button class="api-kv-delete" title="Xóa dòng này">×</button>';
        row.querySelector('.api-kv-delete').addEventListener('click', function () {
            row.remove();
        });
        return row;
    }

    function setupAddRowButtons() {
        var addParam = document.getElementById('apiAddParam');
        if (addParam) {
            addParam.addEventListener('click', function () {
                var rows = document.getElementById('apiParamsRows');
                if (rows) rows.appendChild(createKvRow('', '', ''));
            });
        }
        var addHeader = document.getElementById('apiAddHeader');
        if (addHeader) {
            addHeader.addEventListener('click', function () {
                var rows = document.getElementById('apiHeadersRows');
                if (rows) rows.appendChild(createKvRow('', '', ''));
            });
        }
    }

    function addInitialRows() {
        var paramsRows = document.getElementById('apiParamsRows');
        if (paramsRows && paramsRows.children.length === 0) {
            paramsRows.appendChild(createKvRow('', '', ''));
        }
        var headersRows = document.getElementById('apiHeadersRows');
        if (headersRows && headersRows.children.length === 0) {
            headersRows.appendChild(createKvRow('Content-Type', 'application/json', 'Kiểu dữ liệu'));
            headersRows.appendChild(createKvRow('', '', ''));
        }
    }

    function collectKvPairs(containerId) {
        var result = {};
        var rows = document.querySelectorAll('#' + containerId + ' .api-kv-row');
        rows.forEach(function (row) {
            var key = row.querySelector('.kv-key').value.trim();
            var val = row.querySelector('.kv-value').value.trim();
            if (key) result[key] = val;
        });
        return result;
    }

    function loadKvRows(containerId, obj) {
        var container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        Object.keys(obj).forEach(function (k) {
            container.appendChild(createKvRow(k, obj[k], ''));
        });
        container.appendChild(createKvRow('', '', ''));
    }

    // ==========================================
    //  Body type toggle
    // ==========================================
    function setupBodyTypeToggle() {
        var radios = document.querySelectorAll('input[name="apiBodyType"]');
        var editor = document.getElementById('apiBodyEditor');
        var formDataContainer = document.getElementById('apiFormDataContainer');
        var formDataRows = document.getElementById('apiFormDataRows');
        var addRowBtn = document.getElementById('apiAddFormDataRow');

        radios.forEach(function (r) {
            r.addEventListener('change', function () {
                if (r.value === 'form') {
                    // Show form-data table, hide textarea
                    if (editor) editor.style.display = 'none';
                    if (formDataContainer) formDataContainer.style.display = '';
                    // Add initial row if empty
                    if (formDataRows && formDataRows.children.length === 0) {
                        formDataRows.appendChild(createFormDataRow('', '', 'text'));
                    }
                } else {
                    // Show textarea, hide form-data table
                    if (formDataContainer) formDataContainer.style.display = 'none';
                    if (editor) {
                        editor.style.display = r.value === 'none' ? 'none' : '';
                        if (r.value === 'json') {
                            editor.placeholder = '{\n  "key": "value"\n}';
                        } else if (r.value === 'raw') {
                            editor.placeholder = 'Nội dung raw...';
                        }
                    }
                }
            });
        });

        // Add row button
        if (addRowBtn) {
            addRowBtn.addEventListener('click', function () {
                if (formDataRows) formDataRows.appendChild(createFormDataRow('', '', 'text'));
            });
        }

        if (editor) editor.style.display = 'none';

        // Beautify button
        var beautifyBtn = document.getElementById('apiBodyBeautify');
        if (beautifyBtn && editor) {
            beautifyBtn.addEventListener('click', function () {
                var raw = editor.value.trim();
                if (!raw) return;
                try {
                    var parsed = JSON.parse(raw);
                    editor.value = JSON.stringify(parsed, null, 2);
                    beautifyBtn.textContent = '✅ Formatted';
                    setTimeout(function () { beautifyBtn.textContent = '✨ Beautify'; }, 1200);
                } catch (e) {
                    // Not valid JSON — try basic formatting for other formats
                    beautifyBtn.textContent = '⚠️ Not JSON';
                    setTimeout(function () { beautifyBtn.textContent = '✨ Beautify'; }, 1500);
                }
            });
        }
    }

    function createFormDataRow(key, value, type) {
        var row = document.createElement('div');
        row.className = 'api-formdata-row';

        var select = document.createElement('select');
        select.className = 'api-fd-type-select';
        select.innerHTML = '<option value="text">Text</option><option value="file">File</option>';
        select.value = type || 'text';

        var keyInput = document.createElement('input');
        keyInput.type = 'text';
        keyInput.className = 'api-fd-key';
        keyInput.placeholder = 'key';
        keyInput.value = key || '';

        var valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.className = 'api-fd-value';
        valueInput.placeholder = 'value';
        valueInput.value = value || '';

        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.className = 'api-fd-file';
        fileInput.style.display = 'none';

        var deleteBtn = document.createElement('button');
        deleteBtn.className = 'api-fd-delete';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Xóa';
        deleteBtn.addEventListener('click', function () { row.remove(); });

        // Toggle text/file
        select.addEventListener('change', function () {
            if (select.value === 'file') {
                valueInput.style.display = 'none';
                fileInput.style.display = '';
            } else {
                valueInput.style.display = '';
                fileInput.style.display = 'none';
            }
        });

        row.appendChild(select);
        row.appendChild(keyInput);
        row.appendChild(valueInput);
        row.appendChild(fileInput);
        row.appendChild(deleteBtn);
        return row;
    }

    // ==========================================
    //  Auth type toggle
    // ==========================================
    function setupAuthTypeToggle() {
        var radios = document.querySelectorAll('input[name="apiAuthType"]');
        var fields = document.getElementById('apiAuthFields');
        radios.forEach(function (r) {
            r.addEventListener('change', function () {
                if (!fields) return;
                if (r.value === 'bearer') {
                    fields.innerHTML =
                        '<div class="api-auth-field"><label>Token</label><input type="text" id="apiAuthToken" placeholder="Nhập Bearer token..." /></div>';
                } else if (r.value === 'basic') {
                    fields.innerHTML =
                        '<div class="api-auth-field"><label>Username</label><input type="text" id="apiAuthUser" placeholder="username" /></div>' +
                        '<div class="api-auth-field"><label>Password</label><input type="password" id="apiAuthPass" placeholder="password" /></div>';
                } else {
                    fields.innerHTML = '<div class="api-auth-none-msg">Không cần xác thực</div>';
                }
            });
        });
    }

    // ==========================================
    //  Send request
    // ==========================================
    function setupSendButton() {
        var btn = document.getElementById('apiSendBtn');
        if (!btn) return;
        btn.addEventListener('click', function () { sendRequest(); });

        var urlInput = document.getElementById('apiUrl');
        if (urlInput) {
            urlInput.addEventListener('keydown', function (e) {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    sendRequest();
                }
            });
        }
    }

    function sendRequest() {
        var method = document.getElementById('apiMethod').value;
        var url = document.getElementById('apiUrl').value.trim();
        if (!url) {
            if (typeof showToast === 'function') showToast('Vui lòng nhập URL', 'warning');
            return;
        }

        // Build query params
        var params = collectKvPairs('apiParamsRows');
        var paramKeys = Object.keys(params);
        if (paramKeys.length > 0) {
            var sep = url.indexOf('?') === -1 ? '?' : '&';
            paramKeys.forEach(function (k) {
                url += sep + encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
                sep = '&';
            });
        }

        var headers = collectKvPairs('apiHeadersRows');

        // Auth
        var authType = document.querySelector('input[name="apiAuthType"]:checked');
        if (authType && authType.value === 'bearer') {
            var token = document.getElementById('apiAuthToken');
            if (token && token.value.trim()) headers['Authorization'] = 'Bearer ' + token.value.trim();
        } else if (authType && authType.value === 'basic') {
            var user = document.getElementById('apiAuthUser');
            var pass = document.getElementById('apiAuthPass');
            if (user && user.value) headers['Authorization'] = 'Basic ' + btoa(user.value + ':' + (pass ? pass.value : ''));
        }

        // Global auth fallback - inject if no Authorization/Cookie header set
        if (!headers['Authorization'] && !headers['authorization'] && !headers['Cookie'] && !headers['cookie']) {
            var globalToken = getGlobalToken();
            if (globalToken) {
                var savedAuthType = getAuthType();
                if (savedAuthType.startsWith('cookie:')) {
                    var cookieName = savedAuthType.split(':').slice(1).join(':');
                    headers['Cookie'] = cookieName + '=' + globalToken;
                } else {
                    headers['Authorization'] = 'Bearer ' + globalToken;
                }
            }
        }
        // Body
        var bodyType = document.querySelector('input[name="apiBodyType"]:checked');
        var body = null;
        if (method !== 'GET' && method !== 'HEAD' && bodyType && bodyType.value !== 'none') {
            if (bodyType.value === 'form') {
                // Collect from form-data table
                var formObj = {};
                var fdRows = document.querySelectorAll('#apiFormDataRows .api-formdata-row');
                fdRows.forEach(function (row) {
                    var key = row.querySelector('.api-fd-key').value.trim();
                    var typeSelect = row.querySelector('.api-fd-type-select');
                    if (!key) return;
                    if (typeSelect.value === 'text') {
                        formObj[key] = row.querySelector('.api-fd-value').value;
                    }
                    // File type: skip for proxy (would need multipart handling)
                });
                if (Object.keys(formObj).length > 0) {
                    body = JSON.stringify(formObj);
                    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
                }
            } else {
                var editor = document.getElementById('apiBodyEditor');
                if (editor && editor.value.trim()) {
                    body = editor.value.trim();
                    if (bodyType.value === 'json') headers['Content-Type'] = headers['Content-Type'] || 'application/json';
                }
            }
        }

        var sendBtn = document.getElementById('apiSendBtn');
        sendBtn.classList.add('loading');
        sendBtn.innerHTML = '<span class="api-spinner"></span> Đang gửi...';
        var startTime = performance.now();
        var fetchOpts = { method: method, headers: headers };
        if (body) fetchOpts.body = body;

        var _retrying = false;

        function doSend(retryUrl, retryMethod, retryHeaders, retryBody) {
            return fetch('/api/proxy-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: retryUrl, method: retryMethod, headers: retryHeaders, body: retryBody })
            })
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    // Auto-retry on 401/403: token expired
                    if (!_retrying && (data.status === 401 || data.status === 403)) {
                        _retrying = true;
                        console.log('[ApiTester] Got ' + data.status + ', attempting auto-relogin...');
                        // Clear expired token
                        clearAuth();
                        // Try to re-login
                        return new Promise(function (resolve) {
                            autoLogin();
                            // Wait for autoLogin to finish (it's async, give it time)
                            setTimeout(function () {
                                var newToken = getGlobalToken();
                                if (newToken) {
                                    // Rebuild headers with new token
                                    var newHeaders = Object.assign({}, retryHeaders);
                                    var authType = getAuthType();
                                    if (authType.startsWith('cookie:')) {
                                        var cookieName = authType.split(':').slice(1).join(':');
                                        newHeaders['Cookie'] = cookieName + '=' + newToken;
                                        delete newHeaders['Authorization'];
                                    } else {
                                        newHeaders['Authorization'] = 'Bearer ' + newToken;
                                        delete newHeaders['Cookie'];
                                    }
                                    if (typeof showToast === 'function') showToast('🔄 Token refreshed, retrying...', 'info');
                                    doSend(retryUrl, retryMethod, newHeaders, retryBody).then(resolve);
                                } else {
                                    // Re-login failed, show original 401 response
                                    if (typeof showToast === 'function') showToast('🔒 Token hết hạn, auto-login thất bại', 'warning');
                                    resolve(data);
                                }
                            }, 2000); // Give autoLogin 2s to complete
                        });
                    }
                    return data;
                });
        }

        doSend(url, method, headers, body)
            .then(function (data) {
                var elapsed = Math.round(performance.now() - startTime);
                displayResponse(data, elapsed, url, method);
                addToHistory(method, url, data.status, elapsed);
            })
            .catch(function (err) {
                fetch(url, fetchOpts)
                    .then(function (res) {
                        var elapsed = Math.round(performance.now() - startTime);
                        var respHeaders = {};
                        res.headers.forEach(function (v, k) { respHeaders[k] = v; });
                        return res.text().then(function (text) {
                            displayResponse({ status: res.status, statusText: res.statusText, headers: respHeaders, body: text }, elapsed, url, method);
                            addToHistory(method, url, res.status, elapsed);
                        });
                    })
                    .catch(function (err2) {
                        var elapsed = Math.round(performance.now() - startTime);
                        displayError(err2.message, elapsed);
                        addToHistory(method, url, 0, elapsed);
                    });
            })
            .finally(function () {
                sendBtn.classList.remove('loading');
                sendBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Gửi';
            });
    }

    // ==========================================
    //  Display captured response (default when clicking API)
    // ==========================================
    function displayCapturedResponse(captured, api) {
        var meta = document.getElementById('apiResponseMeta');
        var statusCode = captured.status || 200;
        var statusClass = statusCode >= 200 && statusCode < 300 ? 'ok' : statusCode >= 300 && statusCode < 400 ? 'redirect' : 'err';
        var bodyText = captured.body ? (typeof captured.body === 'string' ? captured.body : JSON.stringify(captured.body, null, 2)) : '';
        var size = new Blob([bodyText || '']).size;

        if (meta) {
            meta.innerHTML =
                '<span class="meta-status ' + statusClass + '">' + statusCode + ' ' + (captured.statusText || '') + '</span>' +
                '<span class="meta-time">⏱ ' + (api.duration || 0) + 'ms</span>' +
                '<span class="meta-size">📦 ' + formatSize(size) + '</span>' +
                '<span class="meta-captured">📸 Captured</span>';
        }

        // Body
        var bodyEl = document.getElementById('apiResponseBody');
        if (bodyEl) {
            if (bodyText) {
                try {
                    var parsed = JSON.parse(bodyText);
                    bodyEl.innerHTML = '<pre>' + syntaxHighlight(JSON.stringify(parsed, null, 2)) + '</pre>';
                } catch (e) {
                    bodyEl.innerHTML = '<pre>' + escapeHtml(bodyText) + '</pre>';
                }
            } else {
                bodyEl.innerHTML = '<div class="api-empty-response"><p style="opacity:0.5">Không có response body trong captured data</p></div>';
            }
        }

        // Headers
        var headersEl = document.getElementById('apiResponseHeaders');
        if (headersEl && captured.headers) {
            var hKeys = Object.keys(captured.headers);
            if (hKeys.length > 0) {
                var html = '<table class="api-resp-header-table"><thead><tr><th>Header</th><th>Giá trị</th></tr></thead><tbody>';
                hKeys.forEach(function (k) {
                    html += '<tr><td>' + escapeHtml(k) + '</td><td>' + escapeHtml(String(captured.headers[k])) + '</td></tr>';
                });
                headersEl.innerHTML = html + '</tbody></table>';
            } else {
                headersEl.innerHTML = '<div class="api-empty-response"><p style="opacity:0.5">Không có response headers</p></div>';
            }
        }

        // Info (basic from captured)
        var infoEl = document.getElementById('apiResponseInfo');
        if (infoEl) {
            var h = captured.headers || {};
            var hLower = {};
            Object.keys(h).forEach(function (k) { hLower[k.toLowerCase()] = h[k]; });

            var serverInfo = [];
            serverInfo.push({ label: 'URL', value: api.url || '' });
            serverInfo.push({ label: 'Phương thức', value: api.method || 'GET' });
            serverInfo.push({ label: 'Status', value: statusCode + ' ' + (captured.statusText || '') });
            serverInfo.push({ label: 'Thời gian', value: (api.duration || 0) + 'ms' });
            serverInfo.push({ label: 'Kích thước', value: formatSize(size) });
            serverInfo.push({ label: 'Nguồn', value: '📸 Captured data', cls: 'highlight' });

            if (hLower['server']) serverInfo.push({ label: '🖥️ Server', value: hLower['server'], cls: 'highlight' });
            if (hLower['x-powered-by']) serverInfo.push({ label: '⚙️ Powered By', value: hLower['x-powered-by'], cls: 'highlight' });
            if (hLower['x-envoy-upstream-service-time']) serverInfo.push({ label: '⏱️ Upstream', value: hLower['x-envoy-upstream-service-time'] + 'ms', cls: 'highlight' });
            if (hLower['content-type']) serverInfo.push({ label: '📄 Content-Type', value: hLower['content-type'] });
            if (hLower['set-cookie']) {
                var cv = hLower['set-cookie'];
                var cn = (Array.isArray(cv) ? cv[0] : cv).split('=')[0];
                serverInfo.push({ label: '🍪 Set-Cookie', value: cn, cls: 'highlight' });
            }

            var html = '<div class="api-info-grid">';
            serverInfo.forEach(function (item) {
                var cls = item.cls ? ' api-info-' + item.cls : '';
                html += '<span class="api-info-label">' + item.label + '</span>';
                html += '<span class="api-info-value' + cls + '">' + escapeHtml(String(item.value)) + '</span>';
            });
            html += '</div>';
            infoEl.innerHTML = html;
        }

        // Reset to body tab
        var bodyTab = document.querySelector('.api-resp-tab[data-resp="body"]');
        if (bodyTab) bodyTab.click();
    }

    // ==========================================
    //  Compare live response with captured
    // ==========================================
    function compareAndShowDiff(liveData) {
        if (!_capturedResponse) return;

        var diffs = [];
        var cap = _capturedResponse;

        // 1. Status diff
        if (cap.status && liveData.status !== cap.status) {
            diffs.push({ type: 'SỬA', field: 'Status', captured: cap.status + ' ' + (cap.statusText || ''), live: liveData.status + ' ' + (liveData.statusText || ''), category: 'status' });
        }

        // 2. Body diff (JSON deep compare) — skip headers entirely (noise)
        var capBody = cap.body;
        var liveBody = liveData.body;
        if (typeof capBody === 'string') { try { capBody = JSON.parse(capBody); } catch (e) { } }
        if (typeof liveBody === 'string') { try { liveBody = JSON.parse(liveBody); } catch (e) { } }

        if (capBody && liveBody && typeof capBody === 'object' && typeof liveBody === 'object') {
            diffObjects(capBody, liveBody, '', diffs);
        } else {
            var capStr = typeof capBody === 'string' ? capBody : JSON.stringify(capBody);
            var liveStr = typeof liveBody === 'string' ? liveBody : JSON.stringify(liveBody);
            if (capStr !== liveStr) {
                diffs.push({ type: 'SỬA', field: 'Body', captured: (capStr || '').substring(0, 200), live: (liveStr || '').substring(0, 200), category: 'body' });
            }
        }

        // Show/hide diff tab
        var diffTab = document.getElementById('apiDiffTab');
        var diffEl = document.getElementById('apiResponseDiff');

        if (diffs.length === 0) {
            if (diffTab) { diffTab.style.display = ''; diffTab.innerHTML = '✅ Không khác biệt'; }
            if (diffEl) diffEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted)"><div style="font-size:48px;margin-bottom:12px">✅</div><div style="font-size:14px;font-weight:600">Không có khác biệt</div><div style="font-size:12px;margin-top:4px">Response live giống với captured data</div></div>';
            return;
        }

        // Count by type
        var addCount = 0, delCount = 0, modCount = 0;
        diffs.forEach(function (d) {
            if (d.type === 'THÊM') addCount++;
            else if (d.type === 'XOÁ') delCount++;
            else modCount++;
        });

        // Show diff tab with count badge
        if (diffTab) {
            diffTab.style.display = '';
            diffTab.innerHTML = '⚡ Khác biệt <span style="background:rgba(255,152,0,0.2);color:#ffb74d;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:700;margin-left:4px">' + diffs.length + '</span>';
        }

        if (diffEl) {
            var html = '<div class="api-diff-visual">';

            // Summary bar
            html += '<div class="diff-summary-bar">';
            html += '<span class="diff-summary-total">🔍 ' + diffs.length + ' khác biệt</span>';
            if (addCount > 0) html += '<span class="diff-chip diff-chip-add">+ ' + addCount + ' thêm</span>';
            if (delCount > 0) html += '<span class="diff-chip diff-chip-del">− ' + delCount + ' xoá</span>';
            if (modCount > 0) html += '<span class="diff-chip diff-chip-mod">~ ' + modCount + ' sửa</span>';
            html += '</div>';

            // Cards
            html += '<div class="diff-cards">';
            diffs.forEach(function (d, idx) {
                var typeIcon = d.type === 'THÊM' ? '➕' : d.type === 'XOÁ' ? '🗑️' : '✏️';
                var typeCls = d.type === 'THÊM' ? 'add' : d.type === 'XOÁ' ? 'del' : 'mod';
                var capDisplay = d.captured ? escapeHtml(String(d.captured)) : '<span class="diff-empty">— trống —</span>';
                var liveDisplay = d.live ? escapeHtml(String(d.live)) : '<span class="diff-empty">— trống —</span>';

                html += '<div class="diff-card diff-card-' + typeCls + '">';
                html += '<div class="diff-card-head">';
                html += '<span class="diff-card-icon">' + typeIcon + '</span>';
                html += '<span class="diff-card-field">' + escapeHtml(d.field) + '</span>';
                html += '<span class="diff-card-badge diff-badge-' + typeCls + '">' + d.type + '</span>';
                html += '</div>';

                if (d.type === 'SỬA') {
                    html += '<div class="diff-card-values">';
                    html += '<div class="diff-val-row diff-val-old"><span class="diff-val-label">Captured</span><span class="diff-val-content">' + capDisplay + '</span></div>';
                    html += '<div class="diff-val-arrow">→</div>';
                    html += '<div class="diff-val-row diff-val-new"><span class="diff-val-label">Live</span><span class="diff-val-content">' + liveDisplay + '</span></div>';
                    html += '</div>';
                } else if (d.type === 'THÊM') {
                    html += '<div class="diff-card-values"><div class="diff-val-row diff-val-new"><span class="diff-val-label">Live</span><span class="diff-val-content">' + liveDisplay + '</span></div></div>';
                } else {
                    html += '<div class="diff-card-values"><div class="diff-val-row diff-val-old"><span class="diff-val-label">Captured</span><span class="diff-val-content">' + capDisplay + '</span></div></div>';
                }

                html += '</div>';
            });
            html += '</div></div>';
            diffEl.innerHTML = html;
        }
    }

    /**
     * Deep diff two objects, adding differences to diffs array
     */
    function diffObjects(captured, live, prefix, diffs) {
        var allKeys = {};
        if (captured && typeof captured === 'object') Object.keys(captured).forEach(function (k) { allKeys[k] = true; });
        if (live && typeof live === 'object') Object.keys(live).forEach(function (k) { allKeys[k] = true; });

        Object.keys(allKeys).forEach(function (key) {
            var path = prefix ? prefix + '.' + key : key;
            var capVal = captured ? captured[key] : undefined;
            var liveVal = live ? live[key] : undefined;

            if (capVal === undefined) {
                diffs.push({ type: 'THÊM', field: path, captured: '', live: truncVal(liveVal) });
            } else if (liveVal === undefined) {
                diffs.push({ type: 'XOÁ', field: path, captured: truncVal(capVal), live: '' });
            } else if (typeof capVal === 'object' && typeof liveVal === 'object' && capVal !== null && liveVal !== null) {
                if (Array.isArray(capVal) && Array.isArray(liveVal)) {
                    if (capVal.length !== liveVal.length) {
                        diffs.push({ type: 'SỬA', field: path + '.length', captured: capVal.length, live: liveVal.length });
                    }
                    // Compare first few elements
                    var maxCheck = Math.min(capVal.length, liveVal.length, 5);
                    for (var i = 0; i < maxCheck; i++) {
                        if (typeof capVal[i] === 'object' && typeof liveVal[i] === 'object') {
                            diffObjects(capVal[i], liveVal[i], path + '[' + i + ']', diffs);
                        } else if (String(capVal[i]) !== String(liveVal[i])) {
                            diffs.push({ type: 'SỬA', field: path + '[' + i + ']', captured: truncVal(capVal[i]), live: truncVal(liveVal[i]) });
                        }
                    }
                } else {
                    diffObjects(capVal, liveVal, path, diffs);
                }
            } else if (String(capVal) !== String(liveVal)) {
                diffs.push({ type: 'SỬA', field: path, captured: truncVal(capVal), live: truncVal(liveVal) });
            }
        });
    }

    function truncVal(v) {
        var s = typeof v === 'object' ? JSON.stringify(v) : String(v);
        return s.length > 120 ? s.substring(0, 120) + '…' : s;
    }

    // ==========================================
    //  Display response
    // ==========================================
    function displayResponse(data, elapsed, url, method) {
        var meta = document.getElementById('apiResponseMeta');
        var statusCode = data.status || 0;
        var statusClass = statusCode >= 200 && statusCode < 300 ? 'ok' : statusCode >= 300 && statusCode < 400 ? 'redirect' : 'err';
        var bodyText = typeof data.body === 'string' ? data.body : JSON.stringify(data.body, null, 2);
        var size = new Blob([bodyText || '']).size;

        if (meta) {
            meta.innerHTML =
                '<span class="meta-status ' + statusClass + '">' + statusCode + ' ' + (data.statusText || '') + '</span>' +
                '<span class="meta-time">⏱ ' + elapsed + 'ms</span>' +
                '<span class="meta-size">📦 ' + formatSize(size) + '</span>';
        }

        var bodyEl = document.getElementById('apiResponseBody');
        if (bodyEl) {
            try {
                var parsed = JSON.parse(bodyText);
                bodyEl.innerHTML = '<pre>' + syntaxHighlight(JSON.stringify(parsed, null, 2)) + '</pre>';
            } catch (e) {
                bodyEl.innerHTML = '<pre>' + escapeHtml(bodyText || 'Không có nội dung') + '</pre>';
            }
        }

        var headersEl = document.getElementById('apiResponseHeaders');
        if (headersEl && data.headers) {
            var html = '<table class="api-resp-header-table"><thead><tr><th>Header</th><th>Giá trị</th></tr></thead><tbody>';
            Object.keys(data.headers).forEach(function (k) {
                html += '<tr><td>' + escapeHtml(k) + '</td><td>' + escapeHtml(data.headers[k]) + '</td></tr>';
            });
            headersEl.innerHTML = html + '</tbody></table>';
        }

        var infoEl = document.getElementById('apiResponseInfo');
        if (infoEl) {
            var h = data.headers || {};
            var hLower = {};
            Object.keys(h).forEach(function (k) { hLower[k.toLowerCase()] = h[k]; });

            // Extract server intelligence
            var serverInfo = [];

            // Basic request info
            serverInfo.push({ label: 'URL', value: url });
            serverInfo.push({ label: 'Phương thức', value: method });
            serverInfo.push({ label: 'Status', value: statusCode + ' ' + (data.statusText || '') });
            serverInfo.push({ label: 'Thời gian', value: elapsed + 'ms' });
            serverInfo.push({ label: 'Kích thước', value: formatSize(size) });
            serverInfo.push({ label: 'Thời điểm', value: new Date().toLocaleString('vi-VN') });

            // Server & Infrastructure
            if (hLower['server']) serverInfo.push({ label: '🖥️ Server', value: hLower['server'], cls: 'highlight' });
            if (hLower['x-powered-by']) serverInfo.push({ label: '⚙️ Powered By', value: hLower['x-powered-by'], cls: 'highlight' });
            if (hLower['via']) serverInfo.push({ label: '🔀 Proxy/CDN', value: hLower['via'] });
            if (hLower['x-envoy-upstream-service-time']) serverInfo.push({ label: '⏱️ Upstream Time', value: hLower['x-envoy-upstream-service-time'] + 'ms', cls: 'highlight' });
            if (hLower['x-cloud-trace-context']) serverInfo.push({ label: '☁️ Cloud Trace', value: hLower['x-cloud-trace-context'].split('/')[0] });
            if (hLower['alt-svc']) {
                var altSvc = hLower['alt-svc'];
                var protocols = [];
                if (altSvc.indexOf('h3') >= 0) protocols.push('HTTP/3');
                if (altSvc.indexOf('h2') >= 0) protocols.push('HTTP/2');
                if (protocols.length > 0) serverInfo.push({ label: '🚀 Protocols', value: protocols.join(', ') });
            }

            // Security Headers
            var secHeaders = [];
            if (hLower['strict-transport-security']) secHeaders.push('✅ HSTS');
            if (hLower['content-security-policy']) secHeaders.push('✅ CSP');
            if (hLower['x-frame-options']) secHeaders.push('✅ X-Frame');
            if (hLower['x-content-type-options']) secHeaders.push('✅ No-Sniff');
            if (hLower['x-xss-protection']) secHeaders.push('✅ XSS');
            if (hLower['referrer-policy']) secHeaders.push('✅ Referrer');
            if (hLower['cross-origin-opener-policy']) secHeaders.push('✅ COOP');
            if (hLower['cross-origin-resource-policy']) secHeaders.push('✅ CORP');
            if (secHeaders.length > 0) serverInfo.push({ label: '🛡️ Security', value: secHeaders.join('  '), cls: 'security' });

            // CORS
            if (hLower['access-control-allow-origin']) serverInfo.push({ label: '🌐 CORS Origin', value: hLower['access-control-allow-origin'] });
            if (hLower['access-control-allow-credentials']) serverInfo.push({ label: '🍪 CORS Credentials', value: hLower['access-control-allow-credentials'] });

            // Caching
            var cacheInfo = [];
            if (hLower['cache-control']) cacheInfo.push(hLower['cache-control']);
            if (hLower['expires']) cacheInfo.push('Expires: ' + hLower['expires']);
            if (hLower['etag']) cacheInfo.push('ETag: ' + hLower['etag']);
            if (cacheInfo.length > 0) serverInfo.push({ label: '📦 Cache', value: cacheInfo.join(' | ') });

            // Content
            if (hLower['content-type']) serverInfo.push({ label: '📄 Content-Type', value: hLower['content-type'] });
            if (hLower['content-encoding']) serverInfo.push({ label: '🗜️ Encoding', value: hLower['content-encoding'] });

            // Set-Cookie (auth detection)
            if (hLower['set-cookie']) {
                var cookieVal = hLower['set-cookie'];
                var cookieName = (Array.isArray(cookieVal) ? cookieVal[0] : cookieVal).split('=')[0];
                serverInfo.push({ label: '🍪 Set-Cookie', value: cookieName + ' (auth cookie detected)', cls: 'highlight' });
            }

            var html = '<div class="api-info-grid">';
            serverInfo.forEach(function (item) {
                var cls = item.cls ? ' api-info-' + item.cls : '';
                html += '<span class="api-info-label">' + item.label + '</span>';
                html += '<span class="api-info-value' + cls + '">' + escapeHtml(String(item.value)) + '</span>';
            });
            html += '</div>';
            infoEl.innerHTML = html;
        }

        // Compare with captured response and show diff if needed
        compareAndShowDiff(data);
    }

    function displayError(msg, elapsed) {
        var meta = document.getElementById('apiResponseMeta');
        if (meta) meta.innerHTML = '<span class="meta-status err">Lỗi</span><span class="meta-time">⏱ ' + elapsed + 'ms</span>';
        var bodyEl = document.getElementById('apiResponseBody');
        if (bodyEl) bodyEl.innerHTML = '<div class="api-empty-response" style="color:#ef5350"><p>❌ ' + escapeHtml(msg) + '</p><p style="font-size:11px;color:var(--text-muted)">Có thể do CORS hoặc server không phản hồi</p></div>';
    }

    // ==========================================
    //  History (localStorage only)
    // ==========================================
    function addToHistory(method, url, status, time) {
        historyData.unshift({ method: method, url: url, status: status, time: time, date: Date.now() });
        if (historyData.length > 10) historyData = historyData.slice(0, 10);
        try { localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historyData)); } catch (e) { /* ignore */ }
        renderHistory();
    }

    function renderHistory() {
        var container = document.getElementById('apiHistoryList');
        if (!container) return;
        if (historyData.length === 0) {
            container.innerHTML = '<div class="api-empty-hint">Chưa có lịch sử</div>';
            return;
        }
        var html = '';
        historyData.slice(0, 10).forEach(function (item, i) {
            var shortUrl = '';
            try { shortUrl = new URL(item.url).pathname; } catch (e) { shortUrl = item.url.replace(/^https?:\/\//, '').substring(0, 30); }
            if (shortUrl.length > 30) shortUrl = '…' + shortUrl.slice(-28);
            var statusCls = item.status >= 200 && item.status < 400 ? 'api-status-ok' : 'api-status-err';
            html += '<div class="api-history-item" data-history="' + i + '" data-search="' + escapeAttr(item.method + ' ' + item.url) + '">';
            html += '<span class="api-history-method api-method-' + item.method.toLowerCase() + '">' + item.method + '</span>';
            html += '<span class="api-history-url" title="' + escapeAttr(item.url) + '">' + escapeHtml(shortUrl) + '</span>';
            if (item.status) html += '<span class="api-history-status ' + statusCls + '">' + item.status + '</span>';
            html += '</div>';
        });
        container.innerHTML = html;

        container.querySelectorAll('.api-history-item').forEach(function (el) {
            el.addEventListener('click', function () {
                var idx = parseInt(el.dataset.history);
                var item = historyData[idx];
                if (item) {
                    loadFullRequest({ method: item.method, url: item.url, headers: {}, body: null });
                    highlightActive(el);
                }
            });
        });
    }

    // ==========================================
    //  Saved requests (localStorage only!)
    // ==========================================
    function renderSaved() {
        var container = document.getElementById('apiSavedList');
        var countEl = document.getElementById('apiSavedCount');
        if (!container) return;
        if (countEl) countEl.textContent = savedData.length;

        if (savedData.length === 0) {
            container.innerHTML = '<div class="api-empty-hint">Nhấn Save để lưu request</div>';
            return;
        }
        var html = '';
        savedData.forEach(function (item, i) {
            var shortUrl = '';
            try { shortUrl = new URL(item.url).pathname; } catch (e) { shortUrl = item.url.replace(/^https?:\/\//, '').substring(0, 28); }
            if (shortUrl.length > 28) shortUrl = '…' + shortUrl.slice(-26);
            html += '<div class="api-history-item" data-saved="' + i + '" data-search="' + escapeAttr(item.method + ' ' + item.url + ' ' + item.name) + '">';
            html += '<span class="api-history-method api-method-' + item.method.toLowerCase() + '">' + item.method + '</span>';
            html += '<span class="api-history-url" title="' + escapeAttr(item.name + '\n' + item.url) + '">' + escapeHtml(item.name || shortUrl) + '</span>';
            html += '<button class="api-kv-delete" data-del-saved="' + i + '" title="Xóa">×</button>';
            html += '</div>';
        });
        container.innerHTML = html;

        container.querySelectorAll('.api-history-item').forEach(function (el) {
            el.addEventListener('click', function (e) {
                if (e.target.dataset.delSaved !== undefined) {
                    savedData.splice(parseInt(e.target.dataset.delSaved), 1);
                    try { localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(savedData)); } catch (ex) { /* ignore */ }
                    renderSaved();
                    return;
                }
                var idx = parseInt(el.dataset.saved);
                var item = savedData[idx];
                if (item) {
                    loadFullRequest(item);
                    highlightActive(el);
                }
            });
        });
    }

    function setupSaveButton() {
        var btn = document.getElementById('apiSaveBtn');
        if (!btn) return;
        btn.addEventListener('click', function () {
            var method = document.getElementById('apiMethod').value;
            var url = document.getElementById('apiUrl').value.trim();
            if (!url) {
                if (typeof showToast === 'function') showToast('Nhập URL trước khi lưu', 'warning');
                return;
            }
            var name = prompt('Đặt tên cho request (chỉ lưu vào trình duyệt, không sửa dữ liệu gốc):');
            if (!name) return;

            var headers = collectKvPairs('apiHeadersRows');
            var editor = document.getElementById('apiBodyEditor');
            var body = editor ? editor.value.trim() : '';

            savedData.push({ name: name, method: method, url: url, headers: headers, body: body, date: Date.now() });
            try { localStorage.setItem(STORAGE_KEY_SAVED, JSON.stringify(savedData)); } catch (e) { /* ignore */ }
            renderSaved();
            if (typeof showToast === 'function') showToast('💾 Đã lưu "' + name + '" (localStorage)', 'success');
        });
    }

    function setupClearHistory() {
        var btn = document.getElementById('apiClearHistory');
        if (!btn) return;
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            historyData = [];
            try { localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historyData)); } catch (e) { /* ignore */ }
            renderHistory();
            if (typeof showToast === 'function') showToast('Đã xóa lịch sử', 'info');
        });
    }

    // ==========================================
    //  Helpers
    // ==========================================
    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    /**
     * Smart path: show the meaningful endpoint portion
     * /api/application-forms/summary-inquiry → application-forms/summary-inquiry
     * /api/v1/users/detail → users/detail
     * Short paths shown in full
     */
    function smartPath(url) {
        var path = '';
        try { path = new URL(url).pathname; } catch (e) { path = url || ''; }
        // Strip common API prefixes
        path = path.replace(/^\/api\/(v\d+\/)?/, '/');
        // Remove trailing slash
        path = path.replace(/\/$/, '');
        // Split into segments
        var segs = path.split('/').filter(Boolean);
        // Show last 2-3 segments depending on length
        if (segs.length <= 3) return '/' + segs.join('/');
        return segs.slice(-2).join('/');
    }

    function escapeAttr(str) {
        return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }

    function syntaxHighlight(json) {
        return json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?/g, function (match) {
                var cls = 'json-string';
                if (/:$/.test(match)) { cls = 'json-key'; match = match.replace(/:$/, '') + ':'; }
                return '<span class="' + cls + '">' + match + '</span>';
            })
            .replace(/\b(true|false)\b/g, '<span class="json-bool">$1</span>')
            .replace(/\b(null)\b/g, '<span class="json-null">$1</span>')
            .replace(/\b(-?\d+\.?\d*([eE][+-]?\d+)?)\b/g, '<span class="json-number">$1</span>');
    }

    // ==========================================
    //  Init on tab activation
    // ==========================================
    var initialized = false;

    function checkInit() {
        var content = document.getElementById('apiTesterContent');
        if (content && content.style.display !== 'none' && !initialized) {
            initialized = true;
            init();
        }
        if (initialized) populateCapturedApis(true);
    }

    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.subtab-btn');
        if (btn && btn.dataset.subtab === 'api-tester') {
            setTimeout(checkInit, 50);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(checkInit, 200); });
    } else {
        setTimeout(checkInit, 200);
    }

    window.ApiTester = {
        init: init,
        populateCapturedApis: populateCapturedApis
    };
})();
