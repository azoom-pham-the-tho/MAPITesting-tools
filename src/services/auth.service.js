const path = require('path');
const fs = require('fs-extra');

class AuthService {
    constructor() {
        // Default patterns - will be overridden by project config
        this.defaultLoginPatterns = [
            '/login', '/signin', '/sign-in', '/auth', 
            '/oauth', '/sso', '/accounts/login',
            'accounts.google.com', 'login.microsoftonline.com'
        ];
        
        // Auth token keys to check in storage
        this.authTokenKeys = [
            'token', 'access_token', 'accessToken', 'jwt', 
            'auth', 'session', 'id_token', 'refresh_token',
            'user', 'currentUser', 'authUser'
        ];
    }

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    getSessionPath(projectName) {
        return path.join(__dirname, '..', '..', 'storage', projectName, 'session.json');
    }

    async saveSession(projectName, sessionData) {
        const sessionPath = this.getSessionPath(projectName);
        
        const data = {
            cookies: sessionData.cookies || [],
            localStorage: sessionData.localStorage || {},
            sessionStorage: sessionData.sessionStorage || {},
            savedAt: new Date().toISOString(),
            expiresAt: sessionData.expiresAt || null,
            loginMethod: sessionData.loginMethod || 'unknown',
            lastUrl: sessionData.lastUrl || null
        };

        await fs.writeJson(sessionPath, data, { spaces: 2 });
        console.log(`[Auth] Session saved for project: ${projectName}`);
        return { success: true, savedAt: data.savedAt };
    }

    async getSession(projectName) {
        const sessionPath = this.getSessionPath(projectName);
        
        if (!await fs.pathExists(sessionPath)) {
            return null;
        }

        try {
            return await fs.readJson(sessionPath);
        } catch (e) {
            console.error('[Auth] Failed to read session:', e);
            return null;
        }
    }

    async hasValidSession(projectName) {
        const session = await this.getSession(projectName);
        
        if (!session) return false;
        
        const hasCookies = session.cookies && session.cookies.length > 0;
        const hasLocalStorage = session.localStorage && Object.keys(session.localStorage).length > 0;
        
        if (!hasCookies && !hasLocalStorage) return false;

        // Check if saved more than 24 hours ago
        const savedAt = new Date(session.savedAt);
        const hoursSinceSaved = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceSaved > 24) {
            console.log(`[Auth] Session is ${Math.round(hoursSinceSaved)} hours old - may be expired`);
            return false;
        }

        return true;
    }

    async deleteSession(projectName) {
        const sessionPath = this.getSessionPath(projectName);
        if (await fs.pathExists(sessionPath)) {
            await fs.remove(sessionPath);
        }
        return { success: true };
    }

    // ============================================
    // SMART AUTH DETECTION (Using Project Config)
    // ============================================

    async isLoggedIn(page, storageService = null, projectName = null) {
        const currentUrl = page.url();
        
        // Get project-specific auth pages if available
        let authPages = this.defaultLoginPatterns;
        if (storageService && projectName) {
            try {
                const config = await storageService.getProjectConfig(projectName);
                if (config.authPages && config.authPages.length > 0) {
                    // Combine project-specific with defaults
                    authPages = [...new Set([...config.authPages, ...this.defaultLoginPatterns])];
                }
            } catch (e) {
                console.log('[Auth] Could not load project config, using defaults');
            }
        }

        // Check 1: URL-based detection
        for (const pattern of authPages) {
            if (currentUrl.toLowerCase().includes(pattern.toLowerCase())) {
                console.log(`[Auth] Detected auth page via URL pattern "${pattern}": ${currentUrl}`);
                return false;
            }
        }

        // Check 2: Login form detection (password field visible)
        const hasLoginForm = await page.evaluate(() => {
            const passwordInput = document.querySelector('input[type="password"]');
            if (passwordInput && passwordInput.offsetParent !== null) {
                return true;
            }

            // Check for OAuth buttons
            const oauthSelectors = [
                '[data-provider="google"]', '.google-sign-in',
                '[href*="accounts.google.com"]', '[href*="oauth"]',
                '[href*="login.microsoftonline.com"]'
            ];
            
            for (const sel of oauthSelectors) {
                const el = document.querySelector(sel);
                if (el && el.offsetParent !== null) {
                    return true;
                }
            }

            return false;
        }).catch(() => false);

        if (hasLoginForm) {
            console.log('[Auth] Detected login form on page');
            return false;
        }

        // Check 3: Auth tokens in storage
        const hasAuthTokens = await page.evaluate((tokenKeys) => {
            for (const key of tokenKeys) {
                const value = localStorage.getItem(key);
                if (value && value.length > 10) return true;
                
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.toLowerCase().includes(key.toLowerCase())) {
                        const val = localStorage.getItem(k);
                        if (val && val.length > 10) return true;
                    }
                }
            }
            return false;
        }, this.authTokenKeys).catch(() => false);

        // Check 4: User UI indicators
        const hasUserIndicators = await page.evaluate(() => {
            const indicators = [
                '[class*="user-menu"]', '[class*="user-avatar"]',
                '[class*="profile"]', '[class*="logout"]',
                '[class*="sign-out"]', '.avatar', '#user-dropdown',
                '[aria-label*="account"]', '[aria-label*="profile"]',
                '[class*="header"] [class*="user"]'
            ];
            
            for (const sel of indicators) {
                const el = document.querySelector(sel);
                if (el && el.offsetParent !== null) {
                    return true;
                }
            }
            return false;
        }).catch(() => false);

        const isLoggedIn = hasAuthTokens || hasUserIndicators;
        console.log(`[Auth] Auth check: tokens=${hasAuthTokens}, userUI=${hasUserIndicators} => ${isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN'}`);
        
        return isLoggedIn;
    }

    // ============================================
    // SESSION RESTORE
    // ============================================

    async restoreSession(page, projectName) {
        const session = await this.getSession(projectName);
        
        if (!session) {
            return { success: false, reason: 'no_session' };
        }

        console.log(`[Auth] Restoring session from: ${session.savedAt}`);

        try {
            if (session.cookies && session.cookies.length > 0) {
                const validCookies = session.cookies.filter(c => c.name && c.value);
                if (validCookies.length > 0) {
                    await page.setCookie(...validCookies);
                    console.log(`[Auth] Restored ${validCookies.length} cookies`);
                }
            }

            if (session.localStorage || session.sessionStorage) {
                await page.evaluate((local, sess) => {
                    if (local) {
                        Object.entries(local).forEach(([key, value]) => {
                            try { localStorage.setItem(key, value); } catch (e) {}
                        });
                    }
                    if (sess) {
                        Object.entries(sess).forEach(([key, value]) => {
                            try { sessionStorage.setItem(key, value); } catch (e) {}
                        });
                    }
                }, session.localStorage, session.sessionStorage);
            }

            return { success: true, loginMethod: session.loginMethod };
        } catch (e) {
            console.error('[Auth] Session restore failed:', e);
            return { success: false, reason: e.message };
        }
    }

    // ============================================
    // CAPTURE SESSION
    // ============================================

    async captureCurrentSession(page, projectName, loginMethod = 'unknown') {
        try {
            const cookies = await page.cookies();
            const currentUrl = page.url();
            
            const storageData = await page.evaluate(() => {
                const local = {};
                const session = {};
                
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    local[key] = localStorage.getItem(key);
                }
                
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    session[key] = sessionStorage.getItem(key);
                }
                
                return { localStorage: local, sessionStorage: session };
            });

            await this.saveSession(projectName, {
                cookies,
                localStorage: storageData.localStorage,
                sessionStorage: storageData.sessionStorage,
                loginMethod,
                lastUrl: currentUrl
            });

            console.log(`[Auth] ✅ Session captured (${cookies.length} cookies)`);
            return { success: true };
        } catch (e) {
            console.error('[Auth] Session capture failed:', e);
            return { success: false, reason: e.message };
        }
    }

    // ============================================
    // LOGIN WIZARD UI
    // ============================================

    async setupLoginWizard(page) {
        await page.evaluate(() => {
            const existing = document.getElementById('__auth_wizard_banner');
            if (existing) existing.remove();

            const banner = document.createElement('div');
            banner.id = '__auth_wizard_banner';
            banner.innerHTML = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                    color: white;
                    padding: 14px 24px;
                    z-index: 2147483647;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                ">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 28px;">🔐</span>
                        <div>
                            <div style="font-weight: 700; font-size: 16px;">Đăng nhập để tiếp tục Replay</div>
                            <div style="font-size: 13px; opacity: 0.95; margin-top: 2px;">
                                Sử dụng <strong>bất kỳ phương thức</strong> (Google, Password, SSO...) → Nhấn 
                                <kbd style="background: rgba(255,255,255,0.25); padding: 3px 8px; border-radius: 4px; font-weight: bold; margin: 0 4px;">F2</kbd>
                                khi xong
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <button id="__auth_confirm_btn" style="
                            background: #10b981;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 8px;
                            font-weight: 600;
                            cursor: pointer;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            transition: all 0.2s;
                            box-shadow: 0 2px 8px rgba(16,185,129,0.4);
                        ">
                            ✅ Đã đăng nhập xong
                        </button>
                        <button id="__auth_cancel_btn" style="
                            background: rgba(255,255,255,0.15);
                            color: white;
                            border: 1px solid rgba(255,255,255,0.3);
                            padding: 12px 20px;
                            border-radius: 8px;
                            font-weight: 500;
                            cursor: pointer;
                            font-size: 14px;
                        ">
                            ❌ Hủy Replay
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(banner);
            document.body.style.marginTop = '70px';

            // Button handlers
            document.getElementById('__auth_confirm_btn').onclick = () => {
                window.__authWizardResult = 'confirmed';
            };
            document.getElementById('__auth_cancel_btn').onclick = () => {
                window.__authWizardResult = 'cancelled';
            };

            // Keyboard handlers
            document.addEventListener('keydown', (e) => {
                if (e.key === 'F2') {
                    e.preventDefault();
                    window.__authWizardResult = 'confirmed';
                }
                if (e.key === 'Escape' && e.shiftKey) {
                    window.__authWizardResult = 'cancelled';
                }
            });
        });
    }

    async removeLoginWizard(page) {
        await page.evaluate(() => {
            const banner = document.getElementById('__auth_wizard_banner');
            if (banner) banner.remove();
            document.body.style.marginTop = '';
        }).catch(() => {});
    }

    async waitForLoginConfirmation(page, timeout = 300000) {
        console.log('[Auth] ⏳ Waiting for login... (Press F2 when done)');

        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const result = await page.evaluate(() => {
                const r = window.__authWizardResult;
                window.__authWizardResult = null;
                return r;
            }).catch(() => null);

            if (result === 'confirmed') {
                return { success: true, action: 'confirmed' };
            }
            if (result === 'cancelled') {
                return { success: false, action: 'cancelled' };
            }

            await new Promise(r => setTimeout(r, 500));
        }

        return { success: false, action: 'timeout' };
    }

    // ============================================
    // MAIN AUTH FLOW
    // ============================================

    async ensureAuthenticated(page, projectName, targetUrl, storageService) {
        console.log('[Auth] 🔐 Starting authentication check...');

        // Step 1: Restore session before navigation
        const session = await this.getSession(projectName);
        if (session) {
            console.log('[Auth] Found saved session, restoring...');
            await this.restoreSession(page, projectName);
        }

        // Step 2: Navigate to target
        try {
            await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.log('[Auth] Navigation issue:', e.message);
        }

        // Step 3: Check if logged in (using project config)
        let isLoggedIn = await this.isLoggedIn(page, storageService, projectName);

        if (isLoggedIn) {
            console.log('[Auth] ✅ Already authenticated');
            await this.captureCurrentSession(page, projectName, session?.loginMethod || 'restored');
            return { authenticated: true, method: 'session_restore' };
        }

        // Step 4: Need manual login
        console.log('[Auth] ⚠️ Login required - showing Login Wizard...');
        
        await this.setupLoginWizard(page);
        const loginResult = await this.waitForLoginConfirmation(page);
        await this.removeLoginWizard(page);

        if (!loginResult.success) {
            return { 
                authenticated: false, 
                reason: loginResult.action === 'cancelled' ? 'User cancelled' : 'Login timeout'
            };
        }

        // Step 5: Verify and save
        await new Promise(r => setTimeout(r, 2000));
        isLoggedIn = await this.isLoggedIn(page, storageService, projectName);

        if (!isLoggedIn) {
            // Try navigating to target again
            try {
                await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
                await new Promise(r => setTimeout(r, 2000));
                isLoggedIn = await this.isLoggedIn(page, storageService, projectName);
            } catch (e) {}
        }

        if (isLoggedIn) {
            await this.captureCurrentSession(page, projectName, 'manual');
            console.log('[Auth] ✅ Login successful, session saved');
            return { authenticated: true, method: 'manual_login' };
        }

        return { authenticated: false, reason: 'Login verification failed' };
    }
}

module.exports = new AuthService();
