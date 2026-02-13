/**
 * UX Enhancements - Performance Optimized
 * Consolidated: keyboard shortcuts, search, auto-save, notifications, context menus
 * Designed for smooth performance even on weak machines
 */

(function () {
  'use strict';

  // ========================================
  // Performance Utilities
  // ========================================

  function debounce(fn, delay = 150) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function throttle(fn, limit = 16) {
    let inThrottle = false;
    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // ========================================
  // Button Ripple Effect
  // ========================================

  function initRippleEffect() {
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('.btn');
      if (!btn || btn.disabled) return;

      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ripple = document.createElement('span');
      ripple.className = 'btn-ripple';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';

      btn.appendChild(ripple);

      ripple.addEventListener('animationend', function() {
        ripple.remove();
      }, { once: true });
    });
  }

  // ========================================
  // Loading Bar
  // ========================================

  const loadingBar = {
    el: null,
    activeRequests: 0,

    init() {
      this.el = document.createElement('div');
      this.el.className = 'loading-bar';
      document.body.prepend(this.el);
    },

    start() {
      this.activeRequests++;
      if (this.activeRequests === 1 && this.el) {
        this.el.className = 'loading-bar active';
      }
    },

    finish() {
      this.activeRequests = Math.max(0, this.activeRequests - 1);
      if (this.activeRequests === 0 && this.el) {
        this.el.className = 'loading-bar complete';
        setTimeout(() => {
          if (this.activeRequests === 0 && this.el) {
            this.el.className = 'loading-bar';
          }
        }, 500);
      }
    }
  };

  // Intercept fetch for automatic loading bar
  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    loadingBar.start();
    return originalFetch.apply(this, args)
      .then(response => {
        loadingBar.finish();
        return response;
      })
      .catch(err => {
        loadingBar.finish();
        throw err;
      });
  };

  // ========================================
  // Toast Notification System
  // ========================================

  const toast = {
    _container: null,
    _maxToasts: 5,

    init() {
      // Called from init() for backward compatibility
      this._ensureContainer();
    },

    _ensureContainer() {
      if (this._container) return this._container;
      this._container = document.createElement('div');
      this._container.className = 'toast-container';
      document.body.appendChild(this._container);
      return this._container;
    },

    _getIcon(type) {
      switch (type) {
        case 'success': return '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>';
        case 'error': return '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>';
        case 'warning': return '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8.22 1.754a.25.25 0 00-.44 0L1.698 13.132a.25.25 0 00.22.368h12.164a.25.25 0 00.22-.368L8.22 1.754zm-1.763-.707c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z"/></svg>';
        case 'info': return '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm6.5-.25A.75.75 0 017.25 7h1a.75.75 0 01.75.75v2.75h.25a.75.75 0 010 1.5h-2a.75.75 0 010-1.5h.25v-2h-.25a.75.75 0 01-.75-.75zM8 6a1 1 0 100-2 1 1 0 000 2z"/></svg>';
        default: return '';
      }
    },

    show(message, type = 'info', duration = 5000, title = '') {
      const container = this._ensureContainer();

      // Limit toasts
      while (container.children.length >= this._maxToasts) {
        this._remove(container.firstChild);
      }

      const el = document.createElement('div');
      el.className = 'toast toast-' + type;
      el.style.position = 'relative';

      el.innerHTML =
        '<span class="toast-icon">' + this._getIcon(type) + '</span>' +
        '<div class="toast-body">' +
          (title ? '<div class="toast-title">' + title + '</div>' : '') +
          '<div class="toast-message">' + message + '</div>' +
        '</div>' +
        '<button class="toast-close" aria-label="Close">&times;</button>' +
        '<div class="toast-progress" style="width: 100%;"></div>';

      // Close button
      el.querySelector('.toast-close').addEventListener('click', (e) => {
        e.stopPropagation();
        this._remove(el);
      });

      container.appendChild(el);

      // Progress bar animation
      if (duration > 0) {
        const progress = el.querySelector('.toast-progress');
        requestAnimationFrame(() => {
          progress.style.width = '0%';
          progress.style.transitionDuration = duration + 'ms';
        });

        el._timeout = setTimeout(() => this._remove(el), duration);
      }

      // Announce for screen readers
      announceMessage(message);

      return el;
    },

    _remove(el) {
      if (!el || !el.parentNode) return;
      if (el._timeout) clearTimeout(el._timeout);
      el.classList.add('toast-removing');
      el.addEventListener('animationend', () => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, { once: true });
    },

    success(message, title) { return this.show(message, 'success', 5000, title); },
    error(message, title) { return this.show(message, 'error', 8000, title); },
    warning(message, title) { return this.show(message, 'warning', 6000, title); },
    info(message, title) { return this.show(message, 'info', 5000, title); },
  };

  // Export toast globally
  window.toast = toast;

  // ========================================
  // Screen Reader Announcements
  // ========================================

  let ariaLive = null;

  function announceMessage(message) {
    if (!ariaLive) {
      ariaLive = document.createElement('div');
      ariaLive.setAttribute('role', 'status');
      ariaLive.setAttribute('aria-live', 'polite');
      ariaLive.className = 'sr-only';
      document.body.appendChild(ariaLive);
    }
    ariaLive.textContent = '';
    requestAnimationFrame(() => {
      ariaLive.textContent = message;
    });
  }

  // ========================================
  // Keyboard Shortcuts
  // ========================================

  const shortcuts = {};
  const isMac = navigator.platform.indexOf('Mac') > -1;

  function getShortcutKey(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');

    const key = e.key.toLowerCase();
    if (!['control', 'meta', 'shift', 'alt'].includes(key)) {
      parts.push(key);
    }
    return parts.join('+');
  }

  function registerShortcut(key, handler, description) {
    shortcuts[key] = { handler, description };
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ignore shortcut when typing in input/textarea
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') {
          e.target.blur();
        }
        return;
      }

      const key = getShortcutKey(e);
      const shortcut = shortcuts[key];

      if (shortcut) {
        e.preventDefault();
        shortcut.handler(e);
      }
    });

    // Register default shortcuts
    registerShortcut('ctrl+s', () => {
      if (window.state && window.state.currentProject) {
        toast.success('Đã auto-save!');
      }
    }, 'Quick Save');

    registerShortcut('ctrl+n', () => {
      const modal = document.getElementById('newProjectModal');
      if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
        const input = document.getElementById('projectNameInput');
        if (input) setTimeout(() => input.focus(), 100);
      }
    }, 'Tạo Project mới');

    // Tab shortcuts
    const tabNames = ['sitemap', 'preview', 'documents', 'compare', 'api'];
    tabNames.forEach((tab, i) => {
      registerShortcut(`ctrl+${i + 1}`, () => {
        const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
        if (btn) btn.click();
      }, `Tab ${tab}`);
    });

    // Zoom shortcuts
    registerShortcut('ctrl+=', () => zoomAction('in'), 'Zoom In');
    registerShortcut('ctrl+-', () => zoomAction('out'), 'Zoom Out');
    registerShortcut('ctrl+0', () => zoomAction('reset'), 'Reset Zoom');

    // Performance Monitor shortcut (Ctrl+P)
    registerShortcut('ctrl+p', () => {
      if (typeof window.togglePerformanceWidget === 'function') {
        window.togglePerformanceWidget();
      }
    }, 'Toggle Performance Monitor');
  }

  function zoomAction(action) {
    const btn = action === 'in' ? document.getElementById('zoomInBtn') :
      action === 'out' ? document.getElementById('zoomOutBtn') :
        document.getElementById('zoomFitBtn');
    if (btn) btn.click();
  }

  // ========================================
  // Shortcuts Modal
  // ========================================

  let shortcutsOverlay = null;
  let shortcutsTemplateCache = null; // Cache template HTML

  // Build template once, reuse many times
  function buildShortcutsTemplate() {
    if (shortcutsTemplateCache) return shortcutsTemplateCache;

    const modKey = isMac ? '⌘' : 'Ctrl';
    const sections = [
      {
        title: 'Chung',
        items: [
          [`${modKey}+S`, 'Lưu nhanh'],
          [`${modKey}+F`, 'Tìm kiếm toàn cục'],
          [`${modKey}+N`, 'Tạo project mới'],
          ['Esc', 'Đóng modal/overlay'],
          ['?', 'Hiển thị phím tắt'],
        ]
      },
      {
        title: 'Chuyển Tab',
        items: [
          [`${modKey}+1`, 'Tab Sitemap'],
          [`${modKey}+2`, 'Tab Preview'],
          [`${modKey}+3`, 'Tab Documents'],
          [`${modKey}+4`, 'Tab So sánh UI'],
          [`${modKey}+5`, 'Tab API Diff'],
        ]
      },
      {
        title: 'Zoom',
        items: [
          [`${modKey}++`, 'Zoom In'],
          [`${modKey}+-`, 'Zoom Out'],
          [`${modKey}+0`, 'Reset Zoom'],
        ]
      }
    ];

    let html = '<div class="shortcuts-panel"><h3>⌨️ Phím Tắt</h3>';
    sections.forEach(section => {
      html += `<div class="shortcuts-section"><h4>${section.title}</h4>`;
      section.items.forEach(([key, desc]) => {
        const keys = key.split('+').map(k => `<kbd>${k}</kbd>`).join(' ');
        html += `<div class="shortcut-row">
          <span class="shortcut-desc">${desc}</span>
          <span class="shortcut-key">${keys}</span>
        </div>`;
      });
      html += '</div>';
    });
    html += '<div style="text-align:center;margin-top:16px;"><button class="btn btn-secondary btn-sm" data-close-shortcuts>Đóng</button></div>';
    html += '</div>';

    shortcutsTemplateCache = html;
    return html;
  }

  function showShortcutsModal() {
    if (shortcutsOverlay) return;

    // Create overlay
    shortcutsOverlay = document.createElement('div');
    shortcutsOverlay.className = 'shortcuts-overlay';

    // Use cached template (no rebuild)
    shortcutsOverlay.innerHTML = buildShortcutsTemplate();
    document.body.appendChild(shortcutsOverlay);

    // Event delegation - single listener handles all clicks
    shortcutsOverlay.addEventListener('click', handleShortcutsClick);
  }

  // Event delegation handler
  function handleShortcutsClick(e) {
    if (e.target === shortcutsOverlay || e.target.hasAttribute('data-close-shortcuts')) {
      closeShortcutsModal();
    }
  }

  function closeShortcutsModal() {
    if (shortcutsOverlay) {
      shortcutsOverlay.removeEventListener('click', handleShortcutsClick);
      shortcutsOverlay.remove();
      shortcutsOverlay = null;
    }
  }

  // ========================================
  // Global Search
  // ========================================

  let searchOverlay = null;
  let searchTemplateCache = null; // Cache search box HTML

  function buildSearchTemplate() {
    if (searchTemplateCache) return searchTemplateCache;

    searchTemplateCache = `
      <div class="global-search-box">
        <input type="text" class="global-search-input" placeholder="🔍 Tìm screens, APIs, documents..." autofocus>
        <div class="global-search-results"></div>
        <div class="global-search-hint">
          <span><kbd>↑↓</kbd> Chọn</span>
          <span><kbd>Enter</kbd> Mở</span>
          <span><kbd>Esc</kbd> Đóng</span>
        </div>
      </div>
    `;

    return searchTemplateCache;
  }

  function openGlobalSearch() {
    if (searchOverlay) return;

    // Create overlay
    searchOverlay = document.createElement('div');
    searchOverlay.className = 'global-search-overlay';

    // Use cached template
    searchOverlay.innerHTML = buildSearchTemplate();
    document.body.appendChild(searchOverlay);

    const input = searchOverlay.querySelector('.global-search-input');
    const results = searchOverlay.querySelector('.global-search-results');
    let activeIndex = -1;

    // Event delegation on overlay
    searchOverlay.addEventListener('click', handleSearchClick);

    // Debounced input handler
    input.addEventListener('input', debounce(() => {
      const query = input.value.trim().toLowerCase();
      if (query.length < 2) {
        results.innerHTML = '';
        return;
      }
      performSearch(query, results);
    }, 200));

    input.addEventListener('keydown', (e) => {
      const items = results.querySelectorAll('.search-result-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, items.length - 1);
        updateActiveItem(items, activeIndex);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActiveItem(items, activeIndex);
      } else if (e.key === 'Enter' && items[activeIndex]) {
        items[activeIndex].click();
      }
    });

    // RAF for smooth focus
    requestAnimationFrame(() => input.focus());
  }

  function handleSearchClick(e) {
    if (e.target === searchOverlay) {
      closeGlobalSearch();
    }
  }

  function updateActiveItem(items, index) {
    items.forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });
  }

  function performSearch(query, container) {
    const results = [];

    // Search tree nodes
    const treeItems = document.querySelectorAll('.tree-item-content');
    treeItems.forEach(item => {
      const label = item.querySelector('.tree-label');
      if (label && label.textContent.toLowerCase().includes(query)) {
        results.push({
          icon: '🖥️',
          title: label.textContent.trim(),
          subtitle: 'Screen',
          action: () => { item.click(); closeGlobalSearch(); }
        });
      }
    });

    // Search workspace nodes
    const sitemapNodes = document.querySelectorAll('[data-node-id]');
    sitemapNodes.forEach(node => {
      const text = node.textContent || '';
      if (text.toLowerCase().includes(query) && !results.find(r => r.title === text.trim())) {
        results.push({
          icon: '🗺️',
          title: text.trim().substring(0, 60),
          subtitle: 'Sitemap Node',
          action: () => { node.click(); closeGlobalSearch(); }
        });
      }
    });

    if (results.length === 0) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">Không tìm thấy kết quả</div>';
      return;
    }

    container.innerHTML = results.slice(0, 10).map((r, i) => `
      <div class="search-result-item" data-index="${i}">
        <span class="search-result-icon">${r.icon}</span>
        <div class="search-result-text">
          <div class="search-result-title">${r.title}</div>
          <div class="search-result-subtitle">${r.subtitle}</div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.search-result-item').forEach((item, i) => {
      item.onclick = () => results[i].action();
    });
  }

  function closeGlobalSearch() {
    if (searchOverlay) {
      searchOverlay.removeEventListener('click', handleSearchClick);
      searchOverlay.remove();
      searchOverlay = null;
    }
  }

  // ========================================
  // Context Menu
  // ========================================

  let contextMenu = null;

  function showContextMenu(e, actions) {
    e.preventDefault();
    hideContextMenu();

    contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';

    actions.forEach(action => {
      if (action.separator) {
        const sep = document.createElement('div');
        sep.className = 'context-menu-separator';
        contextMenu.appendChild(sep);
        return;
      }

      const item = document.createElement('button');
      item.className = `context-menu-item${action.danger ? ' danger' : ''}`;
      item.innerHTML = `<span>${action.icon || ''}</span><span>${action.label}</span>`;
      item.onclick = () => {
        action.handler();
        hideContextMenu();
      };
      contextMenu.appendChild(item);
    });

    // Position
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - contextMenu.children.length * 40);
    contextMenu.style.left = x + 'px';
    contextMenu.style.top = y + 'px';

    document.body.appendChild(contextMenu);

    // Close on click outside
    setTimeout(() => {
      document.addEventListener('click', hideContextMenu, { once: true });
    }, 10);
  }

  function hideContextMenu() {
    if (contextMenu) {
      contextMenu.remove();
      contextMenu = null;
    }
  }

  // Setup tree context menus
  function setupTreeContextMenus() {
    document.addEventListener('contextmenu', (e) => {
      const treeItem = e.target.closest('.tree-item-content');
      if (!treeItem) return;

      const label = treeItem.querySelector('.tree-label');
      const nodeText = label ? label.textContent.trim() : 'Node';

      showContextMenu(e, [
        {
          icon: '✎',
          label: `Đổi tên "${nodeText}"`,
          handler: () => toast.info('Chức năng đổi tên đang phát triển')
        },
        {
          icon: '📋',
          label: 'Sao chép',
          handler: () => toast.info('Đã sao chép!')
        },
        { separator: true },
        {
          icon: '📤',
          label: 'Xuất dữ liệu',
          handler: () => toast.info('Đang xuất...')
        },
        { separator: true },
        {
          icon: '🗑️',
          label: 'Xóa',
          danger: true,
          handler: () => {
            if (confirm(`Xóa "${nodeText}"?`)) {
              toast.success('Đã xóa!');
            }
          }
        }
      ]);
    });
  }

  // ========================================
  // Auto-Save
  // ========================================

  let autoSaveTimer = null;
  let hasChanges = false;

  function setupAutoSave() {
    // Monitor for changes
    const observer = new MutationObserver(throttle(() => {
      hasChanges = true;
    }, 1000));

    const mainTree = document.getElementById('mainTree');
    if (mainTree) {
      observer.observe(mainTree, { childList: true, subtree: true });
    }

    const sectionsList = document.getElementById('sectionsList');
    if (sectionsList) {
      observer.observe(sectionsList, { childList: true, subtree: true });
    }

    // Auto-save interval (every 60 seconds)
    autoSaveTimer = setInterval(() => {
      if (hasChanges && window.state && window.state.currentProject) {
        performAutoSave();
        hasChanges = false;
      }
    }, 60000);

    // Save session state for restore
    window.addEventListener('beforeunload', (e) => {
      saveSessionState();
    });

    // Restore session on load
    restoreSessionState();
  }

  function performAutoSave() {
    const state = window.state;
    if (!state || !state.currentProject) return;

    try {
      localStorage.setItem('mapi-autosave', JSON.stringify({
        project: state.currentProject,
        timestamp: Date.now()
      }));
    } catch (e) {
      // localStorage might be full
    }
  }

  function saveSessionState() {
    try {
      const state = window.state;
      if (!state) return;

      const activeTab = document.querySelector('.tab-btn.active');

      localStorage.setItem('mapi-session', JSON.stringify({
        project: state.currentProject,
        activeTab: activeTab ? activeTab.dataset.tab : 'sitemap',
        timestamp: Date.now()
      }));
    } catch (e) {
      // Ignore
    }
  }

  function restoreSessionState() {
    try {
      const saved = localStorage.getItem('mapi-session');
      if (!saved) return;

      const session = JSON.parse(saved);

      // Only restore if session is less than 24 hours old
      if (Date.now() - session.timestamp > 86400000) return;

      // Restore project selection
      if (session.project) {
        const select = document.getElementById('projectSelect');
        if (select) {
          setTimeout(() => {
            const option = Array.from(select.options).find(o => o.value === session.project);
            if (option) {
              select.value = session.project;
              select.dispatchEvent(new Event('change'));
            }
          }, 500);
        }
      }

      // Restore active tab
      if (session.activeTab) {
        setTimeout(() => {
          const tab = document.querySelector(`.tab-btn[data-tab="${session.activeTab}"]`);
          if (tab) tab.click();
        }, 800);
      }
    } catch (e) {
      // Ignore
    }
  }

  // ========================================
  // Accessibility
  // ========================================

  function setupAccessibility() {
    // Skip link
    const skipLink = document.createElement('a');
    skipLink.className = 'skip-link';
    skipLink.href = '#sitemapTab';
    skipLink.textContent = 'Bỏ qua đến nội dung';
    document.body.prepend(skipLink);

    // Add ARIA labels to icon-only buttons
    document.querySelectorAll('.btn').forEach(btn => {
      if (!btn.getAttribute('aria-label') && !btn.textContent.trim()) {
        const title = btn.getAttribute('title');
        if (title) btn.setAttribute('aria-label', title);
      }
    });
  }

  // ========================================
  // Button Ripple Effect (lightweight)
  // ========================================

  function setupButtonEffects() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn) return;

      const rect = btn.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      btn.style.setProperty('--ripple-x', x + '%');
      btn.style.setProperty('--ripple-y', y + '%');
    });
  }

  // ========================================
  // Lazy Image Loading
  // ========================================

  let imageObserver = null;

  function setupLazyImages() {
    if (!('IntersectionObserver' in window)) return;

    imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            img.classList.add('loaded');
          }
          imageObserver.unobserve(img);
        }
      });
    }, { rootMargin: '50px' });

    // Observe existing images
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }

  // Re-observe new images when DOM changes
  function observeNewImages() {
    const observer = new MutationObserver(debounce(() => {
      if (imageObserver) {
        document.querySelectorAll('img[data-src]:not(.loaded)').forEach(img => {
          imageObserver.observe(img);
        });
      }
    }, 200));

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ========================================
  // Smart Panel Resizer
  // ========================================

  function setupPanelResizers() {
    const leftResizer = document.getElementById('resizerLeft');
    const rightResizer = document.getElementById('resizerRight');

    if (leftResizer) setupResizer(leftResizer, 'left');
    if (rightResizer) setupResizer(rightResizer, 'right');
  }

  function setupResizer(resizer, side) {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    const panel = side === 'left' ? document.getElementById('leftPanel') : document.getElementById('rightPanel');
    if (!panel) return;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = panel.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', throttle((e) => {
      if (!isResizing) return;

      const diff = side === 'left' ? e.clientX - startX : startX - e.clientX;
      const newWidth = Math.max(200, Math.min(600, startWidth + diff));
      panel.style.width = newWidth + 'px';
      panel.style.minWidth = newWidth + 'px';
    }, 16));

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  // ========================================
  // Shortcut Hint Button
  // ========================================

  function createShortcutHintButton() {
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost btn-sm';
    btn.style.cssText = 'position:fixed;bottom:24px;left:24px;z-index:100;opacity:0.4;transition:opacity 0.2s;font-size:16px;';
    btn.innerHTML = '⌨️';
    btn.title = 'Phím tắt (?)';
    btn.setAttribute('aria-label', 'Hiển thị phím tắt');
    btn.onmouseenter = () => btn.style.opacity = '1';
    btn.onmouseleave = () => btn.style.opacity = '0.4';
    btn.onclick = showShortcutsModal;
    document.body.appendChild(btn);
  }

  // ========================================
  // Initialize Everything
  // ========================================

  function init() {
    loadingBar.init();
    toast.init();
    setupKeyboardShortcuts();
    setupButtonEffects();
    setupTreeContextMenus();
    setupAutoSave();
    setupAccessibility();
    setupLazyImages();
    observeNewImages();
    setupPanelResizers();

    initRippleEffect();

    // Expose globally
    window.SmartUX = {
      toast,
      loadingBar,
      showContextMenu,
      hideContextMenu,
      openGlobalSearch,
      closeGlobalSearch,
      showShortcutsModal,
      registerShortcut,
      announceMessage,
      debounce,
      throttle
    };

    // Also expose showToast for backward compatibility
    if (!window.showToast) {
      window.showToast = function (message, type) {
        toast.show(message, type);
      };
    }

    console.log('✅ UX Enhancements loaded - Press ? for shortcuts');
  }

  // Run on ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
