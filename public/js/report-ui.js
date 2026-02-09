/**
 * ReportUI - Advanced Reporting Module for MAPITesting Tool
 * Provides report generation, listing, viewing, and management.
 */

const ReportUI = {
  reports: [],
  _initialized: false,
  _stylesInjected: false,

  // ========================================
  // SVG Icons
  // ========================================
  icons: {
    comparison: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>',
    'test-run': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>',
    'project-health': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>',
    report: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
    view: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    spinner: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="report-spinner"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    html: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    pdf: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>',
    empty: '<svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3"><rect x="8" y="6" width="32" height="36" rx="3"/><path d="M16 16h16M16 22h16M16 28h10"/><path d="M24 36v6M20 38l4 4 4-4"/></svg>',
  },

  // ========================================
  // Initialization
  // ========================================
  init() {
    if (this._initialized) return;
    this._initialized = true;

    this._injectStyles();
    this._addTabButton();
    this._createTabContent();
    this._createGenerateModal();
    this._createViewModal();
  },

  // ========================================
  // Style Injection
  // ========================================
  _injectStyles() {
    if (this._stylesInjected) return;
    this._stylesInjected = true;

    const style = document.createElement('style');
    style.id = 'report-ui-styles';
    style.textContent = `
      /* ---- Reports Tab Container ---- */
      .report-tab-container {
        padding: 20px;
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
      }

      .report-tab-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
      }

      .report-tab-header h3 {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      /* ---- Report Type Cards ---- */
      .report-type-cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 24px;
      }

      .report-type-card {
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 10px;
        padding: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
      }

      .report-type-card:hover {
        border-color: var(--accent-primary);
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2);
      }

      .report-type-card-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 10px;
      }

      .report-type-card-icon.comparison {
        background: rgba(102, 126, 234, 0.15);
        color: #667eea;
      }

      .report-type-card-icon.test-run {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
      }

      .report-type-card-icon.project-health {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }

      .report-type-card-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 4px;
      }

      .report-type-card-desc {
        font-size: 11px;
        color: var(--text-muted);
        line-height: 1.4;
      }

      /* ---- Report List ---- */
      .report-list-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .report-list-header h4 {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
      }

      .report-list-count {
        font-size: 11px;
        color: var(--text-muted);
        background: var(--bg-tertiary);
        padding: 2px 8px;
        border-radius: 10px;
      }

      .report-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .report-card {
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 12px 14px;
        display: flex;
        align-items: center;
        gap: 12px;
        transition: all 0.15s ease;
      }

      .report-card:hover {
        border-color: var(--accent-primary);
        background: var(--bg-secondary);
      }

      .report-card-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .report-card-icon.comparison {
        background: rgba(102, 126, 234, 0.15);
        color: #667eea;
      }

      .report-card-icon.test-run {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
      }

      .report-card-icon.project-health {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }

      .report-card-info {
        flex: 1;
        min-width: 0;
      }

      .report-card-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 2px;
      }

      .report-card-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: var(--text-muted);
      }

      .report-card-type-label {
        font-size: 10px;
        font-weight: 500;
        padding: 1px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .report-card-type-label.comparison {
        background: rgba(102, 126, 234, 0.15);
        color: #667eea;
      }

      .report-card-type-label.test-run {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
      }

      .report-card-type-label.project-health {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
      }

      .report-format-badges {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .report-format-badge {
        font-size: 10px;
        font-weight: 600;
        padding: 1px 5px;
        border-radius: 3px;
        text-transform: uppercase;
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }

      .report-format-badge.html-badge {
        background: rgba(59, 130, 246, 0.15);
        color: #3b82f6;
      }

      .report-format-badge.pdf-badge {
        background: rgba(239, 68, 68, 0.15);
        color: #ef4444;
      }

      .report-card-actions {
        display: flex;
        gap: 4px;
        flex-shrink: 0;
      }

      .report-action-btn {
        width: 30px;
        height: 30px;
        border-radius: 6px;
        border: 1px solid var(--border-color);
        background: var(--bg-secondary);
        color: var(--text-muted);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
        padding: 0;
      }

      .report-action-btn:hover {
        border-color: var(--accent-primary);
        color: var(--accent-primary);
        background: rgba(102, 126, 234, 0.1);
      }

      .report-action-btn.danger:hover {
        border-color: #ef4444;
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
      }

      .report-action-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      /* ---- Generate Modal ---- */
      .report-generate-modal .modal-content {
        max-width: 520px;
      }

      .report-form-section {
        margin-bottom: 16px;
      }

      .report-form-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 8px;
      }

      .report-radio-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .report-radio-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .report-radio-item:hover {
        border-color: var(--accent-primary);
      }

      .report-radio-item.selected {
        border-color: var(--accent-primary);
        background: rgba(102, 126, 234, 0.08);
      }

      .report-radio-item input[type="radio"] {
        accent-color: var(--accent-primary);
        margin: 0;
      }

      .report-radio-item-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 6px;
        flex-shrink: 0;
      }

      .report-radio-item-text {
        flex: 1;
      }

      .report-radio-item-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
      }

      .report-radio-item-desc {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 1px;
      }

      .report-section-selectors {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .report-section-selectors select {
        width: 100%;
        padding: 8px 10px;
        font-size: 12px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        color: var(--text-primary);
        cursor: pointer;
      }

      .report-section-selectors select:focus {
        border-color: var(--accent-primary);
        outline: none;
      }

      .report-format-selector {
        display: flex;
        gap: 8px;
      }

      .report-format-option {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 10px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-muted);
        transition: all 0.15s ease;
      }

      .report-format-option:hover {
        border-color: var(--accent-primary);
        color: var(--text-primary);
      }

      .report-format-option.selected {
        border-color: var(--accent-primary);
        color: var(--accent-primary);
        background: rgba(102, 126, 234, 0.08);
      }

      .report-format-option input[type="radio"] {
        display: none;
      }

      .report-checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .report-checkbox-item {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: var(--text-primary);
        cursor: pointer;
      }

      .report-checkbox-item input[type="checkbox"] {
        accent-color: var(--accent-primary);
        margin: 0;
        width: 14px;
        height: 14px;
      }

      /* ---- View Report Modal ---- */
      .report-view-modal .modal-content {
        max-width: 90vw;
        width: 1100px;
        height: 85vh;
        display: flex;
        flex-direction: column;
      }

      .report-view-modal .modal-body {
        flex: 1;
        padding: 0;
        overflow: hidden;
        display: flex;
      }

      .report-view-iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: #fff;
      }

      /* ---- Progress Overlay ---- */
      .report-progress-overlay {
        position: fixed;
        inset: 0;
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
      }

      .report-progress-box {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        padding: 32px 40px;
        text-align: center;
        min-width: 260px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      }

      .report-progress-box .report-spinner {
        animation: report-spin 1s linear infinite;
        margin-bottom: 12px;
        color: var(--accent-primary);
      }

      .report-progress-text {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: 4px;
      }

      .report-progress-sub {
        font-size: 12px;
        color: var(--text-muted);
      }

      @keyframes report-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      /* ---- Empty State ---- */
      .report-empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--text-muted);
      }

      .report-empty-state p {
        font-size: 13px;
        margin-top: 12px;
      }

      /* ---- Section Notice (comparison-only) ---- */
      .report-section-notice {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 6px;
        padding: 6px 10px;
        background: rgba(245, 158, 11, 0.08);
        border-radius: 6px;
        display: none;
      }

      .report-section-notice.visible {
        display: block;
      }

      /* ---- Responsive ---- */
      @media (max-width: 640px) {
        .report-type-cards {
          grid-template-columns: 1fr;
        }
        .report-section-selectors {
          grid-template-columns: 1fr;
        }
        .report-view-modal .modal-content {
          max-width: 98vw;
          width: auto;
          height: 90vh;
        }
      }
    `;
    document.head.appendChild(style);
  },

  // ========================================
  // Tab Button
  // ========================================
  _addTabButton() {
    const tablist = document.querySelector('.workspace-tabs');
    if (!tablist) return;

    // Check if already added
    if (tablist.querySelector('[data-tab="reports"]')) return;

    const tabBtn = document.createElement('button');
    tabBtn.className = 'tab-btn';
    tabBtn.setAttribute('data-tab', 'reports');
    tabBtn.setAttribute('role', 'tab');
    tabBtn.setAttribute('aria-selected', 'false');
    tabBtn.innerHTML = this.icons.report + ' Reports';

    // Insert before the tab-group (compare/api)
    const tabGroup = tablist.querySelector('.tab-group');
    if (tabGroup) {
      tablist.insertBefore(tabBtn, tabGroup);
    } else {
      tablist.appendChild(tabBtn);
    }

    // Click handler - integrate with existing switchTab system
    tabBtn.addEventListener('click', () => {
      // Deactivate all tabs
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.remove('active');
        c.style.display = 'none';
      });

      // Activate reports tab
      tabBtn.classList.add('active');
      tabBtn.setAttribute('aria-selected', 'true');
      const tabEl = document.getElementById('reportsTab');
      if (tabEl) {
        tabEl.classList.add('active');
        tabEl.style.display = '';
      }

      if (state) state.activeTab = 'reports';

      // Load reports when switching to tab
      this.loadReports();
    });
  },

  // ========================================
  // Tab Content Area
  // ========================================
  _createTabContent() {
    const panelContent = document.querySelector('.panel-center .panel-content');
    if (!panelContent) return;

    // Check if already exists
    if (document.getElementById('reportsTab')) return;

    const tabEl = document.createElement('div');
    tabEl.id = 'reportsTab';
    tabEl.className = 'tab-content';
    tabEl.setAttribute('role', 'tabpanel');
    tabEl.style.display = 'none';
    tabEl.innerHTML = '<div class="report-tab-container" id="reportTabContainer"></div>';
    panelContent.appendChild(tabEl);

    this.renderTab();
  },

  // ========================================
  // Render Tab Content
  // ========================================
  renderTab() {
    const container = document.getElementById('reportTabContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="report-tab-header">
        <h3>${this.icons.report} Reports</h3>
        <button class="btn btn-primary btn-sm" id="reportGenerateNewBtn">
          ${this.icons.plus} Generate New
        </button>
      </div>

      <div class="report-type-cards">
        <div class="report-type-card" data-type="comparison">
          <div class="report-type-card-icon comparison">
            ${this.icons.comparison}
          </div>
          <div class="report-type-card-title">Comparison</div>
          <div class="report-type-card-desc">Compare two sections side-by-side with visual diff</div>
        </div>
        <div class="report-type-card" data-type="test-run">
          <div class="report-type-card-icon test-run">
            ${this.icons['test-run']}
          </div>
          <div class="report-type-card-title">Test Run</div>
          <div class="report-type-card-desc">Summary of test execution results and regressions</div>
        </div>
        <div class="report-type-card" data-type="project-health">
          <div class="report-type-card-icon project-health">
            ${this.icons['project-health']}
          </div>
          <div class="report-type-card-title">Project Health</div>
          <div class="report-type-card-desc">Overall project status, coverage, and metrics</div>
        </div>
      </div>

      <div class="report-list-header">
        <h4>Recent Reports</h4>
        <span class="report-list-count" id="reportListCount">0 reports</span>
      </div>

      <div class="report-list" id="reportList">
        <div class="report-empty-state" id="reportEmptyState">
          ${this.icons.empty}
          <p>No reports yet. Generate your first report above.</p>
        </div>
      </div>
    `;

    // Bind event: Generate New button
    const genBtn = document.getElementById('reportGenerateNewBtn');
    if (genBtn) {
      genBtn.addEventListener('click', () => this.showGenerateModal());
    }

    // Bind events: Type cards -> open generate modal with preselected type
    container.querySelectorAll('.report-type-card').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.getAttribute('data-type');
        this.showGenerateModal(type);
      });
    });
  },

  // ========================================
  // Generate Report Modal
  // ========================================
  _createGenerateModal() {
    if (document.getElementById('reportGenerateModal')) return;

    const modal = document.createElement('div');
    modal.id = 'reportGenerateModal';
    modal.className = 'modal report-generate-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'reportGenerateModalTitle');
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="reportGenerateModalTitle">Generate Report</h3>
          <button class="modal-close" aria-label="Close" id="reportGenCloseBtn">&times;</button>
        </div>
        <div class="modal-body">
          <!-- Report Type -->
          <div class="report-form-section">
            <label class="report-form-label">Report Type</label>
            <div class="report-radio-group" id="reportTypeGroup">
              <label class="report-radio-item" data-type="comparison">
                <input type="radio" name="reportType" value="comparison">
                <div class="report-radio-item-icon comparison" style="background:rgba(102,126,234,0.15);color:#667eea;">
                  ${this.icons.comparison}
                </div>
                <div class="report-radio-item-text">
                  <div class="report-radio-item-title">Comparison Report</div>
                  <div class="report-radio-item-desc">Side-by-side visual diff between two sections</div>
                </div>
              </label>
              <label class="report-radio-item" data-type="test-run">
                <input type="radio" name="reportType" value="test-run">
                <div class="report-radio-item-icon test-run" style="background:rgba(16,185,129,0.15);color:#10b981;">
                  ${this.icons['test-run']}
                </div>
                <div class="report-radio-item-text">
                  <div class="report-radio-item-title">Test Run Report</div>
                  <div class="report-radio-item-desc">Test execution results with pass/fail details</div>
                </div>
              </label>
              <label class="report-radio-item" data-type="project-health">
                <input type="radio" name="reportType" value="project-health">
                <div class="report-radio-item-icon project-health" style="background:rgba(245,158,11,0.15);color:#f59e0b;">
                  ${this.icons['project-health']}
                </div>
                <div class="report-radio-item-text">
                  <div class="report-radio-item-title">Project Health Report</div>
                  <div class="report-radio-item-desc">Overall project status and health metrics</div>
                </div>
              </label>
            </div>
          </div>

          <!-- Section Selectors (for comparison) -->
          <div class="report-form-section" id="reportSectionSelectorsWrap" style="display:none;">
            <label class="report-form-label">Sections to Compare</label>
            <div class="report-section-selectors">
              <select id="reportSection1">
                <option value="">-- Section 1 --</option>
              </select>
              <select id="reportSection2">
                <option value="">-- Section 2 --</option>
              </select>
            </div>
            <div class="report-section-notice" id="reportSectionNotice">
              Select two different sections to generate a comparison report.
            </div>
          </div>

          <!-- Format Selector -->
          <div class="report-form-section">
            <label class="report-form-label">Output Format</label>
            <div class="report-format-selector" id="reportFormatSelector">
              <label class="report-format-option selected" data-format="html">
                <input type="radio" name="reportFormat" value="html" checked>
                ${this.icons.html} HTML
              </label>
              <label class="report-format-option" data-format="pdf">
                <input type="radio" name="reportFormat" value="pdf">
                ${this.icons.pdf} PDF
              </label>
              <label class="report-format-option" data-format="both">
                <input type="radio" name="reportFormat" value="both">
                ${this.icons.html}+${this.icons.pdf} Both
              </label>
            </div>
          </div>

          <!-- Options -->
          <div class="report-form-section">
            <label class="report-form-label">Options</label>
            <div class="report-checkbox-group">
              <label class="report-checkbox-item">
                <input type="checkbox" id="reportIncludeScreenshots" checked>
                Include screenshots
              </label>
              <label class="report-checkbox-item">
                <input type="checkbox" id="reportIncludeCharts" checked>
                Include charts and graphs
              </label>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary modal-cancel" id="reportGenCancelBtn">Cancel</button>
          <button class="btn btn-primary" id="reportGenSubmitBtn">Generate</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    this._bindGenerateModalEvents();
  },

  _bindGenerateModalEvents() {
    const modal = document.getElementById('reportGenerateModal');
    if (!modal) return;

    // Close buttons
    const closeBtn = document.getElementById('reportGenCloseBtn');
    const cancelBtn = document.getElementById('reportGenCancelBtn');
    const closeModal = () => { modal.style.display = 'none'; };
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Report type radio selection styling
    const typeGroup = document.getElementById('reportTypeGroup');
    if (typeGroup) {
      typeGroup.addEventListener('change', (e) => {
        if (e.target.name === 'reportType') {
          typeGroup.querySelectorAll('.report-radio-item').forEach(item => {
            item.classList.remove('selected');
          });
          e.target.closest('.report-radio-item').classList.add('selected');
          this._updateSectionSelectorsVisibility(e.target.value);
        }
      });
    }

    // Format selector styling
    const formatSelector = document.getElementById('reportFormatSelector');
    if (formatSelector) {
      formatSelector.addEventListener('click', (e) => {
        const option = e.target.closest('.report-format-option');
        if (!option) return;
        formatSelector.querySelectorAll('.report-format-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        const radio = option.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
    }

    // Generate button
    const submitBtn = document.getElementById('reportGenSubmitBtn');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this._handleGenerate());
    }
  },

  _updateSectionSelectorsVisibility(type) {
    const wrap = document.getElementById('reportSectionSelectorsWrap');
    const notice = document.getElementById('reportSectionNotice');
    if (!wrap) return;

    if (type === 'comparison') {
      wrap.style.display = '';
      if (notice) notice.classList.add('visible');
      this._populateSectionDropdowns();
    } else {
      wrap.style.display = 'none';
      if (notice) notice.classList.remove('visible');
    }
  },

  _populateSectionDropdowns() {
    const sel1 = document.getElementById('reportSection1');
    const sel2 = document.getElementById('reportSection2');
    if (!sel1 || !sel2) return;

    const sections = (state && state.sections) ? state.sections : [];

    const buildOptions = (sel) => {
      sel.innerHTML = '<option value="">-- Select Section --</option>';
      sections.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.timestamp || s.name || s;
        const label = s.customName || s.name || s.timestamp || s;
        opt.textContent = label;
        sel.appendChild(opt);
      });
    };

    // Also add "main" as an option
    const addMainOption = (sel) => {
      const opt = document.createElement('option');
      opt.value = 'main';
      opt.textContent = 'Main Data';
      // Insert after the placeholder
      if (sel.options.length > 0) {
        sel.insertBefore(opt, sel.options[1]);
      } else {
        sel.appendChild(opt);
      }
    };

    buildOptions(sel1);
    buildOptions(sel2);
    addMainOption(sel1);
    addMainOption(sel2);
  },

  showGenerateModal(preselectedType) {
    if (!state || !state.currentProject) {
      if (typeof showToast === 'function') {
        showToast('Please select a project first.', 'warning');
      }
      return;
    }

    const modal = document.getElementById('reportGenerateModal');
    if (!modal) return;

    // Reset selections
    const typeGroup = document.getElementById('reportTypeGroup');
    if (typeGroup) {
      typeGroup.querySelectorAll('.report-radio-item').forEach(item => item.classList.remove('selected'));
      typeGroup.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
    }

    // Reset format to HTML
    const formatSelector = document.getElementById('reportFormatSelector');
    if (formatSelector) {
      formatSelector.querySelectorAll('.report-format-option').forEach(o => o.classList.remove('selected'));
      const htmlOpt = formatSelector.querySelector('[data-format="html"]');
      if (htmlOpt) htmlOpt.classList.add('selected');
      const htmlRadio = formatSelector.querySelector('input[value="html"]');
      if (htmlRadio) htmlRadio.checked = true;
    }

    // Reset checkboxes
    const screenshotsCb = document.getElementById('reportIncludeScreenshots');
    const chartsCb = document.getElementById('reportIncludeCharts');
    if (screenshotsCb) screenshotsCb.checked = true;
    if (chartsCb) chartsCb.checked = true;

    // Hide section selectors by default
    const wrap = document.getElementById('reportSectionSelectorsWrap');
    if (wrap) wrap.style.display = 'none';

    // If preselected type
    if (preselectedType) {
      const radio = typeGroup ? typeGroup.querySelector(`input[value="${preselectedType}"]`) : null;
      if (radio) {
        radio.checked = true;
        const item = radio.closest('.report-radio-item');
        if (item) item.classList.add('selected');
        this._updateSectionSelectorsVisibility(preselectedType);
      }
    }

    modal.style.display = 'flex';
  },

  // ========================================
  // Handle Generate
  // ========================================
  async _handleGenerate() {
    const projectName = state ? state.currentProject : null;
    if (!projectName) {
      if (typeof showToast === 'function') showToast('No project selected.', 'error');
      return;
    }

    // Gather type
    const typeRadio = document.querySelector('input[name="reportType"]:checked');
    if (!typeRadio) {
      if (typeof showToast === 'function') showToast('Please select a report type.', 'warning');
      return;
    }
    const type = typeRadio.value;

    // Gather sections (for comparison)
    let section1 = '';
    let section2 = '';
    if (type === 'comparison') {
      const sel1 = document.getElementById('reportSection1');
      const sel2 = document.getElementById('reportSection2');
      section1 = sel1 ? sel1.value : '';
      section2 = sel2 ? sel2.value : '';
      if (!section1 || !section2) {
        if (typeof showToast === 'function') showToast('Please select both sections for comparison.', 'warning');
        return;
      }
      if (section1 === section2) {
        if (typeof showToast === 'function') showToast('Please select two different sections.', 'warning');
        return;
      }
    }

    // Gather format
    const formatRadio = document.querySelector('input[name="reportFormat"]:checked');
    const format = formatRadio ? formatRadio.value : 'html';

    // Gather options
    const includeScreenshots = document.getElementById('reportIncludeScreenshots');
    const includeCharts = document.getElementById('reportIncludeCharts');

    const options = {
      projectName,
      type,
      section1,
      section2,
      format,
      includeScreenshots: includeScreenshots ? includeScreenshots.checked : true,
      includeCharts: includeCharts ? includeCharts.checked : true,
    };

    // Close modal
    const modal = document.getElementById('reportGenerateModal');
    if (modal) modal.style.display = 'none';

    await this.generateReport(options);
  },

  // ========================================
  // Generate Report API Call
  // ========================================
  async generateReport(options) {
    // Show progress
    this._showProgress('Generating report...', 'This may take a few moments.');

    try {
      const result = await api.fetch('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify(options),
      });

      this._hideProgress();

      if (typeof showToast === 'function') {
        showToast('Report generated successfully!', 'success');
      }

      // Refresh list
      await this.loadReports();

      // Offer to view if HTML format
      if (result && result.reportId && (options.format === 'html' || options.format === 'both')) {
        this.viewReport(result.reportId);
      }

    } catch (err) {
      this._hideProgress();
      console.error('Report generation failed:', err);
      if (typeof showToast === 'function') {
        showToast('Report generation failed: ' + (err.message || 'Unknown error'), 'error');
      }
    }
  },

  // ========================================
  // Progress Overlay
  // ========================================
  _showProgress(text, subText) {
    // Remove existing
    this._hideProgress();

    const overlay = document.createElement('div');
    overlay.className = 'report-progress-overlay';
    overlay.id = 'reportProgressOverlay';
    overlay.innerHTML = `
      <div class="report-progress-box">
        ${this.icons.spinner}
        <div class="report-progress-text">${text || 'Processing...'}</div>
        <div class="report-progress-sub">${subText || ''}</div>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  _hideProgress() {
    const overlay = document.getElementById('reportProgressOverlay');
    if (overlay) overlay.remove();
  },

  // ========================================
  // Load Reports
  // ========================================
  async loadReports() {
    const projectName = state ? state.currentProject : null;
    if (!projectName) {
      this.reports = [];
      this.renderReportList([]);
      return;
    }

    try {
      const encodedName = encodeURIComponent(projectName);
      const result = await api.fetch(`/api/reports/${encodedName}/list`);
      this.reports = Array.isArray(result) ? result : (result && result.reports ? result.reports : []);
      this.renderReportList(this.reports);
    } catch (err) {
      console.error('Failed to load reports:', err);
      this.reports = [];
      this.renderReportList([]);
    }
  },

  // ========================================
  // Render Report List
  // ========================================
  renderReportList(reports) {
    const listEl = document.getElementById('reportList');
    const countEl = document.getElementById('reportListCount');
    if (!listEl) return;

    if (countEl) {
      countEl.textContent = reports.length + (reports.length === 1 ? ' report' : ' reports');
    }

    if (!reports || reports.length === 0) {
      listEl.innerHTML = `
        <div class="report-empty-state" id="reportEmptyState">
          ${this.icons.empty}
          <p>No reports yet. Generate your first report above.</p>
        </div>
      `;
      return;
    }

    // Sort by date descending
    const sorted = [...reports].sort((a, b) => {
      const da = new Date(a.createdAt || a.date || 0);
      const db = new Date(b.createdAt || b.date || 0);
      return db - da;
    });

    listEl.innerHTML = sorted.map(report => {
      const type = report.type || 'test-run';
      const typeLabel = this.getTypeLabel(type);
      const typeClass = type;
      const title = report.title || typeLabel;
      const date = this._formatDate(report.createdAt || report.date);
      const formats = report.formats || [report.format || 'html'];
      const reportId = report.id || report.reportId;

      const hasHtml = formats.includes('html') || formats.includes('both');
      const hasPdf = formats.includes('pdf') || formats.includes('both');

      const formatBadges = [];
      if (hasHtml) {
        formatBadges.push(`<span class="report-format-badge html-badge">${this.icons.html} HTML</span>`);
      }
      if (hasPdf) {
        formatBadges.push(`<span class="report-format-badge pdf-badge">${this.icons.pdf} PDF</span>`);
      }

      return `
        <div class="report-card" data-report-id="${reportId}">
          <div class="report-card-icon ${typeClass}">
            ${this.getTypeIcon(type)}
          </div>
          <div class="report-card-info">
            <div class="report-card-title" title="${title}">${title}</div>
            <div class="report-card-meta">
              <span class="report-card-type-label ${typeClass}">${typeLabel}</span>
              <span>${date}</span>
              <div class="report-format-badges">${formatBadges.join('')}</div>
            </div>
          </div>
          <div class="report-card-actions">
            ${hasHtml ? `<button class="report-action-btn" title="View HTML" data-action="view" data-id="${reportId}">${this.icons.view}</button>` : ''}
            ${hasPdf ? `<button class="report-action-btn" title="Download PDF" data-action="download" data-id="${reportId}">${this.icons.download}</button>` : ''}
            <button class="report-action-btn danger" title="Delete" data-action="delete" data-id="${reportId}">${this.icons.trash}</button>
          </div>
        </div>
      `;
    }).join('');

    // Bind action buttons
    listEl.querySelectorAll('.report-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (action === 'view') this.viewReport(id);
        else if (action === 'download') this.downloadPDF(id);
        else if (action === 'delete') this.deleteReport(id);
      });
    });

    // Click on card to view (if HTML available)
    listEl.querySelectorAll('.report-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't trigger if clicking action buttons
        if (e.target.closest('.report-action-btn')) return;
        const id = card.getAttribute('data-report-id');
        const viewBtn = card.querySelector('[data-action="view"]');
        if (viewBtn) {
          this.viewReport(id);
        }
      });
      card.style.cursor = 'pointer';
    });
  },

  // ========================================
  // View Report Modal
  // ========================================
  _createViewModal() {
    if (document.getElementById('reportViewModal')) return;

    const modal = document.createElement('div');
    modal.id = 'reportViewModal';
    modal.className = 'modal modal-large report-view-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'reportViewModalTitle');
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="reportViewModalTitle">Report Preview</h3>
          <button class="modal-close" aria-label="Close" id="reportViewCloseBtn">&times;</button>
        </div>
        <div class="modal-body">
          <iframe class="report-view-iframe" id="reportViewIframe" sandbox="allow-same-origin" title="Report Preview"></iframe>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" id="reportViewOpenTabBtn">Open in New Tab</button>
          <button class="btn btn-secondary modal-cancel" id="reportViewCancelBtn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Bind events
    const closeBtn = document.getElementById('reportViewCloseBtn');
    const cancelBtn = document.getElementById('reportViewCancelBtn');
    const closeModal = () => {
      modal.style.display = 'none';
      const iframe = document.getElementById('reportViewIframe');
      if (iframe) iframe.src = 'about:blank';
    };
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Open in new tab
    const openTabBtn = document.getElementById('reportViewOpenTabBtn');
    if (openTabBtn) {
      openTabBtn.addEventListener('click', () => {
        const iframe = document.getElementById('reportViewIframe');
        if (iframe && iframe.src && iframe.src !== 'about:blank') {
          window.open(iframe.src, '_blank');
        }
      });
    }
  },

  viewReport(reportId) {
    const projectName = state ? state.currentProject : null;
    if (!projectName || !reportId) return;

    const encodedProject = encodeURIComponent(projectName);
    const encodedId = encodeURIComponent(reportId);
    const url = `/api/reports/${encodedProject}/${encodedId}/html`;

    const modal = document.getElementById('reportViewModal');
    const iframe = document.getElementById('reportViewIframe');
    const titleEl = document.getElementById('reportViewModalTitle');

    if (!modal || !iframe) {
      // Fallback: open in new tab
      window.open(url, '_blank');
      return;
    }

    // Find report title
    const report = this.reports.find(r => (r.id || r.reportId) === reportId);
    if (titleEl) {
      titleEl.textContent = report ? (report.title || this.getTypeLabel(report.type)) : 'Report Preview';
    }

    iframe.src = url;
    modal.style.display = 'flex';
  },

  // ========================================
  // Download PDF
  // ========================================
  downloadPDF(reportId) {
    const projectName = state ? state.currentProject : null;
    if (!projectName || !reportId) return;

    const encodedProject = encodeURIComponent(projectName);
    const encodedId = encodeURIComponent(reportId);
    const url = `/api/reports/${encodedProject}/${encodedId}/pdf`;

    // Create a temporary link to trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    if (typeof showToast === 'function') {
      showToast('Downloading PDF report...', 'info');
    }
  },

  // ========================================
  // Delete Report
  // ========================================
  async deleteReport(reportId) {
    const projectName = state ? state.currentProject : null;
    if (!projectName || !reportId) return;

    // Confirmation
    const confirmed = confirm('Are you sure you want to delete this report?');
    if (!confirmed) return;

    try {
      const encodedProject = encodeURIComponent(projectName);
      const encodedId = encodeURIComponent(reportId);
      await api.fetch(`/api/reports/${encodedProject}/${encodedId}`, {
        method: 'DELETE',
      });

      if (typeof showToast === 'function') {
        showToast('Report deleted.', 'success');
      }

      // Refresh list
      await this.loadReports();
    } catch (err) {
      console.error('Delete report failed:', err);
      if (typeof showToast === 'function') {
        showToast('Failed to delete report: ' + (err.message || 'Unknown error'), 'error');
      }
    }
  },

  // ========================================
  // Helpers
  // ========================================
  getTypeIcon(type) {
    switch (type) {
      case 'comparison':
        return this.icons.comparison;
      case 'test-run':
        return this.icons['test-run'];
      case 'project-health':
        return this.icons['project-health'];
      default:
        return this.icons.report;
    }
  },

  getTypeLabel(type) {
    switch (type) {
      case 'comparison':
        return 'Comparison Report';
      case 'test-run':
        return 'Test Run Report';
      case 'project-health':
        return 'Project Health Report';
      default:
        return 'Report';
    }
  },

  _formatDate(dateStr) {
    if (!dateStr) return '--';

    // Try using the global formatTimestamp if available
    if (typeof formatTimestamp === 'function') {
      try {
        const result = formatTimestamp(dateStr);
        if (result && result !== dateStr) return result;
      } catch (e) {
        // fall through
      }
    }

    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch (e) {
      return dateStr;
    }
  },
};

// ========================================
// Auto-initialize on DOMContentLoaded
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  ReportUI.init();
});

// Also expose globally
window.ReportUI = ReportUI;
