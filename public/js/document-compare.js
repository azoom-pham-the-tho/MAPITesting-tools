/**
 * Document Library & Compare Module
 * Professional Document Management with Smart Comparison
 */

class DocumentCompare {
  constructor() {
    this.currentDocument = null;
    this.documents = [];
    this.allDocuments = [];
    this.defaultCategories = [
      { id: 'all', name: 'Tat ca', icon: 'folder' },
      { id: 'requirements', name: 'Yeu cau', icon: 'file-text' },
      { id: 'test-cases', name: 'Test Cases', icon: 'check-square' },
      { id: 'reports', name: 'Bao cao', icon: 'bar-chart' },
      { id: 'uncategorized', name: 'Chua phan loai', icon: 'help-circle' }
    ];
    this.customCategories = this._loadCustomCategories();
    this.categories = [...this.defaultCategories, ...this.customCategories];
    this.currentCategory = 'all';
    this.viewMode = 'grid';
    this.searchQuery = '';

    // Pagination
    this.pageSize = 30;
    this.currentPage = 1;
    this.hasMore = false;
    this.isLoadingMore = false;

    // Compare State
    this.diffMode = 'unified'; // 'unified' or 'side-by-side'
    this.currentChanges = [];
    this.changePositions = []; // Track positions for navigation
    this.currentChangeIndex = -1;
    this.renderedCount = 0;
    this.BATCH_SIZE = 80;
    this.CONTEXT_LINES = 3; // Lines to show around changes

    // Intersection Observer for Infinite Scroll
    this.observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && this.hasMore && !this.isLoadingMore) {
        this.loadMore();
      }
    }, { root: null, rootMargin: '100px', threshold: 0.1 });

    this.init();
  }

  // --- API Helpers ---
  async _fetch(url, options = {}) {
    try {
      const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options,
      });
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
        return data;
      }
      return await response.text();
    } catch (err) {
      console.error('API Error:', err);
      this.showToast(err.message, 'error');
      throw err;
    }
  }

  // --- Initialization ---
  init() {
    this.injectStyles();
    this.setupMainContainer();
    this.setupEventListeners();
    if (document.querySelector('.tab-btn[data-tab="documents"].active')) {
      this.loadDocuments();
    }
  }

  injectStyles() {
    if (!document.getElementById('doc-styles')) {
      const link = document.createElement('link');
      link.id = 'doc-styles';
      link.rel = 'stylesheet';
      link.href = '/css/document-style.css?v=' + Date.now();
      document.head.appendChild(link);
    }
  }

  setupMainContainer() {
    const container = document.getElementById('documentsTab');
    if (!container) return;

    container.style.padding = '0';
    container.style.overflow = 'hidden';

    container.innerHTML = `
      <div class="doc-layout">
        <!-- Sidebar -->
        <div class="doc-sidebar">
          <div class="doc-sidebar-title">THU VIEN</div>
          <div id="libSidebarNav"></div>
        </div>

        <!-- Main Content -->
        <div class="doc-main">
          <!-- Toolbar -->
          <div class="doc-toolbar">
            <div class="doc-search-wrapper">
              <svg class="doc-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input type="text" class="doc-search-input" id="docSearchInput" placeholder="Tim tai lieu...">
            </div>
            <div class="doc-tools">
              <button class="doc-btn-icon ${this.viewMode === 'grid' ? 'active' : ''}" onclick="docCompare.setViewMode('grid')" title="Grid View">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
              </button>
              <button class="doc-btn-icon ${this.viewMode === 'list' ? 'active' : ''}" onclick="docCompare.setViewMode('list')" title="List View">
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
              </button>
              <label for="docFileInput" class="doc-btn-primary">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                Upload
              </label>
              <input type="file" id="docFileInput" multiple accept=".docx,.xlsx,.xls,.pdf,.txt,.csv" style="display:none" onchange="handleDocUpload(this)">
            </div>
          </div>

          <!-- Content Area -->
          <div id="libContent" class="doc-content-area"></div>

          <!-- Drop Overlay -->
          <div id="libDropOverlay" class="dropzone-overlay">
            <div style="text-align:center; color: var(--doc-primary);">
              <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin:0 auto 0.75rem"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              <h3 style="font-size: 1.1rem; font-weight: 600;">Tha file vao day de upload</h3>
            </div>
          </div>
        </div>
      </div>

      <!-- Detail View (Full Screen Overlay) -->
      <div id="docDetailView" class="doc-detail-overlay" style="display:none;"></div>
    `;

    this.renderSidebar();
    this.setupDropZone();

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.doc-card-menu-btn')) {
        document.querySelectorAll('.doc-dropdown').forEach(m => m.remove());
      }
    });
  }

  setupEventListeners() {
    const tabs = document.querySelectorAll('.tab-btn[data-tab="documents"]');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        if (!document.querySelector('.doc-layout')) {
          this.setupMainContainer();
        }
        this.loadDocuments();
      });
    });

    const searchInput = document.getElementById('docSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.currentPage = 1;
        this.renderContent();
      });
    }
  }

  setupDropZone() {
    const main = document.querySelector('.doc-main');
    const overlay = document.getElementById('libDropOverlay');
    if (!main || !overlay) return;

    let dragCounter = 0;

    main.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      overlay.classList.add('active');
    });

    main.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0) overlay.classList.remove('active');
    });

    main.addEventListener('dragover', (e) => e.preventDefault());

    main.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragCounter = 0;
      overlay.classList.remove('active');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        await this.uploadFiles(Array.from(files));
      }
    });
  }

  // --- Logic ---

  async loadDocuments() {
    if (!window.state.currentProject) return;
    try {
      const res = await this._fetch(`/api/documents/${encodeURIComponent(window.state.currentProject)}`);
      if (res.success) {
        this.allDocuments = res.documents.map(d => ({
          ...d,
          category: d.category || 'uncategorized'
        }));
        this.currentPage = 1;
        this.renderContent();
        this.renderSidebar();
      }
    } catch (e) {
      console.error(e);
    }
  }

  getFilteredDocuments() {
    const filtered = this.allDocuments.filter(doc => {
      const matchSearch = doc.name.toLowerCase().includes(this.searchQuery);
      const matchCat = this.currentCategory === 'all' || doc.category === this.currentCategory;
      return matchSearch && matchCat;
    });

    const endIndex = this.currentPage * this.pageSize;
    this.hasMore = endIndex < filtered.length;
    return filtered.slice(0, endIndex);
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.setupMainContainer();
    this.loadDocuments();
  }

  setCategory(catId) {
    this.currentCategory = catId;
    this.renderSidebar();
    this.currentPage = 1;
    this.renderContent();
  }

  // --- Rendering ---

  renderSidebar() {
    const nav = document.getElementById('libSidebarNav');
    if (!nav) return;

    const defaultIds = this.defaultCategories.map(c => c.id);

    nav.innerHTML = this.categories.map(cat => {
      const count = cat.id === 'all'
        ? this.allDocuments.length
        : this.allDocuments.filter(d => d.category === cat.id).length;
      const isCustom = !defaultIds.includes(cat.id);

      return `
        <div class="doc-nav-item ${this.currentCategory === cat.id ? 'active' : ''}" onclick="docCompare.setCategory('${cat.id}')">
          ${this.getCategoryIcon(cat.icon)}
          <span style="flex:1">${cat.name}</span>
          ${count > 0 ? `<span class="doc-nav-count">${count}</span>` : ''}
          ${isCustom ? `<button class="doc-nav-delete-btn" onclick="event.stopPropagation(); docCompare.deleteCategory('${cat.id}')" title="Xoa thu muc" style="background:none; border:none; color:var(--doc-text-muted); cursor:pointer; font-size:14px; padding:0 2px; line-height:1; opacity:0.5;">&times;</button>` : ''}
        </div>
      `;
    }).join('') + `
      <div class="doc-nav-item" onclick="docCompare.addCategory()" style="color:var(--doc-text-muted); border:1px dashed var(--doc-border); margin-top:0.5rem; justify-content:center; gap:4px; opacity:0.7;">
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        Them thu muc
      </div>
    `;
  }

  _loadCustomCategories() {
    try {
      const key = `doc_custom_categories_${window.state?.currentProject || 'default'}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) { return []; }
  }

  _saveCustomCategories() {
    try {
      const key = `doc_custom_categories_${window.state?.currentProject || 'default'}`;
      localStorage.setItem(key, JSON.stringify(this.customCategories));
    } catch (e) { /* */ }
  }

  addCategory() {
    this.showPrompt('Nhap ten thu muc moi:', '', (name) => {
      if (!name || !name.trim()) return;
      const id = 'custom_' + Date.now();
      const newCat = { id, name: name.trim(), icon: 'folder' };
      this.customCategories.push(newCat);
      this.categories = [...this.defaultCategories, ...this.customCategories];
      this._saveCustomCategories();
      this.renderSidebar();
      this.showSuccess('Da them thu muc: ' + name.trim());
    });
  }

  deleteCategory(catId) {
    const cat = this.customCategories.find(c => c.id === catId);
    if (!cat) return;
    this.showCustomConfirm(`Xoa thu muc "${cat.name}"? Cac tai lieu ben trong se chuyen ve "Chua phan loai".`, () => {
      this.allDocuments.forEach(doc => {
        if (doc.category === catId) doc.category = 'uncategorized';
      });
      this.customCategories = this.customCategories.filter(c => c.id !== catId);
      this.categories = [...this.defaultCategories, ...this.customCategories];
      this._saveCustomCategories();
      if (this.currentCategory === catId) this.currentCategory = 'all';
      this.renderSidebar();
      this.renderContent();
      this.showSuccess('Da xoa thu muc: ' + cat.name);
    });
  }

  getCategoryIcon(name) {
    const icons = {
      'folder': '<svg class="doc-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>',
      'file-text': '<svg class="doc-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>',
      'check-square': '<svg class="doc-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>',
      'bar-chart': '<svg class="doc-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>',
      'help-circle': '<svg class="doc-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
    };
    return icons[name] || icons.folder;
  }

  renderContent() {
    const container = document.getElementById('libContent');
    if (!container) return;

    const filtered = this.getFilteredDocuments();

    if (filtered.length === 0 && !this.isLoadingMore) {
      container.innerHTML = `
        <div class="doc-empty">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width:48px;height:48px;color:var(--doc-border);margin-bottom:1rem;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"></path></svg>
          <p style="font-weight:600; font-size:0.95rem;">Chua co tai lieu</p>
          <p style="font-size:0.85rem; opacity:0.7;">Upload file de bat dau</p>
        </div>
      `;
      return;
    }

    let html = '';

    if (this.viewMode === 'grid') {
      html = `<div class="doc-grid">
        ${filtered.map(doc => this.renderGridItem(doc)).join('')}
      </div>`;
    } else {
      html = `<table class="doc-list-view">
        <thead>
          <tr>
            <th>Ten</th>
            <th>Loai</th>
            <th>Versions</th>
            <th>Cap nhat</th>
            <th style="width: 50px;"></th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(doc => this.renderListItem(doc)).join('')}
        </tbody>
      </table>`;
    }

    if (this.hasMore) {
      html += `
        <div id="docLoadingSentinel" class="doc-loading-sentinel"></div>
        <div class="doc-loading-spinner">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        </div>
      `;
    }

    const prevScroll = container.scrollTop;
    container.innerHTML = html;
    if (this.currentPage > 1) container.scrollTop = prevScroll;

    const sentinel = document.getElementById('docLoadingSentinel');
    if (sentinel) {
      this.observer.disconnect();
      this.observer.observe(sentinel);
    }
  }

  loadMore() {
    if (this.isLoadingMore || !this.hasMore) return;
    this.isLoadingMore = true;
    setTimeout(() => {
      this.currentPage++;
      this.renderContent();
      this.isLoadingMore = false;
    }, 200);
  }

  renderFileName(doc) {
    const ext = doc.ext.replace('.', '');
    const displayName = doc.displayName || doc.baseName;
    return `
      <div class="doc-file-name-wrapper">
        <span class="doc-file-basename" title="${doc.name}">${this.escapeHtml(displayName)}</span>
        <span class="file-ext-badge ext-${ext}">${ext}</span>
      </div>
    `;
  }

  renderGridItem(doc) {
    return `
      <div class="doc-file-card" onclick="docCompare.openDocument('${doc.id}')">
        <button class="doc-card-menu-btn" onclick="event.stopPropagation(); docCompare.showCardMenu(event, '${doc.id}')">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>
        </button>
        <div class="doc-file-icon icon-${doc.type}">
          ${this.getFileIcon(doc.type)}
        </div>
        ${this.renderFileName(doc)}
        <div class="doc-file-info">
          <span class="doc-version-tag">v${doc.versions.length}</span>
          <span style="color:var(--doc-text-muted);">&#183;</span>
          <span>${this.formatDate(doc.updatedAt || doc.createdAt)}</span>
        </div>
      </div>
    `;
  }

  renderListItem(doc) {
    return `
      <tr onclick="docCompare.openDocument('${doc.id}')">
        <td>
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="icon-${doc.type}" style="width:24px; height:24px;">${this.getFileIcon(doc.type, true)}</div>
            ${this.renderFileName(doc)}
          </div>
        </td>
        <td>${doc.type.toUpperCase()}</td>
        <td><span class="doc-version-tag">v${doc.versions.length}</span></td>
        <td>${this.formatDate(doc.updatedAt || doc.createdAt)}</td>
        <td>
          <button class="doc-btn-icon" style="border:none; width:28px; height:28px; background:transparent;" onclick="event.stopPropagation(); docCompare.showCardMenu(event, '${doc.id}')">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M3 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>
          </button>
        </td>
      </tr>
    `;
  }

  showCardMenu(event, docId) {
    document.querySelectorAll('.doc-dropdown').forEach(m => m.remove());

    const menu = document.createElement('div');
    menu.className = 'doc-dropdown show';
    menu.style.top = `${event.clientY + 10}px`;
    menu.style.left = `${event.clientX - 100}px`;

    menu.innerHTML = `
      <div class="doc-menu-item" onclick="docCompare.renameDocument('${docId}')">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
        Doi ten
      </div>
      <div class="doc-menu-item" onclick="docCompare.downloadLatest('${docId}')">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
        Tai ban moi nhat
      </div>
      <div class="doc-menu-item danger" onclick="docCompare.deleteDocument('${docId}')">
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        Xoa
      </div>
    `;

    document.body.appendChild(menu);
  }

  async renameDocument(docId) {
    document.querySelectorAll('.doc-dropdown').forEach(m => m.remove());
    const doc = this.allDocuments.find(d => d.id === docId);
    if (!doc) return;
    const currentName = doc.displayName || doc.baseName;
    this.showPrompt('Nhap ten moi:', currentName, async (newName) => {
      if (!newName || !newName.trim() || newName.trim() === currentName) return;
      try {
        await this._fetch(`/api/documents/${encodeURIComponent(window.state.currentProject)}/${docId}/rename`, {
          method: 'PUT',
          body: JSON.stringify({ displayName: newName.trim() })
        });
        doc.displayName = newName.trim();
        this.renderContent();
        this.showSuccess('Da doi ten thanh: ' + newName.trim());
      } catch (e) {
        this.showToast('Doi ten that bai: ' + e.message, 'error');
      }
    });
  }

  getFileIcon(type, small = false) {
    const size = small ? 24 : 42;
    const icons = {
      word: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="1.5"><rect x="5" y="3" width="14" height="18" rx="2" stroke="#2563eb"/><path d="M9 9h6M9 13h6M9 17h4" stroke="#2563eb" stroke-linecap="round"/></svg>`,
      excel: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2" stroke="#16a34a"/><path d="M4 10h16M10 4v16" stroke="#16a34a"/></svg>`,
      pdf: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="1.5"><rect x="5" y="3" width="14" height="18" rx="2" stroke="#dc2626"/><path d="M9 11h6M9 15h3" stroke="#dc2626" stroke-linecap="round"/></svg>`,
      text: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#64748b"/><path d="M14 2v6h6" stroke="#64748b"/></svg>`,
      csv: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2" stroke="#16a34a"/><path d="M4 10h16M10 4v16M16 4v16" stroke="#16a34a"/></svg>`
    };
    return icons[type] || icons.text;
  }

  // --- Document Actions ---

  async uploadFiles(files) {
    if (!window.state.currentProject) return this.showToast('Chon project truoc', 'error');

    this.showToast(`Dang upload ${files.length} file...`, 'info');

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch(`/api/documents/${encodeURIComponent(window.state.currentProject)}/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();

        if (data.success && this.currentCategory !== 'all' && this.currentCategory !== 'uncategorized') {
          await this._fetch(`/api/documents/${encodeURIComponent(window.state.currentProject)}/${data.id}/category`, {
            method: 'PUT',
            body: JSON.stringify({ category: this.currentCategory })
          });
        }
      } catch (e) {
        console.error(e);
      }
    }

    this.showToast('Upload thanh cong!', 'success');
    this.loadDocuments();
  }

  async downloadLatest(docId) {
    try {
      const res = await this._fetch(`/api/documents/${encodeURIComponent(window.state.currentProject)}/${docId}`);
      if (res.success && res.document.versions.length > 0) {
        const latestV = res.document.versions[res.document.versions.length - 1].version;
        window.open(`/api/documents/${encodeURIComponent(window.state.currentProject)}/${docId}/${latestV}/download`, '_blank');
      }
    } catch (e) {
      console.error(e);
    }
  }

  async deleteDocument(id) {
    this.showCustomConfirm('Xoa tai lieu nay?', async () => {
      await this._fetch(`/api/documents/${encodeURIComponent(window.state.currentProject)}/${id}`, { method: 'DELETE' });
      this.showToast('Da xoa tai lieu', 'success');
      this.loadDocuments();
    });
  }

  // --- Detail View ---

  async openDocument(id) {
    const res = await this._fetch(`/api/documents/${encodeURIComponent(window.state.currentProject)}/${id}`);
    if (res.success) {
      this.currentDocument = res.document;
      this.renderDetailView();
    }
  }

  renderDetailView() {
    const view = document.getElementById('docDetailView');
    view.style.display = 'flex';

    const doc = this.currentDocument;
    const latestVersion = doc.versions[doc.versions.length - 1];

    view.innerHTML = `
      <div class="doc-detail-toolbar">
        <div style="display:flex; align-items:center; gap:0.75rem;">
          <button class="doc-btn-icon" onclick="docCompare.closeDetailView()">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <div>
            <h2 style="margin:0; font-size:1rem; font-weight:600; display:flex; align-items:center; gap:6px;">
              ${this.escapeHtml(doc.displayName || doc.baseName)}
              <span class="file-ext-badge ext-${doc.ext.replace('.', '')}">${doc.ext}</span>
            </h2>
            <div style="display:flex; align-items:center; gap:8px; font-size:0.75rem; color:var(--doc-text-sub); margin-top:2px;">
              <span style="opacity:0.7;" title="Ten file goc">📄 ${this.escapeHtml(doc.name)}</span>
              <span style="opacity:0.3;">|</span>
              <span>Phan loai:</span>
              <select style="border:none; background:transparent; font-weight:500; cursor:pointer; color:var(--doc-primary); font-size:0.75rem; outline:none;" onchange="docCompare.updateDocCategory('${doc.id}', this.value)">
                ${this.categories.filter(c => c.id !== 'all').map(c => `
                  <option value="${c.id}" ${c.id === (doc.category || 'uncategorized') ? 'selected' : ''}>${c.name}</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          ${doc.versions.length > 1 ? `
            <button class="doc-btn-primary" onclick="docCompare.startCompare()">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
              So sanh phien ban
            </button>
          ` : ''}
          <button class="doc-btn-icon" style="color:var(--doc-danger); border-color:var(--doc-danger);" onclick="docCompare.deleteCurrentDocument()" title="Xoa tai lieu">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          </button>
        </div>
      </div>

      <div style="display:flex; flex:1; overflow:hidden;">
        <!-- Versions Sidebar - Timeline Style -->
        <div class="doc-version-sidebar">
          <div class="doc-version-header">
            <span class="doc-version-header-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Version History
            </span>
            <label class="doc-version-upload-btn" style="cursor:pointer;">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
              Upload
              <input type="file" accept=".docx,.xlsx,.xls,.pdf,.txt,.csv" style="display:none" onchange="docCompare.uploadNewVersion(this)">
            </label>
          </div>
          <div class="doc-version-search">
            <input type="text" placeholder="Search versions..." id="docVersionSearch" oninput="docCompare.filterVersions(this.value)">
          </div>
          <div class="doc-version-timeline" id="docVersionTimeline">
            ${[...doc.versions].reverse().map(v => {
      const isLatest = v.version === latestVersion.version;
      const timeStr = this.timeAgo(v.uploadedAt);
      const dateStr = this.formatDateShort(v.uploadedAt);
      return `
              <div class="doc-version-tl-item ${isLatest ? 'active-version' : ''}"
                   onclick="docCompare.previewVersion(${v.version})">
                <div class="doc-version-dot"></div>
                <div class="doc-version-tl-info">
                  <div class="doc-version-tl-title">
                    v${v.version}
                    ${isLatest ? '<span class="doc-version-tl-tag latest">latest</span>' : ''}
                    <span class="doc-version-tl-actions">
                      <button class="doc-version-tl-act" onclick="event.stopPropagation(); docCompare.downloadVersion(${v.version})" title="Download">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                      </button>
                      ${doc.versions.length > 1 ? `
                        <button class="doc-version-tl-act act-danger" onclick="event.stopPropagation(); docCompare.deleteVersion(${v.version})" title="Xoa phien ban">
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      ` : ''}
                    </span>
                  </div>
                  <div class="doc-version-tl-meta">
                    <span class="doc-version-tl-size">${this.formatSize(v.size)}</span>
                    <span>${timeStr}</span>
                    <span class="doc-version-tl-date">${dateStr}</span>
                  </div>
                </div>
              </div>
            `}).join('')}
          </div>
        </div>

        <!-- Preview / Compare Area -->
        <div id="docMainArea" style="flex:1; overflow-y:auto; background:var(--doc-bg-app);"></div>
      </div>
    `;

    this.previewVersion(latestVersion.version);
  }

  async updateDocCategory(docId, newCat) {
    await this._fetch(`/api/documents/${encodeURIComponent(window.state.currentProject)}/${docId}/category`, {
      method: 'PUT',
      body: JSON.stringify({ category: newCat })
    });
    this.currentDocument.category = newCat;
    this.loadDocuments();
  }

  closeDetailView() {
    if (this._pdfCleanup) { this._pdfCleanup(); this._pdfCleanup = null; }
    if (this._excelCleanup) { this._excelCleanup(); this._excelCleanup = null; }
    document.getElementById('docDetailView').style.display = 'none';
    this.currentDocument = null;
  }

  async uploadNewVersion(input) {
    if (!input.files.length || !this.currentDocument) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('file', file);

    const docId = this.currentDocument.id;
    this.showToast('Dang upload phien ban moi...', 'info');
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(window.state.currentProject)}/upload?docId=${encodeURIComponent(docId)}`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Upload phien ban moi thanh cong!', 'success');
        // Reload document and re-render detail view
        await this.openDocument(docId);
        this.loadDocuments();
      } else {
        this.showToast(data.error || 'Upload that bai', 'error');
      }
    } catch (e) {
      this.showToast('Upload that bai: ' + e.message, 'error');
    }
    input.value = '';
  }

  async deleteCurrentDocument() {
    if (!this.currentDocument) return;
    this.showCustomConfirm('Xoa tai lieu nay va tat ca phien ban?', async () => {
      try {
        await this._fetch(`/api/documents/${encodeURIComponent(window.state.currentProject)}/${this.currentDocument.id}`, { method: 'DELETE' });
        this.showToast('Da xoa tai lieu', 'success');
        this.closeDetailView();
        this.loadDocuments();
      } catch (e) {
        this.showToast('Xoa that bai: ' + e.message, 'error');
      }
    });
  }

  async deleteVersion(version) {
    if (!this.currentDocument) return;
    if (this.currentDocument.versions.length <= 1) {
      return this.showToast('Khong the xoa phien ban cuoi cung. Hay xoa ca tai lieu.', 'error');
    }
    this.showCustomConfirm(`Xoa phien ban v${version}?`, async () => {
      try {
        await this._fetch(`/api/documents/${encodeURIComponent(window.state.currentProject)}/${this.currentDocument.id}/${version}`, { method: 'DELETE' });
        this.showToast(`Da xoa phien ban v${version}`, 'success');
        await this.openDocument(this.currentDocument.id);
        this.loadDocuments();
      } catch (e) {
        this.showToast('Xoa that bai: ' + e.message, 'error');
      }
    });
  }

  // --- Preview ---

  async previewVersion(version) {
    // Cleanup previous listeners
    if (this._pdfCleanup) { this._pdfCleanup(); this._pdfCleanup = null; }
    if (this._excelCleanup) { this._excelCleanup(); this._excelCleanup = null; }
    this._previewingVersion = version;

    const area = document.getElementById('docMainArea');
    area.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100%;gap:8px;color:var(--doc-text-sub);"><div class="doc-loading-spinner" style="padding:0;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div> Dang tai...</div>';

    try {
      const res = await this._fetch(`/api/documents/${encodeURIComponent(window.state.currentProject)}/${this.currentDocument.id}/${version}/preview`);

      if (!res.success) throw new Error('Preview failed');

      area.innerHTML = '';

      // Title bar
      const titleBar = document.createElement('div');
      titleBar.className = 'preview-full-title';
      titleBar.innerHTML = `
        <span class="title-text">${this.escapeHtml(this.currentDocument.name)}</span>
        <span class="doc-version-tag">v${version}</span>
      `;
      area.appendChild(titleBar);

      const wrapper = document.createElement('div');
      wrapper.className = 'preview-container';
      area.appendChild(wrapper);

      if (res.type === 'pdf') {
        await this.renderPdf(res.url, wrapper);
      } else if (res.type === 'html') {
        this.renderHtmlLazy(res.content, wrapper);
      } else if (res.type === 'excel') {
        this.renderExcel(res, wrapper);
      } else {
        this.renderTextLazy(res.content || '', wrapper);
      }

    } catch (e) {
      area.innerHTML = `<div class="doc-empty" style="color:var(--doc-danger);"><p>Loi preview: ${e.message}</p></div>`;
    }
  }

  async renderPdf(url, container) {
    if (!window.pdfjsLib) {
      container.innerHTML = '<div class="doc-empty"><p>PDF.js chua duoc tai. Kiem tra ket noi mang.</p></div>';
      return;
    }

    try {
      const loadingTask = pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;

      // Zoom state - render at high resolution, use CSS transform for smooth zoom
      const BASE_RENDER_SCALE = 2.0; // Render at 2x for crisp display
      let cssZoom = 0.65; // Initial CSS zoom (0.65 * 2.0 base = ~1.3x visual)
      const MIN_ZOOM = 0.25;
      const MAX_ZOOM = 2.0;
      const ZOOM_STEP = 0.05; // Smaller step for smoother zoom
      const WHEEL_STEP = 0.03; // Even smaller for scroll wheel

      const getVisualPercent = () => Math.round(cssZoom * BASE_RENDER_SCALE * 100 / 2);

      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; max-width:900px; margin-bottom:0.75rem;">
          <span style="font-size:0.85rem; color:var(--doc-text-sub);">Tong: ${pdf.numPages} trang</span>
          <div class="pdf-zoom-bar" style="position:static; margin-bottom:0;">
            <button class="pdf-zoom-btn" id="pdfZoomOut" title="Thu nho (Ctrl+-)">-</button>
            <span class="pdf-zoom-level" id="pdfZoomLevel">${getVisualPercent()}%</span>
            <button class="pdf-zoom-btn" id="pdfZoomIn" title="Phong to (Ctrl++)">+</button>
            <button class="pdf-zoom-btn" id="pdfZoomFit" title="Vua man hinh" style="font-size:0.7rem;">Fit</button>
          </div>
        </div>
        <div id="pdfPages" class="preview-pdf-container"></div>
        <div id="pdfSentinel" class="lazy-load-sentinel">
          <div class="lazy-load-spinner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span>Dang tai them trang...</span>
          </div>
        </div>
        <div id="pdfLoadingStatus" class="doc-loading-spinner" style="display:none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        </div>
      `;

      const pagesContainer = container.querySelector('#pdfPages');
      const sentinel = container.querySelector('#pdfSentinel');
      const status = container.querySelector('#pdfLoadingStatus');
      const zoomInBtn = container.querySelector('#pdfZoomIn');
      const zoomOutBtn = container.querySelector('#pdfZoomOut');
      const zoomFitBtn = container.querySelector('#pdfZoomFit');
      const zoomLevelEl = container.querySelector('#pdfZoomLevel');

      let currentPage = 1;
      const BATCH = 3;

      // Apply CSS zoom smoothly (no re-render needed)
      const applyZoom = (newZoom) => {
        cssZoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));
        zoomLevelEl.textContent = getVisualPercent() + '%';
        pagesContainer.style.transform = `scale(${cssZoom})`;
      };

      // Set initial transform-origin and zoom
      pagesContainer.style.transformOrigin = 'top center';
      pagesContainer.style.transition = 'transform 0.15s ease-out';
      applyZoom(cssZoom);

      const renderPage = async (pageNum) => {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: BASE_RENDER_SCALE });

        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'pdf-page-wrapper';
        pageWrapper.setAttribute('data-page', pageNum);

        const pageLabel = document.createElement('div');
        pageLabel.className = 'pdf-page-number';
        pageLabel.textContent = `Trang ${pageNum} / ${pdf.numPages}`;
        pageWrapper.appendChild(pageLabel);

        // Canvas container for proper text layer alignment
        const canvasContainer = document.createElement('div');
        canvasContainer.style.cssText = 'position:relative; display:inline-block;';

        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-page-canvas';
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        // Display at native size (CSS zoom handles scaling)
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';

        canvasContainer.appendChild(canvas);

        // Text layer - exact overlay on canvas for copy-paste
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        textLayerDiv.style.cssText = `position:absolute; left:0; top:0; width:${viewport.width}px; height:${viewport.height}px;`;
        canvasContainer.appendChild(textLayerDiv);

        pageWrapper.appendChild(canvasContainer);
        pagesContainer.appendChild(pageWrapper);

        // Render canvas
        await page.render({ canvasContext: context, viewport }).promise;

        // Render text layer for copy-paste
        try {
          const textContent = await page.getTextContent();
          pdfjsLib.renderTextLayer({
            textContent,
            container: textLayerDiv,
            viewport,
            enhanceTextSelection: true
          });
        } catch (_) { /* ignore text layer errors */ }
      };

      const renderNextBatch = async () => {
        if (currentPage > pdf.numPages) {
          if (pdfObserver) pdfObserver.disconnect();
          sentinel.style.display = 'none';
          return;
        }

        status.style.display = 'flex';
        const endPage = Math.min(currentPage + BATCH, pdf.numPages + 1);

        for (let i = currentPage; i < endPage; i++) {
          await renderPage(i);
        }

        currentPage = endPage;
        status.style.display = 'none';
      };

      // Zoom controls - smooth CSS-only, no re-render
      zoomInBtn.addEventListener('click', () => {
        applyZoom(cssZoom + ZOOM_STEP);
      });

      zoomOutBtn.addEventListener('click', () => {
        applyZoom(cssZoom - ZOOM_STEP);
      });

      zoomFitBtn.addEventListener('click', () => {
        const areaWidth = document.getElementById('docMainArea')?.clientWidth || 800;
        const padding = 80;
        // Calculate CSS zoom to fit: containerWidth / (pageWidth * BASE_RENDER_SCALE)
        const pageWidthAtBase = 612 * BASE_RENDER_SCALE;
        const fitZoom = (areaWidth - padding) / pageWidthAtBase;
        applyZoom(fitZoom);
      });

      // Keyboard zoom (Ctrl+/- or Cmd+/-)
      const handleKeyZoom = (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          applyZoom(cssZoom + ZOOM_STEP);
        } else if (e.key === '-') {
          e.preventDefault();
          applyZoom(cssZoom - ZOOM_STEP);
        } else if (e.key === '0') {
          e.preventDefault();
          applyZoom(0.65); // Reset to default
        }
      };
      document.addEventListener('keydown', handleKeyZoom);

      // Ctrl+Scroll wheel zoom (Windows & Mac)
      const scrollArea = document.getElementById('docMainArea');
      const handleWheelZoom = (e) => {
        if (!e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        // Use deltaY magnitude for proportional zoom (trackpad gives small values, mouse wheel gives large)
        const rawDelta = -e.deltaY;
        const step = Math.abs(e.deltaY) > 50 ? WHEEL_STEP : WHEEL_STEP * 0.5;
        const delta = rawDelta > 0 ? step : -step;
        applyZoom(cssZoom + delta);
      };
      if (scrollArea) {
        scrollArea.addEventListener('wheel', handleWheelZoom, { passive: false });
      }

      // Pinch-to-zoom (trackpad / touchscreen)
      let lastPinchDist = 0;
      const handleTouchStart = (e) => {
        if (e.touches.length === 2) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          lastPinchDist = Math.sqrt(dx * dx + dy * dy);
        }
      };
      const handleTouchMove = (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (lastPinchDist > 0) {
            const pinchDelta = (dist - lastPinchDist) * 0.005;
            applyZoom(cssZoom + pinchDelta);
          }
          lastPinchDist = dist;
        }
      };
      const handleTouchEnd = () => { lastPinchDist = 0; };

      if (scrollArea) {
        scrollArea.addEventListener('touchstart', handleTouchStart, { passive: true });
        scrollArea.addEventListener('touchmove', handleTouchMove, { passive: false });
        scrollArea.addEventListener('touchend', handleTouchEnd, { passive: true });
      }

      // Cleanup on navigation away
      this._pdfCleanup = () => {
        document.removeEventListener('keydown', handleKeyZoom);
        if (scrollArea) {
          scrollArea.removeEventListener('wheel', handleWheelZoom);
          scrollArea.removeEventListener('touchstart', handleTouchStart);
          scrollArea.removeEventListener('touchmove', handleTouchMove);
          scrollArea.removeEventListener('touchend', handleTouchEnd);
        }
      };

      // Setup Observer for PDF Infinite Scroll
      const pdfObserver = new IntersectionObserver(async (entries) => {
        if (entries[0].isIntersecting) {
          await renderNextBatch();
        }
      }, {
        root: scrollArea,
        rootMargin: '400px',
        threshold: 0.1
      });

      pdfObserver.observe(sentinel);

    } catch (error) {
      console.error('PDF Render Error:', error);
      container.innerHTML = `<div class="doc-empty" style="color:var(--doc-danger);"><p>Khong the hien thi PDF: ${error.message}</p></div>`;
    }
  }

  renderExcel(data, container) {
    const sheetNames = data.sheetNames || Object.keys(data.sheets);
    if (sheetNames.length === 0) {
      container.innerHTML = '<div class="doc-empty"><p>File Excel khong co du lieu</p></div>';
      return;
    }

    // State
    let activeSheet = sheetNames[0];
    const sheetData = {}; // cached rows per sheet
    const sheetMeta = data.sheetInfo || {};
    sheetNames.forEach(name => {
      sheetData[name] = data.sheets[name] || [];
    });

    // Column letter helper
    const colLetter = (i) => {
      let s = '';
      i++;
      while (i > 0) { i--; s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26); }
      return s;
    };

    // Build UI
    container.innerHTML = `
      <div class="excel-viewer">
        <div class="excel-body">
          <div class="excel-table-scroll" id="excelTableScroll" tabindex="0" style="outline:none;"></div>
          <div id="excelLoadMore" class="lazy-load-sentinel" style="display:none;">
            <div class="lazy-load-spinner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <span>Dang tai them dong...</span>
            </div>
          </div>
        </div>
        <div class="excel-sheet-tabs" id="excelSheetTabs"></div>
      </div>
    `;

    const scrollContainer = container.querySelector('#excelTableScroll');
    const loadMoreEl = container.querySelector('#excelLoadMore');
    const tabsEl = container.querySelector('#excelSheetTabs');

    // Render sheet tabs
    const renderTabs = () => {
      tabsEl.innerHTML = sheetNames.map(name => {
        const info = sheetMeta[name];
        const rowCount = info ? info.totalRows : (sheetData[name] || []).length;
        return `<button class="excel-tab ${name === activeSheet ? 'active' : ''}" onclick="docCompare._switchSheet('${name.replace(/'/g, "\\'")}')">${this.escapeHtml(name)} <span class="excel-tab-count">${rowCount}</span></button>`;
      }).join('');
    };

    // Render table for active sheet
    const renderTable = () => {
      const rows = sheetData[activeSheet] || [];
      const info = sheetMeta[activeSheet];
      const colCount = info ? info.colCount : rows.reduce((m, r) => Math.max(m, r.length), 0);

      if (rows.length === 0) {
        scrollContainer.innerHTML = '<div class="doc-empty" style="padding:2rem;"><p>Sheet khong co du lieu</p></div>';
        return;
      }

      // Header row (first row)
      let headerHtml = '<tr><th class="excel-row-num"></th>';
      for (let c = 0; c < colCount; c++) {
        headerHtml += `<th class="excel-col-header">${colLetter(c)}</th>`;
      }
      headerHtml += '</tr>';

      // First row as data header
      headerHtml += '<tr class="excel-header-row"><td class="excel-row-num">1</td>';
      const firstRow = rows[0] || [];
      for (let c = 0; c < colCount; c++) {
        headerHtml += `<td class="excel-header-cell">${firstRow[c] !== null && firstRow[c] !== undefined ? this.escapeHtml(String(firstRow[c])) : ''}</td>`;
      }
      headerHtml += '</tr>';

      // Data rows
      let bodyHtml = '';
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        bodyHtml += `<tr><td class="excel-row-num">${i + 1}</td>`;
        for (let c = 0; c < colCount; c++) {
          const val = row[c];
          bodyHtml += `<td>${val !== null && val !== undefined ? this.escapeHtml(String(val)) : ''}</td>`;
        }
        bodyHtml += '</tr>';
      }

      scrollContainer.innerHTML = `
        <table class="excel-table">
          <thead>${headerHtml}</thead>
          <tbody id="excelTbody">${bodyHtml}</tbody>
        </table>
      `;

      // Show/hide load more
      const total = info ? info.totalRows : rows.length;
      if (rows.length < total) {
        loadMoreEl.style.display = 'block';
      } else {
        loadMoreEl.style.display = 'none';
      }
    };

    // Lazy load on scroll
    const handleScroll = () => {
      const el = scrollContainer;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
        this._loadMoreExcelRows(activeSheet, sheetData, sheetMeta, scrollContainer, loadMoreEl);
      }
    };
    scrollContainer.addEventListener('scroll', handleScroll);

    // Cell selection for copy (like real Excel)
    let selStart = null;
    let selEnd = null;
    let isSelecting = false;

    const clearSelection = () => {
      scrollContainer.querySelectorAll('.excel-cell-selected').forEach(td => td.classList.remove('excel-cell-selected'));
    };

    const getCellPos = (td) => {
      if (!td || td.classList.contains('excel-row-num') || td.tagName === 'TH') return null;
      const tr = td.parentElement;
      const tbody = tr.parentElement;
      if (tbody.tagName === 'THEAD') return null;
      const rowIdx = Array.from(tbody.children).indexOf(tr);
      const colIdx = Array.from(tr.children).indexOf(td) - 1; // -1 for row-num
      if (colIdx < 0) return null;
      return { row: rowIdx, col: colIdx };
    };

    const highlightRange = (start, end) => {
      clearSelection();
      if (!start || !end) return;
      const minR = Math.min(start.row, end.row), maxR = Math.max(start.row, end.row);
      const minC = Math.min(start.col, end.col), maxC = Math.max(start.col, end.col);
      const tbody = scrollContainer.querySelector('#excelTbody');
      if (!tbody) return;
      for (let r = minR; r <= maxR; r++) {
        const tr = tbody.children[r];
        if (!tr) continue;
        for (let c = minC; c <= maxC; c++) {
          const td = tr.children[c + 1]; // +1 for row-num column
          if (td) td.classList.add('excel-cell-selected');
        }
      }
    };

    scrollContainer.addEventListener('mousedown', (e) => {
      const td = e.target.closest('td');
      const pos = getCellPos(td);
      if (!pos) return;
      selStart = pos;
      selEnd = pos;
      isSelecting = true;
      highlightRange(selStart, selEnd);
      scrollContainer.focus();
    });

    scrollContainer.addEventListener('mousemove', (e) => {
      if (!isSelecting) return;
      const td = e.target.closest('td');
      const pos = getCellPos(td);
      if (!pos) return;
      selEnd = pos;
      highlightRange(selStart, selEnd);
    });

    scrollContainer.addEventListener('mouseup', () => { isSelecting = false; });

    // Copy selected cells with Ctrl+C
    const handleExcelCopy = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'c') return;
      if (!selStart || !selEnd) return;
      // Only intercept if focus is in excel area
      if (!scrollContainer.contains(document.activeElement) && !scrollContainer.matches(':hover')) return;

      const minR = Math.min(selStart.row, selEnd.row), maxR = Math.max(selStart.row, selEnd.row);
      const minC = Math.min(selStart.col, selEnd.col), maxC = Math.max(selStart.col, selEnd.col);
      const tbody = scrollContainer.querySelector('#excelTbody');
      if (!tbody) return;

      const lines = [];
      for (let r = minR; r <= maxR; r++) {
        const tr = tbody.children[r];
        if (!tr) continue;
        const cells = [];
        for (let c = minC; c <= maxC; c++) {
          const td = tr.children[c + 1];
          cells.push(td ? td.textContent : '');
        }
        lines.push(cells.join('\t'));
      }

      if (lines.length > 0) {
        e.preventDefault();
        navigator.clipboard.writeText(lines.join('\n')).catch(() => { });
        this.showToast(`Da copy ${maxR - minR + 1} dong x ${maxC - minC + 1} cot`, 'success');
      }
    };
    document.addEventListener('keydown', handleExcelCopy);

    // Store cleanup ref
    this._excelCleanup = () => {
      document.removeEventListener('keydown', handleExcelCopy);
    };

    // Store references for external methods
    this._excelState = { sheetData, sheetMeta, scrollContainer, loadMoreEl, renderTable, renderTabs, colLetter };

    this._switchSheet = (name) => {
      activeSheet = name;
      renderTabs();
      renderTable();
      scrollContainer.scrollTop = 0;
    };

    renderTabs();
    renderTable();
  }

  async _loadMoreExcelRows(sheetName, sheetData, sheetMeta, scrollContainer, loadMoreEl) {
    if (this._loadingExcel) return;
    const info = sheetMeta[sheetName];
    if (!info || sheetData[sheetName].length >= info.totalRows) {
      loadMoreEl.style.display = 'none';
      return;
    }

    this._loadingExcel = true;
    loadMoreEl.style.display = 'block';

    try {
      const doc = this.currentDocument;
      const version = this._previewingVersion || doc.versions[doc.versions.length - 1].version;
      const res = await this._fetch(
        `/api/documents/${encodeURIComponent(window.state.currentProject)}/${doc.id}/${version}/excel-rows?sheet=${encodeURIComponent(sheetName)}&offset=${sheetData[sheetName].length}&limit=50`
      );

      if (res.success && res.rows.length > 0) {
        const tbody = scrollContainer.querySelector('#excelTbody');
        const colCount = info.colCount;
        const startIdx = sheetData[sheetName].length;

        sheetData[sheetName] = sheetData[sheetName].concat(res.rows);

        // Append rows to DOM
        const frag = document.createDocumentFragment();
        res.rows.forEach((row, i) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td class="excel-row-num">${startIdx + i + 1}</td>` +
            Array.from({ length: colCount }, (_, c) => {
              const val = row[c];
              return `<td>${val !== null && val !== undefined ? this.escapeHtml(String(val)) : ''}</td>`;
            }).join('');
          frag.appendChild(tr);
        });
        tbody.appendChild(frag);

        if (!res.hasMore) loadMoreEl.style.display = 'none';
      } else {
        loadMoreEl.style.display = 'none';
      }
    } catch (e) {
      console.error('Load more excel rows error:', e);
    }

    this._loadingExcel = false;
  }

  // --- Lazy rendering for HTML (Word) documents ---
  renderHtmlLazy(htmlContent, container) {
    const page = document.createElement('div');
    page.className = 'preview-page';
    container.appendChild(page);

    // Split HTML into block-level chunks for progressive rendering
    // Use a temporary div to parse and extract child nodes
    const temp = document.createElement('div');
    temp.innerHTML = htmlContent;
    const children = Array.from(temp.childNodes);

    const BATCH_SIZE = 30;
    let rendered = 0;

    const renderBatch = () => {
      const end = Math.min(rendered + BATCH_SIZE, children.length);
      const frag = document.createDocumentFragment();
      for (let i = rendered; i < end; i++) {
        frag.appendChild(children[i].cloneNode(true));
      }
      page.appendChild(frag);
      rendered = end;

      if (rendered < children.length) {
        sentinel.style.display = 'block';
      } else {
        sentinel.style.display = 'none';
        if (htmlObserver) htmlObserver.disconnect();
      }
    };

    // Sentinel with animated spinner for scroll-based loading
    const sentinel = document.createElement('div');
    sentinel.className = 'lazy-load-sentinel';
    sentinel.innerHTML = '<div class="lazy-load-spinner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span>Dang tai them noi dung...</span></div>';
    container.appendChild(sentinel);

    const scrollArea = document.getElementById('docMainArea');
    const htmlObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && rendered < children.length) {
        renderBatch();
      }
    }, { root: scrollArea, rootMargin: '300px', threshold: 0.1 });

    // Initial batch
    renderBatch();
    if (rendered < children.length) {
      htmlObserver.observe(sentinel);
    } else {
      sentinel.style.display = 'none';
    }
  }

  // --- Lazy rendering for Text/CSV files ---
  renderTextLazy(textContent, container) {
    const pre = document.createElement('div');
    pre.className = 'preview-text-content';
    container.appendChild(pre);

    const lines = textContent.split('\n');
    const BATCH_SIZE = 100;
    let rendered = 0;

    const renderBatch = () => {
      const end = Math.min(rendered + BATCH_SIZE, lines.length);
      const chunk = lines.slice(rendered, end);

      const linesFrag = document.createDocumentFragment();
      chunk.forEach((line, i) => {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'text-line';
        lineDiv.innerHTML = `<span class="text-line-num">${rendered + i + 1}</span><span class="text-line-content">${this.escapeHtml(line)}</span>`;
        linesFrag.appendChild(lineDiv);
      });
      pre.appendChild(linesFrag);
      rendered = end;

      if (rendered < lines.length) {
        sentinel.style.display = 'block';
      } else {
        sentinel.style.display = 'none';
        if (textObserver) textObserver.disconnect();
      }
    };

    // Sentinel with animated spinner for scroll-based loading
    const sentinel = document.createElement('div');
    sentinel.className = 'lazy-load-sentinel';
    sentinel.innerHTML = '<div class="lazy-load-spinner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><span>Dang tai them noi dung...</span></div>';
    container.appendChild(sentinel);

    const scrollArea = document.getElementById('docMainArea');
    const textObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && rendered < lines.length) {
        renderBatch();
      }
    }, { root: scrollArea, rootMargin: '300px', threshold: 0.1 });

    // Initial batch
    renderBatch();
    if (rendered < lines.length) {
      textObserver.observe(sentinel);
    } else {
      sentinel.style.display = 'none';
    }
  }

  // --- Compare ---

  startCompare() {
    if (!this.currentDocument || this.currentDocument.versions.length < 2) {
      return this.showToast('Can it nhat 2 phien ban de so sanh', 'error');
    }

    const versions = this.currentDocument.versions;
    const v1 = versions[versions.length - 2].version;
    const v2 = versions[versions.length - 1].version;

    const area = document.getElementById('docMainArea');
    area.style.padding = '0';
    area.innerHTML = `
      <div class="compare-container" style="height:100%;">
        <div class="compare-header">
          <div class="compare-selectors">
            <select id="v1Select" class="doc-search-input" style="width:auto; padding-left:10px;">
              ${versions.map(v => `<option value="${v.version}" ${v.version === v1 ? 'selected' : ''}>Phien ban ${v.version}</option>`).join('')}
            </select>
            <svg width="20" height="20" fill="none" stroke="var(--doc-text-muted)" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            <select id="v2Select" class="doc-search-input" style="width:auto; padding-left:10px;">
              ${versions.map(v => `<option value="${v.version}" ${v.version === v2 ? 'selected' : ''}>Phien ban ${v.version}</option>`).join('')}
            </select>
            <button class="doc-btn-primary" onclick="docCompare.executeVisualCompare()">So sanh</button>
          </div>
        </div>
        <div id="compareResult" class="compare-result"></div>
      </div>
    `;
    this.executeVisualCompare();
  }

  async executeVisualCompare() {
    const v1 = document.getElementById('v1Select').value;
    const v2 = document.getElementById('v2Select').value;
    const container = document.getElementById('compareResult');
    const docType = this.currentDocument.type;

    container.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:200px;gap:8px;color:var(--doc-text-sub);"><div class="doc-loading-spinner" style="padding:0;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div> Dang so sanh...</div>';

    try {
      const baseUrl = `/api/documents/${encodeURIComponent(window.state.currentProject)}/${this.currentDocument.id}`;

      if (docType === 'excel') {
        // Excel uses visual grid compare
        const [prev1, prev2] = await Promise.all([
          this._fetch(`${baseUrl}/${v1}/preview`),
          this._fetch(`${baseUrl}/${v2}/preview`)
        ]);
        this._buildAndRenderExcelDiff(container, prev1, prev2, v1, v2);
      } else if (docType === 'pdf') {
        // PDF: Pure visual comparison with pixel-level diff — no text diff needed
        const [prev1, prev2] = await Promise.all([
          this._fetch(`${baseUrl}/${v1}/preview`),
          this._fetch(`${baseUrl}/${v2}/preview`)
        ]);
        this._renderPdfVisualDiff(container, prev1, prev2, v1, v2);
      } else {
        // Text, Word, CSV — all use GitHub-style diff
        const diffData = await this._fetch(`${baseUrl}/compare-text-diff?v1=${v1}&v2=${v2}`);
        this._renderGithubDiff(container, diffData, v1, v2);
      }
    } catch (e) {
      container.innerHTML = `<div class="doc-empty" style="color:var(--doc-danger);padding:2rem;"><p>Loi: ${e.message}</p></div>`;
    }
  }

  // ===== GitHub-Style Diff Renderer (shared for all file types) =====
  _renderGithubDiff(container, diffData, v1, v2, options = {}) {
    const { stats, hunks, isTruncated, noChanges } = diffData;
    const totalChanges = stats.added + stats.removed + stats.modified;

    // Build stats bar
    const statsHtml = `
      <div class="gh-diff-stats">
        <div class="gh-diff-stat-bar">
          <span class="gh-stat-added">+${stats.added}</span>
          <span class="gh-stat-removed">-${stats.removed}</span>
          <span class="gh-stat-modified">~${stats.modified}</span>
        </div>
        <div class="gh-diff-stat-visual">
          ${this._buildStatBlocks(stats)}
        </div>
      </div>
    `;

    if (noChanges) {
      container.innerHTML = `
        <div class="gh-diff-wrapper">
          ${statsHtml}
          <div class="gh-diff-empty">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Khong co thay doi nao giua 2 phien ban</span>
          </div>
        </div>
      `;
      return;
    }

    // Build diff table
    let diffHtml = '';
    let changeIdx = 0;
    this._ghChangePositions = [];

    for (const hunk of hunks) {
      if (hunk.collapsed) {
        diffHtml += `
          <div class="gh-diff-collapse" data-collapsed="${hunk.collapsed}">
            <div class="gh-diff-collapse-inner">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              <span>${hunk.collapsed} dong khong thay doi</span>
            </div>
          </div>
        `;
        continue;
      }

      for (const row of hunk.rows) {
        const id = `gh-change-${changeIdx}`;

        if (row.type === 'equal') {
          diffHtml += `
            <div class="gh-diff-row gh-equal">
              <div class="gh-gutter gh-gutter-left">${row.leftNum}</div>
              <div class="gh-gutter gh-gutter-right">${row.rightNum}</div>
              <div class="gh-marker"></div>
              <div class="gh-content">${this.escapeHtml(row.content)}</div>
            </div>
          `;
        } else if (row.type === 'delete') {
          this._ghChangePositions.push(id);
          diffHtml += `
            <div class="gh-diff-row gh-delete" id="${id}">
              <div class="gh-gutter gh-gutter-left">${row.leftNum}</div>
              <div class="gh-gutter gh-gutter-right"></div>
              <div class="gh-marker">-</div>
              <div class="gh-content">${this.escapeHtml(row.content)}</div>
            </div>
          `;
          changeIdx++;
        } else if (row.type === 'insert') {
          this._ghChangePositions.push(id);
          diffHtml += `
            <div class="gh-diff-row gh-insert" id="${id}">
              <div class="gh-gutter gh-gutter-left"></div>
              <div class="gh-gutter gh-gutter-right">${row.rightNum}</div>
              <div class="gh-marker">+</div>
              <div class="gh-content">${this.escapeHtml(row.content)}</div>
            </div>
          `;
          changeIdx++;
        } else if (row.type === 'modify') {
          this._ghChangePositions.push(id);
          // Build word-highlighted content
          const leftHtml = (row.leftParts || []).map(p =>
            p.type === 'del' ? `<span class="gh-word-del">${this.escapeHtml(p.value)}</span>` : this.escapeHtml(p.value)
          ).join('');
          const rightHtml = (row.rightParts || []).map(p =>
            p.type === 'ins' ? `<span class="gh-word-ins">${this.escapeHtml(p.value)}</span>` : this.escapeHtml(p.value)
          ).join('');

          diffHtml += `
            <div class="gh-diff-row gh-modify-old" id="${id}">
              <div class="gh-gutter gh-gutter-left">${row.leftNum}</div>
              <div class="gh-gutter gh-gutter-right"></div>
              <div class="gh-marker">-</div>
              <div class="gh-content">${leftHtml}</div>
            </div>
            <div class="gh-diff-row gh-modify-new">
              <div class="gh-gutter gh-gutter-left"></div>
              <div class="gh-gutter gh-gutter-right">${row.rightNum}</div>
              <div class="gh-marker">+</div>
              <div class="gh-content">${rightHtml}</div>
            </div>
          `;
          changeIdx++;
        }
      }
    }

    const extraClass = options.inTab ? '' : 'gh-diff-standalone';

    container.innerHTML = `
      <div class="gh-diff-wrapper ${extraClass}">
        ${statsHtml}
        ${isTruncated ? '<div class="overview-warning" style="margin:0.5rem 1rem;"><svg class="overview-warning-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg><span>Noi dung qua dai, da cat bot.</span></div>' : ''}
        <div class="gh-diff-nav">
          <div class="gh-diff-legend">
            <span class="gh-legend-item gh-legend-del">Xoa</span>
            <span class="gh-legend-item gh-legend-ins">Them</span>
            <span class="gh-legend-item gh-legend-mod">Sua</span>
          </div>
          <div class="diff-navigator">
            <button class="diff-nav-btn" onclick="docCompare._ghNavigate(-1)" title="Thay doi truoc">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
            </button>
            <span class="diff-nav-count" id="ghNavCount">0/${totalChanges}</span>
            <button class="diff-nav-btn" onclick="docCompare._ghNavigate(1)" title="Thay doi tiep">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
          </div>
        </div>
        <div class="gh-diff-table" id="ghDiffTable">${diffHtml}</div>
      </div>
    `;

    this._ghCurrentIndex = -1;

    // Bind collapse click handlers
    container.querySelectorAll('.gh-diff-collapse').forEach(el => {
      el.addEventListener('click', () => {
        const count = parseInt(el.dataset.collapsed);
        let html = '';
        for (let i = 0; i < count; i++) {
          html += `<div class="gh-diff-row gh-equal gh-expanded"><div class="gh-gutter gh-gutter-left">·</div><div class="gh-gutter gh-gutter-right">·</div><div class="gh-marker"></div><div class="gh-content" style="color:var(--doc-text-muted);font-style:italic;">...</div></div>`;
        }
        el.outerHTML = html;
      });
    });
  }

  _buildStatBlocks(stats) {
    const total = stats.added + stats.removed + stats.modified;
    if (total === 0) return '';
    const blocks = 5;
    const addBlocks = Math.max(stats.added > 0 ? 1 : 0, Math.round((stats.added / total) * blocks));
    const rmBlocks = Math.max(stats.removed > 0 ? 1 : 0, Math.round((stats.removed / total) * blocks));
    const modBlocks = Math.max(stats.modified > 0 ? 1 : 0, blocks - addBlocks - rmBlocks);
    let html = '';
    for (let i = 0; i < addBlocks; i++) html += '<span class="gh-stat-block gh-block-add"></span>';
    for (let i = 0; i < rmBlocks; i++) html += '<span class="gh-stat-block gh-block-rm"></span>';
    for (let i = 0; i < modBlocks; i++) html += '<span class="gh-stat-block gh-block-mod"></span>';
    return html;
  }

  _ghNavigate(dir) {
    const positions = this._ghChangePositions || [];
    if (positions.length === 0) return;

    // Remove previous highlight
    if (this._ghCurrentIndex >= 0) {
      const prev = document.getElementById(positions[this._ghCurrentIndex]);
      if (prev) prev.classList.remove('gh-highlight');
    }

    this._ghCurrentIndex += dir;
    if (this._ghCurrentIndex < 0) this._ghCurrentIndex = positions.length - 1;
    if (this._ghCurrentIndex >= positions.length) this._ghCurrentIndex = 0;

    const el = document.getElementById(positions[this._ghCurrentIndex]);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('gh-highlight');
    }

    const navCount = document.getElementById('ghNavCount');
    if (navCount) navCount.textContent = `${this._ghCurrentIndex + 1}/${positions.length}`;
  }

  // ===== PDF: Visual Pixel-Level Diff Comparison =====
  async _renderPdfVisualDiff(container, prev1, prev2, v1, v2) {
    if (!window.pdfjsLib) {
      container.innerHTML = '<div class="doc-empty"><p>PDF.js chua duoc tai. Kiem tra ket noi mang.</p></div>';
      return;
    }

    container.innerHTML = `
      <div class="pdf-diff-wrapper">
        <div class="pdf-diff-toolbar">
          <div class="pdf-diff-modes">
            <button class="pdf-mode-btn active" data-mode="sidebyside" onclick="docCompare._switchPdfMode(this, 'sidebyside')">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"/></svg>
              Song song
            </button>
            <button class="pdf-mode-btn" data-mode="diff" onclick="docCompare._switchPdfMode(this, 'diff')">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z"/></svg>
              Phan biet
            </button>
            <button class="pdf-mode-btn" data-mode="slider" onclick="docCompare._switchPdfMode(this, 'slider')">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"/></svg>
              Truot
            </button>
          </div>
          <div class="pdf-diff-legend" id="pdfDiffLegend" style="display:none;">
            <span class="gh-legend-item gh-legend-del">Xoa</span>
            <span class="gh-legend-item gh-legend-ins">Them</span>
            <span class="gh-legend-item" style="color:var(--doc-text-sub);background:var(--doc-bg-surface-hover);">Khong doi</span>
          </div>
          <div id="pdfDiffStatus" style="font-size:12px;color:var(--doc-text-sub);"></div>
        </div>
        <div class="pdf-diff-body" id="pdfDiffBody">
          <div style="display:flex;justify-content:center;align-items:center;height:200px;gap:8px;color:var(--doc-text-sub);">
            <div class="doc-loading-spinner" style="padding:0;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>
            Dang render PDF...
          </div>
        </div>
      </div>
    `;

    try {
      // Load both PDFs
      const [pdf1, pdf2] = await Promise.all([
        pdfjsLib.getDocument(prev1.url).promise,
        pdfjsLib.getDocument(prev2.url).promise
      ]);

      const maxPages = Math.max(pdf1.numPages, pdf2.numPages);
      const body = document.getElementById('pdfDiffBody');
      const RENDER_WIDTH = 500; // width per page for comparison

      // Store page canvases for mode switching
      this._pdfDiffPages = [];

      body.innerHTML = '';

      for (let p = 1; p <= maxPages; p++) {
        // Render both pages to off-screen canvases
        const canvas1 = document.createElement('canvas');
        const canvas2 = document.createElement('canvas');
        let w = RENDER_WIDTH, h1 = 0, h2 = 0;

        if (p <= pdf1.numPages) {
          const page = await pdf1.getPage(p);
          const vp = page.getViewport({ scale: 1 });
          const scale = RENDER_WIDTH / vp.width;
          const viewport = page.getViewport({ scale });
          canvas1.width = viewport.width;
          canvas1.height = viewport.height;
          h1 = viewport.height;
          await page.render({ canvasContext: canvas1.getContext('2d'), viewport }).promise;
        }

        if (p <= pdf2.numPages) {
          const page = await pdf2.getPage(p);
          const vp = page.getViewport({ scale: 1 });
          const scale = RENDER_WIDTH / vp.width;
          const viewport = page.getViewport({ scale });
          canvas2.width = viewport.width;
          canvas2.height = viewport.height;
          h2 = viewport.height;
          await page.render({ canvasContext: canvas2.getContext('2d'), viewport }).promise;
        }

        // Compute pixel diff
        const maxH = Math.max(h1, h2) || 600;
        const diffCanvas = document.createElement('canvas');
        diffCanvas.width = w;
        diffCanvas.height = maxH;
        const diffCtx = diffCanvas.getContext('2d');

        let diffPercent = 0;
        const hasPage1 = p <= pdf1.numPages;
        const hasPage2 = p <= pdf2.numPages;

        if (hasPage1 && hasPage2) {
          // Both pages exist — pixel compare
          const ctx1 = canvas1.getContext('2d');
          const ctx2 = canvas2.getContext('2d');
          const minH = Math.min(h1, h2);
          const data1 = ctx1.getImageData(0, 0, w, minH);
          const data2 = ctx2.getImageData(0, 0, w, minH);
          const diffData = diffCtx.createImageData(w, maxH);
          const px1 = data1.data, px2 = data2.data, out = diffData.data;

          let totalPixels = w * maxH;
          let diffPixels = 0;

          // Compare pixel by pixel with BLOCK tolerance
          const THRESHOLD = 30; // color difference threshold

          for (let y = 0; y < maxH; y++) {
            for (let x = 0; x < w; x++) {
              const idx = (y * w + x) * 4;

              if (y >= minH) {
                // Extra rows — only in taller version
                if (y < h1) {
                  // Only in v1 (deleted)
                  out[idx] = 255; out[idx + 1] = 80; out[idx + 2] = 80; out[idx + 3] = 200;
                  diffPixels++;
                } else if (y < h2) {
                  // Only in v2 (added)
                  out[idx] = 80; out[idx + 1] = 200; out[idx + 2] = 80; out[idx + 3] = 200;
                  diffPixels++;
                } else {
                  out[idx + 3] = 0;
                }
                continue;
              }

              const r1 = px1[idx], g1 = px1[idx + 1], b1 = px1[idx + 2];
              const r2 = px2[idx], g2 = px2[idx + 1], b2 = px2[idx + 2];
              const dr = Math.abs(r1 - r2), dg = Math.abs(g1 - g2), db = Math.abs(b1 - b2);
              const diff = dr + dg + db;

              if (diff > THRESHOLD) {
                // Different pixel
                diffPixels++;
                // Show old as red, new as green blend
                if (r1 + g1 + b1 > r2 + g2 + b2) {
                  // Darker in new (content removed/changed)
                  out[idx] = 255; out[idx + 1] = 60; out[idx + 2] = 60; out[idx + 3] = 180;
                } else {
                  // Brighter in new (content added/changed)
                  out[idx] = 60; out[idx + 1] = 200; out[idx + 2] = 60; out[idx + 3] = 180;
                }
              } else {
                // Same pixel — show faded
                const grey = Math.round((r2 + g2 + b2) / 3);
                out[idx] = grey; out[idx + 1] = grey; out[idx + 2] = grey; out[idx + 3] = 60;
              }
            }
          }

          diffCtx.putImageData(diffData, 0, 0);
          diffPercent = totalPixels > 0 ? Math.round((diffPixels / totalPixels) * 100) : 0;
        } else if (hasPage1 && !hasPage2) {
          // Page only in v1 (deleted)
          diffCtx.fillStyle = 'rgba(255, 80, 80, 0.3)';
          diffCtx.fillRect(0, 0, w, h1);
          diffCtx.drawImage(canvas1, 0, 0);
          diffCtx.fillStyle = 'rgba(255, 80, 80, 0.4)';
          diffCtx.fillRect(0, 0, w, h1);
          diffPercent = 100;
        } else if (!hasPage1 && hasPage2) {
          // Page only in v2 (added)
          diffCtx.fillStyle = 'rgba(80, 200, 80, 0.3)';
          diffCtx.fillRect(0, 0, w, h2);
          diffCtx.drawImage(canvas2, 0, 0);
          diffCtx.fillStyle = 'rgba(80, 200, 80, 0.4)';
          diffCtx.fillRect(0, 0, w, h2);
          diffPercent = 100;
        }

        this._pdfDiffPages.push({
          pageNum: p,
          canvas1, canvas2, diffCanvas,
          w, h1, h2, maxH,
          diffPercent,
          hasPage1, hasPage2
        });
      }

      // Store versions for labels
      this._pdfDiffV1 = v1;
      this._pdfDiffV2 = v2;

      // Render default mode (side by side)
      this._renderPdfMode('sidebyside');

      // Update status
      const totalDiff = this._pdfDiffPages.reduce((sum, p) => sum + p.diffPercent, 0);
      const avgDiff = Math.round(totalDiff / this._pdfDiffPages.length);
      document.getElementById('pdfDiffStatus').textContent =
        `${maxPages} trang | Khac biet trung binh: ${avgDiff}%`;

    } catch (err) {
      console.error('PDF diff error:', err);
      container.querySelector('#pdfDiffBody').innerHTML =
        `<div class="doc-empty" style="color:var(--doc-danger);"><p>Khong the so sanh PDF: ${err.message}</p></div>`;
    }
  }

  _switchPdfMode(btn, mode) {
    btn.closest('.pdf-diff-modes').querySelectorAll('.pdf-mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const legend = document.getElementById('pdfDiffLegend');
    if (legend) legend.style.display = mode === 'diff' ? 'flex' : 'none';
    this._renderPdfMode(mode);
  }

  _renderPdfMode(mode) {
    const body = document.getElementById('pdfDiffBody');
    if (!body || !this._pdfDiffPages) return;
    body.innerHTML = '';

    const v1 = this._pdfDiffV1;
    const v2 = this._pdfDiffV2;

    for (const page of this._pdfDiffPages) {
      const section = document.createElement('div');
      section.className = 'pdf-page-section';

      // Page header
      const header = document.createElement('div');
      header.className = 'pdf-page-header';
      const diffColor = page.diffPercent > 10 ? 'var(--doc-danger)' : page.diffPercent > 0 ? 'var(--doc-warning)' : 'var(--doc-success)';
      header.innerHTML = `
        <span>Trang ${page.pageNum}</span>
        <span style="color:${diffColor};font-weight:600;">${page.diffPercent}% khac biet</span>
      `;
      section.appendChild(header);

      if (mode === 'sidebyside') {
        const row = document.createElement('div');
        row.className = 'pdf-side-row';

        // Left (v1)
        const leftDiv = document.createElement('div');
        leftDiv.className = 'pdf-side-panel';
        if (page.hasPage1) {
          const img1 = document.createElement('img');
          img1.src = page.canvas1.toDataURL();
          img1.style.cssText = 'width:100%;display:block;border-radius:4px;';
          leftDiv.appendChild(img1);
        } else {
          leftDiv.innerHTML = '<div class="pdf-no-page">Khong co trang nay</div>';
        }

        // Right (v2)
        const rightDiv = document.createElement('div');
        rightDiv.className = 'pdf-side-panel';
        if (page.hasPage2) {
          const img2 = document.createElement('img');
          img2.src = page.canvas2.toDataURL();
          img2.style.cssText = 'width:100%;display:block;border-radius:4px;';
          rightDiv.appendChild(img2);
        } else {
          rightDiv.innerHTML = '<div class="pdf-no-page">Khong co trang nay</div>';
        }

        row.appendChild(leftDiv);
        row.appendChild(rightDiv);
        section.appendChild(row);

      } else if (mode === 'diff') {
        // Show diff overlay full width
        const diffDiv = document.createElement('div');
        diffDiv.className = 'pdf-diff-panel';
        const img = document.createElement('img');
        img.src = page.diffCanvas.toDataURL();
        img.style.cssText = 'width:100%;max-width:600px;display:block;margin:0 auto;border-radius:4px;border:1px solid var(--doc-border);';
        diffDiv.appendChild(img);
        section.appendChild(diffDiv);

      } else if (mode === 'slider') {
        // Slider mode: overlap v1 and v2, drag to reveal
        const sliderWrap = document.createElement('div');
        sliderWrap.className = 'pdf-slider-wrap';
        sliderWrap.style.cssText = `position:relative;max-width:500px;margin:0 auto;overflow:hidden;border-radius:4px;border:1px solid var(--doc-border);aspect-ratio:${page.w}/${page.maxH};`;

        const imgOld = document.createElement('img');
        imgOld.src = page.canvas1.toDataURL();
        imgOld.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;';
        imgOld.draggable = false;

        const clipDiv = document.createElement('div');
        clipDiv.style.cssText = 'position:absolute;top:0;right:0;width:50%;height:100%;overflow:hidden;';
        const imgNew = document.createElement('img');
        imgNew.src = page.canvas2.toDataURL();
        imgNew.style.cssText = `position:absolute;top:0;right:0;width:${page.w}px;height:100%;max-width:none;object-fit:contain;`;
        imgNew.draggable = false;
        clipDiv.appendChild(imgNew);

        const handle = document.createElement('div');
        handle.className = 'pdf-slider-handle';
        handle.style.cssText = 'position:absolute;top:0;left:50%;width:3px;height:100%;background:var(--doc-primary);cursor:ew-resize;z-index:10;';

        const handleGrip = document.createElement('div');
        handleGrip.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;background:var(--doc-primary);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
        handleGrip.innerHTML = '<svg width="14" height="14" fill="none" stroke="white" viewBox="0 0 24 24" stroke-width="2"><path d="M8 4l-4 4 4 4M16 4l4 4-4 4"/></svg>';
        handle.appendChild(handleGrip);

        // Labels
        const labelOld = document.createElement('div');
        labelOld.style.cssText = 'position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.7);color:white;padding:2px 8px;border-radius:4px;font-size:11px;z-index:5;';
        labelOld.textContent = `v${v1} cu`;

        const labelNew = document.createElement('div');
        labelNew.style.cssText = 'position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.7);color:white;padding:2px 8px;border-radius:4px;font-size:11px;z-index:5;';
        labelNew.textContent = `v${v2} moi`;

        sliderWrap.appendChild(imgOld);
        sliderWrap.appendChild(clipDiv);
        sliderWrap.appendChild(handle);
        sliderWrap.appendChild(labelOld);
        sliderWrap.appendChild(labelNew);
        section.appendChild(sliderWrap);

        // Slider interaction
        let dragging = false;
        const onMove = (e) => {
          if (!dragging) return;
          const rect = sliderWrap.getBoundingClientRect();
          const clientX = e.touches ? e.touches[0].clientX : e.clientX;
          let x = clientX - rect.left;
          x = Math.max(0, Math.min(rect.width, x));
          const pct = (x / rect.width) * 100;
          handle.style.left = pct + '%';
          clipDiv.style.width = (100 - pct) + '%';
          imgNew.style.width = sliderWrap.offsetWidth + 'px';
        };
        handle.addEventListener('mousedown', (e) => { dragging = true; e.preventDefault(); });
        handle.addEventListener('touchstart', (e) => { dragging = true; e.preventDefault(); });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove);
        document.addEventListener('mouseup', () => { dragging = false; });
        document.addEventListener('touchend', () => { dragging = false; });
      }

      body.appendChild(section);
    }
  }



  _buildAndRenderExcelDiff(container, prev1, prev2, v1, v2) {
    const allSheets = [...new Set([...(prev1.sheetNames || []), ...(prev2.sheetNames || [])])];
    const sheets = {};

    allSheets.forEach(name => {
      const rows1 = (prev1.sheets && prev1.sheets[name]) || [];
      const rows2 = (prev2.sheets && prev2.sheets[name]) || [];

      const maxRows = Math.max(rows1.length, rows2.length);
      const maxCols = Math.max(
        rows1.reduce((m, r) => Math.max(m, r.length), 0),
        rows2.reduce((m, r) => Math.max(m, r.length), 0)
      );

      const changeMap = [];
      let stats = { added: 0, removed: 0, modified: 0 };

      for (let r = 0; r < maxRows; r++) {
        const rowChanges = [];
        const r1 = rows1[r] || [];
        const r2 = rows2[r] || [];
        let rowHasAdd = false, rowHasRemove = false, rowHasModify = false;

        for (let c = 0; c < maxCols; c++) {
          const val1 = r1[c] != null ? String(r1[c]) : '';
          const val2 = r2[c] != null ? String(r2[c]) : '';
          if (val1 === val2) {
            rowChanges.push(null);
          } else if (val1 === '' && val2 !== '') {
            rowChanges.push('add'); rowHasAdd = true;
          } else if (val1 !== '' && val2 === '') {
            rowChanges.push('remove'); rowHasRemove = true;
          } else {
            rowChanges.push('modify'); rowHasModify = true;
          }
        }
        changeMap.push(rowChanges);

        // Count stats per ROW (not per cell) for meaningful numbers
        if (r >= rows1.length) { stats.added++; }           // Entire row is new
        else if (r >= rows2.length) { stats.removed++; }    // Entire row was removed
        else if (rowHasModify || rowHasAdd || rowHasRemove) { stats.modified++; }  // Row has changes
      }

      const isOnlyInV1 = !(prev2.sheets && prev2.sheets[name]);
      const isOnlyInV2 = !(prev1.sheets && prev1.sheets[name]);

      sheets[name] = { rows1, rows2, maxCols, changeMap, stats, isOnlyInV1, isOnlyInV2 };
    });

    this._visualSheets = sheets;
    this._visualRes = { v1: { version: v1 }, v2: { version: v2 }, sheetNames: allSheets };

    // Compute total stats
    let totalAdd = 0, totalRemove = 0, totalModify = 0;
    allSheets.forEach(name => {
      const s = sheets[name].stats;
      totalAdd += s.added;
      totalRemove += s.removed;
      totalModify += s.modified;
    });

    container.innerHTML = `
      <div class="visual-compare-wrapper">
        <div class="visual-compare-summary">
          <div class="diff-stat-card stat-added">
            <div class="stat-icon">+</div>
            <div><div class="diff-stat-number">${totalAdd}</div><div style="font-size:0.7rem;font-weight:400;">Them moi</div></div>
          </div>
          <div class="diff-stat-card stat-removed">
            <div class="stat-icon">-</div>
            <div><div class="diff-stat-number">${totalRemove}</div><div style="font-size:0.7rem;font-weight:400;">Xoa bo</div></div>
          </div>
          <div class="diff-stat-card stat-modified">
            <div class="stat-icon">~</div>
            <div><div class="diff-stat-number">${totalModify}</div><div style="font-size:0.7rem;font-weight:400;">Thay doi</div></div>
          </div>
          <div style="margin-left:auto;display:flex;gap:12px;align-items:center;">
            <div class="diff-legend-item"><div class="diff-legend-swatch swatch-add"></div><span style="font-size:11px;">Them moi</span></div>
            <div class="diff-legend-item"><div class="diff-legend-swatch swatch-remove"></div><span style="font-size:11px;">Xoa bo</span></div>
            <div class="diff-legend-item"><div class="diff-legend-swatch swatch-modify"></div><span style="font-size:11px;">Sua doi</span></div>
          </div>
        </div>
        <div class="visual-compare-tabs" id="visualCompareTabs">
          ${allSheets.map((name, i) => {
      const s = sheets[name].stats;
      const changes = s.added + s.removed + s.modified;
      return `<button class="visual-compare-tab ${i === 0 ? 'active' : ''}" onclick="docCompare.switchVisualSheet('${name.replace(/'/g, "\\\\'")}')">${this.escapeHtml(name)}${changes > 0 ? `<span class="sheet-badge has-changes">${changes}</span>` : ''}</button>`;
    }).join('')}
        </div>
        <div class="visual-compare-body" id="visualCompareBody"></div>
      </div>
    `;

    this.switchVisualSheet(allSheets[0]);
  }

  switchVisualSheet(sheetName) {
    const tabs = document.querySelectorAll('.visual-compare-tab');
    tabs.forEach(t => t.classList.toggle('active', t.textContent.trim().startsWith(sheetName)));

    const body = document.getElementById('visualCompareBody');
    const sheet = this._visualSheets[sheetName];
    const res = this._visualRes;
    if (!sheet) { body.innerHTML = '<div class="doc-empty"><p>Sheet khong co du lieu</p></div>'; return; }

    const colLetter = (i) => { let s = ''; i++; while (i > 0) { i--; s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26); } return s; };

    const buildTable = (rows, side) => {
      if (!rows || rows.length === 0) return '<div class="doc-empty" style="padding:2rem;font-size:12px;color:var(--doc-text-muted);">Khong co du lieu</div>';

      let headerHtml = '<tr><th class="row-num"></th>';
      for (let c = 0; c < sheet.maxCols; c++) headerHtml += `<th>${colLetter(c)}</th>`;
      headerHtml += '</tr>';

      let bodyHtml = '';
      const maxRows = Math.max(sheet.rows1.length, sheet.rows2.length);
      for (let r = 0; r < maxRows; r++) {
        const row = rows[r] || [];
        bodyHtml += `<tr><td class="row-num">${r + 1}</td>`;
        for (let c = 0; c < sheet.maxCols; c++) {
          const val = row[c] != null ? this.escapeHtml(String(row[c])) : '';
          const change = sheet.changeMap[r] ? sheet.changeMap[r][c] : null;
          let cls = '';
          if (change === 'add' && side === 'right') cls = 'cell-add';
          else if (change === 'remove' && side === 'left') cls = 'cell-remove';
          else if (change === 'modify') cls = 'cell-modify';
          bodyHtml += `<td class="${cls}" ${val ? `title="${val}"` : ''}>${val}</td>`;
        }
        bodyHtml += '</tr>';
      }
      return `<table class="visual-excel-table"><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table>`;
    };

    body.innerHTML = `
      <div class="visual-compare-side" id="visualSideLeft">
        <div class="visual-compare-side-header">
          <span class="doc-version-tl-tag" style="background:var(--doc-text-muted);">v${res.v1.version}</span> Phien ban cu
          ${sheet.isOnlyInV1 ? '<span style="color:var(--doc-danger);font-size:11px;margin-left:auto;">Chi co o phien ban nay</span>' : ''}
        </div>
        ${buildTable(sheet.rows1, 'left')}
      </div>
      <div class="visual-compare-side" id="visualSideRight">
        <div class="visual-compare-side-header">
          <span class="doc-version-tl-tag latest">v${res.v2.version}</span> Phien ban moi
          ${sheet.isOnlyInV2 ? '<span style="color:var(--doc-success);font-size:11px;margin-left:auto;">Sheet moi</span>' : ''}
        </div>
        ${buildTable(sheet.rows2, 'right')}
      </div>
    `;

    // Sync scroll
    const left = document.getElementById('visualSideLeft');
    const right = document.getElementById('visualSideRight');
    let syncing = false;
    const syncScroll = (src, tgt) => { if (syncing) return; syncing = true; tgt.scrollTop = src.scrollTop; tgt.scrollLeft = src.scrollLeft; syncing = false; };
    left.addEventListener('scroll', () => syncScroll(left, right));
    right.addEventListener('scroll', () => syncScroll(right, left));
  }

  _renderVisualWordDiff(container, prev1, prev2, v1, v2) {
    container.innerHTML = `
      <div class="visual-compare-wrapper">
        <div class="visual-compare-summary">
          <div style="font-size:13px;color:var(--doc-text-sub);">So sanh truc quan noi dung Word — cuon 2 ben de xem thay doi</div>
          <div style="margin-left:auto;display:flex;gap:12px;align-items:center;">
            <div class="diff-legend-item"><div class="diff-legend-swatch swatch-add"></div><span style="font-size:11px;">Phien ban moi</span></div>
            <div class="diff-legend-item"><div class="diff-legend-swatch swatch-remove"></div><span style="font-size:11px;">Phien ban cu</span></div>
          </div>
        </div>
        <div class="visual-compare-body">
          <div class="visual-compare-side" id="visualSideLeft">
            <div class="visual-compare-side-header">
              <span class="doc-version-tl-tag" style="background:var(--doc-text-muted);">v${v1}</span> Phien ban cu
            </div>
            <div class="visual-word-panel">${prev1.content || ''}</div>
          </div>
          <div class="visual-compare-side" id="visualSideRight">
            <div class="visual-compare-side-header">
              <span class="doc-version-tl-tag latest">v${v2}</span> Phien ban moi
            </div>
            <div class="visual-word-panel">${prev2.content || ''}</div>
          </div>
        </div>
      </div>
    `;

    const left = document.getElementById('visualSideLeft');
    const right = document.getElementById('visualSideRight');
    let syncing = false;
    const syncScroll = (src, tgt) => { if (syncing) return; syncing = true; tgt.scrollTop = src.scrollTop; syncing = false; };
    left.addEventListener('scroll', () => syncScroll(left, right));
    right.addEventListener('scroll', () => syncScroll(right, left));
  }

  _renderVisualPdfDiff(container, prev1, prev2, v1, v2) {
    container.innerHTML = `
      <div class="visual-compare-wrapper">
        <div class="visual-compare-summary">
          <div style="font-size:13px;color:var(--doc-text-sub);">So sanh truc quan PDF — xem 2 phien ban song song</div>
        </div>
        <div class="visual-compare-body" style="height:calc(100vh - 220px);">
          <div class="visual-compare-side" id="pdfSideLeft" style="overflow-y:auto;">
            <div class="visual-compare-side-header">
              <span class="doc-version-tl-tag" style="background:var(--doc-text-muted);">v${v1}</span> Phien ban cu
              <span id="pdfPageCountLeft" style="margin-left:auto;font-size:11px;color:var(--doc-text-sub);"></span>
            </div>
            <div id="pdfPagesLeft" style="padding:8px;display:flex;flex-direction:column;align-items:center;gap:8px;"></div>
          </div>
          <div class="visual-compare-side" id="pdfSideRight" style="overflow-y:auto;">
            <div class="visual-compare-side-header">
              <span class="doc-version-tl-tag latest">v${v2}</span> Phien ban moi
              <span id="pdfPageCountRight" style="margin-left:auto;font-size:11px;color:var(--doc-text-sub);"></span>
            </div>
            <div id="pdfPagesRight" style="padding:8px;display:flex;flex-direction:column;align-items:center;gap:8px;"></div>
          </div>
        </div>
      </div>
    `;

    // Render both PDFs using pdf.js
    const self = this;
    const renderSide = async (url, containerId, countId) => {
      const pagesEl = document.getElementById(containerId);
      const countEl = document.getElementById(countId);
      if (!pagesEl) return;

      if (!window.pdfjsLib) {
        pagesEl.innerHTML = '<div class="doc-empty"><p>PDF.js chua duoc tai. Kiem tra ket noi mang.</p></div>';
        return;
      }

      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        if (countEl) countEl.textContent = `${pdf.numPages} trang`;

        const sideEl = pagesEl.parentElement;
        const sideWidth = sideEl ? sideEl.clientWidth - 40 : 400;

        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const unscaledVp = page.getViewport({ scale: 1 });
          const scale = sideWidth / unscaledVp.width;
          const viewport = page.getViewport({ scale });

          const wrapper = document.createElement('div');
          wrapper.style.cssText = 'position:relative;background:#fff;border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.2);';

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.cssText = 'display:block;width:100%;height:auto;';

          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;

          // Page number label
          const label = document.createElement('div');
          label.style.cssText = 'text-align:center;font-size:10px;color:var(--doc-text-sub);padding:2px 0;';
          label.textContent = `Trang ${p} / ${pdf.numPages}`;

          wrapper.appendChild(canvas);
          pagesEl.appendChild(wrapper);
          pagesEl.appendChild(label);
        }
      } catch (err) {
        console.error('PDF render error:', err);
        pagesEl.innerHTML = `<div class="doc-empty" style="color:var(--doc-danger);"><p>Khong the hien thi PDF: ${err.message}</p></div>`;
      }
    };

    // Render both sides in parallel
    Promise.all([
      renderSide(prev1.url, 'pdfPagesLeft', 'pdfPageCountLeft'),
      renderSide(prev2.url, 'pdfPagesRight', 'pdfPageCountRight')
    ]).then(() => {
      // Setup synchronized scrolling
      const left = document.getElementById('pdfSideLeft');
      const right = document.getElementById('pdfSideRight');
      if (!left || !right) return;

      let syncing = false;
      const syncScroll = (src, tgt) => {
        if (syncing) return;
        syncing = true;
        tgt.scrollTop = src.scrollTop;
        syncing = false;
      };
      left.addEventListener('scroll', () => syncScroll(left, right));
      right.addEventListener('scroll', () => syncScroll(right, left));
    });
  }

  _renderVisualTextDiff(container, prev1, prev2, v1, v2) {
    const lines1 = (prev1.content || '').split('\n');
    const lines2 = (prev2.content || '').split('\n');
    const maxLines = Math.max(lines1.length, lines2.length);

    // Build line-level diff
    let stats = { added: 0, removed: 0, modified: 0 };
    const lineChanges = [];
    for (let i = 0; i < maxLines; i++) {
      const l1 = i < lines1.length ? lines1[i] : null;
      const l2 = i < lines2.length ? lines2[i] : null;
      if (l1 === l2) { lineChanges.push(null); }
      else if (l1 === null) { lineChanges.push('add'); stats.added++; }
      else if (l2 === null) { lineChanges.push('remove'); stats.removed++; }
      else { lineChanges.push('modify'); stats.modified++; }
    }

    const buildPanel = (lines, side) => {
      return lines.map((line, i) => {
        const change = lineChanges[i];
        let cls = '';
        if (change === 'add' && side === 'right') cls = 'cell-add';
        else if (change === 'remove' && side === 'left') cls = 'cell-remove';
        else if (change === 'modify') cls = 'cell-modify';
        return `<div class="visual-text-line ${cls}"><span class="visual-text-num">${i + 1}</span><span class="visual-text-content">${this.escapeHtml(line)}</span></div>`;
      }).join('');
    };

    // Pad shorter array
    while (lines1.length < maxLines) lines1.push('');
    while (lines2.length < maxLines) lines2.push('');

    container.innerHTML = `
      <div class="visual-compare-wrapper">
        <div class="visual-compare-summary">
          <div class="diff-stat-card stat-added">
            <div class="stat-icon">+</div>
            <div><div class="diff-stat-number">${stats.added}</div><div style="font-size:0.7rem;font-weight:400;">Them moi</div></div>
          </div>
          <div class="diff-stat-card stat-removed">
            <div class="stat-icon">-</div>
            <div><div class="diff-stat-number">${stats.removed}</div><div style="font-size:0.7rem;font-weight:400;">Xoa bo</div></div>
          </div>
          <div class="diff-stat-card stat-modified">
            <div class="stat-icon">~</div>
            <div><div class="diff-stat-number">${stats.modified}</div><div style="font-size:0.7rem;font-weight:400;">Thay doi</div></div>
          </div>
          <div style="margin-left:auto;display:flex;gap:12px;align-items:center;">
            <div class="diff-legend-item"><div class="diff-legend-swatch swatch-add"></div><span style="font-size:11px;">Them moi</span></div>
            <div class="diff-legend-item"><div class="diff-legend-swatch swatch-remove"></div><span style="font-size:11px;">Xoa bo</span></div>
            <div class="diff-legend-item"><div class="diff-legend-swatch swatch-modify"></div><span style="font-size:11px;">Sua doi</span></div>
          </div>
        </div>
        <div class="visual-compare-body">
          <div class="visual-compare-side" id="visualSideLeft">
            <div class="visual-compare-side-header">
              <span class="doc-version-tl-tag" style="background:var(--doc-text-muted);">v${v1}</span> Phien ban cu
            </div>
            <div class="visual-text-panel">${buildPanel(lines1, 'left')}</div>
          </div>
          <div class="visual-compare-side" id="visualSideRight">
            <div class="visual-compare-side-header">
              <span class="doc-version-tl-tag latest">v${v2}</span> Phien ban moi
            </div>
            <div class="visual-text-panel">${buildPanel(lines2, 'right')}</div>
          </div>
        </div>
      </div>
    `;

    const left = document.getElementById('visualSideLeft');
    const right = document.getElementById('visualSideRight');
    let syncing = false;
    const syncScroll = (src, tgt) => { if (syncing) return; syncing = true; tgt.scrollTop = src.scrollTop; syncing = false; };
    left.addEventListener('scroll', () => syncScroll(left, right));
    right.addEventListener('scroll', () => syncScroll(right, left));
  }

  async executeCompare(force = false) {
    const v1 = document.getElementById('v1Select').value;
    const v2 = document.getElementById('v2Select').value;
    const container = document.getElementById('compareResult');

    container.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:200px;gap:8px;color:var(--doc-text-sub);"><div class="doc-loading-spinner" style="padding:0;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div> Dang so sanh...</div>';

    try {
      const res = await this._fetch(`/api/documents/${encodeURIComponent(window.state.currentProject)}/${this.currentDocument.id}/compare?v1=${v1}&v2=${v2}&force=${force}`);

      if (res.mode === 'overview') {
        this.renderOverviewMode(container, res);
        return;
      }

      // Process changes for smart display
      this.currentChanges = res.changes || [];
      this.renderedCount = 0;
      this.changePositions = [];
      this.currentChangeIndex = -1;

      const totalChanges = res.stats.added + res.stats.removed + res.stats.modified;
      const totalLines = res.stats.total;
      const changePercent = totalLines > 0 ? Math.round((totalChanges / totalLines) * 100) : 0;

      container.innerHTML = `
        <!-- Summary Cards -->
        <div class="diff-summary">
          <div class="diff-stat-card stat-added">
            <div class="stat-icon">+</div>
            <div>
              <div class="diff-stat-number">${res.stats.added}</div>
              <div style="font-size:0.7rem; font-weight:400;">Them moi</div>
            </div>
          </div>
          <div class="diff-stat-card stat-removed">
            <div class="stat-icon">-</div>
            <div>
              <div class="diff-stat-number">${res.stats.removed}</div>
              <div style="font-size:0.7rem; font-weight:400;">Xoa bo</div>
            </div>
          </div>
          <div class="diff-stat-card stat-modified">
            <div class="stat-icon">~</div>
            <div>
              <div class="diff-stat-number">${res.stats.modified}</div>
              <div style="font-size:0.7rem; font-weight:400;">Thay doi</div>
            </div>
          </div>
          <div style="margin-left:auto; text-align:right; font-size:0.8rem; color:var(--doc-text-sub);">
            <div style="font-size:1.1rem; font-weight:700; color:${changePercent > 50 ? 'var(--doc-danger)' : changePercent > 20 ? 'var(--doc-warning)' : 'var(--doc-success)'};">${changePercent}%</div>
            <div>thay doi</div>
          </div>
        </div>

        <!-- Legend + Navigation -->
        <div class="diff-legend">
          <div class="diff-legend-item">
            <div class="diff-legend-swatch swatch-add"></div>
            <span>Noi dung moi (them vao)</span>
          </div>
          <div class="diff-legend-item">
            <div class="diff-legend-swatch swatch-remove"></div>
            <span>Noi dung cu (da xoa)</span>
          </div>
          <div class="diff-legend-item">
            <div class="diff-legend-swatch swatch-modify"></div>
            <span>Noi dung sua doi</span>
          </div>
          <div class="diff-navigator">
            <button class="diff-nav-btn" onclick="docCompare.navigateChange(-1)" title="Thay doi truoc">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
            </button>
            <span class="diff-nav-count" id="diffNavCount">0/${totalChanges}</span>
            <button class="diff-nav-btn" onclick="docCompare.navigateChange(1)" title="Thay doi tiep">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </button>
          </div>
        </div>

        ${res.isTruncated ? '<div class="overview-warning"><svg class="overview-warning-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg><span>Noi dung qua dai, chi hien thi 200,000 ky tu dau tien.</span></div>' : ''}

        <div id="diffViewer" class="diff-viewer diff-container"></div>
      `;

      this.renderSmartDiff();

    } catch (e) {
      container.innerHTML = `<div class="doc-empty" style="color:var(--doc-danger);padding:2rem;"><p>Loi: ${e.message}</p></div>`;
    }
  }

  renderOverviewMode(container, res) {
    container.innerHTML = `
      <div style="padding:1.5rem;">
        <div class="overview-warning">
          <svg class="overview-warning-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <span>${res.message}</span>
        </div>
        <div style="display:flex; gap:1rem; margin-bottom:1.5rem;">
          <div class="overview-card">
            <h4>
              <span class="doc-version-tag" style="background:var(--doc-primary);color:white;border-color:var(--doc-primary);">v${res.v1.version}</span>
              Phien ban cu
            </h4>
            <p>Kich thuoc: ${this.formatSize(res.v1.size)}</p>
            <p>So dong: ${res.v1.lines}</p>
            ${res.v1.ext ? `<p>Dinh dang: ${res.v1.ext}</p>` : ''}
          </div>
          <div class="overview-card">
            <h4>
              <span class="doc-version-tag" style="background:var(--doc-success);color:white;border-color:var(--doc-success);">v${res.v2.version}</span>
              Phien ban moi
            </h4>
            <p>Kich thuoc: ${this.formatSize(res.v2.size)}</p>
            <p>So dong: ${res.v2.lines}</p>
            ${res.v2.ext ? `<p>Dinh dang: ${res.v2.ext}</p>` : ''}
          </div>
        </div>
        <button class="doc-btn-primary" onclick="docCompare.executeCompare(true)">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          So sanh chi tiet
        </button>
      </div>
    `;
  }

  /**
   * Smart diff rendering:
   * - Collapse long unchanged sections (show only CONTEXT_LINES around changes)
   * - Track change positions for navigation
   * - Render in batches for performance
   */
  renderSmartDiff() {
    const container = document.getElementById('diffViewer');
    if (!container) return;

    const changes = this.currentChanges;
    const frag = document.createDocumentFragment();
    let lineNum = 1;
    let unchangedBuffer = [];

    const flushUnchanged = () => {
      if (unchangedBuffer.length === 0) return;

      if (unchangedBuffer.length <= this.CONTEXT_LINES * 2 + 1) {
        // Short enough to show all
        unchangedBuffer.forEach(line => {
          const div = this._createDiffLine(lineNum++, line, '');
          frag.appendChild(div);
        });
      } else {
        // Show first CONTEXT_LINES, collapse middle, show last CONTEXT_LINES
        const head = unchangedBuffer.slice(0, this.CONTEXT_LINES);
        const tail = unchangedBuffer.slice(-this.CONTEXT_LINES);
        const hiddenCount = unchangedBuffer.length - this.CONTEXT_LINES * 2;

        head.forEach(line => {
          frag.appendChild(this._createDiffLine(lineNum++, line, ''));
        });

        // Collapsed section
        const collapseDiv = document.createElement('div');
        collapseDiv.className = 'diff-collapse';
        collapseDiv.setAttribute('data-hidden-lines', JSON.stringify(unchangedBuffer.slice(this.CONTEXT_LINES, -this.CONTEXT_LINES)));
        collapseDiv.setAttribute('data-start-line', String(lineNum));
        collapseDiv.innerHTML = `
          <span class="diff-collapse-text">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            ${hiddenCount} dong khong thay doi (nhan de mo)
          </span>
        `;
        collapseDiv.onclick = function () {
          const lines = JSON.parse(this.getAttribute('data-hidden-lines'));
          let startLine = parseInt(this.getAttribute('data-start-line'));
          const expandFrag = document.createDocumentFragment();
          lines.forEach(line => {
            const div = document.createElement('div');
            div.className = 'diff-line';
            div.innerHTML = `<div class="diff-gutter">${startLine++}</div><div class="diff-content">${docCompare.escapeHtml(line)}</div>`;
            expandFrag.appendChild(div);
          });
          this.replaceWith(expandFrag);
        };
        frag.appendChild(collapseDiv);
        lineNum += hiddenCount;

        tail.forEach(line => {
          frag.appendChild(this._createDiffLine(lineNum++, line, ''));
        });
      }

      unchangedBuffer = [];
    };

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];

      if (change.type === 'unchanged') {
        unchangedBuffer.push(change.value);
        continue;
      }

      // Flush any buffered unchanged lines
      flushUnchanged();

      // Track change position for navigation
      const changeId = `diff-change-${this.changePositions.length}`;

      if (change.type === 'modify' && change.details) {
        let oldH = '', newH = '';
        change.details.forEach(p => {
          const val = this.escapeHtml(p.value);
          if (p.removed) oldH += `<span class="diff-word-del">${val}</span>`;
          else if (p.added) newH += `<span class="diff-word-add">${val}</span>`;
          else { oldH += val; newH += val; }
        });

        const oldLine = document.createElement('div');
        oldLine.className = 'diff-line diff-removed';
        oldLine.id = changeId;
        oldLine.innerHTML = `<div class="diff-gutter">-</div><div class="diff-content">${oldH}</div>`;
        frag.appendChild(oldLine);

        const newLine = document.createElement('div');
        newLine.className = 'diff-line diff-added';
        newLine.innerHTML = `<div class="diff-gutter">+</div><div class="diff-content">${newH}</div>`;
        frag.appendChild(newLine);

        this.changePositions.push(changeId);
        lineNum++;
      } else if (change.type === 'add') {
        const lines = change.value.split('\n').filter(l => l !== '');
        lines.forEach((line, idx) => {
          const div = document.createElement('div');
          div.className = 'diff-line diff-added';
          if (idx === 0) div.id = changeId;
          div.innerHTML = `<div class="diff-gutter">+</div><div class="diff-content">${this.escapeHtml(line)}</div>`;
          frag.appendChild(div);
        });
        if (lines.length > 0) this.changePositions.push(changeId);
        lineNum += lines.length;
      } else if (change.type === 'remove') {
        const lines = change.value.split('\n').filter(l => l !== '');
        lines.forEach((line, idx) => {
          const div = document.createElement('div');
          div.className = 'diff-line diff-removed';
          if (idx === 0) div.id = changeId;
          div.innerHTML = `<div class="diff-gutter">-</div><div class="diff-content">${this.escapeHtml(line)}</div>`;
          frag.appendChild(div);
        });
        if (lines.length > 0) this.changePositions.push(changeId);
      }
    }

    // Flush remaining unchanged
    flushUnchanged();

    container.innerHTML = '';
    container.appendChild(frag);

    // Update nav count
    const navCount = document.getElementById('diffNavCount');
    if (navCount) navCount.textContent = `0/${this.changePositions.length}`;
  }

  _createDiffLine(lineNum, text, cls) {
    const div = document.createElement('div');
    div.className = `diff-line ${cls}`;
    div.innerHTML = `<div class="diff-gutter">${lineNum}</div><div class="diff-content">${this.escapeHtml(text)}</div>`;
    return div;
  }

  navigateChange(direction) {
    if (this.changePositions.length === 0) return;

    // Remove previous highlight
    if (this.currentChangeIndex >= 0) {
      const prev = document.getElementById(this.changePositions[this.currentChangeIndex]);
      if (prev) prev.style.outline = '';
    }

    this.currentChangeIndex += direction;

    if (this.currentChangeIndex < 0) this.currentChangeIndex = this.changePositions.length - 1;
    if (this.currentChangeIndex >= this.changePositions.length) this.currentChangeIndex = 0;

    const el = document.getElementById(this.changePositions[this.currentChangeIndex]);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.outline = '2px solid var(--doc-primary)';
      el.style.outlineOffset = '-1px';
    }

    const navCount = document.getElementById('diffNavCount');
    if (navCount) navCount.textContent = `${this.currentChangeIndex + 1}/${this.changePositions.length}`;
  }

  async downloadVersion(version) {
    window.open(`/api/documents/${encodeURIComponent(window.state.currentProject)}/${this.currentDocument.id}/${version}/download`, '_blank');
  }

  // --- Utilities ---

  formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) {
      return `Hom nay ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }
    if (diffDays === 1) return 'Hom qua';
    if (diffDays < 7) return `${diffDays} ngay truoc`;

    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  timeAgo(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    const now = new Date();
    const diffMs = now - d;
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `uploaded ${minutes}m ago`;
    if (hours < 24) return `uploaded ${hours}h ago`;
    if (days < 7) return `uploaded ${days}d ago`;
    if (weeks < 5) return `uploaded ${weeks}w ago`;
    return `uploaded ${months}mo ago`;
  }

  formatDateShort(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }

  filterVersions(query) {
    if (!this.currentDocument) return;
    const timeline = document.getElementById('docVersionTimeline');
    if (!timeline) return;
    const items = timeline.querySelectorAll('.doc-version-tl-item');
    const q = (query || '').toLowerCase().trim();
    items.forEach(item => {
      const text = item.textContent.toLowerCase();
      item.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
  }

  formatSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  showToast(msg, type = 'info') {
    // Remove existing toast
    document.querySelectorAll('.doc-toast').forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `doc-toast toast-${type}`;

    const icons = {
      success: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
      error: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
      info: '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
    };

    toast.innerHTML = `${icons[type] || icons.info} ${this.escapeHtml(msg)}`;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  showError(msg) { this.showToast(msg, 'error'); }
  showSuccess(msg) { this.showToast(msg, 'success'); }

  dragStart(event, docId) {
    event.dataTransfer.setData('text/plain', docId);
  }
  showPrompt(message, defaultValue, onConfirm) {
    // Remove existing prompt modal
    document.querySelectorAll('.doc-prompt-overlay').forEach(el => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'doc-prompt-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10002;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';

    overlay.innerHTML = `
      <div style="background:var(--bg-secondary, #1a1a2e);border:1px solid var(--border-color, rgba(255,255,255,0.1));border-radius:8px;padding:20px 24px;min-width:320px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
        <p style="margin:0 0 12px 0;font-size:14px;color:var(--text-primary, #fff);">${message}</p>
        <input type="text" id="docPromptInput" value="${this.escapeHtml(defaultValue || '')}" 
          style="width:100%;padding:8px 12px;border:1px solid var(--border-color, rgba(255,255,255,0.15));border-radius:6px;background:var(--bg-primary, #0f0f1a);color:var(--text-primary, #fff);font-size:14px;outline:none;box-sizing:border-box;" />
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
          <button id="docPromptCancel" style="padding:6px 16px;border-radius:6px;border:1px solid var(--border-color, rgba(255,255,255,0.15));background:transparent;color:var(--text-secondary, #aaa);cursor:pointer;font-size:13px;">Huy</button>
          <button id="docPromptOk" style="padding:6px 16px;border-radius:6px;border:none;background:var(--accent-primary, #667eea);color:#fff;cursor:pointer;font-size:13px;font-weight:600;">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector('#docPromptInput');
    setTimeout(() => { input.focus(); input.select(); }, 50);

    const close = () => overlay.remove();

    overlay.querySelector('#docPromptCancel').addEventListener('click', close);
    overlay.querySelector('#docPromptOk').addEventListener('click', () => {
      const val = input.value;
      close();
      if (typeof onConfirm === 'function') onConfirm(val);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = input.value;
        close();
        if (typeof onConfirm === 'function') onConfirm(val);
      } else if (e.key === 'Escape') {
        close();
      }
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }

  showCustomConfirm(message, onConfirm) {
    document.querySelectorAll('.doc-prompt-overlay').forEach(el => el.remove());

    const overlay = document.createElement('div');
    overlay.className = 'doc-prompt-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10002;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';

    overlay.innerHTML = `
      <div style="background:var(--bg-secondary, #1a1a2e);border:1px solid var(--border-color, rgba(255,255,255,0.1));border-radius:8px;padding:20px 24px;min-width:300px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
        <p style="margin:0 0 16px 0;font-size:14px;color:var(--text-primary, #fff);">${message}</p>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="docConfirmCancel" style="padding:6px 16px;border-radius:6px;border:1px solid var(--border-color, rgba(255,255,255,0.15));background:transparent;color:var(--text-secondary, #aaa);cursor:pointer;font-size:13px;">Huy</button>
          <button id="docConfirmOk" style="padding:6px 16px;border-radius:6px;border:none;background:var(--danger, #f44);color:#fff;cursor:pointer;font-size:13px;font-weight:600;">Xac nhan</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();

    overlay.querySelector('#docConfirmCancel').addEventListener('click', close);
    overlay.querySelector('#docConfirmOk').addEventListener('click', () => {
      close();
      if (typeof onConfirm === 'function') onConfirm();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }
}

// Global hooks
let docCompare;
function handleDocUpload(input) { if (input.files.length) docCompare.uploadFiles(Array.from(input.files)); input.value = ''; }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { docCompare = new DocumentCompare(); });
else docCompare = new DocumentCompare();
