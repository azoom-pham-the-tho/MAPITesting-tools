/**
 * Theme Manager
 * Handles theme switching, font size adjustment, and preference persistence
 */

class ThemeManager {
  constructor() {
    this.theme = 'dark'; // default
    this.fontSize = 'medium'; // default
    this.storageKey = 'mapit-theme-preferences';

    this.init();
  }

  /**
   * Initialize theme manager
   */
  init() {
    // Load saved preferences
    this.loadPreferences();

    // Apply theme and font size
    this.applyTheme(this.theme);
    this.applyFontSize(this.fontSize);

    // Bind events
    this.bindEvents();

    // Update UI controls
    this.updateControlsUI();
  }

  /**
   * Load preferences from localStorage
   */
  loadPreferences() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const prefs = JSON.parse(saved);
        this.theme = prefs.theme || 'dark';
        this.fontSize = prefs.fontSize || 'medium';
      }
    } catch (e) {
      console.warn('Failed to load theme preferences:', e);
    }
  }

  /**
   * Save preferences to localStorage
   */
  savePreferences() {
    try {
      const prefs = {
        theme: this.theme,
        fontSize: this.fontSize
      };
      localStorage.setItem(this.storageKey, JSON.stringify(prefs));
    } catch (e) {
      console.warn('Failed to save theme preferences:', e);
    }
  }

  /**
   * Apply theme
   */
  applyTheme(themeName) {
    this.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const colors = {
        light: '#ffffff',
        dark: '#1a1a1a',
        'high-contrast': '#000000'
      };
      metaThemeColor.setAttribute('content', colors[themeName] || colors.dark);
    }

    this.savePreferences();
    this.updateControlsUI();
  }

  /**
   * Apply font size
   */
  applyFontSize(size) {
    this.fontSize = size;
    document.documentElement.setAttribute('data-font-size', size);
    this.savePreferences();
    this.updateControlsUI();
  }

  /**
   * Toggle between light and dark theme
   */
  toggleTheme() {
    const newTheme = this.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  }

  /**
   * Cycle through themes
   */
  cycleTheme() {
    const themes = ['light', 'dark', 'high-contrast'];
    const currentIndex = themes.indexOf(this.theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    this.applyTheme(themes[nextIndex]);
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Theme toggle button
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Theme selector dropdown
    const themeSelectorBtn = document.getElementById('themeSelectorBtn');
    const themeDropdown = document.getElementById('themeDropdown');

    if (themeSelectorBtn && themeDropdown) {
      // Toggle dropdown
      themeSelectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        themeDropdown.classList.toggle('active');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!themeSelectorBtn.contains(e.target) && !themeDropdown.contains(e.target)) {
          themeDropdown.classList.remove('active');
        }
      });

      // Theme option clicks
      themeDropdown.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => {
          const theme = option.dataset.theme;
          this.applyTheme(theme);
          themeDropdown.classList.remove('active');
        });
      });
    }

    // Font size buttons
    document.querySelectorAll('.font-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.dataset.size;
        this.applyFontSize(size);
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + T: Toggle theme
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        this.toggleTheme();
      }

      // Ctrl/Cmd + Shift + +: Increase font size
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '+') {
        e.preventDefault();
        const sizes = ['small', 'medium', 'large'];
        const currentIndex = sizes.indexOf(this.fontSize);
        if (currentIndex < sizes.length - 1) {
          this.applyFontSize(sizes[currentIndex + 1]);
        }
      }

      // Ctrl/Cmd + Shift + -: Decrease font size
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === '-') {
        e.preventDefault();
        const sizes = ['small', 'medium', 'large'];
        const currentIndex = sizes.indexOf(this.fontSize);
        if (currentIndex > 0) {
          this.applyFontSize(sizes[currentIndex - 1]);
        }
      }
    });
  }

  /**
   * Update UI controls to reflect current state
   */
  updateControlsUI() {
    // Update theme toggle icon
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      // Use existing SVG icons in HTML instead of replacing innerHTML
      const iconSun = document.getElementById('themeIconSun');
      const iconMoon = document.getElementById('themeIconMoon');

      if (iconSun && iconMoon) {
        // Toggle visibility of existing icons
        if (this.theme === 'dark') {
          // Dark mode: show sun icon (to switch to light)
          iconSun.style.display = 'block';
          iconMoon.style.display = 'none';
        } else {
          // Light mode: show moon icon (to switch to dark)
          iconSun.style.display = 'none';
          iconMoon.style.display = 'block';
        }
      }

      themeToggleBtn.title = this.theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }

    // Update theme dropdown active state
    document.querySelectorAll('.theme-option').forEach(option => {
      if (option.dataset.theme === this.theme) {
        option.classList.add('active');
      } else {
        option.classList.remove('active');
      }
    });

    // Update font size buttons
    document.querySelectorAll('.font-size-btn').forEach(btn => {
      if (btn.dataset.size === this.fontSize) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  /**
   * Get current theme
   */
  getCurrentTheme() {
    return this.theme;
  }

  /**
   * Get current font size
   */
  getCurrentFontSize() {
    return this.fontSize;
  }
}

// Initialize theme manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
  });
} else {
  window.themeManager = new ThemeManager();
}
