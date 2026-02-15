/**
 * DashboardFeatures — comprehensive feature module for MAPITesting Tool
 * Adds: Theme Toggle, Keyboard Shortcuts, Notification Center,
 *       Global Search, Bulk Operations, Analytics Dashboard Tab
 *
 * Usage: Call DashboardFeatures.init() after DOM is ready.
 * Depends on globals: state, api, showToast, switchTab, elements
 */
const DashboardFeatures = {

  // =========================================================================
  //  THEME TOGGLE (delegated to simple-settings.js)
  // =========================================================================
  theme: {
    current: localStorage.getItem('mapit-theme') || 'dark',

    init() {
      // All theme logic handled by AppSettings (simple-settings.js)
    },

    toggle() {
      if (window.AppSettings) {
        window.AppSettings.current.theme = window.AppSettings.current.theme === 'dark' ? 'light' : 'dark';
        window.AppSettings.save();
        window.AppSettings.applySettings();
      }
    },

    apply(theme) {
      // Handled by AppSettings
    }
  },

  // =========================================================================
  //  KEYBOARD SHORTCUTS
  // =========================================================================
  shortcuts: {
    registered: [],

    init() {
      this._registerDefaults();
      document.addEventListener('keydown', (e) => this.handleKeydown(e));
    },

    register(shortcut) {
      // shortcut: { key, ctrl, shift, alt, description, category, action }
      this.registered.push({
        key: shortcut.key,
        ctrl: !!shortcut.ctrl,
        shift: !!shortcut.shift,
        alt: !!shortcut.alt,
        description: shortcut.description || '',
        category: shortcut.category || 'General',
        action: shortcut.action
      });
    },

    _registerDefaults() {
      this.register({ key: 'k', ctrl: true, description: 'Open search', category: 'General', action: () => DashboardFeatures.search.open() });
      this.register({ key: '/', ctrl: false, description: 'Open search', category: 'General', action: () => DashboardFeatures.search.open() });
      this.register({ key: '?', shift: true, description: 'Show keyboard shortcuts', category: 'General', action: () => this.showHelp() });
      this.register({ key: 'Escape', description: 'Close dialogs', category: 'General', action: () => this._closeAll() });
      this.register({ key: 't', alt: true, description: 'Toggle theme', category: 'General', action: () => DashboardFeatures.theme.toggle() });
      this.register({ key: 'n', alt: true, description: 'Toggle notifications', category: 'General', action: () => DashboardFeatures.notifications.toggle() });

      this.register({ key: '1', alt: true, description: 'Switch to Sitemap tab', category: 'Navigation', action: () => { if (typeof switchTab === 'function') switchTab('sitemap'); } });
      this.register({ key: '2', alt: true, description: 'Switch to Preview tab', category: 'Navigation', action: () => { if (typeof switchTab === 'function') switchTab('preview'); } });
      this.register({ key: '3', alt: true, description: 'Switch to Documents tab', category: 'Navigation', action: () => { if (typeof switchTab === 'function') switchTab('documents'); } });
      this.register({ key: '4', alt: true, description: 'Switch to Compare tab', category: 'Navigation', action: () => { if (typeof switchTab === 'function') switchTab('compare'); } });
      this.register({ key: '5', alt: true, description: 'Switch to API tab', category: 'Navigation', action: () => { if (typeof switchTab === 'function') switchTab('api'); } });
      this.register({ key: '0', alt: true, description: 'Switch to Dashboard tab', category: 'Navigation', action: () => DashboardFeatures.analytics.activateTab() });

      this.register({ key: 'a', ctrl: true, shift: true, description: 'Select all sections', category: 'Actions', action: () => DashboardFeatures.bulk.selectAll() });
      this.register({ key: 'd', ctrl: true, shift: true, description: 'Deselect all sections', category: 'Actions', action: () => DashboardFeatures.bulk.deselectAll() });
    },

    handleKeydown(e) {
      // Skip when typing in inputs
      var tag = (e.target.tagName || '').toLowerCase();
      var isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

      for (var i = 0; i < this.registered.length; i++) {
        var s = this.registered[i];
        var keyMatch = e.key === s.key || e.key.toLowerCase() === s.key.toLowerCase();
        var ctrlMatch = s.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        var shiftMatch = s.shift ? e.shiftKey : !e.shiftKey;
        var altMatch = s.alt ? e.altKey : !e.altKey;

        if (keyMatch && ctrlMatch && altMatch) {
          // For Shift, we allow it to differ only when the shortcut doesn't require shift
          // because some keys like '?' need shift naturally
          if (s.shift && !e.shiftKey) continue;
          if (!s.shift && s.key !== '?' && e.shiftKey) continue;

          // If in input, only handle Escape and Ctrl-based shortcuts
          if (isInput && !s.ctrl && s.key !== 'Escape') continue;

          e.preventDefault();
          e.stopPropagation();
          s.action();
          return;
        }
      }
    },

    _closeAll() {
      DashboardFeatures.search.close();
      DashboardFeatures.notifications.hide();
      var helpModal = document.getElementById('df-shortcuts-modal');
      if (helpModal) helpModal.remove();
    },

    showHelp() {
      var existing = document.getElementById('df-shortcuts-modal');
      if (existing) { existing.remove(); return; }

      // Use DocumentFragment for better performance
      var fragment = document.createDocumentFragment();

      var categories = {};
      this.registered.forEach(function (s) {
        if (!categories[s.category]) categories[s.category] = [];
        categories[s.category].push(s);
      });

      var overlay = document.createElement('div');
      overlay.id = 'df-shortcuts-modal';
      overlay.className = 'df-modal-overlay';

      var modal = document.createElement('div');
      modal.className = 'df-modal';
      modal.style.maxWidth = '540px';

      var title = document.createElement('div');
      title.className = 'df-modal-header';
      title.innerHTML = '<span class="df-modal-title">Keyboard Shortcuts</span>' +
        '<button class="df-modal-close" title="Close">' + DashboardFeatures._icons.close + '</button>';
      modal.appendChild(title);

      var body = document.createElement('div');
      body.className = 'df-modal-body';
      body.style.maxHeight = '400px';
      body.style.overflowY = 'auto';

      // Build all tables in fragment first
      Object.keys(categories).forEach(function (cat) {
        var groupTitle = document.createElement('div');
        groupTitle.className = 'df-shortcut-category';
        groupTitle.textContent = cat;
        body.appendChild(groupTitle);

        var table = document.createElement('table');
        table.className = 'df-shortcut-table';

        // Build rows in batch
        var tbody = document.createElement('tbody');
        categories[cat].forEach(function (s) {
          var tr = document.createElement('tr');
          var keyParts = [];
          if (s.ctrl) keyParts.push('Ctrl');
          if (s.alt) keyParts.push('Alt');
          if (s.shift) keyParts.push('Shift');
          keyParts.push(s.key === ' ' ? 'Space' : s.key.length === 1 ? s.key.toUpperCase() : s.key);

          var kbdHtml = keyParts.map(function (p) { return '<kbd>' + p + '</kbd>'; }).join(' + ');
          tr.innerHTML = '<td class="df-shortcut-keys">' + kbdHtml + '</td>' +
            '<td class="df-shortcut-desc">' + s.description + '</td>';
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        body.appendChild(table);
      });

      modal.appendChild(body);
      overlay.appendChild(modal);

      // Event delegation for close button
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay || e.target.classList.contains('df-modal-close')) {
          overlay.remove();
        }
      });

      // Use RAF for smooth append
      requestAnimationFrame(function () {
        document.body.appendChild(overlay);
      });
    }
  },

  // =========================================================================
  //  NOTIFICATION CENTER
  // =========================================================================
  notifications: {
    items: [],
    unreadCount: 0,
    maxItems: 50,
    _panelVisible: false,

    init() {
      // Listeners attached in DOMContentLoaded handler below
      // Panel already exists in HTML (#notificationPanel)
    },

    add(title, message, type) {
      type = type || 'info';
      var item = {
        id: Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        title: title,
        message: message,
        type: type,
        time: new Date(),
        read: false
      };
      this.items.unshift(item);
      if (this.items.length > this.maxItems) {
        this.items = this.items.slice(0, this.maxItems);
      }
      this.unreadCount++;
      this._updateBadge();
      if (this._panelVisible) {
        this.renderPanel();
      }
    },

    markAllRead() {
      this.items.forEach(function (item) { item.read = true; });
      this.unreadCount = 0;
      this._updateBadge();
      this.renderPanel();
    },

    clearAll() {
      this.items = [];
      this.unreadCount = 0;
      this._updateBadge();
      this.renderPanel();
    },

    toggle() {
      if (this._panelVisible) {
        this.hide();
      } else {
        this.show();
      }
    },

    show() {
      this._panelVisible = true;
      this.renderPanel();
      var panel = document.getElementById('notificationPanel');
      if (panel) {
        panel.style.display = 'block';
        // Ensure panel is visible
        panel.style.visibility = 'visible';
        panel.style.opacity = '1';
      }
    },

    hide() {
      this._panelVisible = false;
      var panel = document.getElementById('notificationPanel');
      if (panel) {
        panel.style.display = 'none';
      }
    },

    renderPanel() {
      var panel = document.getElementById('notificationPanel');
      if (!panel) return;

      var body = panel.querySelector('.notification-panel-list') ||
        document.getElementById('notificationList');
      if (!body) return;

      if (this.items.length === 0) {
        body.innerHTML = '<div class="empty-state" style="padding:24px;"><p>Không có thông báo</p></div>';
        return;
      }

      // Use DocumentFragment for batch DOM updates
      var fragment = document.createDocumentFragment();
      var self = this;

      this.items.forEach(function (item) {
        var icon = self._typeIcon(item.type);
        var timeStr = self._timeAgo(item.time);
        var readClass = item.read ? 'notification-read' : 'notification-unread';

        var div = document.createElement('div');
        div.className = 'notification-item ' + readClass;
        div.dataset.id = item.id;

        div.innerHTML = '<div class="notification-icon notification-icon-' + item.type + '">' + icon + '</div>' +
          '<div class="notification-content">' +
          '<div class="notification-title">' + self._escapeHtml(item.title) + '</div>' +
          '<div class="notification-message">' + self._escapeHtml(item.message) + '</div>' +
          '<div class="notification-time">' + timeStr + '</div>' +
          '</div>';

        fragment.appendChild(div);
      });

      // Clear and append once
      body.innerHTML = '';
      body.appendChild(fragment);
    },

    _attachToExistingBellIcon() {
      // Use existing notification button in HTML (#notificationBellBtn)
      var btn = document.getElementById('notificationBellBtn');
      if (!btn) return;

      var self = this;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        self.toggle();
      });

      // Close on outside click (with delay to prevent immediate close)
      document.addEventListener('click', (e) => {
        var panel = document.getElementById('notificationPanel');
        var bellWrapper = document.getElementById('notificationBellWrapper');
        if (panel && bellWrapper && self._panelVisible &&
          !bellWrapper.contains(e.target)) {
          self.hide();
        }
      });
    },

    _attachToExistingPanelButtons() {
      // Connect "Mark All Read" button
      var markReadBtn = document.getElementById('markAllReadBtn');
      if (markReadBtn) {
        markReadBtn.addEventListener('click', () => this.markAllRead());
      }
    },

    _createPanel() {
      var panel = document.createElement('div');
      panel.id = 'df-notification-panel';
      panel.className = 'df-notification-panel';
      panel.innerHTML =
        '<div class="df-notif-header">' +
        '<span class="df-notif-header-title">Thông báo</span>' +
        '<div class="df-notif-header-actions">' +
        '<button id="df-notif-mark-read" class="df-link-btn" title="Đánh dấu tất cả đã đọc">Đã đọc hết</button>' +
        '<button id="df-notif-clear" class="df-link-btn" title="Xóa tất cả thông báo">' + DashboardFeatures._icons.trash + '</button>' +
        '</div>' +
        '</div>' +
        '<div class="df-notif-body">' +
        '<div class="df-notif-empty">Không có thông báo</div>' +
        '</div>';

      document.body.appendChild(panel);

      document.getElementById('df-notif-mark-read').addEventListener('click', () => this.markAllRead());
      document.getElementById('df-notif-clear').addEventListener('click', () => this.clearAll());
    },

    _updateBadge() {
      // Use existing badge in HTML (#notificationBadge)
      var badge = document.getElementById('notificationBadge');
      if (!badge) return;
      if (this.unreadCount > 0) {
        badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    },

    _typeIcon(type) {
      switch (type) {
        case 'success': return DashboardFeatures._icons.checkCircle;
        case 'error': return DashboardFeatures._icons.alertCircle;
        case 'warning': return DashboardFeatures._icons.warning;
        default: return DashboardFeatures._icons.info;
      }
    },

    _timeAgo(date) {
      var seconds = Math.floor((new Date() - date) / 1000);
      if (seconds < 5) return 'vừa xong';
      if (seconds < 60) return seconds + ' giây trước';
      var minutes = Math.floor(seconds / 60);
      if (minutes < 60) return minutes + ' phút trước';
      var hours = Math.floor(minutes / 60);
      if (hours < 24) return hours + ' giờ trước';
      var days = Math.floor(hours / 24);
      return days + ' ngày trước';
    },

    _escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }
  },

  // =========================================================================
  //  GLOBAL SEARCH (Command Palette)
  // =========================================================================
  search: {
    isOpen: false,
    recentSearches: JSON.parse(localStorage.getItem('mapit-recent-searches') || '[]'),
    _overlay: null,
    _input: null,
    _results: null,

    init() {
      this._createOverlay();
    },

    open() {
      if (this.isOpen) return;
      this.isOpen = true;
      this._overlay.classList.add('df-search-open');
      this._input.value = '';
      this._input.focus();
      this._showRecent();
    },

    close() {
      if (!this.isOpen) return;
      this.isOpen = false;
      this._overlay.classList.remove('df-search-open');
      this._input.value = '';
    },

    handleInput(query) {
      if (!query || query.trim().length === 0) {
        this._showRecent();
        return;
      }

      var results = [];
      var q = query.toLowerCase();

      // Search projects
      if (typeof state !== 'undefined' && state.projects) {
        state.projects.forEach(function (proj) {
          var name = typeof proj === 'string' ? proj : proj.name;
          if (name && name.toLowerCase().indexOf(q) !== -1) {
            results.push({
              group: 'Projects',
              icon: DashboardFeatures._icons.folder,
              title: name,
              subtitle: 'Project',
              action: function () {
                if (typeof state !== 'undefined') {
                  state.currentProject = name;
                  if (typeof api !== 'undefined' && api.getSections) {
                    api.getSections(name);
                  }
                }
              }
            });
          }
        });
      }

      // Search sections
      if (typeof state !== 'undefined' && state.sections) {
        state.sections.forEach(function (section) {
          var sectionName = section.name || section.title || section.timestamp || '';
          var sectionUrl = section.url || section.path || '';
          var searchText = (sectionName + ' ' + sectionUrl).toLowerCase();
          if (searchText.indexOf(q) !== -1) {
            results.push({
              group: 'Sections',
              icon: DashboardFeatures._icons.file,
              title: sectionName,
              subtitle: sectionUrl || 'Section',
              action: function () {
                if (typeof switchTab === 'function') switchTab('preview');
              }
            });
          }
        });
      }

      // Search screens from main tree
      if (typeof state !== 'undefined' && state.mainTree) {
        var tree = state.mainTree;
        var flatNodes = this._flattenTree(tree);
        flatNodes.forEach(function (node) {
          var nodeText = (node.name || node.url || node.path || '').toLowerCase();
          if (nodeText.indexOf(q) !== -1) {
            results.push({
              group: 'Screens',
              icon: DashboardFeatures._icons.monitor,
              title: node.name || node.url || node.path || 'Screen',
              subtitle: node.url || node.path || '',
              action: function () {
                if (typeof switchTab === 'function') switchTab('sitemap');
              }
            });
          }
        });
      }

      // Search tab names
      var tabs = ['sitemap', 'preview', 'documents', 'compare', 'api', 'dashboard'];
      tabs.forEach(function (tab) {
        if (tab.indexOf(q) !== -1) {
          results.push({
            group: 'Navigation',
            icon: DashboardFeatures._icons.navigate,
            title: tab.charAt(0).toUpperCase() + tab.slice(1),
            subtitle: 'Switch to tab',
            action: function () {
              if (tab === 'dashboard') {
                DashboardFeatures.analytics.activateTab();
              } else if (typeof switchTab === 'function') {
                switchTab(tab);
              }
            }
          });
        }
      });

      this._renderResults(results, query);
    },

    executeResult(result) {
      // Save to recent
      var recent = this.recentSearches;
      var entry = { title: result.title, subtitle: result.subtitle, group: result.group };
      // Remove duplicate
      recent = recent.filter(function (r) { return r.title !== entry.title || r.group !== entry.group; });
      recent.unshift(entry);
      if (recent.length > 10) recent = recent.slice(0, 10);
      this.recentSearches = recent;
      localStorage.setItem('mapit-recent-searches', JSON.stringify(recent));

      this.close();
      if (typeof result.action === 'function') result.action();
    },

    _createOverlay() {
      var overlay = document.createElement('div');
      overlay.id = 'df-search-overlay';
      overlay.className = 'df-search-overlay';
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.close();
      });

      var container = document.createElement('div');
      container.className = 'df-search-container';

      var inputWrap = document.createElement('div');
      inputWrap.className = 'df-search-input-wrap';
      inputWrap.innerHTML = DashboardFeatures._icons.search;

      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'df-search-input';
      input.placeholder = 'Tìm kiếm project, section, screen...';
      input.addEventListener('input', (e) => this.handleInput(e.target.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.close();
        if (e.key === 'ArrowDown') this._moveFocus(1);
        if (e.key === 'ArrowUp') this._moveFocus(-1);
        if (e.key === 'Enter') this._activateFocused();
      });

      inputWrap.appendChild(input);
      container.appendChild(inputWrap);

      var results = document.createElement('div');
      results.className = 'df-search-results';
      container.appendChild(results);

      var hint = document.createElement('div');
      hint.className = 'df-search-hint';
      hint.innerHTML = '<span><kbd>Enter</kbd> to select</span>' +
        '<span><kbd>' + String.fromCharCode(8593) + '</kbd><kbd>' + String.fromCharCode(8595) + '</kbd> to navigate</span>' +
        '<span><kbd>Esc</kbd> to close</span>';
      container.appendChild(hint);

      overlay.appendChild(container);
      document.body.appendChild(overlay);

      this._overlay = overlay;
      this._input = input;
      this._results = results;
    },

    _showRecent() {
      if (this.recentSearches.length === 0) {
        this._results.innerHTML = '<div class="df-search-empty">Start typing to search...</div>';
        return;
      }

      var fragment = document.createDocumentFragment();
      var self = this;

      var title = document.createElement('div');
      title.className = 'df-search-group-title';
      title.textContent = 'Tìm kiếm gần đây';
      fragment.appendChild(title);

      this.recentSearches.forEach(function (item) {
        var div = document.createElement('div');
        div.className = 'df-search-result-item';
        div.tabIndex = 0;
        div.dataset.title = item.title;

        div.innerHTML = '<span class="df-search-result-icon">' + DashboardFeatures._icons.clock + '</span>' +
          '<span class="df-search-result-text">' +
          '<span class="df-search-result-title">' + self._escapeHtml(item.title) + '</span>' +
          '<span class="df-search-result-sub">' + self._escapeHtml(item.subtitle || '') + '</span>' +
          '</span>';

        fragment.appendChild(div);
      });

      this._results.innerHTML = '';
      this._results.appendChild(fragment);
    },

    _renderResults(results, query) {
      if (results.length === 0) {
        this._results.innerHTML = '<div class="df-search-empty">No results for "' + this._escapeHtml(query) + '"</div>';
        return;
      }

      var grouped = {};
      results.forEach(function (r) {
        if (!grouped[r.group]) grouped[r.group] = [];
        grouped[r.group].push(r);
      });

      var fragment = document.createDocumentFragment();
      var self = this;
      var idx = 0;

      Object.keys(grouped).forEach(function (group) {
        var groupTitle = document.createElement('div');
        groupTitle.className = 'df-search-group-title';
        groupTitle.textContent = group;
        fragment.appendChild(groupTitle);

        grouped[group].forEach(function (r) {
          var div = document.createElement('div');
          div.className = 'df-search-result-item';
          div.tabIndex = 0;
          div.dataset.idx = idx;

          div.innerHTML = '<span class="df-search-result-icon">' + r.icon + '</span>' +
            '<span class="df-search-result-text">' +
            '<span class="df-search-result-title">' + self._escapeHtml(r.title) + '</span>' +
            '<span class="df-search-result-sub">' + self._escapeHtml(r.subtitle) + '</span>' +
            '</span>';

          fragment.appendChild(div);
          idx++;
        });
      });

      this._results.innerHTML = '';
      this._results.appendChild(fragment);

      // Attach click handlers
      var flatResults = results;
      var items = this._results.querySelectorAll('.df-search-result-item');
      items.forEach((item, i) => {
        item.addEventListener('click', () => {
          if (flatResults[i]) this.executeResult(flatResults[i]);
        });
      });
    },

    _moveFocus(dir) {
      var items = this._results.querySelectorAll('.df-search-result-item');
      if (items.length === 0) return;
      var focused = this._results.querySelector('.df-search-result-focused');
      var currentIdx = -1;
      if (focused) {
        for (var i = 0; i < items.length; i++) {
          if (items[i] === focused) { currentIdx = i; break; }
        }
        focused.classList.remove('df-search-result-focused');
      }
      var nextIdx = currentIdx + dir;
      if (nextIdx < 0) nextIdx = items.length - 1;
      if (nextIdx >= items.length) nextIdx = 0;
      items[nextIdx].classList.add('df-search-result-focused');
      items[nextIdx].scrollIntoView({ block: 'nearest' });
    },

    _activateFocused() {
      var focused = this._results.querySelector('.df-search-result-focused');
      if (focused) focused.click();
    },

    _flattenTree(node) {
      var result = [];
      if (!node) return result;
      if (Array.isArray(node)) {
        node.forEach((n) => { result = result.concat(this._flattenTree(n)); });
        return result;
      }
      result.push(node);
      if (node.children) {
        result = result.concat(this._flattenTree(node.children));
      }
      return result;
    },

    _escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str || '';
      return div.innerHTML;
    },

    _escapeAttr(str) {
      return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  },

  // =========================================================================
  //  BULK OPERATIONS
  // =========================================================================
  bulk: {
    selectedSections: new Set(),
    _toolbarEl: null,

    init() {
      this._createToolbar();
      this._observeSections();
    },

    toggleSelection(sectionId) {
      if (this.selectedSections.has(sectionId)) {
        this.selectedSections.delete(sectionId);
      } else {
        this.selectedSections.add(sectionId);
      }
      this._updateCheckbox(sectionId);
      this.renderToolbar();
    },

    selectAll() {
      var cards = document.querySelectorAll('.section-card, .section-item, [data-section-id]');
      var self = this;
      cards.forEach(function (card) {
        var id = card.getAttribute('data-section-id') || card.getAttribute('data-timestamp');
        if (id) {
          self.selectedSections.add(id);
          self._updateCheckbox(id);
        }
      });
      this.renderToolbar();
      DashboardFeatures.notifications.add('Selection', 'All sections selected', 'info');
    },

    deselectAll() {
      var self = this;
      this.selectedSections.forEach(function (id) {
        self._updateCheckbox(id, false);
      });
      this.selectedSections.clear();
      this.renderToolbar();
    },

    deleteSelected() {
      var count = this.selectedSections.size;
      if (count === 0) return;
      if (!confirm('Delete ' + count + ' selected section(s)?')) return;

      var promises = [];
      var self = this;
      this.selectedSections.forEach(function (id) {
        if (typeof api !== 'undefined' && api.deleteSection) {
          promises.push(
            api.deleteSection(state.currentProject, id)
              .catch(function (err) { console.error('Delete failed for', id, err); })
          );
        }
      });

      Promise.all(promises).then(function () {
        self.selectedSections.clear();
        self.renderToolbar();
        if (typeof showToast === 'function') {
          showToast(count + ' section(s) deleted', 'success');
        }
        // Refresh sections list
        if (typeof api !== 'undefined' && api.getSections && typeof state !== 'undefined' && state.currentProject) {
          api.getSections(state.currentProject);
        }
      });
    },

    mergeSelected() {
      var count = this.selectedSections.size;
      if (count < 2) {
        if (typeof showToast === 'function') {
          showToast('Select at least 2 sections to merge', 'warning');
        }
        return;
      }

      var name = prompt('Enter name for merged section:');
      if (!name) return;

      var ids = Array.from(this.selectedSections);
      if (typeof api !== 'undefined' && api.mergeSections) {
        api.mergeSections(state.currentProject, ids, name)
          .then(() => {
            this.selectedSections.clear();
            this.renderToolbar();
            if (typeof showToast === 'function') {
              showToast(count + ' sections merged into "' + name + '"', 'success');
            }
            if (typeof api !== 'undefined' && api.getSections && typeof state !== 'undefined' && state.currentProject) {
              api.getSections(state.currentProject);
            }
          })
          .catch(function (err) {
            if (typeof showToast === 'function') {
              showToast('Merge failed: ' + err.message, 'error');
            }
          });
      } else {
        if (typeof showToast === 'function') {
          showToast('Merge API not available', 'warning');
        }
      }
    },

    renderToolbar() {
      var toolbar = this._toolbarEl;
      if (!toolbar) return;
      var count = this.selectedSections.size;
      if (count === 0) {
        toolbar.classList.remove('df-bulk-visible');
        return;
      }
      toolbar.classList.add('df-bulk-visible');
      var countLabel = toolbar.querySelector('.df-bulk-count');
      if (countLabel) countLabel.textContent = count + ' selected';
    },

    _createToolbar() {
      var toolbar = document.createElement('div');
      toolbar.id = 'df-bulk-toolbar';
      toolbar.className = 'df-bulk-toolbar';
      toolbar.innerHTML =
        '<span class="df-bulk-count">0 selected</span>' +
        '<button class="df-bulk-btn df-bulk-select-all" title="Select all">' + DashboardFeatures._icons.selectAll + ' All</button>' +
        '<button class="df-bulk-btn df-bulk-deselect" title="Deselect all">' + DashboardFeatures._icons.close + ' None</button>' +
        '<button class="df-bulk-btn df-bulk-delete" title="Delete selected">' + DashboardFeatures._icons.trash + ' Delete</button>' +
        '<button class="df-bulk-btn df-bulk-merge" title="Merge selected">' + DashboardFeatures._icons.merge + ' Merge</button>';

      toolbar.querySelector('.df-bulk-select-all').addEventListener('click', () => this.selectAll());
      toolbar.querySelector('.df-bulk-deselect').addEventListener('click', () => this.deselectAll());
      toolbar.querySelector('.df-bulk-delete').addEventListener('click', () => this.deleteSelected());
      toolbar.querySelector('.df-bulk-merge').addEventListener('click', () => this.mergeSelected());

      document.body.appendChild(toolbar);
      this._toolbarEl = toolbar;
    },

    _observeSections() {
      // Watch for section cards being added to the DOM
      var self = this;
      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) {
              self._injectCheckboxes(node);
            }
          });
        });
      });
      observer.observe(document.body, { childList: true, subtree: true });

      // Also inject into existing cards
      setTimeout(function () { self._injectCheckboxes(document.body); }, 500);
    },

    _injectCheckboxes(root) {
      var cards = root.querySelectorAll ? root.querySelectorAll('.section-card, .section-item, [data-section-id]') : [];
      var self = this;
      cards.forEach(function (card) {
        if (card.querySelector('.df-bulk-checkbox')) return;
        var id = card.getAttribute('data-section-id') || card.getAttribute('data-timestamp');
        if (!id) return;

        var cb = document.createElement('label');
        cb.className = 'df-bulk-checkbox';
        cb.innerHTML = '<input type="checkbox" data-bulk-id="' + id + '"><span class="df-bulk-checkmark">' + DashboardFeatures._icons.check + '</span>';
        cb.addEventListener('click', function (e) { e.stopPropagation(); });
        cb.querySelector('input').addEventListener('change', function () {
          self.toggleSelection(id);
        });
        card.style.position = card.style.position || 'relative';
        card.insertBefore(cb, card.firstChild);
      });
    },

    _updateCheckbox(sectionId, checked) {
      var isChecked = checked !== undefined ? checked : this.selectedSections.has(sectionId);
      var cb = document.querySelector('input[data-bulk-id="' + sectionId + '"]');
      if (cb) cb.checked = isChecked;
    }
  },

  // =========================================================================
  //  ANALYTICS / DASHBOARD TAB
  // =========================================================================
  analytics: {
    _tabAdded: false,
    _contentEl: null,

    init() {
      this._addTab();
    },

    activateTab() {
      // Don't override tab switching - let app.js handle it
      // Just load dashboard data
      this.loadDashboard();

      if (typeof state !== 'undefined') {
        state.activeTab = 'dashboard';
      }
    },

    loadDashboard() {
      // Use existing dashboard container from HTML
      var dashboardTab = document.getElementById('dashboardTab');
      if (!dashboardTab) return;

      var self = this;

      // Update hero banner with project name
      var heroTitle = document.getElementById('dashProjectName');
      var heroDesc = document.getElementById('dashProjectDesc');
      if (typeof state !== 'undefined' && state.currentProject) {
        if (heroTitle) heroTitle.textContent = '📋 ' + state.currentProject;
        if (heroDesc) {
          var sectionCount = state.sections ? state.sections.length : 0;
          heroDesc.textContent = sectionCount + ' phiên bản đã chụp · Đang tải dữ liệu...';
        }
      } else {
        if (heroTitle) heroTitle.textContent = 'Chào mừng đến MAPIT';
        if (heroDesc) heroDesc.textContent = 'Chọn project ở sidebar bên trái để xem tổng quan';
      }

      var statsPromise = this._gatherStats();
      var testPromise = this._fetchTestResults();

      Promise.all([statsPromise, testPromise]).then(function (results) {
        var stats = results[0];
        var testResults = results[1];

        // Update hero subtitle with real data
        if (heroDesc && typeof state !== 'undefined' && state.currentProject) {
          var sCount = state.sections ? state.sections.length : 0;
          var parts = [];
          parts.push(stats.totalScreens + ' màn hình');
          parts.push(stats.totalAPIs + ' API');
          parts.push(sCount + ' phiên bản');
          heroDesc.textContent = parts.join(' · ');
        }

        // Update stat cards numbers
        var dashTotalScreens = document.getElementById('dashTotalScreens');
        var dashTotalAPIs = document.getElementById('dashTotalAPIs');
        var dashTotalSections = document.getElementById('dashTotalSections');
        var dashStorageSize = document.getElementById('dashStorageSize');

        if (dashTotalScreens) dashTotalScreens.textContent = stats.screensWithUI + '/' + stats.totalScreens;
        if (dashTotalAPIs) dashTotalAPIs.textContent = stats.totalAPIs;
        if (dashTotalSections) dashTotalSections.textContent = stats.totalSections;
        if (dashStorageSize) dashStorageSize.textContent = stats.storageSize;

        // Update coverage ring
        self._updateCoverage(stats, testResults);

        // Update mini flow
        self._updateFlowMini();

        // Update existing HTML sections  
        var activityTimeline = document.getElementById('activityTimeline');
        if (activityTimeline) {
          activityTimeline.innerHTML = self.renderRecentActivity(stats.recentSections);
        }

        var testResultsSummary = document.getElementById('testResultsSummary');
        if (testResultsSummary) {
          testResultsSummary.innerHTML = self.renderTestResults(testResults);
        }

        self._attachQuickActionHandlers();

        // Attach view sitemap button
        var viewSitemapBtn = document.getElementById('dashViewSitemapBtn');
        if (viewSitemapBtn && !viewSitemapBtn.dataset.attached) {
          viewSitemapBtn.addEventListener('click', function () {
            if (typeof switchTab === 'function') switchTab('sitemap');
          });
          viewSitemapBtn.dataset.attached = 'true';
        }
      }).catch(function (err) {
        console.error('Failed to load dashboard:', err);
      });
    },

    _updateCoverage(stats, testResults) {
      var total = stats.totalScreens || 0;
      var withUI = stats.screensWithUI || 0;
      var withAPI = stats.screensWithAPI || 0;
      var tested = testResults ? testResults.length : 0;

      // Coverage % = screens with captured UI / total screens in flow
      var coverage = total > 0 ? Math.round((withUI / total) * 100) : 0;

      // Update ring
      var arc = document.getElementById('dashCoverageArc');
      var percentEl = document.getElementById('dashCoveragePercent');

      if (arc) {
        var circumference = 314; // 2 * PI * 50
        var offset = circumference - (circumference * coverage / 100);
        arc.style.strokeDashoffset = offset;
      }
      if (percentEl) percentEl.textContent = coverage + '%';

      // Update details
      var covUI = document.getElementById('dashCovUI');
      var covAPI = document.getElementById('dashCovAPI');
      var covTest = document.getElementById('dashCovTest');
      if (covUI) covUI.textContent = withUI + ' / ' + total;
      if (covAPI) covAPI.textContent = withAPI + ' / ' + total;
      if (covTest) covTest.textContent = tested;
    },

    _updateFlowMini() {
      var container = document.getElementById('dashFlowMini');
      if (!container) return;

      // Get flow data from mainTree if available
      if (typeof state === 'undefined' || !state.mainTree || state.mainTree.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:24px;"><p>Chọn project để xem cấu trúc màn hình</p></div>';
        return;
      }

      var screens = [];
      var extractScreens = function (nodes) {
        nodes.forEach(function (n) {
          if (n.name !== 'UI' && n.name !== 'APIs' && n.type !== 'api') {
            var hasUI = n.children && n.children.some(function (c) { return c.name === 'UI'; });
            if (hasUI || n.type === 'ui') {
              screens.push({
                name: n.name.replace(/_/g, ' '),
                path: n.path || n.name,
                type: n.name.startsWith('tab_') ? 'tab' : n.name.startsWith('modal_') ? 'modal' : 'page'
              });
            }
          }
          if (n.children) extractScreens(n.children);
        });
      };
      extractScreens(state.mainTree);

      if (screens.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding:24px;"><p>Chưa có màn hình nào</p></div>';
        return;
      }

      var html = '<div class="dash-flow-nodes">';
      screens.slice(0, 15).forEach(function (s, i) {
        var icon = s.type === 'tab' ? '🏷️' : s.type === 'modal' ? '🗔' : '📄';
        if (i > 0) html += '<span class="dash-flow-arrow">→</span>';
        html += '<div class="dash-flow-node" title="' + DashboardFeatures._escapeHtml(s.path) + '"><span class="flow-icon">' + icon + '</span>' + DashboardFeatures._escapeHtml(s.name) + '</div>';
      });
      if (screens.length > 15) {
        html += '<span class="dash-flow-arrow">...</span>';
        html += '<div class="dash-flow-node" style="opacity:0.6">+' + (screens.length - 15) + ' khác</div>';
      }
      html += '</div>';
      container.innerHTML = html;
    },

    renderStatsCards(data) {
      var cards = [
        { label: 'Total Screens', value: data.totalScreens, icon: DashboardFeatures._icons.monitor, color: '#4fc3f7' },
        { label: 'Total APIs', value: data.totalAPIs, icon: DashboardFeatures._icons.api, color: '#81c784' },
        { label: 'Total Sections', value: data.totalSections, icon: DashboardFeatures._icons.file, color: '#ffb74d' },
        { label: 'Storage Size', value: data.storageSize, icon: DashboardFeatures._icons.storage, color: '#ce93d8' }
      ];

      var html = '<div class="df-stats-row">';
      cards.forEach(function (card) {
        html += '<div class="df-stat-card">' +
          '<div class="df-stat-icon" style="color:' + card.color + '">' + card.icon + '</div>' +
          '<div class="df-stat-info">' +
          '<div class="df-stat-value">' + card.value + '</div>' +
          '<div class="df-stat-label">' + card.label + '</div>' +
          '</div>' +
          '</div>';
      });
      html += '</div>';
      return html;
    },

    renderRecentActivity(sections) {
      var html = '';

      if (!sections || sections.length === 0) {
        html += '<div class="df-dashboard-empty">Chưa có hoạt động gần đây</div>';
      } else {
        html += '<div class="df-activity-list">';
        sections.slice(0, 10).forEach(function (section) {
          // Extract name: use section name/title, or extract from path
          var name = section.name || section.title || '';
          if (!name || name === 'Untitled') {
            // Try to get from path - last segment
            var p = section.path || section.url || '';
            var segments = p.replace(/\\/g, '/').split('/').filter(Boolean);
            name = segments.length > 0 ? segments[segments.length - 1] : 'Untitled';
          }

          // Parse timestamp from folder name format: "2026-02-09T07-17-54-280Z"
          var time = '';
          var rawTs = section.timestamp || section.name || '';
          // Try direct Date parse first
          var date = new Date(rawTs);
          if (isNaN(date.getTime())) {
            // Try to parse from section folder name format
            var tsMatch = String(rawTs).match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
            if (tsMatch) {
              date = new Date(tsMatch[1] + 'T' + tsMatch[2] + ':' + tsMatch[3] + ':' + tsMatch[4] + 'Z');
            }
          }
          if (!isNaN(date.getTime())) {
            time = date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          }

          // Clean the display name - remove timestamps from name
          var displayName = name.replace(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*/, '').trim();
          // If name was entirely a timestamp, show friendly label
          if (!displayName) {
            displayName = time ? 'Section lúc ' + time : 'Section #' + (sections.indexOf(section) + 1);
          }
          // Humanize underscores
          displayName = displayName.replace(/_/g, ' ');

          var screenCount = section.screenCount || (section.screens ? section.screens.length : 0);

          html += '<div class="df-activity-item">' +
            '<div class="df-activity-icon">' + DashboardFeatures._icons.clock + '</div>' +
            '<div class="df-activity-info">' +
            '<div class="df-activity-name">' + DashboardFeatures._escapeHtml(displayName) + '</div>' +
            (screenCount > 0 ? '<div class="df-activity-meta">' + screenCount + ' màn hình</div>' : '') +
            (time ? '<div class="df-activity-time">' + time + '</div>' : '') +
            '</div>' +
            '</div>';
        });
        html += '</div>';
      }

      return html;
    },

    renderQuickActions() {
      var html = '<div class="df-dashboard-section">';
      html += '<div class="df-dashboard-section-title">Thao Tác Nhanh</div>';
      html += '<div class="df-quick-actions">';
      html += '<button class="df-quick-btn" id="df-qa-capture">' + DashboardFeatures._icons.capture + ' New Capture</button>';
      html += '<button class="df-quick-btn" id="df-qa-compare">' + DashboardFeatures._icons.compare + ' Compare</button>';
      html += '<button class="df-quick-btn" id="df-qa-test">' + DashboardFeatures._icons.test + ' Test All</button>';
      html += '</div>';
      html += '</div>';
      return html;
    },

    renderTestResults(results) {
      var html = '';

      if (!results || results.length === 0) {
        html += '<div class="df-dashboard-empty">Chưa có kết quả test</div>';
      } else {
        html += '<div class="df-test-list">';
        results.slice(0, 5).forEach(function (r) {
          var statusIcon = r.status === 'passed' ? DashboardFeatures._icons.checkCircle :
            r.status === 'failed' ? DashboardFeatures._icons.alertCircle :
              DashboardFeatures._icons.clock;
          var statusClass = 'df-test-' + (r.status || 'unknown');
          var time = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
          html += '<div class="df-test-item ' + statusClass + '">' +
            '<span class="df-test-status">' + statusIcon + '</span>' +
            '<span class="df-test-name">' + DashboardFeatures._escapeHtml(r.name || 'Test') + '</span>' +
            '<span class="df-test-time">' + time + '</span>' +
            '</div>';
        });
        html += '</div>';
      }

      return html;
    },

    _addTab() {
      if (this._tabAdded) return;

      // Use existing dashboard tab and content from HTML instead of creating new ones
      var existingTab = document.querySelector('.tab-btn[data-tab="dashboard"]');
      var existingContent = document.getElementById('dashboardTab');

      if (existingTab && existingContent) {
        // Use existing elements
        this._contentEl = existingContent;
        this._tabAdded = true;
        return;
      }

      // Fallback: create new tab if doesn't exist (shouldn't happen)
      var tabContainer = document.querySelector('.workspace-tabs') ||
        document.querySelector('.tabs') ||
        document.querySelector('[role="tablist"]');
      if (!tabContainer) return;

      var tab = document.createElement('button');
      tab.id = 'df-tab-dashboard';
      tab.className = 'workspace-tab tab-btn';
      tab.setAttribute('data-tab', 'dashboard');
      tab.innerHTML = DashboardFeatures._icons.dashboard + ' Dashboard';
      tab.addEventListener('click', () => this.activateTab());

      // Insert before the first tab
      if (tabContainer.firstChild) {
        tabContainer.insertBefore(tab, tabContainer.firstChild);
      } else {
        tabContainer.appendChild(tab);
      }

      // Create content area
      var contentParent = document.querySelector('.workspace-content') ||
        document.querySelector('.tab-panels') ||
        document.querySelector('.content-area') ||
        document.querySelector('main');

      if (contentParent) {
        var content = document.createElement('div');
        content.id = 'df-dashboard-content';
        content.className = 'tab-content df-dashboard';
        content.style.display = 'none';
        content.setAttribute('data-tab-content', 'dashboard');
        contentParent.appendChild(content);
        this._contentEl = content;
      }

      this._tabAdded = true;
    },

    _gatherStats() {
      return new Promise(function (resolve) {
        var stats = {
          totalScreens: 0,
          screensWithUI: 0,
          screensWithAPI: 0,
          totalAPIs: 0,
          totalSections: 0,
          storageSize: '--',
          recentSections: []
        };

        if (typeof state !== 'undefined' && state.sections) {
          stats.totalSections = state.sections.length;
          stats.recentSections = state.sections.slice().sort(function (a, b) {
            return (b.timestamp || 0) - (a.timestamp || 0);
          });

          state.sections.forEach(function (section) {
            if (section.apiCount) stats.totalAPIs += section.apiCount;
            else if (section.apis) stats.totalAPIs += section.apis.length || 0;
          });
        }

        // Count actual captured screens from mainTree (uses backend hasUI/hasAPI flags)
        if (typeof state !== 'undefined' && state.mainTree) {
          var countFromTree = function (nodes) {
            if (!nodes) return;
            nodes.forEach(function (node) {
              // Use backend flags if available
              if (node.type === 'ui') {
                if (node.hasUI) stats.screensWithUI++;
                if (node.hasAPI) stats.screensWithAPI++;
              }
              if (node.children) countFromTree(node.children);
            });
          };
          countFromTree(state.mainTree);
        }

        // Count total screens from mainTree (all type='ui' nodes = screens defined in flow.json)
        if (typeof state !== 'undefined' && state.mainTree) {
          var countTotalScreens = function (nodes) {
            if (!nodes) return;
            nodes.forEach(function (node) {
              if (node.type === 'ui') stats.totalScreens++;
              if (node.children) countTotalScreens(node.children);
            });
          };
          countTotalScreens(state.mainTree);
        }

        // Async data fetches
        var promises = [];

        // Storage size
        if (typeof api !== 'undefined' && api.getStorageInfo && typeof state !== 'undefined' && state.currentProject) {
          promises.push(
            api.getStorageInfo(state.currentProject).then(function (info) {
              stats.storageSize = info.size || info.formattedSize || '--';
            }).catch(function () { })
          );
        }

        Promise.all(promises).then(function () {
          // Fallback: if no screens found in tree
          if (stats.totalScreens === 0) {
            stats.totalScreens = stats.screensWithUI;
          }
          resolve(stats);
        });
      });
    },

    _fetchTestResults() {
      return new Promise(function (resolve) {
        var projectName = (typeof state !== 'undefined' && state.currentProject) ? state.currentProject : '';
        if (!projectName) { resolve([]); return; }

        fetch('/api/test-runner/results?project=' + encodeURIComponent(projectName))
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then(function (data) {
            resolve(Array.isArray(data) ? data : (data.results || []));
          })
          .catch(function () {
            resolve([]);
          });
      });
    },

    _attachQuickActionHandlers() {
      // Attach to existing HTML button IDs
      var captureBtn = document.getElementById('dashNewCapture');
      if (captureBtn && !captureBtn.dataset.handlerAttached) {
        captureBtn.addEventListener('click', function () {
          if (typeof switchTab === 'function') switchTab('sitemap');
          if (DashboardFeatures.notifications) {
            DashboardFeatures.notifications.add('Action', 'Navigate to Sitemap for new capture', 'info');
          }
        });
        captureBtn.dataset.handlerAttached = 'true';
      }

      var compareBtn = document.getElementById('dashCompareAll');
      if (compareBtn && !compareBtn.dataset.handlerAttached) {
        compareBtn.addEventListener('click', function () {
          if (typeof switchTab === 'function') switchTab('compare');
        });
        compareBtn.dataset.handlerAttached = 'true';
      }

      var testBtn = document.getElementById('dashTestAll');
      if (testBtn && !testBtn.dataset.handlerAttached) {
        testBtn.addEventListener('click', function () {
          if (DashboardFeatures.notifications) {
            DashboardFeatures.notifications.add('Test Runner', 'Starting tests...', 'info');
          }
          var projectName = (typeof state !== 'undefined' && state.currentProject) ? state.currentProject : '';
          fetch('/api/test-runner/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project: projectName })
          }).then(function (res) { return res.json(); })
            .then(function (data) {
              if (DashboardFeatures.notifications) {
                DashboardFeatures.notifications.add('Test Runner', 'Tests completed: ' + (data.summary || JSON.stringify(data)), data.passed ? 'success' : 'warning');
              }
            })
            .catch(function (err) {
              if (DashboardFeatures.notifications) {
                DashboardFeatures.notifications.add('Test Runner', 'Tests failed: ' + err.message, 'error');
              }
            });
        });
        testBtn.dataset.handlerAttached = 'true';
      }

      var exportBtn = document.getElementById('dashExport');
      if (exportBtn && !exportBtn.dataset.handlerAttached) {
        exportBtn.addEventListener('click', function () {
          if (typeof state === 'undefined' || !state.currentProject) {
            if (typeof showToast === 'function') showToast('Vui lòng chọn project trước', 'warning');
            return;
          }

          // Generate report from available data
          var report = {
            project: state.currentProject,
            exportedAt: new Date().toISOString(),
            sections: (state.sections || []).map(function (s) {
              return { name: s.name || s, timestamp: s.timestamp || null };
            }),
            stats: {
              totalScreens: document.getElementById('dashTotalScreens') ? document.getElementById('dashTotalScreens').textContent : '0',
              totalAPIs: document.getElementById('dashTotalAPIs') ? document.getElementById('dashTotalAPIs').textContent : '0',
              totalSections: document.getElementById('dashTotalSections') ? document.getElementById('dashTotalSections').textContent : '0',
              storageSize: document.getElementById('dashStorageSize') ? document.getElementById('dashStorageSize').textContent : '0'
            },
            screens: [],
            apis: []
          };

          // Extract screen & API data from mainTree
          if (state.mainTree) {
            var extractData = function (nodes, parentPath) {
              nodes.forEach(function (n) {
                var currentPath = parentPath ? parentPath + '/' + n.name : n.name;
                if (n.name === 'UI' && n.children) {
                  n.children.forEach(function (screen) {
                    report.screens.push({ name: screen.name, path: currentPath + '/' + screen.name });
                  });
                }
                if (n.name === 'APIs' && n.children) {
                  n.children.forEach(function (api) {
                    report.apis.push({ name: api.name, path: currentPath + '/' + api.name, method: api.method || 'GET' });
                  });
                }
                if (n.children) extractData(n.children, currentPath);
              });
            };
            extractData(state.mainTree, '');
          }

          // Download as JSON
          var blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = state.currentProject + '_report_' + new Date().toISOString().slice(0, 10) + '.json';
          a.click();
          URL.revokeObjectURL(url);

          if (typeof showToast === 'function') {
            showToast('Đã xuất báo cáo ' + state.currentProject, 'success');
          }
        });
        exportBtn.dataset.handlerAttached = 'true';
      }

      // Also attach handler to Run All Tests button in Test Results section
      var runTestsBtn = document.getElementById('dashRunTestsBtn');
      if (runTestsBtn && !runTestsBtn.dataset.handlerAttached) {
        runTestsBtn.addEventListener('click', function () {
          if (typeof switchTab === 'function') switchTab('testing');
        });
        runTestsBtn.dataset.handlerAttached = 'true';
      }
    }
  },

  // =========================================================================
  //  SVG ICONS (safe, no emoji)
  // =========================================================================
  _icons: {
    bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>',

    close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',

    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',

    checkCircle: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',

    alertCircle: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',

    warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',

    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',

    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',

    folder: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>',

    file: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',

    monitor: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',

    navigate: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',

    clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',

    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',

    selectAll: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',

    merge: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 009 9"/></svg>',

    dashboard: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',

    api: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',

    storage: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',

    capture: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>',

    compare: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',

    test: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>'
  },

  // =========================================================================
  //  UTILITY
  // =========================================================================
  _escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  // =========================================================================
  //  STYLES
  // =========================================================================
  _injectStyles() {
    if (document.getElementById('df-styles')) return;
    var style = document.createElement('style');
    style.id = 'df-styles';
    style.textContent = [
      /* Header buttons */
      '.df-header-btn {',
      '  background: none; border: none; color: var(--text-primary, #e0e0e0);',
      '  cursor: pointer; padding: 6px 8px; border-radius: 6px;',
      '  display: inline-flex; align-items: center; gap: 4px;',
      '  transition: background 0.2s; position: relative;',
      '}',
      '.df-header-btn:hover { background: var(--hover-bg, rgba(255,255,255,0.1)); }',

      /* Badge */
      '.df-badge {',
      '  position: absolute; top: 0; right: 0;',
      '  background: #ef5350; color: #fff; font-size: 10px;',
      '  min-width: 16px; height: 16px; border-radius: 8px;',
      '  display: flex; align-items: center; justify-content: center;',
      '  padding: 0 4px; font-weight: 600; line-height: 1;',
      '}',

      /* Modal overlay */
      '.df-modal-overlay {',
      '  position: fixed; top: 0; left: 0; right: 0; bottom: 0;',
      '  background: rgba(0,0,0,0.6); z-index: 10000;',
      '  display: flex; align-items: center; justify-content: center;',
      '  backdrop-filter: blur(2px);',
      '}',
      '.df-modal {',
      '  background: var(--surface-bg, #1e1e1e); border-radius: 12px;',
      '  border: 1px solid var(--border-color, #333);',
      '  width: 90%; max-width: 600px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);',
      '  overflow: hidden;',
      '}',
      '.df-modal-header {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  padding: 16px 20px; border-bottom: 1px solid var(--border-color, #333);',
      '}',
      '.df-modal-title { font-size: 16px; font-weight: 600; color: var(--text-primary, #e0e0e0); }',
      '.df-modal-close {',
      '  background: none; border: none; color: var(--text-secondary, #999);',
      '  cursor: pointer; padding: 4px; border-radius: 4px;',
      '}',
      '.df-modal-close:hover { color: var(--text-primary, #e0e0e0); background: var(--hover-bg, rgba(255,255,255,0.1)); }',
      '.df-modal-body { padding: 16px 20px; }',

      /* Shortcut table */
      '.df-shortcut-category {',
      '  font-size: 11px; text-transform: uppercase; letter-spacing: 1px;',
      '  color: var(--text-secondary, #999); margin: 16px 0 8px; font-weight: 600;',
      '}',
      '.df-shortcut-category:first-child { margin-top: 0; }',
      '.df-shortcut-table { width: 100%; border-collapse: collapse; }',
      '.df-shortcut-table td { padding: 6px 0; color: var(--text-primary, #e0e0e0); font-size: 13px; }',
      '.df-shortcut-keys { width: 45%; }',
      'kbd {',
      '  background: var(--hover-bg, rgba(255,255,255,0.1));',
      '  border: 1px solid var(--border-color, #444);',
      '  border-radius: 4px; padding: 2px 6px; font-size: 11px;',
      '  font-family: monospace; color: var(--text-primary, #e0e0e0);',
      '}',

      /* Notification panel */
      '.df-notification-panel {',
      '  position: fixed; top: 50px; right: 16px;',
      '  width: 360px; max-height: 480px;',
      '  background: var(--surface-bg, #1e1e1e);',
      '  border: 1px solid var(--border-color, #333);',
      '  border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.4);',
      '  z-index: 9999; display: none; flex-direction: column;',
      '  overflow: hidden;',
      '}',
      '.df-notification-panel.df-panel-open { display: flex; }',
      '.df-notif-header {',
      '  display: flex; align-items: center; justify-content: space-between;',
      '  padding: 12px 16px; border-bottom: 1px solid var(--border-color, #333);',
      '}',
      '.df-notif-header-title { font-weight: 600; font-size: 14px; color: var(--text-primary, #e0e0e0); }',
      '.df-notif-header-actions { display: flex; gap: 8px; align-items: center; }',
      '.df-link-btn {',
      '  background: none; border: none; color: var(--text-secondary, #999);',
      '  cursor: pointer; font-size: 12px; padding: 4px 8px; border-radius: 4px;',
      '}',
      '.df-link-btn:hover { color: var(--text-primary, #e0e0e0); background: var(--hover-bg, rgba(255,255,255,0.1)); }',
      '.df-notif-body { overflow-y: auto; max-height: 380px; }',
      '.df-notif-empty {',
      '  padding: 40px 16px; text-align: center; color: var(--text-secondary, #999); font-size: 13px;',
      '}',
      '.df-notif-item {',
      '  display: flex; gap: 10px; padding: 10px 16px;',
      '  border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.05));',
      '  transition: background 0.15s;',
      '}',
      '.df-notif-item:hover { background: var(--hover-bg, rgba(255,255,255,0.04)); }',
      '.df-notif-unread { background: var(--hover-bg, rgba(255,255,255,0.03)); }',
      '.df-notif-icon { flex-shrink: 0; margin-top: 2px; }',
      '.df-notif-icon-success { color: #81c784; }',
      '.df-notif-icon-error { color: #ef5350; }',
      '.df-notif-icon-warning { color: #ffb74d; }',
      '.df-notif-icon-info { color: #4fc3f7; }',
      '.df-notif-content { flex: 1; min-width: 0; }',
      '.df-notif-title { font-size: 13px; font-weight: 500; color: var(--text-primary, #e0e0e0); }',
      '.df-notif-message { font-size: 12px; color: var(--text-secondary, #aaa); margin-top: 2px; word-break: break-word; }',
      '.df-notif-time { font-size: 11px; color: var(--text-tertiary, #666); margin-top: 4px; }',

      /* Search overlay */
      '.df-search-overlay {',
      '  position: fixed; top: 0; left: 0; right: 0; bottom: 0;',
      '  background: rgba(0,0,0,0.65); z-index: 10001;',
      '  display: none; align-items: flex-start; justify-content: center;',
      '  padding-top: 15vh; backdrop-filter: blur(3px);',
      '}',
      '.df-search-overlay.df-search-open { display: flex; }',
      '.df-search-container {',
      '  width: 90%; max-width: 580px;',
      '  background: var(--surface-bg, #1e1e1e);',
      '  border: 1px solid var(--border-color, #444);',
      '  border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);',
      '  overflow: hidden;',
      '}',
      '.df-search-input-wrap {',
      '  display: flex; align-items: center; gap: 10px;',
      '  padding: 12px 16px; border-bottom: 1px solid var(--border-color, #333);',
      '}',
      '.df-search-input-wrap svg { color: var(--text-secondary, #999); flex-shrink: 0; }',
      '.df-search-input {',
      '  flex: 1; background: none; border: none; outline: none;',
      '  color: var(--text-primary, #e0e0e0); font-size: 16px;',
      '  font-family: inherit;',
      '}',
      '.df-search-input::placeholder { color: var(--text-secondary, #777); }',
      '.df-search-results { max-height: 320px; overflow-y: auto; }',
      '.df-search-empty {',
      '  padding: 30px 16px; text-align: center; color: var(--text-secondary, #888); font-size: 13px;',
      '}',
      '.df-search-group-title {',
      '  font-size: 11px; text-transform: uppercase; letter-spacing: 1px;',
      '  color: var(--text-secondary, #888); padding: 10px 16px 4px; font-weight: 600;',
      '}',
      '.df-search-result-item {',
      '  display: flex; align-items: center; gap: 10px;',
      '  padding: 8px 16px; cursor: pointer; transition: background 0.15s;',
      '}',
      '.df-search-result-item:hover, .df-search-result-focused {',
      '  background: var(--hover-bg, rgba(255,255,255,0.08));',
      '}',
      '.df-search-result-icon { color: var(--text-secondary, #999); flex-shrink: 0; }',
      '.df-search-result-text { flex: 1; min-width: 0; }',
      '.df-search-result-title { font-size: 13px; color: var(--text-primary, #e0e0e0); }',
      '.df-search-result-sub {',
      '  font-size: 11px; color: var(--text-tertiary, #666);',
      '  display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
      '}',
      '.df-search-hint {',
      '  display: flex; gap: 16px; padding: 8px 16px;',
      '  border-top: 1px solid var(--border-color, #333);',
      '  font-size: 11px; color: var(--text-tertiary, #666);',
      '}',
      '.df-search-hint span { display: flex; align-items: center; gap: 4px; }',
      '.df-search-hint kbd {',
      '  font-size: 10px; padding: 1px 4px;',
      '}',

      /* Bulk operations toolbar */
      '.df-bulk-toolbar {',
      '  position: fixed; bottom: -60px; left: 50%; transform: translateX(-50%);',
      '  background: var(--surface-bg, #1e1e1e);',
      '  border: 1px solid var(--border-color, #444);',
      '  border-radius: 10px; padding: 8px 16px;',
      '  display: flex; align-items: center; gap: 12px;',
      '  box-shadow: 0 8px 30px rgba(0,0,0,0.4);',
      '  z-index: 9998; transition: bottom 0.3s ease;',
      '}',
      '.df-bulk-toolbar.df-bulk-visible { bottom: 24px; }',
      '.df-bulk-count { font-size: 13px; font-weight: 600; color: var(--text-primary, #e0e0e0); white-space: nowrap; }',
      '.df-bulk-btn {',
      '  background: none; border: 1px solid var(--border-color, #444);',
      '  color: var(--text-primary, #e0e0e0); cursor: pointer;',
      '  padding: 5px 10px; border-radius: 6px; font-size: 12px;',
      '  display: inline-flex; align-items: center; gap: 4px;',
      '  transition: background 0.2s; white-space: nowrap;',
      '}',
      '.df-bulk-btn:hover { background: var(--hover-bg, rgba(255,255,255,0.1)); }',
      '.df-bulk-delete { color: #ef5350; border-color: #ef5350; }',
      '.df-bulk-delete:hover { background: rgba(239,83,80,0.15); }',
      '.df-bulk-merge { color: #4fc3f7; border-color: #4fc3f7; }',
      '.df-bulk-merge:hover { background: rgba(79,195,247,0.15); }',

      /* Bulk checkbox */
      '.df-bulk-checkbox {',
      '  position: absolute; top: 8px; left: 8px; z-index: 10;',
      '  cursor: pointer; display: flex; align-items: center;',
      '}',
      '.df-bulk-checkbox input { display: none; }',
      '.df-bulk-checkmark {',
      '  width: 20px; height: 20px; border-radius: 4px;',
      '  border: 2px solid var(--border-color, #555);',
      '  display: flex; align-items: center; justify-content: center;',
      '  background: var(--surface-bg, #1e1e1e);',
      '  transition: all 0.15s; color: transparent;',
      '}',
      '.df-bulk-checkbox input:checked + .df-bulk-checkmark {',
      '  background: #4fc3f7; border-color: #4fc3f7; color: #fff;',
      '}',

      /* Dashboard tab content */
      '.df-dashboard { padding: 20px; overflow-y: auto; }',
      '.df-dashboard-loading, .df-dashboard-error {',
      '  padding: 40px; text-align: center; color: var(--text-secondary, #999); font-size: 14px;',
      '}',
      '.df-dashboard-error { color: #ef5350; }',

      /* Stats row */
      '.df-stats-row {',
      '  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));',
      '  gap: 16px; margin-bottom: 24px;',
      '}',
      '.df-stat-card {',
      '  background: var(--surface-bg, #1e1e1e);',
      '  border: 1px solid var(--border-color, #333);',
      '  border-radius: 10px; padding: 20px;',
      '  display: flex; align-items: center; gap: 16px;',
      '}',
      '.df-stat-icon { opacity: 0.9; }',
      '.df-stat-value { font-size: 28px; font-weight: 700; color: var(--text-primary, #e0e0e0); line-height: 1; }',
      '.df-stat-label { font-size: 12px; color: var(--text-secondary, #999); margin-top: 4px; }',

      /* Dashboard grid */
      '.df-dashboard-grid {',
      '  display: grid; grid-template-columns: 1fr 1fr; gap: 20px;',
      '}',
      '@media (max-width: 800px) { .df-dashboard-grid { grid-template-columns: 1fr; } }',
      '.df-dashboard-col { display: flex; flex-direction: column; gap: 20px; }',
      '.df-dashboard-section {',
      '  background: var(--surface-bg, #1e1e1e);',
      '  border: 1px solid var(--border-color, #333);',
      '  border-radius: 10px; padding: 16px; overflow: hidden;',
      '}',
      '.df-dashboard-section-title {',
      '  font-size: 14px; font-weight: 600; color: var(--text-primary, #e0e0e0);',
      '  margin-bottom: 12px;',
      '}',
      '.df-dashboard-empty {',
      '  padding: 20px; text-align: center; color: var(--text-secondary, #888); font-size: 13px;',
      '}',

      /* Activity list */
      '.df-activity-list { display: flex; flex-direction: column; gap: 2px; }',
      '.df-activity-item {',
      '  display: flex; gap: 10px; padding: 8px;',
      '  border-radius: 6px; transition: background 0.15s;',
      '}',
      '.df-activity-item:hover { background: var(--hover-bg, rgba(255,255,255,0.04)); }',
      '.df-activity-icon { color: var(--text-secondary, #888); margin-top: 2px; flex-shrink: 0; }',
      '.df-activity-info { flex: 1; min-width: 0; }',
      '.df-activity-name { font-size: 13px; color: var(--text-primary, #e0e0e0); }',
      '.df-activity-meta {',
      '  font-size: 11px; color: var(--text-tertiary, #666);',
      '  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
      '}',
      '.df-activity-time { font-size: 11px; color: var(--text-tertiary, #666); margin-top: 2px; }',

      /* Quick actions */
      '.df-quick-actions { display: flex; gap: 8px; flex-wrap: wrap; }',
      '.df-quick-btn {',
      '  background: var(--hover-bg, rgba(255,255,255,0.06));',
      '  border: 1px solid var(--border-color, #444);',
      '  color: var(--text-primary, #e0e0e0); cursor: pointer;',
      '  padding: 10px 16px; border-radius: 8px; font-size: 13px;',
      '  display: inline-flex; align-items: center; gap: 6px;',
      '  transition: background 0.2s;',
      '}',
      '.df-quick-btn:hover { background: var(--hover-bg, rgba(255,255,255,0.12)); }',

      /* Test results */
      '.df-test-list { display: flex; flex-direction: column; gap: 4px; }',
      '.df-test-item {',
      '  display: flex; align-items: center; gap: 8px;',
      '  padding: 8px; border-radius: 6px; font-size: 13px;',
      '}',
      '.df-test-passed .df-test-status { color: #81c784; }',
      '.df-test-failed .df-test-status { color: #ef5350; }',
      '.df-test-unknown .df-test-status { color: #ffb74d; }',
      '.df-test-name { flex: 1; color: var(--text-primary, #e0e0e0); }',
      '.df-test-time { font-size: 11px; color: var(--text-tertiary, #666); }',

      ''
    ].join('\n');
    document.head.appendChild(style);
  },

  // =========================================================================
  //  MAIN INIT
  // =========================================================================
  init() {
    this._injectStyles();

    // CRITICAL FIX: Remove any stray shortcuts modal from previous session
    var strayModal = document.getElementById('df-shortcuts-modal');
    if (strayModal) {
      strayModal.remove();
      console.warn('[DashboardFeatures] Removed stray shortcuts modal on init');
    }

    this.theme.init();
    this.shortcuts.init();
    this.notifications.init();
    this.search.init();
    this.bulk.init();
    this.analytics.init();

    // Hook into existing showToast to also add notifications
    if (typeof window.showToast === 'function') {
      var originalShowToast = window.showToast;
      window.showToast = (message, type) => {
        originalShowToast(message, type);
        this.notifications.add(type || 'info', message, type || 'info');
      };
    }

    console.log('[DashboardFeatures] Initialized. Press Shift+? for keyboard shortcuts.');
  }
};

// =========================================================================
//  AUTO-INIT & BRIDGE TO EXISTING HTML ELEMENTS
// =========================================================================
document.addEventListener('DOMContentLoaded', function () {
  // Initialize dashboard features
  DashboardFeatures.init();

  // Bridge: Connect existing HTML header buttons to DashboardFeatures handlers
  var globalSearchBtn = document.getElementById('globalSearchBtn');
  if (globalSearchBtn) {
    globalSearchBtn.addEventListener('click', function () {
      DashboardFeatures.search.open();
    });
  }

  var shortcutsHelpBtn = document.getElementById('shortcutsHelpBtn');
  if (shortcutsHelpBtn) {
    shortcutsHelpBtn.addEventListener('click', function () {
      DashboardFeatures.shortcuts.showHelp();
    });
  }

  var notificationBellBtn = document.getElementById('notificationBellBtn');
  if (notificationBellBtn) {
    notificationBellBtn.addEventListener('click', function () {
      DashboardFeatures.notifications.toggle();
    });
  }

  var markAllReadBtn = document.getElementById('markAllReadBtn');
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', function () {
      DashboardFeatures.notifications.markAllRead();
    });
  }


  var dashRunTestsBtn = document.getElementById('dashRunTestsBtn');
  if (dashRunTestsBtn) {
    dashRunTestsBtn.addEventListener('click', function () {
      if (state && state.currentProject) {
        showToast('Running all tests...', 'info');
      }
    });
  }

  // Bridge: Bulk operations toolbar buttons
  var bulkSelectAll = document.getElementById('bulkSelectAll');
  if (bulkSelectAll) {
    bulkSelectAll.addEventListener('click', function () {
      DashboardFeatures.bulk.selectAll();
    });
  }

  var bulkDeselectAll = document.getElementById('bulkDeselectAll');
  if (bulkDeselectAll) {
    bulkDeselectAll.addEventListener('click', function () {
      DashboardFeatures.bulk.deselectAll();
    });
  }

  var bulkMerge = document.getElementById('bulkMerge');
  if (bulkMerge) {
    bulkMerge.addEventListener('click', function () {
      DashboardFeatures.bulk.mergeSelected();
    });
  }

  var bulkDelete = document.getElementById('bulkDelete');
  if (bulkDelete) {
    bulkDelete.addEventListener('click', function () {
      DashboardFeatures.bulk.deleteSelected();
    });
  }

  // Dashboard tab: Load data when project changes
  var projectSelect = document.getElementById('projectSelect');
  if (projectSelect) {
    projectSelect.addEventListener('change', function () {
      // Update dashboard stats when project changes
      setTimeout(function () {
        if (state && state.activeTab === 'dashboard') {
          DashboardFeatures.analytics.loadDashboard();
        }
        updateDashboardStats();
      }, 500);
    });
  }
});

// Helper: Update dashboard stats from current state
function updateDashboardStats() {
  if (!state || !state.currentProject) return;

  var totalScreens = 0;
  var totalAPIs = 0;

  // Count from mainTree
  if (state.mainTree && Array.isArray(state.mainTree)) {
    function countNodes(nodes) {
      nodes.forEach(function (node) {
        if (node.type === 'file' || node.hasScreenshot || node.path) totalScreens++;
        if (node.children) countNodes(node.children);
      });
    }
    countNodes(state.mainTree);
  }

  // Count from sections
  var sectionCount = state.sections ? state.sections.length : 0;
  state.sections && state.sections.forEach(function (s) {
    totalAPIs += (s.apiCount || 0);
  });

  var dashTotalScreens = document.getElementById('dashTotalScreens');
  var dashTotalAPIs = document.getElementById('dashTotalAPIs');
  var dashTotalSections = document.getElementById('dashTotalSections');

  if (dashTotalScreens) dashTotalScreens.textContent = totalScreens;
  if (dashTotalAPIs) dashTotalAPIs.textContent = totalAPIs;
  if (dashTotalSections) dashTotalSections.textContent = sectionCount;

  // Update storage size
  if (typeof api !== 'undefined' && api.getProjectSize) {
    api.getProjectSize(state.currentProject).then(function (size) {
      var dashStorageSize = document.getElementById('dashStorageSize');
      if (dashStorageSize && size) {
        dashStorageSize.textContent = size.totalFormatted || size.total || '0 KB';
      }
    }).catch(function () { });
  }

  // Update activity timeline
  updateActivityTimeline();
}

function updateActivityTimeline() {
  var timeline = document.getElementById('activityTimeline');
  if (!timeline || !state || !state.sections) return;

  if (state.sections.length === 0) {
    timeline.innerHTML = '<div class="empty-state" style="padding:24px;"><p>Chưa có hoạt động gần đây</p></div>';
    return;
  }

  var html = '';
  var recent = state.sections.slice(0, 10);
  recent.forEach(function (section) {
    var timestamp = typeof formatTimestamp === 'function' ? formatTimestamp(section.timestamp) : section.timestamp;
    var isReplay = String(section.timestamp).includes('_replay');
    var dotClass = isReplay ? 'dot-info' : 'dot-success';
    var label = isReplay ? 'Replay' : 'Capture';
    var screens = section.screenCount || (section.screens ? section.screens.length : 0);

    html += '<div class="activity-item">';
    html += '  <div class="activity-item-dot ' + dotClass + '"></div>';
    html += '  <div class="activity-item-content">';
    html += '    <div class="activity-item-description"><strong>' + label + '</strong> - ' + screens + ' screens, ' + (section.apiCount || 0) + ' APIs</div>';
    html += '    <div class="activity-item-time">' + timestamp + '</div>';
    html += '  </div>';
    html += '</div>';
  });

  timeline.innerHTML = html;
}
