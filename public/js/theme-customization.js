/**
 * ThemeCustomization — Advanced theme settings with accent colors, font sizes,
 * density, border radius, and custom CSS injection.
 *
 * Extends the existing DashboardFeatures.theme toggle (dark/light) with a
 * full settings modal.  Integrates with existing CSS variables defined in
 * :root, :root[data-theme="light"], and :root[data-theme="high-contrast"].
 *
 * No emoji — SVG icons and safe Unicode only.
 */
const ThemeCustomization = {

  // ---------------------------------------------------------------------------
  //  DEFAULT SETTINGS
  // ---------------------------------------------------------------------------
  settings: {
    theme: 'dark',
    accentColor: '#667eea',
    accentSecondary: '#764ba2',
    fontSize: 'medium',
    density: 'comfortable',
    borderRadius: 12,
    customCSS: ''
  },

  STORAGE_KEY: 'mapit-theme-settings',

  ACCENT_PRESETS: [
    { name: 'Purple Blue', primary: '#667eea', secondary: '#764ba2' },
    { name: 'Ocean',       primary: '#2193b0', secondary: '#6dd5ed' },
    { name: 'Sunset',      primary: '#f12711', secondary: '#f5af19' },
    { name: 'Forest',      primary: '#11998e', secondary: '#38ef7d' },
    { name: 'Rose',        primary: '#ee0979', secondary: '#ff6a00' },
    { name: 'Midnight',    primary: '#4e54c8', secondary: '#8f94fb' }
  ],

  FONT_SIZES: {
    small:  '13px',
    medium: '14px',
    large:  '16px'
  },

  DENSITY_UNITS: {
    compact:     '4px',
    comfortable: '8px',
    spacious:    '12px'
  },

  // ---------------------------------------------------------------------------
  //  SVG ICONS (no emoji)
  // ---------------------------------------------------------------------------
  _icons: {
    gear: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="3"/>' +
      '<path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>' +
      '</svg>',

    close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',

    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="20 6 9 17 4 12"/></svg>',

    sun: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="5"/>' +
      '<line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>' +
      '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>' +
      '<line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>' +
      '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>' +
      '</svg>',

    moon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>',

    contrast: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 010 20V2z" fill="currentColor"/></svg>',

    reset: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>'
  },

  // ---------------------------------------------------------------------------
  //  INIT
  // ---------------------------------------------------------------------------
  init: function () {
    this.loadSettings();
    this.applySettings();
    this._injectStyles();
    this._addGearButton();
  },

  // ---------------------------------------------------------------------------
  //  PERSISTENCE
  // ---------------------------------------------------------------------------
  loadSettings: function () {
    try {
      var raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        // Merge with defaults — saved values override
        for (var key in saved) {
          if (saved.hasOwnProperty(key) && this.settings.hasOwnProperty(key)) {
            this.settings[key] = saved[key];
          }
        }
      }
    } catch (e) {
      console.warn('[ThemeCustomization] Failed to load settings:', e);
    }
  },

  saveSettings: function () {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('[ThemeCustomization] Failed to save settings:', e);
    }
  },

  // ---------------------------------------------------------------------------
  //  APPLY ALL SETTINGS
  // ---------------------------------------------------------------------------
  applySettings: function () {
    this.applyTheme(this.settings.theme);
    this.applyAccentColor(this.settings.accentColor, this.settings.accentSecondary);
    this.applyFontSize(this.settings.fontSize);
    this.applyDensity(this.settings.density);
    this.applyBorderRadius(this.settings.borderRadius);
    this.applyCustomCSS(this.settings.customCSS);
  },

  // ---------------------------------------------------------------------------
  //  INDIVIDUAL APPLIERS
  // ---------------------------------------------------------------------------
  applyTheme: function (theme) {
    this.settings.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);

    // Sync with DashboardFeatures.theme if available
    if (typeof DashboardFeatures !== 'undefined' && DashboardFeatures.theme) {
      DashboardFeatures.theme.current = theme;
      DashboardFeatures.theme.apply(theme);
    }

    // Sync with ThemeManager if available
    if (typeof window.themeManager !== 'undefined') {
      window.themeManager.theme = theme;
    }

    // Update legacy localStorage key used by DashboardFeatures
    try { localStorage.setItem('mapit-theme', theme); } catch (e) { /* ignore */ }
  },

  applyAccentColor: function (primary, secondary) {
    this.settings.accentColor = primary;
    this.settings.accentSecondary = secondary;

    var root = document.documentElement;
    root.style.setProperty('--accent-primary', primary);
    root.style.setProperty('--accent-secondary', secondary);
    root.style.setProperty('--accent-gradient',
      'linear-gradient(135deg, ' + primary + ' 0%, ' + secondary + ' 100%)');
    root.style.setProperty('--border-glow', primary + '80');
  },

  applyFontSize: function (size) {
    this.settings.fontSize = size;
    var px = this.FONT_SIZES[size] || this.FONT_SIZES.medium;
    document.documentElement.style.setProperty('--font-size-base', px);
    document.body.style.fontSize = px;
  },

  applyDensity: function (density) {
    this.settings.density = density;
    var unit = this.DENSITY_UNITS[density] || this.DENSITY_UNITS.comfortable;
    var unitNum = parseInt(unit, 10);
    var root = document.documentElement;
    root.style.setProperty('--spacing-unit', unit);
    root.style.setProperty('--spacing-xs', Math.max(2, unitNum / 2) + 'px');
    root.style.setProperty('--spacing-sm', unitNum + 'px');
    root.style.setProperty('--spacing-md', (unitNum * 2) + 'px');
    root.style.setProperty('--spacing-lg', (unitNum * 3) + 'px');
    root.style.setProperty('--spacing-xl', (unitNum * 4) + 'px');
  },

  applyBorderRadius: function (px) {
    this.settings.borderRadius = px;
    document.documentElement.style.setProperty('--border-radius', px + 'px');
    document.documentElement.style.setProperty('--border-radius-sm', Math.max(4, px - 4) + 'px');
  },

  applyCustomCSS: function (css) {
    this.settings.customCSS = css;
    var el = document.getElementById('mapit-custom-css');
    if (!el) {
      el = document.createElement('style');
      el.id = 'mapit-custom-css';
      document.head.appendChild(el);
    }
    el.textContent = css || '';
  },

  // ---------------------------------------------------------------------------
  //  RESET
  // ---------------------------------------------------------------------------
  resetToDefaults: function () {
    this.settings = {
      theme: 'dark',
      accentColor: '#667eea',
      accentSecondary: '#764ba2',
      fontSize: 'medium',
      density: 'comfortable',
      borderRadius: 12,
      customCSS: ''
    };
    this.applySettings();
    this.saveSettings();
  },

  // ---------------------------------------------------------------------------
  //  GEAR BUTTON (next to #themeToggleBtn)
  // ---------------------------------------------------------------------------
  _addGearButton: function () {
    // Try multiple strategies to find the theme toggle button
    var themeBtn = document.getElementById('themeToggleBtn') ||
                   document.getElementById('df-theme-toggle');

    var parent = null;
    if (themeBtn) {
      parent = themeBtn.parentElement;
    } else {
      // Fallback: header actions area
      parent = document.querySelector('.header-actions') ||
               document.querySelector('.header-right') ||
               document.querySelector('.app-header') ||
               document.querySelector('header');
    }
    if (!parent) return;

    // Don't add twice
    if (document.getElementById('tc-gear-btn')) return;

    var btn = document.createElement('button');
    btn.id = 'tc-gear-btn';
    btn.className = 'header-action-btn tc-gear-btn';
    btn.title = 'Theme Settings';
    btn.setAttribute('aria-label', 'Open theme settings');
    btn.innerHTML = this._icons.gear;

    var self = this;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      self.showSettingsModal();
    });

    // Insert right after themeToggleBtn if possible
    if (themeBtn && themeBtn.nextSibling) {
      parent.insertBefore(btn, themeBtn.nextSibling);
    } else {
      parent.appendChild(btn);
    }
  },

  // ---------------------------------------------------------------------------
  //  SETTINGS MODAL
  // ---------------------------------------------------------------------------
  showSettingsModal: function () {
    // Remove if already open
    var existing = document.getElementById('tc-settings-overlay');
    if (existing) { existing.remove(); return; }

    var self = this;

    // ---- overlay ----
    var overlay = document.createElement('div');
    overlay.id = 'tc-settings-overlay';
    overlay.className = 'theme-settings-overlay';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    // ---- modal container ----
    var modal = document.createElement('div');
    modal.className = 'theme-settings-modal';

    // ---- header ----
    var header = document.createElement('div');
    header.className = 'theme-settings-header';
    header.innerHTML =
      '<span style="font-size:16px;font-weight:600;color:var(--text-primary);">Theme Settings</span>' +
      '<button class="tc-modal-close" title="Close">' + this._icons.close + '</button>';
    header.querySelector('.tc-modal-close').addEventListener('click', function () {
      overlay.remove();
    });
    modal.appendChild(header);

    // ---- body ----
    var body = document.createElement('div');
    body.className = 'theme-settings-body';

    // 1. THEME SECTION
    body.appendChild(this._buildThemeSection());

    // 2. ACCENT COLOR SECTION
    body.appendChild(this._buildAccentSection());

    // 3. FONT SIZE SECTION
    body.appendChild(this._buildFontSizeSection());

    // 4. LAYOUT DENSITY SECTION
    body.appendChild(this._buildDensitySection());

    // 5. BORDER RADIUS SECTION
    body.appendChild(this._buildBorderRadiusSection());

    // 6. CUSTOM CSS SECTION
    body.appendChild(this._buildCustomCSSSection());

    modal.appendChild(body);

    // ---- footer ----
    var footer = document.createElement('div');
    footer.className = 'theme-settings-footer';
    footer.innerHTML =
      '<button class="tc-btn tc-btn-ghost" id="tc-reset-btn">' + this._icons.reset + ' Reset to Defaults</button>' +
      '<div class="tc-footer-right">' +
        '<button class="tc-btn tc-btn-ghost" id="tc-cancel-btn">Cancel</button>' +
        '<button class="tc-btn tc-btn-primary" id="tc-apply-btn">Apply</button>' +
      '</div>';
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // ---- wire footer buttons ----
    document.getElementById('tc-reset-btn').addEventListener('click', function () {
      self.resetToDefaults();
      overlay.remove();
      if (typeof DashboardFeatures !== 'undefined' && DashboardFeatures.notifications) {
        DashboardFeatures.notifications.add('Theme', 'Settings reset to defaults', 'info');
      }
    });

    // Save a snapshot of current settings before opening modal
    var settingsBeforeOpen = JSON.parse(JSON.stringify(self.settings));

    document.getElementById('tc-cancel-btn').addEventListener('click', function () {
      // Revert to pre-modal settings
      self.settings = settingsBeforeOpen;
      self.applySettings();
      overlay.remove();
    });

    document.getElementById('tc-apply-btn').addEventListener('click', function () {
      self.saveSettings();
      overlay.remove();
      if (typeof DashboardFeatures !== 'undefined' && DashboardFeatures.notifications) {
        DashboardFeatures.notifications.add('Theme', 'Settings applied', 'success');
      }
    });

    // ESC to close
    var escHandler = function (e) {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  },

  // ---------------------------------------------------------------------------
  //  SECTION BUILDERS
  // ---------------------------------------------------------------------------

  /** 1. Theme (Dark / Light / High Contrast) */
  _buildThemeSection: function () {
    var section = this._section('Theme');
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;';

    var themes = [
      { id: 'dark',          label: 'Dark',          icon: this._icons.moon },
      { id: 'light',         label: 'Light',         icon: this._icons.sun },
      { id: 'high-contrast', label: 'High Contrast', icon: this._icons.contrast }
    ];

    var self = this;
    themes.forEach(function (t) {
      var card = document.createElement('div');
      card.className = 'theme-card' + (self.settings.theme === t.id ? ' active' : '');
      card.setAttribute('data-theme-id', t.id);
      card.innerHTML =
        '<span class="tc-card-icon">' + t.icon + '</span>' +
        '<span class="tc-card-label">' + t.label + '</span>' +
        '<span class="tc-card-check">' + self._icons.check + '</span>';
      card.addEventListener('click', function () {
        wrap.querySelectorAll('.theme-card').forEach(function (c) { c.classList.remove('active'); });
        card.classList.add('active');
        self.applyTheme(t.id);
      });
      wrap.appendChild(card);
    });

    section.appendChild(wrap);
    return section;
  },

  /** 2. Accent Color (presets + custom picker) */
  _buildAccentSection: function () {
    var section = this._section('Accent Color');
    var self = this;

    // Preset swatches
    var swatchWrap = document.createElement('div');
    swatchWrap.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;';

    this.ACCENT_PRESETS.forEach(function (preset) {
      var swatch = document.createElement('div');
      swatch.className = 'accent-swatch' +
        (self.settings.accentColor === preset.primary ? ' active' : '');
      swatch.title = preset.name;
      swatch.style.background = 'linear-gradient(135deg, ' + preset.primary + ', ' + preset.secondary + ')';
      swatch.setAttribute('data-primary', preset.primary);
      swatch.setAttribute('data-secondary', preset.secondary);
      swatch.addEventListener('click', function () {
        swatchWrap.querySelectorAll('.accent-swatch').forEach(function (s) { s.classList.remove('active'); });
        swatch.classList.add('active');
        self.applyAccentColor(preset.primary, preset.secondary);
        // Update custom inputs
        var pi = document.getElementById('tc-accent-primary');
        var si = document.getElementById('tc-accent-secondary');
        if (pi) pi.value = preset.primary;
        if (si) si.value = preset.secondary;
        self._updateGradientPreview();
      });
      swatchWrap.appendChild(swatch);
    });

    section.appendChild(swatchWrap);

    // Custom color row
    var customRow = document.createElement('div');
    customRow.style.cssText = 'display:flex;gap:12px;align-items:center;flex-wrap:wrap;';

    customRow.innerHTML =
      '<div class="tc-color-field">' +
        '<label class="tc-label-sm">Primary</label>' +
        '<div class="tc-color-input-wrap">' +
          '<input type="color" id="tc-accent-picker-primary" value="' + this.settings.accentColor + '">' +
          '<input type="text" id="tc-accent-primary" class="tc-hex-input" value="' + this.settings.accentColor + '" maxlength="7" spellcheck="false">' +
        '</div>' +
      '</div>' +
      '<div class="tc-color-field">' +
        '<label class="tc-label-sm">Secondary</label>' +
        '<div class="tc-color-input-wrap">' +
          '<input type="color" id="tc-accent-picker-secondary" value="' + this.settings.accentSecondary + '">' +
          '<input type="text" id="tc-accent-secondary" class="tc-hex-input" value="' + this.settings.accentSecondary + '" maxlength="7" spellcheck="false">' +
        '</div>' +
      '</div>';

    section.appendChild(customRow);

    // Gradient preview bar
    var preview = document.createElement('div');
    preview.id = 'tc-gradient-preview';
    preview.className = 'accent-gradient-preview';
    preview.style.background = 'linear-gradient(135deg, ' + this.settings.accentColor + ' 0%, ' + this.settings.accentSecondary + ' 100%)';
    section.appendChild(preview);

    // Wire custom color events (after DOM insertion via setTimeout)
    var wireColors = function () {
      var pickerP = document.getElementById('tc-accent-picker-primary');
      var pickerS = document.getElementById('tc-accent-picker-secondary');
      var inputP  = document.getElementById('tc-accent-primary');
      var inputS  = document.getElementById('tc-accent-secondary');
      if (!pickerP) return;

      pickerP.addEventListener('input', function () {
        inputP.value = pickerP.value;
        self._applyCustomAccent();
      });
      pickerS.addEventListener('input', function () {
        inputS.value = pickerS.value;
        self._applyCustomAccent();
      });
      inputP.addEventListener('input', function () {
        if (/^#[0-9a-fA-F]{6}$/.test(inputP.value)) {
          pickerP.value = inputP.value;
          self._applyCustomAccent();
        }
      });
      inputS.addEventListener('input', function () {
        if (/^#[0-9a-fA-F]{6}$/.test(inputS.value)) {
          pickerS.value = inputS.value;
          self._applyCustomAccent();
        }
      });
    };
    setTimeout(wireColors, 0);

    return section;
  },

  _applyCustomAccent: function () {
    var p = document.getElementById('tc-accent-primary');
    var s = document.getElementById('tc-accent-secondary');
    if (!p || !s) return;
    // Deselect all preset swatches
    var swatches = document.querySelectorAll('.accent-swatch');
    swatches.forEach(function (sw) { sw.classList.remove('active'); });
    // Highlight matching preset if any
    swatches.forEach(function (sw) {
      if (sw.getAttribute('data-primary') === p.value &&
          sw.getAttribute('data-secondary') === s.value) {
        sw.classList.add('active');
      }
    });
    this.applyAccentColor(p.value, s.value);
    this._updateGradientPreview();
  },

  _updateGradientPreview: function () {
    var bar = document.getElementById('tc-gradient-preview');
    if (bar) {
      bar.style.background = 'linear-gradient(135deg, ' +
        this.settings.accentColor + ' 0%, ' +
        this.settings.accentSecondary + ' 100%)';
    }
  },

  /** 3. Font Size */
  _buildFontSizeSection: function () {
    var section = this._section('Font Size');
    var self = this;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start;';

    var sizes = [
      { id: 'small',  label: 'Small',  sub: '13px' },
      { id: 'medium', label: 'Medium', sub: '14px' },
      { id: 'large',  label: 'Large',  sub: '16px' }
    ];

    sizes.forEach(function (sz) {
      var radio = document.createElement('label');
      radio.className = 'tc-radio-card' + (self.settings.fontSize === sz.id ? ' active' : '');
      radio.innerHTML =
        '<input type="radio" name="tc-font-size" value="' + sz.id + '"' +
          (self.settings.fontSize === sz.id ? ' checked' : '') + '>' +
        '<span class="tc-radio-mark"></span>' +
        '<span class="tc-radio-text">' + sz.label + ' <span class="tc-radio-sub">(' + sz.sub + ')</span></span>';
      radio.querySelector('input').addEventListener('change', function () {
        wrap.querySelectorAll('.tc-radio-card').forEach(function (c) { c.classList.remove('active'); });
        radio.classList.add('active');
        self.applyFontSize(sz.id);
        self._updateFontPreview();
      });
      wrap.appendChild(radio);
    });

    section.appendChild(wrap);

    // Preview text
    var preview = document.createElement('div');
    preview.id = 'tc-font-preview';
    preview.className = 'tc-preview-text';
    preview.style.fontSize = this.FONT_SIZES[this.settings.fontSize];
    preview.textContent = 'The quick brown fox jumps over the lazy dog.';
    section.appendChild(preview);

    return section;
  },

  _updateFontPreview: function () {
    var el = document.getElementById('tc-font-preview');
    if (el) {
      el.style.fontSize = this.FONT_SIZES[this.settings.fontSize];
    }
  },

  /** 4. Layout Density */
  _buildDensitySection: function () {
    var section = this._section('Layout Density');
    var self = this;
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start;';

    var densities = [
      { id: 'compact',     label: 'Compact',     sub: '4px spacing' },
      { id: 'comfortable', label: 'Comfortable', sub: '8px spacing' },
      { id: 'spacious',    label: 'Spacious',    sub: '12px spacing' }
    ];

    densities.forEach(function (d) {
      var radio = document.createElement('label');
      radio.className = 'tc-radio-card' + (self.settings.density === d.id ? ' active' : '');
      radio.innerHTML =
        '<input type="radio" name="tc-density" value="' + d.id + '"' +
          (self.settings.density === d.id ? ' checked' : '') + '>' +
        '<span class="tc-radio-mark"></span>' +
        '<span class="tc-radio-text">' + d.label + ' <span class="tc-radio-sub">(' + d.sub + ')</span></span>';
      radio.querySelector('input').addEventListener('change', function () {
        wrap.querySelectorAll('.tc-radio-card').forEach(function (c) { c.classList.remove('active'); });
        radio.classList.add('active');
        self.applyDensity(d.id);
        self._updateDensityDiagram();
      });
      wrap.appendChild(radio);
    });

    section.appendChild(wrap);

    // Visual diagram
    var diagram = document.createElement('div');
    diagram.id = 'tc-density-diagram';
    diagram.className = 'tc-density-diagram';
    this._renderDensityDiagram(diagram);
    section.appendChild(diagram);

    return section;
  },

  _renderDensityDiagram: function (container) {
    var unit = parseInt(this.DENSITY_UNITS[this.settings.density], 10);
    container.innerHTML =
      '<div class="tc-density-row" style="gap:' + unit + 'px;">' +
        '<div class="tc-density-box"></div>' +
        '<div class="tc-density-box"></div>' +
        '<div class="tc-density-box"></div>' +
      '</div>' +
      '<div class="tc-density-label">' + unit + 'px gap</div>';
  },

  _updateDensityDiagram: function () {
    var el = document.getElementById('tc-density-diagram');
    if (el) this._renderDensityDiagram(el);
  },

  /** 5. Border Radius */
  _buildBorderRadiusSection: function () {
    var section = this._section('Border Radius');
    var self = this;

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:16px;';

    var slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'tc-radius-slider';
    slider.className = 'tc-slider';
    slider.min = '0';
    slider.max = '20';
    slider.value = String(this.settings.borderRadius);

    var valueLabel = document.createElement('span');
    valueLabel.id = 'tc-radius-value';
    valueLabel.className = 'tc-slider-value';
    valueLabel.textContent = this.settings.borderRadius + 'px';

    var previewBox = document.createElement('div');
    previewBox.id = 'tc-radius-preview';
    previewBox.className = 'tc-radius-preview';
    previewBox.style.borderRadius = this.settings.borderRadius + 'px';

    slider.addEventListener('input', function () {
      var val = parseInt(slider.value, 10);
      valueLabel.textContent = val + 'px';
      previewBox.style.borderRadius = val + 'px';
      self.applyBorderRadius(val);
    });

    row.appendChild(slider);
    row.appendChild(valueLabel);
    row.appendChild(previewBox);

    section.appendChild(row);
    return section;
  },

  /** 6. Custom CSS */
  _buildCustomCSSSection: function () {
    var section = this._section('Custom CSS');
    var self = this;

    var textarea = document.createElement('textarea');
    textarea.id = 'tc-custom-css-input';
    textarea.className = 'tc-textarea';
    textarea.rows = 5;
    textarea.placeholder = '/* Enter custom CSS rules here */\n.my-class { color: red; }';
    textarea.value = this.settings.customCSS || '';
    textarea.spellcheck = false;

    textarea.addEventListener('input', function () {
      self.applyCustomCSS(textarea.value);
    });

    section.appendChild(textarea);

    var warning = document.createElement('div');
    warning.className = 'tc-warning';
    warning.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>' +
      '<line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
      ' Custom CSS may break the UI. Use with caution.';
    section.appendChild(warning);

    return section;
  },

  // ---------------------------------------------------------------------------
  //  HELPERS
  // ---------------------------------------------------------------------------

  /** Create a settings section with title */
  _section: function (title) {
    var el = document.createElement('div');
    el.className = 'theme-settings-section';
    var t = document.createElement('div');
    t.className = 'theme-settings-section-title';
    t.textContent = title;
    el.appendChild(t);
    return el;
  },

  // ---------------------------------------------------------------------------
  //  INJECT STYLES
  // ---------------------------------------------------------------------------
  _injectStyles: function () {
    if (document.getElementById('tc-styles')) return;
    var style = document.createElement('style');
    style.id = 'tc-styles';
    style.textContent = [
      /* Overlay */
      '.theme-settings-overlay {',
      '  position: fixed; inset: 0; z-index: 10002;',
      '  background: rgba(0,0,0,0.6);',
      '  display: flex; align-items: center; justify-content: center;',
      '  backdrop-filter: blur(3px);',
      '  animation: tcFadeIn 0.15s ease;',
      '}',
      '@keyframes tcFadeIn { from { opacity: 0; } to { opacity: 1; } }',

      /* Modal */
      '.theme-settings-modal {',
      '  width: 90%; max-width: 560px; max-height: 80vh;',
      '  overflow-y: auto; overflow-x: hidden;',
      '  background: var(--bg-secondary, #1a1a2e);',
      '  border-radius: var(--border-radius, 12px);',
      '  border: 1px solid var(--border-color, rgba(255,255,255,0.1));',
      '  box-shadow: var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.5));',
      '  animation: tcSlideUp 0.2s ease;',
      '}',
      '@keyframes tcSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }',

      /* Scrollbar inside modal */
      '.theme-settings-modal::-webkit-scrollbar { width: 6px; }',
      '.theme-settings-modal::-webkit-scrollbar-track { background: transparent; }',
      '.theme-settings-modal::-webkit-scrollbar-thumb { background: var(--text-muted, #6b6b7b); border-radius: 3px; }',

      /* Header */
      '.theme-settings-header {',
      '  padding: 20px 24px;',
      '  border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.1));',
      '  display: flex; justify-content: space-between; align-items: center;',
      '  position: sticky; top: 0;',
      '  background: var(--bg-secondary, #1a1a2e);',
      '  z-index: 1;',
      '}',
      '.tc-modal-close {',
      '  background: none; border: none; color: var(--text-muted, #6b6b7b);',
      '  cursor: pointer; padding: 6px; border-radius: 6px;',
      '  display: flex; align-items: center; justify-content: center;',
      '  transition: all 0.15s;',
      '}',
      '.tc-modal-close:hover { color: var(--text-primary, #fff); background: var(--bg-glass, rgba(255,255,255,0.05)); }',

      /* Body */
      '.theme-settings-body { padding: 20px 24px; }',

      /* Section */
      '.theme-settings-section { margin-bottom: 24px; }',
      '.theme-settings-section:last-child { margin-bottom: 0; }',
      '.theme-settings-section-title {',
      '  font-size: 12px; font-weight: 600;',
      '  text-transform: uppercase; letter-spacing: 0.05em;',
      '  color: var(--text-muted, #6b6b7b);',
      '  margin-bottom: 12px;',
      '}',

      /* Theme cards */
      '.theme-card {',
      '  display: inline-flex; align-items: center; gap: 8px;',
      '  padding: 12px 16px;',
      '  border: 2px solid var(--border-color, rgba(255,255,255,0.1));',
      '  border-radius: 8px; cursor: pointer;',
      '  transition: all 0.15s;',
      '  color: var(--text-primary, #fff);',
      '  background: var(--bg-tertiary, #16213e);',
      '}',
      '.theme-card:hover { border-color: var(--text-muted, #6b6b7b); }',
      '.theme-card.active {',
      '  border-color: var(--accent-primary, #667eea);',
      '  background: rgba(102,126,234,0.1);',
      '}',
      '.tc-card-icon { display: flex; align-items: center; }',
      '.tc-card-label { font-size: 13px; font-weight: 500; }',
      '.tc-card-check {',
      '  display: none; color: var(--accent-primary, #667eea);',
      '  margin-left: 4px;',
      '}',
      '.theme-card.active .tc-card-check { display: flex; }',

      /* Accent swatches */
      '.accent-swatch {',
      '  width: 32px; height: 32px; border-radius: 50%;',
      '  cursor: pointer;',
      '  border: 3px solid transparent;',
      '  transition: all 0.15s;',
      '  flex-shrink: 0;',
      '}',
      '.accent-swatch:hover { transform: scale(1.1); }',
      '.accent-swatch.active {',
      '  border-color: var(--text-primary, #fff);',
      '  transform: scale(1.15);',
      '  box-shadow: 0 0 0 2px var(--bg-secondary, #1a1a2e);',
      '}',

      /* Gradient preview */
      '.accent-gradient-preview {',
      '  height: 8px; border-radius: 4px; margin-top: 12px;',
      '}',

      /* Color field */
      '.tc-color-field { display: flex; flex-direction: column; gap: 4px; }',
      '.tc-label-sm { font-size: 11px; color: var(--text-muted, #6b6b7b); font-weight: 500; }',
      '.tc-color-input-wrap {',
      '  display: flex; align-items: center; gap: 6px;',
      '}',
      '.tc-color-input-wrap input[type="color"] {',
      '  width: 28px; height: 28px; padding: 0; border: none;',
      '  background: none; cursor: pointer; border-radius: 4px;',
      '}',
      '.tc-color-input-wrap input[type="color"]::-webkit-color-swatch-wrapper { padding: 2px; }',
      '.tc-color-input-wrap input[type="color"]::-webkit-color-swatch { border-radius: 3px; border: none; }',
      '.tc-hex-input {',
      '  width: 80px; padding: 4px 8px;',
      '  background: var(--bg-tertiary, #16213e);',
      '  border: 1px solid var(--border-color, rgba(255,255,255,0.1));',
      '  border-radius: 6px;',
      '  color: var(--text-primary, #fff);',
      '  font-family: monospace; font-size: 13px;',
      '}',
      '.tc-hex-input:focus { outline: none; border-color: var(--accent-primary, #667eea); }',

      /* Radio cards */
      '.tc-radio-card {',
      '  display: inline-flex; align-items: center; gap: 8px;',
      '  padding: 10px 14px;',
      '  border: 2px solid var(--border-color, rgba(255,255,255,0.1));',
      '  border-radius: 8px; cursor: pointer;',
      '  transition: all 0.15s;',
      '  color: var(--text-primary, #fff);',
      '  background: var(--bg-tertiary, #16213e);',
      '}',
      '.tc-radio-card:hover { border-color: var(--text-muted, #6b6b7b); }',
      '.tc-radio-card.active {',
      '  border-color: var(--accent-primary, #667eea);',
      '  background: rgba(102,126,234,0.08);',
      '}',
      '.tc-radio-card input[type="radio"] { display: none; }',
      '.tc-radio-mark {',
      '  width: 16px; height: 16px; border-radius: 50%;',
      '  border: 2px solid var(--text-muted, #6b6b7b);',
      '  display: flex; align-items: center; justify-content: center;',
      '  transition: all 0.15s; flex-shrink: 0;',
      '}',
      '.tc-radio-card.active .tc-radio-mark {',
      '  border-color: var(--accent-primary, #667eea);',
      '  background: var(--accent-primary, #667eea);',
      '  box-shadow: inset 0 0 0 3px var(--bg-tertiary, #16213e);',
      '}',
      '.tc-radio-text { font-size: 13px; font-weight: 500; }',
      '.tc-radio-sub { font-size: 11px; color: var(--text-muted, #6b6b7b); font-weight: 400; }',

      /* Font preview */
      '.tc-preview-text {',
      '  margin-top: 12px; padding: 12px 16px;',
      '  background: var(--bg-tertiary, #16213e);',
      '  border-radius: 8px; color: var(--text-secondary, #a0a0b0);',
      '  border: 1px solid var(--border-color, rgba(255,255,255,0.1));',
      '  transition: font-size 0.2s;',
      '}',

      /* Density diagram */
      '.tc-density-diagram {',
      '  margin-top: 12px; padding: 16px;',
      '  background: var(--bg-tertiary, #16213e);',
      '  border-radius: 8px;',
      '  border: 1px solid var(--border-color, rgba(255,255,255,0.1));',
      '}',
      '.tc-density-row {',
      '  display: flex; transition: gap 0.2s;',
      '}',
      '.tc-density-box {',
      '  width: 40px; height: 24px;',
      '  background: var(--accent-primary, #667eea);',
      '  border-radius: 4px; opacity: 0.6;',
      '}',
      '.tc-density-label {',
      '  font-size: 11px; color: var(--text-muted, #6b6b7b);',
      '  margin-top: 8px; text-align: center;',
      '}',

      /* Slider */
      '.tc-slider {',
      '  flex: 1; height: 4px; -webkit-appearance: none; appearance: none;',
      '  background: var(--bg-tertiary, #16213e);',
      '  border-radius: 2px; outline: none;',
      '}',
      '.tc-slider::-webkit-slider-thumb {',
      '  -webkit-appearance: none; appearance: none;',
      '  width: 18px; height: 18px; border-radius: 50%;',
      '  background: var(--accent-primary, #667eea);',
      '  cursor: pointer; border: 2px solid var(--bg-secondary, #1a1a2e);',
      '}',
      '.tc-slider::-moz-range-thumb {',
      '  width: 18px; height: 18px; border-radius: 50%;',
      '  background: var(--accent-primary, #667eea);',
      '  cursor: pointer; border: 2px solid var(--bg-secondary, #1a1a2e);',
      '}',
      '.tc-slider-value {',
      '  font-size: 13px; font-weight: 600;',
      '  color: var(--text-primary, #fff);',
      '  min-width: 38px; text-align: center;',
      '}',

      /* Radius preview */
      '.tc-radius-preview {',
      '  width: 48px; height: 32px;',
      '  background: var(--accent-primary, #667eea);',
      '  transition: border-radius 0.15s;',
      '  opacity: 0.7; flex-shrink: 0;',
      '}',

      /* Textarea */
      '.tc-textarea {',
      '  width: 100%; padding: 12px;',
      '  background: var(--bg-tertiary, #16213e);',
      '  border: 1px solid var(--border-color, rgba(255,255,255,0.1));',
      '  border-radius: 8px;',
      '  color: var(--text-primary, #fff);',
      '  font-family: "SF Mono", Menlo, Consolas, monospace;',
      '  font-size: 12px; line-height: 1.5;',
      '  resize: vertical; min-height: 80px;',
      '}',
      '.tc-textarea:focus { outline: none; border-color: var(--accent-primary, #667eea); }',
      '.tc-textarea::placeholder { color: var(--text-muted, #6b6b7b); }',

      /* Warning */
      '.tc-warning {',
      '  margin-top: 8px; padding: 8px 12px;',
      '  background: var(--warning-bg, rgba(255,212,59,0.15));',
      '  border-radius: 6px;',
      '  font-size: 11px; color: var(--warning, #ffd43b);',
      '  display: flex; align-items: center; gap: 6px;',
      '}',

      /* Footer */
      '.theme-settings-footer {',
      '  padding: 16px 24px;',
      '  border-top: 1px solid var(--border-color, rgba(255,255,255,0.1));',
      '  display: flex; justify-content: space-between; align-items: center;',
      '  position: sticky; bottom: 0;',
      '  background: var(--bg-secondary, #1a1a2e);',
      '}',
      '.tc-footer-right { display: flex; gap: 8px; }',

      /* Buttons */
      '.tc-btn {',
      '  padding: 8px 16px; border-radius: 8px;',
      '  font-size: 13px; font-weight: 500;',
      '  cursor: pointer; border: none;',
      '  display: inline-flex; align-items: center; gap: 6px;',
      '  transition: all 0.15s;',
      '}',
      '.tc-btn-primary {',
      '  background: var(--accent-primary, #667eea);',
      '  color: #fff;',
      '}',
      '.tc-btn-primary:hover { opacity: 0.9; }',
      '.tc-btn-ghost {',
      '  background: transparent;',
      '  color: var(--text-secondary, #a0a0b0);',
      '  border: 1px solid var(--border-color, rgba(255,255,255,0.1));',
      '}',
      '.tc-btn-ghost:hover {',
      '  color: var(--text-primary, #fff);',
      '  background: var(--bg-glass, rgba(255,255,255,0.05));',
      '}',

      /* Gear button in header */
      '.tc-gear-btn {',
      '  background: none; border: none;',
      '  color: var(--text-primary, #e0e0e0);',
      '  cursor: pointer; padding: 6px 8px;',
      '  border-radius: 6px; display: inline-flex;',
      '  align-items: center; justify-content: center;',
      '  transition: all 0.2s;',
      '}',
      '.tc-gear-btn:hover {',
      '  background: var(--bg-glass, rgba(255,255,255,0.1));',
      '  transform: rotate(30deg);',
      '}',

      ''
    ].join('\n');
    document.head.appendChild(style);
  }
};

// =============================================================================
//  AUTO-INIT
// =============================================================================
(function () {
  function boot() {
    ThemeCustomization.init();
    console.log('[ThemeCustomization] Initialized. Click the gear icon to open theme settings.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
