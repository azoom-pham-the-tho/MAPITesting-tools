/**
 * Simple Settings Panel
 * Focus on Performance settings and essential preferences
 */

(function () {
  'use strict';

  const Settings = {
    // Default settings
    defaults: {
      performanceMode: 'auto',
      fpsTarget: 60,
      imageQuality: 'high',
      animations: true,
      theme: 'dark'
    },

    current: {},

    init() {
      this.load();
      this.applySettings();
      this.createSettingsButton();
    },

    load() {
      try {
        const saved = localStorage.getItem('mapit-settings');
        this.current = saved ? JSON.parse(saved) : { ...this.defaults };
      } catch (e) {
        this.current = { ...this.defaults };
      }
    },

    save() {
      try {
        localStorage.setItem('mapit-settings', JSON.stringify(this.current));
      } catch (e) {
        console.warn('Failed to save settings:', e);
      }
    },

    createSettingsButton() {
      // Create settings button in header
      const headerActions = document.getElementById('headerActions');
      if (headerActions) {
        const settingsBtn = document.createElement('button');
        settingsBtn.id = 'settingsBtn';
        settingsBtn.className = 'header-action-btn';
        settingsBtn.title = 'Settings';
        settingsBtn.setAttribute('aria-label', 'Settings');
        settingsBtn.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        `;
        settingsBtn.addEventListener('click', () => this.openPanel());

        // Insert as first child in header actions
        headerActions.insertBefore(settingsBtn, headerActions.firstChild);
      }
    },

    load() {
      try {
        const saved = localStorage.getItem('mapit-settings');
        this.current = saved ? JSON.parse(saved) : { ...this.defaults };
      } catch (e) {
        this.current = { ...this.defaults };
      }
    },

    save() {
      try {
        localStorage.setItem('mapit-settings', JSON.stringify(this.current));
      } catch (e) {
        console.warn('Failed to save settings:', e);
      }
    },

    openPanel() {
      // Remove existing panel
      const existing = document.getElementById('settingsPanel');
      if (existing) existing.remove();

      // Create overlay
      const overlay = document.createElement('div');
      overlay.id = 'settingsPanel';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.15s ease;
      `;

      // Create modal
      const modal = document.createElement('div');
      modal.style.cssText = `
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        overflow: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        transform: scale(0.98);
        transition: transform 0.15s ease;
        will-change: transform;
      `;

      modal.innerHTML = `
        <div style="padding: 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 18px; color: var(--text-primary);">⚙️ Settings</h2>
          <button id="closeSettings" style="background: none; border: none; color: var(--text-secondary); font-size: 24px; cursor: pointer; padding: 0; width: 32px; height: 32px;">&times;</button>
        </div>
        <div style="padding: 20px;">
          ${this.renderSettings()}
        </div>
        <div style="padding: 20px; border-top: 1px solid var(--border-color); display: flex; gap: 12px; justify-content: flex-end;">
          <button id="resetSettings" class="btn btn-secondary btn-sm">Reset to Default</button>
          <button id="saveSettings" class="btn btn-primary btn-sm">Save</button>
        </div>
      `;

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Smooth fade-in animation
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        modal.style.transform = 'scale(1)';
      });

      // Event listeners
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closePanel();
      });

      document.getElementById('closeSettings').addEventListener('click', () => this.closePanel());
      document.getElementById('saveSettings').addEventListener('click', () => this.saveAndClose());
      document.getElementById('resetSettings').addEventListener('click', () => this.reset());

      // Bind inputs AFTER modal is visible (defer heavy operations)
      requestAnimationFrame(() => {
        this.bindInputs();
      });
    },

    renderSettings() {
      return `
        <!-- Performance Mode -->
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">
            Performance Mode
          </label>
          <select id="setting-performanceMode" style="width: 100%; padding: 8px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 13px;">
            <option value="auto" ${this.current.performanceMode === 'auto' ? 'selected' : ''}>Auto (Recommended)</option>
            <option value="high" ${this.current.performanceMode === 'high' ? 'selected' : ''}>High Performance</option>
            <option value="medium" ${this.current.performanceMode === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="low" ${this.current.performanceMode === 'low' ? 'selected' : ''}>Low (Battery Saver)</option>
          </select>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
            Auto mode adjusts quality based on device performance
          </div>
        </div>

        <!-- FPS Target -->
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">
            FPS Target
          </label>
          <select id="setting-fpsTarget" style="width: 100%; padding: 8px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 13px;">
            <option value="30" ${this.current.fpsTarget === 30 ? 'selected' : ''}>30 FPS (Better battery)</option>
            <option value="60" ${this.current.fpsTarget === 60 ? 'selected' : ''}>60 FPS (Smooth)</option>
          </select>
        </div>

        <!-- Image Quality -->
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">
            Image Quality
          </label>
          <select id="setting-imageQuality" style="width: 100%; padding: 8px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 13px;">
            <option value="high" ${this.current.imageQuality === 'high' ? 'selected' : ''}>High Quality</option>
            <option value="medium" ${this.current.imageQuality === 'medium' ? 'selected' : ''}>Medium Quality</option>
            <option value="low" ${this.current.imageQuality === 'low' ? 'selected' : ''}>Low Quality (Faster)</option>
          </select>
        </div>

        <!-- Animations -->
        <div style="margin-bottom: 24px;">
          <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
            <input type="checkbox" id="setting-animations" ${this.current.animations ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-primary);">
            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Enable Animations</span>
          </label>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px; margin-left: 30px;">
            Disable for better performance on slow devices
          </div>
        </div>

        <!-- Theme -->
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">
            Theme
          </label>
          <select id="setting-theme" style="width: 100%; padding: 8px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 6px; color: var(--text-primary); font-size: 13px;">
            <option value="dark" ${this.current.theme === 'dark' ? 'selected' : ''}>🌙 Dark</option>
            <option value="light" ${this.current.theme === 'light' ? 'selected' : ''}>☀️ Light</option>
          </select>
        </div>

        <!-- Performance Monitor -->
        <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px;">
          <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 12px;">
            ⚡ Performance Monitor
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px;">
            <div style="padding: 8px; background: var(--bg-primary); border-radius: 6px;">
              <div style="color: var(--text-muted); margin-bottom: 4px;">FPS</div>
              <div id="perf-fps" style="color: var(--success); font-weight: 600; font-size: 18px;">--</div>
            </div>
            <div style="padding: 8px; background: var(--bg-primary); border-radius: 6px;">
              <div style="color: var(--text-muted); margin-bottom: 4px;">Lag</div>
              <div id="perf-lag" style="color: var(--warning); font-weight: 600; font-size: 18px;">--</div>
            </div>
            <div style="padding: 8px; background: var(--bg-primary); border-radius: 6px;">
              <div style="color: var(--text-muted); margin-bottom: 4px;">Memory</div>
              <div id="perf-mem" style="color: var(--info); font-weight: 600; font-size: 18px;">--</div>
            </div>
            <div style="padding: 8px; background: var(--bg-primary); border-radius: 6px;">
              <div style="color: var(--text-muted); margin-bottom: 4px;">Quality</div>
              <div id="perf-quality" style="color: var(--accent-primary); font-weight: 600; font-size: 18px;">--</div>
            </div>
          </div>
        </div>

        <!-- Cache Management -->
        <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">💾 Cache Storage</span>
            <span id="cacheStorageSize" style="font-size: 12px; color: var(--warning);">Calculating...</span>
          </div>
          <button id="clearCacheBtn" class="btn btn-secondary btn-sm" style="width: 100%;">Clear All Cache</button>
        </div>
      `;
    },

    bindInputs() {
      // Update performance metrics less frequently
      this.lastPerfValues = {};
      this.updatePerformanceMetrics();
      this.perfInterval = setInterval(() => this.updatePerformanceMetrics(), 3000); // 3s instead of 1s

      // Update cache size
      this.calculateCacheSize().then(bytes => {
        const el = document.getElementById('cacheStorageSize');
        if (el) {
          const mb = (bytes / (1024 * 1024)).toFixed(1);
          const kb = Math.round(bytes / 1024);
          el.textContent = bytes > 1024 * 1024 ? `${mb} MB` : `${kb} KB`;
        }
      });

      // Clear cache button - custom handler without alert
      const clearBtn = document.getElementById('clearCacheBtn');
      if (clearBtn) {
        clearBtn.addEventListener('click', async () => {
          if (!confirm('Xóa toàn bộ cache?\n\nTrang sẽ reload sau khi xóa.')) return;

          clearBtn.disabled = true;
          clearBtn.textContent = 'Đang xóa...';

          try {
            // Clear all cache
            localStorage.clear();
            sessionStorage.clear();

            if ('indexedDB' in window) {
              const dbs = await indexedDB.databases();
              await Promise.all(dbs.map(db => {
                return new Promise((resolve) => {
                  const request = indexedDB.deleteDatabase(db.name);
                  request.onsuccess = () => resolve();
                  request.onerror = () => resolve();
                  request.onblocked = () => resolve();
                });
              }));
            }

            if ('caches' in window) {
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.map(name => caches.delete(name)));
            }

            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              await Promise.all(registrations.map(reg => reg.unregister()));
            }

            await new Promise(resolve => setTimeout(resolve, 500));

            // Reload without alert
            window.location.reload(true);
          } catch (error) {
            clearBtn.disabled = false;
            clearBtn.textContent = 'Clear All Cache';
            alert('Lỗi khi xóa cache: ' + error.message);
          }
        });
      }
    },

    updatePerformanceMetrics() {
      const fpsEl = document.getElementById('perf-fps');
      if (!fpsEl) return;

      // Use native browser performance APIs
      let fps, lag, mem, quality;

      // FPS estimation via frame timing
      const now = performance.now();
      if (this._lastFrameTime) {
        const delta = now - this._lastFrameTime;
        fps = Math.round(Math.min(60, 1000 / Math.max(delta, 1)));
      } else {
        fps = 60;
      }
      this._lastFrameTime = now;

      // Memory from browser API (Chrome only)
      if (performance.memory) {
        mem = Math.round((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100) + '%';
      } else {
        mem = 'N/A';
      }

      lag = '0%';
      quality = this.current.performanceMode === 'auto' ? 'AUTO' : this.current.performanceMode.charAt(0).toUpperCase();

      // Only update DOM if values changed (avoid unnecessary reflows)
      if (this.lastPerfValues.fps !== fps) {
        fpsEl.textContent = fps;
        this.lastPerfValues.fps = fps;
      }

      const lagEl = document.getElementById('perf-lag');
      if (lagEl && this.lastPerfValues.lag !== lag) {
        lagEl.textContent = lag;
        this.lastPerfValues.lag = lag;
      }

      const memEl = document.getElementById('perf-mem');
      if (memEl && this.lastPerfValues.mem !== mem) {
        memEl.textContent = mem;
        this.lastPerfValues.mem = mem;
      }

      const qualityEl = document.getElementById('perf-quality');
      if (qualityEl && this.lastPerfValues.quality !== quality) {
        qualityEl.textContent = quality;
        this.lastPerfValues.quality = quality;
      }
    },

    saveAndClose() {
      // Read all inputs
      this.current.performanceMode = document.getElementById('setting-performanceMode').value;
      this.current.fpsTarget = parseInt(document.getElementById('setting-fpsTarget').value);
      this.current.imageQuality = document.getElementById('setting-imageQuality').value;
      this.current.animations = document.getElementById('setting-animations').checked;
      this.current.theme = document.getElementById('setting-theme').value;

      this.save();
      this.applySettings();
      this.closePanel();

      if (window.toast) {
        window.toast.success('Settings saved!');
      }
    },

    reset() {
      if (confirm('Reset all settings to default?')) {
        this.current = { ...this.defaults };
        this.save();
        this.applySettings();
        this.closePanel();
        if (window.toast) {
          window.toast.info('Settings reset to default');
        }
      }
    },

    closePanel() {
      // Clear performance monitoring interval
      if (this.perfInterval) {
        clearInterval(this.perfInterval);
        this.perfInterval = null;
      }

      const panel = document.getElementById('settingsPanel');
      if (panel) panel.remove();
    },

    async calculateCacheSize() {
      // Modern Storage API (most accurate)
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          return estimate.usage || 0;
        } catch (e) { /* fallback below */ }
      }
      // Manual fallback
      let total = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) total += (localStorage[key].length + key.length) * 2;
      }
      for (let key in sessionStorage) {
        if (sessionStorage.hasOwnProperty(key)) total += (sessionStorage[key].length + key.length) * 2;
      }
      if ('indexedDB' in window) {
        try { const dbs = await indexedDB.databases(); total += dbs.length * 100 * 1024; } catch (e) { }
      }
      return total;
    },

    applySettings() {
      // Apply theme - always set data-theme attribute (CSS uses both [data-theme="dark"] and [data-theme="light"])
      document.documentElement.setAttribute('data-theme', this.current.theme);
      localStorage.setItem('mapit-theme', this.current.theme);

      // Apply animations
      if (!this.current.animations) {
        document.documentElement.style.setProperty('--transition-fast', '0s');
        document.documentElement.style.setProperty('--transition-normal', '0s');
        document.documentElement.style.setProperty('--transition-slow', '0s');
      } else {
        document.documentElement.style.removeProperty('--transition-fast');
        document.documentElement.style.removeProperty('--transition-normal');
        document.documentElement.style.removeProperty('--transition-slow');
      }
    }
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Settings.init());
  } else {
    Settings.init();
  }

  // Export globally
  window.AppSettings = Settings;
})();
