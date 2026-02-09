/* ============================================================
   Version Control UI Module for MAPITesting Tool
   Manages commit, history, rollback, diff, tagging of main data
   ============================================================ */

const VersionUI = {
  versions: [],
  currentPage: 1,
  totalPages: 1,
  hasMore: false,
  diffSelectedFirst: null,
  panelEl: null,
  timelineEl: null,

  // ---- SVG Icons (no emoji) ----
  icons: {
    commit: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><line x1="0" y1="8" x2="5" y2="8"/><line x1="11" y1="8" x2="16" y2="8"/></svg>',
    history: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.5"/><polyline points="8,4 8,8 11,10"/></svg>',
    rollback: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="4,7 1,4 4,1"/><path d="M1,4 H10 A5,5 0 0 1 10,14 H5"/></svg>',
    diff: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1" width="6" height="14" rx="1"/><rect x="9" y="1" width="6" height="14" rx="1"/></svg>',
    tag: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1,9 L1,1 H9 L15,8 L8,15 Z"/><circle cx="5" cy="5" r="1.5" fill="currentColor"/></svg>',
    trash: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3,4 4,14 12,14 13,4"/><line x1="1" y1="4" x2="15" y2="4"/><path d="M6,4 V2 H10 V4"/></svg>',
    plus: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>',
    added: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#4caf50" stroke-width="2"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>',
    removed: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#f44336" stroke-width="2"><line x1="3" y1="8" x2="13" y2="8"/></svg>',
    modified: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#ff9800" stroke-width="2"><circle cx="8" cy="8" r="5"/></svg>',
    unchanged: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#999" stroke-width="1.5"><line x1="3" y1="8" x2="13" y2="8"/></svg>'
  },

  // ================================================================
  // INIT
  // ================================================================
  init() {
    this.injectStyles();
    this.createVersionPanel();
    this.addCommitButton();

    // Auto-load history when project changes
    if (state.currentProject) {
      this.loadHistory(1);
    }
  },

  // ================================================================
  // CSS INJECTION
  // ================================================================
  injectStyles() {
    if (document.getElementById('version-ui-styles')) return;
    const style = document.createElement('style');
    style.id = 'version-ui-styles';
    style.textContent = `
      /* Version Panel */
      .version-panel {
        padding: 12px;
        border-top: 1px solid var(--border-color);
      }
      .version-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .version-panel-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .version-commit-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        padding: 3px 10px;
        border-radius: 4px;
        border: 1px solid var(--accent-primary);
        background: rgba(102,126,234,0.1);
        color: var(--accent-primary);
        cursor: pointer;
        font-weight: 500;
        transition: background 0.15s;
      }
      .version-commit-btn:hover {
        background: rgba(102,126,234,0.25);
      }

      /* Timeline */
      .version-timeline {
        position: relative;
        padding-left: 20px;
      }
      .version-timeline::before {
        content: '';
        position: absolute;
        left: 7px;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--border-color);
      }
      .version-item {
        position: relative;
        margin-bottom: 16px;
      }
      .version-dot {
        position: absolute;
        left: -20px;
        top: 4px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--text-muted);
        border: 2px solid var(--bg-secondary);
        z-index: 1;
      }
      .version-dot.dot-tagged {
        background: var(--accent-primary);
      }
      .version-dot.dot-rollback {
        background: var(--warning);
      }
      .version-message {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
        word-break: break-word;
      }
      .version-meta {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 2px;
      }
      .version-tag {
        display: inline-block;
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 4px;
        background: rgba(102,126,234,0.15);
        color: var(--accent-primary);
        margin-top: 4px;
      }
      .version-actions {
        display: flex;
        gap: 4px;
        margin-top: 6px;
      }
      .version-action-btn {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 4px;
        border: 1px solid var(--border-color);
        background: none;
        color: var(--text-secondary);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        transition: all 0.15s;
      }
      .version-action-btn:hover {
        background: var(--bg-glass);
        color: var(--text-primary);
      }
      .version-action-btn.danger:hover {
        color: var(--danger);
        border-color: var(--danger);
      }
      .version-load-more {
        text-align: center;
        margin-top: 8px;
      }
      .version-load-more-btn {
        font-size: 12px;
        padding: 4px 16px;
        border-radius: 4px;
        border: 1px solid var(--border-color);
        background: none;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.15s;
      }
      .version-load-more-btn:hover {
        background: var(--bg-glass);
        color: var(--text-primary);
      }
      .version-empty {
        font-size: 12px;
        color: var(--text-muted);
        text-align: center;
        padding: 20px 0;
      }
      .version-search {
        margin-bottom: 10px;
      }
      .version-search input {
        width: 100%;
        padding: 5px 8px;
        font-size: 12px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        background: var(--bg-primary);
        color: var(--text-primary);
        box-sizing: border-box;
        outline: none;
      }
      .version-search input:focus {
        border-color: var(--accent-primary);
      }
      .version-search input::placeholder {
        color: var(--text-muted);
      }

      /* Commit Modal */
      .version-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(2px);
      }
      .version-modal {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        width: 500px;
        max-width: 90vw;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      }
      .version-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border-color);
      }
      .version-modal-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .version-modal-close {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
      }
      .version-modal-close:hover {
        color: var(--text-primary);
      }
      .version-modal-body {
        padding: 16px;
      }
      .version-modal-footer {
        padding: 12px 16px;
        border-top: 1px solid var(--border-color);
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .version-form-group {
        margin-bottom: 14px;
      }
      .version-form-group label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }
      .version-form-group textarea,
      .version-form-group input[type="text"] {
        width: 100%;
        padding: 8px 10px;
        font-size: 13px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        background: var(--bg-primary);
        color: var(--text-primary);
        box-sizing: border-box;
        outline: none;
        font-family: inherit;
      }
      .version-form-group textarea {
        resize: vertical;
        min-height: 70px;
      }
      .version-form-group textarea:focus,
      .version-form-group input[type="text"]:focus {
        border-color: var(--accent-primary);
      }
      .version-btn-primary {
        padding: 6px 18px;
        font-size: 13px;
        border-radius: 4px;
        border: none;
        background: var(--accent-primary);
        color: #fff;
        cursor: pointer;
        font-weight: 500;
        transition: opacity 0.15s;
      }
      .version-btn-primary:hover {
        opacity: 0.9;
      }
      .version-btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .version-btn-secondary {
        padding: 6px 18px;
        font-size: 13px;
        border-radius: 4px;
        border: 1px solid var(--border-color);
        background: none;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.15s;
      }
      .version-btn-secondary:hover {
        background: var(--bg-glass);
        color: var(--text-primary);
      }

      /* Diff Modal */
      .version-diff-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      .version-diff-table th {
        text-align: left;
        padding: 6px 8px;
        font-size: 11px;
        font-weight: 600;
        color: var(--text-muted);
        border-bottom: 1px solid var(--border-color);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .version-diff-table td {
        padding: 5px 8px;
        border-bottom: 1px solid var(--border-color);
        color: var(--text-primary);
        vertical-align: middle;
      }
      .version-diff-table tr:last-child td {
        border-bottom: none;
      }
      .diff-status {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 500;
      }
      .diff-status.added { color: #4caf50; }
      .diff-status.removed { color: #f44336; }
      .diff-status.modified { color: #ff9800; }
      .diff-status.unchanged { color: #999; }
      .diff-filepath {
        font-family: monospace;
        font-size: 12px;
        word-break: break-all;
      }
      .version-diff-select {
        margin-bottom: 14px;
      }
      .version-diff-select label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }
      .version-diff-select select {
        width: 100%;
        padding: 6px 8px;
        font-size: 13px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        background: var(--bg-primary);
        color: var(--text-primary);
        outline: none;
      }
      .version-diff-select select:focus {
        border-color: var(--accent-primary);
      }
      .version-diff-summary {
        display: flex;
        gap: 16px;
        margin-bottom: 12px;
        font-size: 12px;
      }
      .version-diff-summary span {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      /* Tag prompt inline */
      .version-tag-prompt {
        display: flex;
        gap: 4px;
        margin-top: 6px;
      }
      .version-tag-prompt input {
        flex: 1;
        padding: 3px 6px;
        font-size: 11px;
        border: 1px solid var(--accent-primary);
        border-radius: 4px;
        background: var(--bg-primary);
        color: var(--text-primary);
        outline: none;
      }
      .version-tag-prompt button {
        padding: 3px 8px;
        font-size: 11px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
      }

      /* Header commit button */
      .header-commit-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 4px;
        border: 1px solid var(--accent-primary);
        background: rgba(102,126,234,0.1);
        color: var(--accent-primary);
        cursor: pointer;
        font-weight: 500;
        transition: background 0.15s;
        margin-left: 6px;
      }
      .header-commit-btn:hover {
        background: rgba(102,126,234,0.25);
      }

      /* Confirm dialog */
      .version-confirm-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.45);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .version-confirm-box {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 20px 24px;
        max-width: 400px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      }
      .version-confirm-box p {
        margin: 0 0 16px 0;
        font-size: 13px;
        color: var(--text-primary);
        line-height: 1.5;
      }
      .version-confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
    `;
    document.head.appendChild(style);
  },

  // ================================================================
  // PANEL CREATION
  // ================================================================
  createVersionPanel() {
    // Find the left panel - look for the mainTree container's parent
    const mainTree = document.getElementById('mainTree');
    if (!mainTree) return;

    const panel = document.createElement('div');
    panel.className = 'version-panel';
    panel.id = 'versionPanel';
    this.panelEl = panel;

    // Header
    const header = document.createElement('div');
    header.className = 'version-panel-header';
    header.innerHTML = `
      <span class="version-panel-title">
        ${this.icons.history}
        Version History
      </span>
      <button class="version-commit-btn" onclick="VersionUI.showCommitModal()" title="Commit current data">
        ${this.icons.commit}
        Commit
      </button>
    `;
    panel.appendChild(header);

    // Search
    const search = document.createElement('div');
    search.className = 'version-search';
    search.innerHTML = `<input type="text" placeholder="Search versions..." id="versionSearchInput" />`;
    panel.appendChild(search);

    // Debounced search
    const searchInput = search.querySelector('input');
    let searchTimer = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        this.currentPage = 1;
        this.versions = [];
        this.loadHistory(1, searchInput.value.trim());
      }, 300);
    });

    // Timeline container
    const timeline = document.createElement('div');
    timeline.className = 'version-timeline';
    timeline.id = 'versionTimeline';
    panel.appendChild(timeline);
    this.timelineEl = timeline;

    // Load more container
    const loadMoreDiv = document.createElement('div');
    loadMoreDiv.className = 'version-load-more';
    loadMoreDiv.id = 'versionLoadMore';
    loadMoreDiv.style.display = 'none';
    loadMoreDiv.innerHTML = `<button class="version-load-more-btn" onclick="VersionUI.loadMore()">Load more</button>`;
    panel.appendChild(loadMoreDiv);

    // Insert after mainTree
    mainTree.parentNode.insertBefore(panel, mainTree.nextSibling);
  },

  // ================================================================
  // ADD COMMIT BUTTON TO LEFT PANEL HEADER
  // ================================================================
  addCommitButton() {
    // Find the panel header that contains "Test All" or similar controls
    const leftPanelHeader = document.querySelector('.panel-header .panel-actions') ||
                            document.querySelector('.left-panel .panel-header');
    if (!leftPanelHeader) return;

    // Determine where to insert
    const actionsContainer = leftPanelHeader.querySelector('.panel-actions') || leftPanelHeader;
    const btn = document.createElement('button');
    btn.className = 'header-commit-btn';
    btn.title = 'Commit version';
    btn.innerHTML = `${this.icons.commit} Commit`;
    btn.addEventListener('click', () => this.showCommitModal());
    actionsContainer.appendChild(btn);
  },

  // ================================================================
  // RENDER VERSIONS
  // ================================================================
  renderVersions(versions, append) {
    if (!this.timelineEl) return;

    if (!append) {
      this.timelineEl.innerHTML = '';
    }

    // Ensure versions is an array
    if (!Array.isArray(versions)) {
      console.warn('[VersionUI] versions is not an array:', versions);
      versions = [];
    }

    if (versions.length === 0 && !append) {
      this.timelineEl.innerHTML = '<div class="version-empty">No versions yet. Commit to create the first snapshot.</div>';
      return;
    }

    versions.forEach(v => {
      const item = document.createElement('div');
      item.className = 'version-item';
      item.dataset.versionId = v.id || v.versionId;

      // Determine dot class
      let dotClass = 'version-dot';
      if (v.tag || v.tagName) dotClass += ' dot-tagged';
      if (v.isRollback) dotClass += ' dot-rollback';

      const tagHtml = (v.tag || v.tagName)
        ? `<span class="version-tag">${this.escapeHtml(v.tag || v.tagName)}</span>`
        : '';

      const vId = v.id || v.versionId;
      const timeStr = this.timeAgo(v.createdAt || v.timestamp || v.date);
      const authorStr = this.escapeHtml(v.author || 'Unknown');
      const messageStr = this.escapeHtml(v.message || 'No message');

      item.innerHTML = `
        <div class="${dotClass}"></div>
        <div class="version-info">
          <div class="version-message">${messageStr}</div>
          <div class="version-meta">${authorStr} \u00B7 ${timeStr}</div>
          ${tagHtml}
          <div class="version-actions" id="vActions_${vId}">
            <button class="version-action-btn" onclick="VersionUI.rollback('${vId}')" title="Rollback to this version">
              ${this.icons.rollback} Rollback
            </button>
            <button class="version-action-btn" onclick="VersionUI.showDiffModal('${vId}')" title="Compare with another version">
              ${this.icons.diff} Diff
            </button>
            <button class="version-action-btn" onclick="VersionUI.showTagInput('${vId}')" title="Add tag">
              ${this.icons.tag} Tag
            </button>
            <button class="version-action-btn danger" onclick="VersionUI.deleteVersion('${vId}')" title="Delete version">
              ${this.icons.trash}
            </button>
          </div>
        </div>
      `;

      this.timelineEl.appendChild(item);
    });

    // Show/hide load more
    const loadMoreEl = document.getElementById('versionLoadMore');
    if (loadMoreEl) {
      loadMoreEl.style.display = this.hasMore ? 'block' : 'none';
    }
  },

  // ================================================================
  // COMMIT MODAL
  // ================================================================
  showCommitModal() {
    if (!state.currentProject) {
      showToast('No project selected', 'error');
      return;
    }

    const savedAuthor = localStorage.getItem('version_author') || 'User';

    const overlay = document.createElement('div');
    overlay.className = 'version-modal-overlay';
    overlay.id = 'versionCommitModal';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal('versionCommitModal');
    });

    overlay.innerHTML = `
      <div class="version-modal">
        <div class="version-modal-header">
          <h3>${this.icons.commit} Commit Version</h3>
          <button class="version-modal-close" onclick="VersionUI.closeModal('versionCommitModal')">
            ${this.icons.close}
          </button>
        </div>
        <div class="version-modal-body">
          <div class="version-form-group">
            <label>Commit Message *</label>
            <textarea id="versionCommitMessage" placeholder="Describe what changed..." rows="3"></textarea>
          </div>
          <div class="version-form-group">
            <label>Author</label>
            <input type="text" id="versionCommitAuthor" value="${this.escapeHtml(savedAuthor)}" placeholder="Your name" />
          </div>
          <div class="version-form-group">
            <label>Project</label>
            <input type="text" value="${this.escapeHtml(state.currentProject)}" disabled style="opacity:0.7" />
          </div>
        </div>
        <div class="version-modal-footer">
          <button class="version-btn-secondary" onclick="VersionUI.closeModal('versionCommitModal')">Cancel</button>
          <button class="version-btn-primary" id="versionCommitBtn" onclick="VersionUI.handleCommit()">
            ${this.icons.commit} Commit
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Focus message textarea
    setTimeout(() => {
      const ta = document.getElementById('versionCommitMessage');
      if (ta) ta.focus();
    }, 50);

    // Enter key in message to submit
    const ta = overlay.querySelector('#versionCommitMessage');
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.handleCommit();
      }
    });
  },

  async handleCommit() {
    const messageEl = document.getElementById('versionCommitMessage');
    const authorEl = document.getElementById('versionCommitAuthor');
    const btnEl = document.getElementById('versionCommitBtn');

    const message = messageEl ? messageEl.value.trim() : '';
    const author = authorEl ? authorEl.value.trim() : 'User';

    if (!message) {
      messageEl.style.borderColor = 'var(--danger)';
      messageEl.focus();
      return;
    }

    // Save author preference
    localStorage.setItem('version_author', author);

    // Disable button
    if (btnEl) {
      btnEl.disabled = true;
      btnEl.textContent = 'Committing...';
    }

    await this.commit(message, author);
    this.closeModal('versionCommitModal');
  },

  async commit(message, author) {
    if (!state.currentProject) return;

    try {
      const result = await api.fetch(`/api/versions/${encodeURIComponent(state.currentProject)}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, author })
      });

      if (result && !result.error) {
        showToast('Version committed successfully', 'success');
        // Refresh history
        this.versions = [];
        this.currentPage = 1;
        await this.loadHistory(1);
      } else {
        showToast(result.error || 'Failed to commit', 'error');
      }
    } catch (err) {
      console.error('Commit error:', err);
      showToast('Failed to commit: ' + err.message, 'error');
    }
  },

  // ================================================================
  // LOAD HISTORY
  // ================================================================
  async loadHistory(page, search) {
    if (!state.currentProject) return;

    const limit = 20;
    let url = `/api/versions/${encodeURIComponent(state.currentProject)}/history?page=${page}&limit=${limit}`;
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }

    try {
      const result = await api.fetch(url);

      if (result && !result.error) {
        let versions = result.versions || result.data || [];

        // Ensure versions is always an array
        if (!Array.isArray(versions)) {
          console.warn('[VersionUI] API returned non-array versions:', versions);
          versions = [];
        }

        const totalItems = result.total || result.totalCount || versions.length;
        this.currentPage = page;
        this.totalPages = result.totalPages || Math.ceil(totalItems / limit) || 1;
        this.hasMore = page < this.totalPages;

        if (page === 1) {
          this.versions = versions;
          this.renderVersions(versions, false);
        } else {
          this.versions = this.versions.concat(versions);
          this.renderVersions(versions, true);
        }
      } else {
        if (page === 1) {
          this.versions = [];
          this.renderVersions([], false);
        }
      }
    } catch (err) {
      console.error('Load history error:', err);
      if (page === 1) {
        this.versions = [];
        this.renderVersions([], false);
      }
    }
  },

  loadMore() {
    const searchInput = document.getElementById('versionSearchInput');
    const search = searchInput ? searchInput.value.trim() : '';
    this.loadHistory(this.currentPage + 1, search || undefined);
  },

  // ================================================================
  // ROLLBACK
  // ================================================================
  async rollback(versionId) {
    if (!state.currentProject) return;

    this.showConfirm(
      'Are you sure you want to rollback to this version? Current data will be backed up automatically before restoring.',
      async () => {
        try {
          const result = await api.fetch(
            `/api/versions/${encodeURIComponent(state.currentProject)}/rollback/${encodeURIComponent(versionId)}`,
            { method: 'POST' }
          );

          if (result && !result.error) {
            showToast('Rollback successful. Previous data was backed up.', 'success');
            // Refresh main tree if available
            if (typeof switchTab === 'function') {
              switchTab('main');
            }
            // Reload the main tree data
            if (state.mainTree && typeof state.mainTree.load === 'function') {
              state.mainTree.load();
            }
            // Refresh version history
            this.versions = [];
            this.currentPage = 1;
            await this.loadHistory(1);
          } else {
            showToast(result.error || 'Rollback failed', 'error');
          }
        } catch (err) {
          console.error('Rollback error:', err);
          showToast('Rollback failed: ' + err.message, 'error');
        }
      }
    );
  },

  // ================================================================
  // DIFF MODAL
  // ================================================================
  showDiffModal(versionId) {
    if (!state.currentProject) return;

    this.diffSelectedFirst = versionId;

    const overlay = document.createElement('div');
    overlay.className = 'version-modal-overlay';
    overlay.id = 'versionDiffModal';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal('versionDiffModal');
    });

    // Build version options (exclude the selected one)
    const options = this.versions
      .filter(v => (v.id || v.versionId) !== versionId)
      .map(v => {
        const vid = v.id || v.versionId;
        const msg = this.escapeHtml(v.message || 'No message');
        const tag = (v.tag || v.tagName) ? ` [${this.escapeHtml(v.tag || v.tagName)}]` : '';
        return `<option value="${vid}">${msg}${tag} - ${this.timeAgo(v.createdAt || v.timestamp || v.date)}</option>`;
      })
      .join('');

    overlay.innerHTML = `
      <div class="version-modal" style="width: 600px;">
        <div class="version-modal-header">
          <h3>${this.icons.diff} Compare Versions</h3>
          <button class="version-modal-close" onclick="VersionUI.closeModal('versionDiffModal')">
            ${this.icons.close}
          </button>
        </div>
        <div class="version-modal-body">
          <div class="version-diff-select">
            <label>Compare with:</label>
            <select id="versionDiffTarget">
              <option value="">-- Select a version --</option>
              ${options}
            </select>
          </div>
          <div id="versionDiffResults"></div>
        </div>
        <div class="version-modal-footer">
          <button class="version-btn-secondary" onclick="VersionUI.closeModal('versionDiffModal')">Close</button>
          <button class="version-btn-primary" id="versionDiffBtn" onclick="VersionUI.handleDiffCompare()">
            ${this.icons.diff} Compare
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
  },

  async handleDiffCompare() {
    const select = document.getElementById('versionDiffTarget');
    if (!select || !select.value) {
      showToast('Select a version to compare with', 'error');
      return;
    }

    const btn = document.getElementById('versionDiffBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Comparing...';
    }

    await this.loadDiff(this.diffSelectedFirst, select.value);

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `${this.icons.diff} Compare`;
    }
  },

  async loadDiff(v1, v2) {
    if (!state.currentProject) return;

    const resultsEl = document.getElementById('versionDiffResults');
    if (!resultsEl) return;

    try {
      const result = await api.fetch(
        `/api/versions/${encodeURIComponent(state.currentProject)}/diff/${encodeURIComponent(v1)}/${encodeURIComponent(v2)}`
      );

      if (result && !result.error) {
        const changes = result.changes || result.diffs || result || [];

        if (!Array.isArray(changes) || changes.length === 0) {
          resultsEl.innerHTML = '<div class="version-empty">No differences found between these versions.</div>';
          return;
        }

        // Summary counts
        let addedCount = 0, removedCount = 0, modifiedCount = 0, unchangedCount = 0;
        changes.forEach(c => {
          const status = (c.status || c.type || '').toLowerCase();
          if (status === 'added') addedCount++;
          else if (status === 'removed' || status === 'deleted') removedCount++;
          else if (status === 'modified' || status === 'changed') modifiedCount++;
          else unchangedCount++;
        });

        let html = `
          <div class="version-diff-summary">
            <span class="diff-status added">${this.icons.added} ${addedCount} added</span>
            <span class="diff-status removed">${this.icons.removed} ${removedCount} removed</span>
            <span class="diff-status modified">${this.icons.modified} ${modifiedCount} modified</span>
            <span class="diff-status unchanged">${this.icons.unchanged} ${unchangedCount} unchanged</span>
          </div>
          <table class="version-diff-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>File Path</th>
              </tr>
            </thead>
            <tbody>
        `;

        changes.forEach(c => {
          let status = (c.status || c.type || 'unchanged').toLowerCase();
          if (status === 'deleted') status = 'removed';
          if (status === 'changed') status = 'modified';

          const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
          let icon = this.icons.unchanged;
          if (status === 'added') icon = this.icons.added;
          else if (status === 'removed') icon = this.icons.removed;
          else if (status === 'modified') icon = this.icons.modified;

          const filepath = this.escapeHtml(c.path || c.filePath || c.file || '');

          html += `
            <tr>
              <td><span class="diff-status ${status}">${icon} ${statusLabel}</span></td>
              <td class="diff-filepath">${filepath}</td>
            </tr>
          `;
        });

        html += '</tbody></table>';
        resultsEl.innerHTML = html;
      } else {
        resultsEl.innerHTML = `<div class="version-empty">Failed to load diff: ${this.escapeHtml(result.error || 'Unknown error')}</div>`;
      }
    } catch (err) {
      console.error('Diff error:', err);
      resultsEl.innerHTML = `<div class="version-empty">Failed to load diff: ${this.escapeHtml(err.message)}</div>`;
    }
  },

  // ================================================================
  // TAG
  // ================================================================
  showTagInput(versionId) {
    const actionsEl = document.getElementById('vActions_' + versionId);
    if (!actionsEl) return;

    // Remove existing tag prompt if any
    const existing = actionsEl.parentNode.querySelector('.version-tag-prompt');
    if (existing) {
      existing.remove();
      return;
    }

    const prompt = document.createElement('div');
    prompt.className = 'version-tag-prompt';
    prompt.innerHTML = `
      <input type="text" id="vTagInput_${versionId}" placeholder="Tag name..." maxlength="50" />
      <button class="version-btn-primary" style="padding:3px 8px;font-size:11px;" onclick="VersionUI.tagVersion('${versionId}')">
        &#x2713;
      </button>
      <button class="version-btn-secondary" style="padding:3px 8px;font-size:11px;" onclick="this.parentElement.remove()">
        &#x2716;
      </button>
    `;

    actionsEl.parentNode.appendChild(prompt);

    const input = document.getElementById('vTagInput_' + versionId);
    if (input) {
      input.focus();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.tagVersion(versionId);
        } else if (e.key === 'Escape') {
          prompt.remove();
        }
      });
    }
  },

  async tagVersion(versionId) {
    if (!state.currentProject) return;

    const input = document.getElementById('vTagInput_' + versionId);
    const tagName = input ? input.value.trim() : '';

    if (!tagName) {
      if (input) input.style.borderColor = 'var(--danger)';
      return;
    }

    try {
      const result = await api.fetch(
        `/api/versions/${encodeURIComponent(state.currentProject)}/versions/${encodeURIComponent(versionId)}/tag`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagName })
        }
      );

      if (result && !result.error) {
        showToast('Tag added: ' + tagName, 'success');
        // Refresh
        this.versions = [];
        this.currentPage = 1;
        await this.loadHistory(1);
      } else {
        showToast(result.error || 'Failed to add tag', 'error');
      }
    } catch (err) {
      console.error('Tag error:', err);
      showToast('Failed to add tag: ' + err.message, 'error');
    }
  },

  // ================================================================
  // DELETE
  // ================================================================
  async deleteVersion(versionId) {
    if (!state.currentProject) return;

    this.showConfirm(
      'Are you sure you want to delete this version? This action cannot be undone.',
      async () => {
        try {
          const result = await api.fetch(
            `/api/versions/${encodeURIComponent(state.currentProject)}/versions/${encodeURIComponent(versionId)}`,
            { method: 'DELETE' }
          );

          if (result && !result.error) {
            showToast('Version deleted', 'success');
            // Refresh
            this.versions = [];
            this.currentPage = 1;
            await this.loadHistory(1);
          } else {
            showToast(result.error || 'Failed to delete version', 'error');
          }
        } catch (err) {
          console.error('Delete error:', err);
          showToast('Failed to delete: ' + err.message, 'error');
        }
      }
    );
  },

  // ================================================================
  // CONFIRM DIALOG
  // ================================================================
  showConfirm(message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'version-confirm-overlay';
    overlay.id = 'versionConfirmDialog';

    overlay.innerHTML = `
      <div class="version-confirm-box">
        <p>${message}</p>
        <div class="version-confirm-actions">
          <button class="version-btn-secondary" id="vConfirmCancel">Cancel</button>
          <button class="version-btn-primary" id="vConfirmOk" style="background:var(--danger);">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#vConfirmCancel').addEventListener('click', () => {
      overlay.remove();
    });

    overlay.querySelector('#vConfirmOk').addEventListener('click', () => {
      overlay.remove();
      if (typeof onConfirm === 'function') onConfirm();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  },

  // ================================================================
  // CLOSE MODAL
  // ================================================================
  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  },

  // ================================================================
  // TIME AGO HELPER
  // ================================================================
  timeAgo(dateString) {
    if (!dateString) return 'unknown';

    const now = Date.now();
    const then = new Date(dateString).getTime();
    if (isNaN(then)) return 'unknown';

    const diffMs = now - then;
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 5) return 'just now';
    if (seconds < 60) return seconds + 's ago';
    if (minutes < 60) return minutes + 'm ago';
    if (hours < 24) return hours + 'h ago';
    if (days < 7) return days + 'd ago';
    if (weeks < 5) return weeks + 'w ago';
    if (months < 12) return months + 'mo ago';
    return years + 'y ago';
  },

  // ================================================================
  // HTML ESCAPE
  // ================================================================
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },

  // ================================================================
  // REFRESH (public helper)
  // ================================================================
  async refresh() {
    this.versions = [];
    this.currentPage = 1;
    const searchInput = document.getElementById('versionSearchInput');
    const search = searchInput ? searchInput.value.trim() : '';
    await this.loadHistory(1, search || undefined);
  }
};

window.VersionUI = VersionUI;

// ================================================================
// AUTO-INIT ON DOM READY
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Delay slightly to ensure other UI elements are rendered first
  setTimeout(() => {
    VersionUI.init();
  }, 500);
});
