/**
 * TestRunnerUI - Frontend module for Test Runner feature
 * Provides regression testing UI with history, statistics, and detailed results.
 *
 * Depends on globals: state, api, showToast, switchTab, formatTimestamp
 */
const TestRunnerUI = {

  // ---------------------------------------------------------------------------
  //  State
  // ---------------------------------------------------------------------------
  testHistory: [],
  statistics: null,
  isRunning: false,
  currentPage: 1,
  totalPages: 1,
  pageSize: 20,
  runningSection: null,
  runProgress: { current: 0, total: 0 },

  // Default thresholds
  thresholds: {
    dom: 95,
    api: 100,
    visual: 90
  },

  // ---------------------------------------------------------------------------
  //  SVG Icons (no emoji)
  // ---------------------------------------------------------------------------
  icons: {
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#51cf66" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    cross: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    running: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffd43b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tr-spin"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>',
    play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    chevronDown: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    chevronUp: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
    chevronLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    chevronRight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    testRunner: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>',
    close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    settings: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1.08-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1.08 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001.08 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1.08z"/></svg>',
    refresh: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>'
  },

  // ---------------------------------------------------------------------------
  //  Initialization
  // ---------------------------------------------------------------------------
  init() {
    this._injectStyles();
    this._addTab();
    this._createTabContent();
    this._observeSectionCards();
    this._listenForProjectChanges();

    // Load persisted thresholds
    try {
      const saved = localStorage.getItem('mapit-test-thresholds');
      if (saved) {
        Object.assign(this.thresholds, JSON.parse(saved));
      }
    } catch (_) { /* ignore */ }
  },

  // ---------------------------------------------------------------------------
  //  Style Injection
  // ---------------------------------------------------------------------------
  _injectStyles() {
    if (document.getElementById('tr-styles')) return;
    const style = document.createElement('style');
    style.id = 'tr-styles';
    style.textContent = `
      /* Test Runner Tab -------------------------------------------------------- */
      .test-runner-container {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        overflow-y: auto;
        height: 100%;
        overscroll-behavior: contain;
      }
      .test-runner-container::-webkit-scrollbar { width: 6px; }
      .test-runner-container::-webkit-scrollbar-track { background: transparent; }
      .test-runner-container::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }

      /* Header */
      .tr-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .tr-header-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .tr-header-actions {
        display: flex;
        gap: 8px;
      }

      /* Stats */
      .test-runner-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
      }
      .tr-stat-card {
        position: relative;
        background: var(--bg-card);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        padding: 16px 20px;
        transition: transform var(--transition-fast), box-shadow var(--transition-fast);
        overflow: hidden;
      }
      .tr-stat-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md), 0 0 20px rgba(102,126,234,0.1);
      }
      .tr-stat-card::before {
        content: "";
        position: absolute; top: 0; left: 0; right: 0;
        height: 2px;
        opacity: 0;
        transition: opacity var(--transition-fast);
      }
      .tr-stat-card:hover::before { opacity: 1; }
      .tr-stat-card.tr-stat-total::before { background: var(--accent-gradient); }
      .tr-stat-card.tr-stat-passed::before { background: var(--success); }
      .tr-stat-card.tr-stat-failed::before { background: var(--danger); }
      .tr-stat-card.tr-stat-rate::before { background: linear-gradient(135deg, var(--success), var(--info)); }
      .tr-stat-value {
        font-size: 28px;
        font-weight: 700;
        line-height: 1.2;
        margin-bottom: 2px;
      }
      .tr-stat-value.color-accent {
        background: var(--accent-gradient);
        -webkit-background-clip: text; background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .tr-stat-value.color-success { color: var(--success); }
      .tr-stat-value.color-danger { color: var(--danger); }
      .tr-stat-value.color-info { color: var(--info); }
      .tr-stat-label {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-weight: 500;
      }

      /* Config panel */
      .test-runner-config {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        overflow: hidden;
      }
      .tr-config-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        cursor: pointer;
        user-select: none;
        transition: background var(--transition-fast);
      }
      .tr-config-header:hover { background: var(--bg-glass); }
      .tr-config-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
      }
      .tr-config-toggle {
        transition: transform var(--transition-fast);
        color: var(--text-muted);
        display: flex;
      }
      .tr-config-toggle.open {
        transform: rotate(180deg);
      }
      .tr-config-body {
        display: none;
        padding: 16px 20px;
        border-top: 1px solid var(--border-color);
      }
      .tr-config-body.open { display: block; }
      .tr-config-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
      }
      .tr-threshold-group label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: 8px;
      }
      .tr-threshold-group .tr-slider-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .tr-threshold-group input[type="range"] {
        flex: 1;
        -webkit-appearance: none;
        appearance: none;
        height: 6px;
        border-radius: 3px;
        background: var(--bg-glass);
        outline: none;
      }
      .tr-threshold-group input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px; height: 16px;
        border-radius: 50%;
        background: var(--accent-primary);
        cursor: pointer;
        border: 2px solid var(--bg-primary);
        box-shadow: 0 0 6px rgba(102,126,234,0.4);
      }
      .tr-threshold-val {
        min-width: 36px;
        text-align: right;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        font-variant-numeric: tabular-nums;
      }

      /* History table */
      .test-runner-history {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        overflow: hidden;
      }
      .tr-history-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 20px;
        border-bottom: 1px solid var(--border-color);
      }
      .tr-history-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
      }
      .tr-table-wrap {
        overflow-x: auto;
      }
      .tr-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }
      .tr-table thead th {
        padding: 10px 12px;
        text-align: left;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
        background: var(--bg-glass);
        border-bottom: 1px solid var(--border-color);
        white-space: nowrap;
      }
      .tr-table tbody tr {
        border-bottom: 1px solid var(--border-color);
        cursor: pointer;
        transition: background var(--transition-fast);
      }
      .tr-table tbody tr:last-child { border-bottom: none; }
      .tr-table tbody tr:hover { background: var(--bg-glass); }
      .tr-table tbody td {
        padding: 10px 12px;
        white-space: nowrap;
        color: var(--text-secondary);
      }
      .tr-table tbody td.td-status { text-align: center; width: 40px; }
      .tr-table tbody td.td-section {
        max-width: 220px;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--text-primary);
        font-weight: 500;
      }
      .tr-table tbody td.td-score { font-variant-numeric: tabular-nums; font-weight: 600; }
      .tr-table tbody td.td-actions {
        text-align: right;
        white-space: nowrap;
      }
      .tr-table .tr-action-btn {
        background: none; border: none; cursor: pointer;
        color: var(--text-muted); padding: 4px 6px;
        border-radius: 4px;
        transition: color var(--transition-fast), background var(--transition-fast);
        display: inline-flex; align-items: center;
      }
      .tr-table .tr-action-btn:hover {
        color: var(--text-primary);
        background: var(--bg-glass);
      }
      .tr-table .tr-action-btn.btn-delete:hover {
        color: var(--danger);
        background: var(--danger-bg);
      }
      .tr-empty-row td {
        text-align: center;
        padding: 40px 12px !important;
        color: var(--text-muted);
        cursor: default !important;
      }

      /* Pagination */
      .tr-pagination {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 12px 20px;
        border-top: 1px solid var(--border-color);
      }
      .tr-page-btn {
        background: var(--bg-glass);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        color: var(--text-secondary);
        cursor: pointer;
        padding: 6px 10px;
        font-size: 12px;
        font-family: inherit;
        min-width: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
      }
      .tr-page-btn:hover {
        background: rgba(102,126,234,0.1);
        color: var(--text-primary);
        border-color: var(--accent-primary);
      }
      .tr-page-btn.active {
        background: var(--accent-primary);
        color: #fff;
        border-color: var(--accent-primary);
      }
      .tr-page-btn:disabled {
        opacity: 0.4;
        cursor: default;
        pointer-events: none;
      }
      .tr-page-info {
        font-size: 12px;
        color: var(--text-muted);
        margin: 0 8px;
      }

      /* Detail modal */
      .tr-modal-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.15s ease forwards;
      }
      .tr-modal {
        width: 90%;
        max-width: 860px;
        max-height: 85vh;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-lg);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: scaleIn 0.2s ease forwards;
      }
      .tr-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        border-bottom: 1px solid var(--border-color);
        flex-shrink: 0;
      }
      .tr-modal-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .tr-modal-close {
        background: none; border: none; cursor: pointer;
        color: var(--text-muted);
        padding: 4px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        transition: color var(--transition-fast), background var(--transition-fast);
      }
      .tr-modal-close:hover {
        color: var(--text-primary);
        background: var(--bg-glass);
      }
      .tr-modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px;
      }
      .tr-modal-body::-webkit-scrollbar { width: 6px; }
      .tr-modal-body::-webkit-scrollbar-track { background: transparent; }
      .tr-modal-body::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }

      /* Detail sections inside modal */
      .tr-detail-summary {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 20px;
      }
      .tr-detail-stat {
        text-align: center;
        padding: 12px;
        background: var(--bg-glass);
        border-radius: var(--border-radius-sm);
        border: 1px solid var(--border-color);
      }
      .tr-detail-stat-value {
        font-size: 22px;
        font-weight: 700;
        line-height: 1.2;
      }
      .tr-detail-stat-label {
        font-size: 11px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        margin-top: 2px;
      }
      .tr-detail-section-block {
        margin-bottom: 16px;
      }
      .tr-detail-section-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 10px;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .tr-screen-result {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 12px;
        border-radius: var(--border-radius-sm);
        margin-bottom: 4px;
        font-size: 13px;
        transition: background var(--transition-fast);
      }
      .tr-screen-result:hover { background: var(--bg-glass); }
      .tr-screen-result .tr-sr-icon { flex-shrink: 0; display: flex; }
      .tr-screen-result .tr-sr-name {
        flex: 1; min-width: 0;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        color: var(--text-primary);
      }
      .tr-screen-result .tr-sr-scores {
        display: flex; gap: 16px; flex-shrink: 0;
        font-variant-numeric: tabular-nums;
      }
      .tr-screen-result .tr-sr-score-item {
        display: flex; align-items: center; gap: 4px;
        font-size: 12px;
      }
      .tr-screen-result .tr-sr-score-label {
        color: var(--text-muted);
        font-weight: 500;
      }
      .tr-diff-block {
        background: var(--bg-glass);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        padding: 12px;
        margin-bottom: 8px;
        font-size: 12px;
        font-family: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace;
        white-space: pre-wrap;
        word-break: break-all;
        max-height: 200px;
        overflow-y: auto;
        color: var(--text-secondary);
      }

      /* Section card test badge */
      .tr-section-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 10px;
        line-height: 1.4;
        cursor: pointer;
        transition: opacity var(--transition-fast);
      }
      .tr-section-badge:hover { opacity: 0.8; }
      .tr-section-badge.pass {
        background: var(--success-bg);
        color: var(--success);
      }
      .tr-section-badge.fail {
        background: var(--danger-bg);
        color: var(--danger);
      }

      /* Run test button injected into section cards */
      .tr-run-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .tr-run-btn svg { vertical-align: -1px; }

      /* Spinner */
      @keyframes tr-spin {
        to { transform: rotate(360deg); }
      }
      .tr-spin { animation: tr-spin 1s linear infinite; }

      /* Progress bar */
      .tr-progress-bar {
        height: 4px;
        border-radius: 2px;
        background: var(--bg-glass);
        overflow: hidden;
        margin-top: 8px;
      }
      .tr-progress-fill {
        height: 100%;
        border-radius: 2px;
        background: var(--accent-gradient);
        transition: width 0.3s ease;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .test-runner-stats { grid-template-columns: repeat(2, 1fr); }
        .tr-config-grid { grid-template-columns: 1fr; }
        .tr-detail-summary { grid-template-columns: repeat(2, 1fr); }
        .tr-table { font-size: 12px; }
        .test-runner-container { padding: 16px; gap: 16px; }
      }
      @media (max-width: 480px) {
        .test-runner-stats { grid-template-columns: 1fr; }
        .tr-stat-value { font-size: 24px; }
        .tr-detail-summary { grid-template-columns: 1fr 1fr; }
      }
    `;
    document.head.appendChild(style);
  },

  // ---------------------------------------------------------------------------
  //  Tab Setup (integrated into Testing tab)
  // ---------------------------------------------------------------------------
  _addTab() {
    // Testing tab is now static in HTML, no need to create a tab button.
    // Just ensure the content area exists.
  },

  _activateTab() {
    // Activate the Testing parent tab
    const testingBtn = document.querySelector('.tab-btn[data-tab="testing"]');
    if (testingBtn) testingBtn.click();

    // Activate the Runner sub-tab
    const runnerSubBtn = document.querySelector('#testingSubtabs .subtab-btn[data-subtab="runner"]');
    if (runnerSubBtn) runnerSubBtn.click();

    if (state) state.activeTab = 'testing';

    // Load data
    this.renderTab();
    this.loadStatistics();
    this.loadHistory(1);
  },

  // ---------------------------------------------------------------------------
  //  Tab Content Creation
  // ---------------------------------------------------------------------------
  _createTabContent() {
    // Content renders into #testRunnerContent inside the Testing tab (static HTML).
    // No need to create a new tab content div.
  },

  // ---------------------------------------------------------------------------
  //  Render Full Tab
  // ---------------------------------------------------------------------------
  renderTab() {
    const tab = document.getElementById('testRunnerContent');
    if (!tab) return;

    const stats = this.statistics || {};
    const total = stats.total || 0;
    const passed = stats.passed || 0;
    const failed = stats.failed || 0;
    const rate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

    tab.innerHTML = `
      <div class="test-runner-container">
        <!-- Header -->
        <div class="tr-header">
          <div class="tr-header-title">
            ${this.icons.testRunner}
            <span>Test Runner</span>
          </div>
          <div class="tr-header-actions">
            <button class="btn btn-secondary btn-sm" id="trRefreshBtn" title="Refresh data">
              ${this.icons.refresh} Refresh
            </button>
            <button class="btn btn-primary btn-sm" id="trRunAllBtn" ${this.isRunning ? 'disabled' : ''}>
              ${this.isRunning ? this.icons.running : this.icons.play}
              ${this.isRunning
        ? 'Running (' + this.runProgress.current + '/' + this.runProgress.total + ')...'
        : 'Run All Tests'}
            </button>
          </div>
        </div>

        <!-- Stats Row -->
        <div class="test-runner-stats">
          <div class="tr-stat-card tr-stat-total">
            <div class="tr-stat-value color-accent" id="trStatTotal">${total}</div>
            <div class="tr-stat-label">Total Tests</div>
          </div>
          <div class="tr-stat-card tr-stat-passed">
            <div class="tr-stat-value color-success" id="trStatPassed">${passed}</div>
            <div class="tr-stat-label">Passed</div>
          </div>
          <div class="tr-stat-card tr-stat-failed">
            <div class="tr-stat-value color-danger" id="trStatFailed">${failed}</div>
            <div class="tr-stat-label">Failed</div>
          </div>
          <div class="tr-stat-card tr-stat-rate">
            <div class="tr-stat-value color-info" id="trStatRate">${rate}%</div>
            <div class="tr-stat-label">Pass Rate</div>
          </div>
        </div>

        <!-- Config Panel -->
        <div class="test-runner-config">
          <div class="tr-config-header" id="trConfigToggle">
            <div class="tr-config-header-left">
              ${this.icons.settings}
              <span>Test Configuration</span>
            </div>
            <span class="tr-config-toggle" id="trConfigArrow">${this.icons.chevronDown}</span>
          </div>
          <div class="tr-config-body" id="trConfigBody">
            <div class="tr-config-grid">
              <div class="tr-threshold-group">
                <label>DOM Similarity Threshold</label>
                <div class="tr-slider-row">
                  <input type="range" min="0" max="100" value="${this.thresholds.dom}" id="trThresholdDom">
                  <span class="tr-threshold-val" id="trThresholdDomVal">${this.thresholds.dom}%</span>
                </div>
              </div>
              <div class="tr-threshold-group">
                <label>API Match Threshold</label>
                <div class="tr-slider-row">
                  <input type="range" min="0" max="100" value="${this.thresholds.api}" id="trThresholdApi">
                  <span class="tr-threshold-val" id="trThresholdApiVal">${this.thresholds.api}%</span>
                </div>
              </div>
              <div class="tr-threshold-group">
                <label>Visual Similarity Threshold</label>
                <div class="tr-slider-row">
                  <input type="range" min="0" max="100" value="${this.thresholds.visual}" id="trThresholdVisual">
                  <span class="tr-threshold-val" id="trThresholdVisualVal">${this.thresholds.visual}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- History Table -->
        <div class="test-runner-history">
          <div class="tr-history-header">
            <span class="tr-history-title">Test History</span>
            <span style="font-size:12px; color: var(--text-muted);" id="trHistoryCount"></span>
          </div>
          <div class="tr-table-wrap">
            <table class="tr-table">
              <thead>
                <tr>
                  <th style="width:40px;text-align:center;">Status</th>
                  <th>Section</th>
                  <th>DOM</th>
                  <th>API</th>
                  <th>Visual</th>
                  <th>Overall</th>
                  <th>Date</th>
                  <th style="text-align:right;">Actions</th>
                </tr>
              </thead>
              <tbody id="trTableBody">
                <tr class="tr-empty-row"><td colspan="8">No test results yet</td></tr>
              </tbody>
            </table>
          </div>
          <div class="tr-pagination" id="trPagination" style="display:none;"></div>
        </div>

        ${this.isRunning ? `
        <div class="tr-progress-bar">
          <div class="tr-progress-fill" style="width: ${this.runProgress.total > 0 ? ((this.runProgress.current / this.runProgress.total) * 100) : 0}%"></div>
        </div>
        ` : ''}
      </div>
    `;

    this._bindTabEvents();
  },

  // ---------------------------------------------------------------------------
  //  Tab Event Bindings
  // ---------------------------------------------------------------------------
  _bindTabEvents() {
    // Run All Tests
    const runAllBtn = document.getElementById('trRunAllBtn');
    if (runAllBtn) {
      runAllBtn.addEventListener('click', () => this.runAllTests());
    }

    // Refresh
    const refreshBtn = document.getElementById('trRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadStatistics();
        this.loadHistory(this.currentPage);
      });
    }

    // Config toggle
    const configToggle = document.getElementById('trConfigToggle');
    if (configToggle) {
      configToggle.addEventListener('click', () => {
        const body = document.getElementById('trConfigBody');
        const arrow = document.getElementById('trConfigArrow');
        if (body && arrow) {
          body.classList.toggle('open');
          arrow.classList.toggle('open');
        }
      });
    }

    // Threshold sliders
    this._bindSlider('trThresholdDom', 'trThresholdDomVal', 'dom');
    this._bindSlider('trThresholdApi', 'trThresholdApiVal', 'api');
    this._bindSlider('trThresholdVisual', 'trThresholdVisualVal', 'visual');
  },

  _bindSlider(sliderId, valId, key) {
    const slider = document.getElementById(sliderId);
    const val = document.getElementById(valId);
    if (!slider || !val) return;

    slider.addEventListener('input', () => {
      const v = parseInt(slider.value, 10);
      val.textContent = v + '%';
      this.thresholds[key] = v;
      try {
        localStorage.setItem('mapit-test-thresholds', JSON.stringify(this.thresholds));
      } catch (_) { /* ignore */ }
    });
  },

  // ---------------------------------------------------------------------------
  //  Run Single Test
  // ---------------------------------------------------------------------------
  async runTest(sectionTimestamp, _skipRunningCheck) {
    if (!state || !state.currentProject) {
      if (typeof showToast === 'function') {
        showToast('Please select a project first', 'warning');
      }
      return null;
    }
    if (!_skipRunningCheck && this.isRunning) {
      if (typeof showToast === 'function') {
        showToast('A test is already running', 'warning');
      }
      return null;
    }

    this.runningSection = sectionTimestamp;
    this._updateSectionBadge(sectionTimestamp, 'running');

    try {
      const result = await api.fetch('/api/test-runner/run', {
        method: 'POST',
        body: JSON.stringify({
          projectName: state.currentProject,
          sectionTimestamp: sectionTimestamp,
          threshold: {
            dom: this.thresholds.dom,
            api: this.thresholds.api,
            visual: this.thresholds.visual
          }
        })
      });

      const passed = result && result.passed;
      if (typeof showToast === 'function' && typeof formatTimestamp === 'function') {
        showToast(
          'Test ' + (passed ? 'PASSED' : 'FAILED') + ' for section ' + formatTimestamp(sectionTimestamp),
          passed ? 'success' : 'error'
        );
      }

      this._updateSectionBadge(sectionTimestamp, passed ? 'pass' : 'fail', result);

      // Refresh history if tab is active
      if (document.getElementById('testRunnerContent') &&
        document.getElementById('testRunnerContent').classList.contains('active')) {
        this.loadStatistics();
        this.loadHistory(1);
      }

      return result;
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast('Test failed: ' + (err.message || 'Unknown error'), 'error');
      }
      this._updateSectionBadge(sectionTimestamp, 'fail');
      return null;
    } finally {
      this.runningSection = null;
    }
  },

  // ---------------------------------------------------------------------------
  //  Run All Tests
  // ---------------------------------------------------------------------------
  async runAllTests() {
    if (!state.currentProject) {
      showToast('Please select a project first', 'warning');
      return;
    }
    if (this.isRunning) {
      showToast('Tests are already running', 'warning');
      return;
    }

    const sections = (state.sections || []).filter(s => !s.timestamp.includes('_replay'));
    if (sections.length === 0) {
      showToast('No sections to test', 'warning');
      return;
    }

    this.isRunning = true;
    this.runProgress = { current: 0, total: sections.length };
    this.renderTab();

    let passCount = 0;
    let failCount = 0;

    for (let i = 0; i < sections.length; i++) {
      this.runProgress.current = i + 1;
      this._updateRunProgress();

      const result = await this.runTest(sections[i].timestamp, true);
      if (result && result.passed) {
        passCount++;
      } else {
        failCount++;
      }
    }

    this.isRunning = false;
    this.runProgress = { current: 0, total: 0 };

    showToast(
      'All tests completed: ' + passCount + ' passed, ' + failCount + ' failed',
      failCount === 0 ? 'success' : 'warning'
    );

    this.loadStatistics();
    this.loadHistory(1);
    this.renderTab();
  },

  _updateRunProgress() {
    const btn = document.getElementById('trRunAllBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = this.icons.running +
        ' Running (' + this.runProgress.current + '/' + this.runProgress.total + ')...';
    }
    const progressFill = document.querySelector('.tr-progress-fill');
    if (progressFill && this.runProgress.total > 0) {
      progressFill.style.width = ((this.runProgress.current / this.runProgress.total) * 100) + '%';
    }
  },

  // ---------------------------------------------------------------------------
  //  Load History
  // ---------------------------------------------------------------------------
  async loadHistory(page) {
    if (!state || !state.currentProject) {
      console.log('TestRunnerUI: No project selected');
      return;
    }

    this.currentPage = page || 1;

    try {
      const data = await api.fetch(
        '/api/test-runner/' + encodeURIComponent(state.currentProject) +
        '/results?page=' + this.currentPage + '&limit=' + this.pageSize
      );

      if (data && data.success !== false) {
        this.testHistory = data.results || data.data || [];
        this.totalPages = data.totalPages || data.pages || 1;

        this._renderHistoryTable();
        this._renderPagination();

        const countEl = document.getElementById('trHistoryCount');
        if (countEl) {
          const total = data.total || data.totalCount || this.testHistory.length;
          countEl.textContent = total + ' result' + (total !== 1 ? 's' : '');
        }
      } else {
        // No data or error response
        this.testHistory = [];
        this.totalPages = 1;
        this._renderHistoryTable();
      }
    } catch (err) {
      console.error('TestRunnerUI.loadHistory error:', err);
      // Silently fail - API might not be ready yet
      this.testHistory = [];
      this.totalPages = 1;
      this._renderHistoryTable();
    }
  },

  _renderHistoryTable() {
    const tbody = document.getElementById('trTableBody');
    if (!tbody) return;

    if (!this.testHistory || this.testHistory.length === 0) {
      tbody.innerHTML = '<tr class="tr-empty-row"><td colspan="8">No test results yet</td></tr>';
      return;
    }

    tbody.innerHTML = this.testHistory.map(test => {
      const passed = test.passed;
      const statusIcon = passed ? this.icons.check : this.icons.cross;
      const domScore = this.formatScore(test.domScore);
      const apiScore = this.formatScore(test.apiScore);
      const visualScore = this.formatScore(test.visualScore);
      const overallScore = this.formatScore(test.overallScore);
      const sectionName = test.sectionName || formatTimestamp(test.sectionTimestamp || '');
      const dateStr = test.createdAt
        ? new Date(test.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '--';
      const testId = test.id || test._id || '';

      return `
        <tr data-test-id="${testId}" onclick="TestRunnerUI.showTestDetail('${testId}')">
          <td class="td-status">${statusIcon}</td>
          <td class="td-section" title="${sectionName}">${sectionName}</td>
          <td class="td-score" style="color:${this.getScoreColor(test.domScore)}">${domScore}</td>
          <td class="td-score" style="color:${this.getScoreColor(test.apiScore)}">${apiScore}</td>
          <td class="td-score" style="color:${this.getScoreColor(test.visualScore)}">${visualScore}</td>
          <td class="td-score" style="color:${this.getScoreColor(test.overallScore)}; font-weight:700;">${overallScore}</td>
          <td>${dateStr}</td>
          <td class="td-actions">
            <button class="tr-action-btn" onclick="event.stopPropagation(); TestRunnerUI.showTestDetail('${testId}')" title="View details">
              ${this.icons.eye}
            </button>
            <button class="tr-action-btn btn-delete" onclick="event.stopPropagation(); TestRunnerUI.deleteTest('${testId}')" title="Delete">
              ${this.icons.trash}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  _renderPagination() {
    const pag = document.getElementById('trPagination');
    if (!pag) return;

    if (this.totalPages <= 1) {
      pag.style.display = 'none';
      return;
    }

    pag.style.display = 'flex';
    let html = '';

    // Previous
    html += `<button class="tr-page-btn" ${this.currentPage <= 1 ? 'disabled' : ''} onclick="TestRunnerUI.loadHistory(${this.currentPage - 1})">${this.icons.chevronLeft}</button>`;

    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      html += `<button class="tr-page-btn" onclick="TestRunnerUI.loadHistory(1)">1</button>`;
      if (startPage > 2) {
        html += `<span class="tr-page-info">...</span>`;
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="tr-page-btn ${i === this.currentPage ? 'active' : ''}" onclick="TestRunnerUI.loadHistory(${i})">${i}</button>`;
    }

    if (endPage < this.totalPages) {
      if (endPage < this.totalPages - 1) {
        html += `<span class="tr-page-info">...</span>`;
      }
      html += `<button class="tr-page-btn" onclick="TestRunnerUI.loadHistory(${this.totalPages})">${this.totalPages}</button>`;
    }

    // Next
    html += `<button class="tr-page-btn" ${this.currentPage >= this.totalPages ? 'disabled' : ''} onclick="TestRunnerUI.loadHistory(${this.currentPage + 1})">${this.icons.chevronRight}</button>`;

    pag.innerHTML = html;
  },

  // ---------------------------------------------------------------------------
  //  Load Statistics
  // ---------------------------------------------------------------------------
  async loadStatistics() {
    if (!state || !state.currentProject) {
      console.log('TestRunnerUI: No project selected');
      return;
    }

    try {
      const data = await api.fetch(
        '/api/test-runner/' + encodeURIComponent(state.currentProject) + '/statistics'
      );

      if (data && data.success !== false) {
        this.statistics = data;
        this._updateStatCards();
      } else {
        // No data or error response
        this.statistics = { total: 0, passed: 0, failed: 0 };
        this._updateStatCards();
      }
    } catch (err) {
      console.error('TestRunnerUI.loadStatistics error:', err);
      // Set default values on error
      this.statistics = { total: 0, passed: 0, failed: 0 };
      this._updateStatCards();
    }
  },

  _updateStatCards() {
    const stats = this.statistics || {};
    const total = stats.total || 0;
    const passed = stats.passed || 0;
    const failed = stats.failed || 0;
    const rate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

    const elTotal = document.getElementById('trStatTotal');
    const elPassed = document.getElementById('trStatPassed');
    const elFailed = document.getElementById('trStatFailed');
    const elRate = document.getElementById('trStatRate');

    if (elTotal) elTotal.textContent = total;
    if (elPassed) elPassed.textContent = passed;
    if (elFailed) elFailed.textContent = failed;
    if (elRate) elRate.textContent = rate + '%';
  },

  // ---------------------------------------------------------------------------
  //  Test Detail Modal
  // ---------------------------------------------------------------------------
  showTestDetail(testId) {
    if (!testId || !state.currentProject) return;

    // Find in cache first
    const cached = this.testHistory.find(t => (t.id || t._id) === testId);

    if (cached) {
      this._renderDetailModal(cached);
    }

    // Also fetch fresh data
    api.fetch(
      '/api/test-runner/' + encodeURIComponent(state.currentProject) + '/results/' + encodeURIComponent(testId)
    ).then(data => {
      if (data) this._renderDetailModal(data);
    }).catch(err => {
      if (!cached) {
        showToast('Failed to load test details: ' + (err.message || 'Unknown error'), 'error');
      }
    });
  },

  _renderDetailModal(test) {
    // Remove existing modal
    const existing = document.getElementById('trDetailModal');
    if (existing) existing.remove();

    const passed = test.passed;
    const sectionName = test.sectionName || formatTimestamp(test.sectionTimestamp || '');
    const dateStr = test.createdAt
      ? new Date(test.createdAt).toLocaleString('vi-VN')
      : '--';

    // Build screen results
    let screenResultsHtml = '';
    const screens = test.screens || test.screenResults || [];
    if (screens.length > 0) {
      screenResultsHtml = screens.map(screen => {
        const sPassed = screen.passed;
        return `
          <div class="tr-screen-result">
            <div class="tr-sr-icon">${sPassed ? this.icons.check : this.icons.cross}</div>
            <div class="tr-sr-name" title="${screen.path || screen.name || ''}">${screen.name || screen.path || 'Unknown'}</div>
            <div class="tr-sr-scores">
              <div class="tr-sr-score-item">
                <span class="tr-sr-score-label">DOM</span>
                <span style="color:${this.getScoreColor(screen.domScore)}">${this.formatScore(screen.domScore)}</span>
              </div>
              <div class="tr-sr-score-item">
                <span class="tr-sr-score-label">API</span>
                <span style="color:${this.getScoreColor(screen.apiScore)}">${this.formatScore(screen.apiScore)}</span>
              </div>
              <div class="tr-sr-score-item">
                <span class="tr-sr-score-label">Visual</span>
                <span style="color:${this.getScoreColor(screen.visualScore)}">${this.formatScore(screen.visualScore)}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      screenResultsHtml = '<div style="padding:12px; color:var(--text-muted); font-size:13px;">No per-screen data available</div>';
    }

    // Build DOM diff summary
    let domDiffHtml = '';
    if (test.domDiff) {
      const dd = test.domDiff;
      domDiffHtml = `
        <div class="tr-detail-section-block">
          <div class="tr-detail-section-title">DOM Differences</div>
          <div class="tr-diff-block">${this._escapeHtml(typeof dd === 'string' ? dd : JSON.stringify(dd, null, 2))}</div>
        </div>
      `;
    }

    // Build API diff summary
    let apiDiffHtml = '';
    if (test.apiDiff) {
      const ad = test.apiDiff;
      apiDiffHtml = `
        <div class="tr-detail-section-block">
          <div class="tr-detail-section-title">API Differences</div>
          <div class="tr-diff-block">${this._escapeHtml(typeof ad === 'string' ? ad : JSON.stringify(ad, null, 2))}</div>
        </div>
      `;
    }

    // Build visual comparison
    let visualHtml = '';
    if (test.visualDiff || test.visualComparison) {
      const vd = test.visualDiff || test.visualComparison;
      if (typeof vd === 'string' && (vd.startsWith('/') || vd.startsWith('http'))) {
        visualHtml = `
          <div class="tr-detail-section-block">
            <div class="tr-detail-section-title">Visual Comparison</div>
            <div style="text-align:center; padding:12px;">
              <img src="${vd}" alt="Visual diff" style="max-width:100%; border-radius:var(--border-radius-sm); border:1px solid var(--border-color);">
            </div>
          </div>
        `;
      } else {
        visualHtml = `
          <div class="tr-detail-section-block">
            <div class="tr-detail-section-title">Visual Comparison</div>
            <div class="tr-diff-block">${this._escapeHtml(typeof vd === 'string' ? vd : JSON.stringify(vd, null, 2))}</div>
          </div>
        `;
      }
    }

    const overlay = document.createElement('div');
    overlay.id = 'trDetailModal';
    overlay.className = 'tr-modal-overlay';
    overlay.innerHTML = `
      <div class="tr-modal">
        <div class="tr-modal-header">
          <div class="tr-modal-title">
            ${passed ? this.icons.check : this.icons.cross}
            <span>Test Result: ${sectionName}</span>
          </div>
          <button class="tr-modal-close" id="trModalClose" title="Close">${this.icons.close}</button>
        </div>
        <div class="tr-modal-body">
          <!-- Summary -->
          <div class="tr-detail-summary">
            <div class="tr-detail-stat">
              <div class="tr-detail-stat-value" style="color:${this.getScoreColor(test.domScore)}">${this.formatScore(test.domScore)}</div>
              <div class="tr-detail-stat-label">DOM</div>
            </div>
            <div class="tr-detail-stat">
              <div class="tr-detail-stat-value" style="color:${this.getScoreColor(test.apiScore)}">${this.formatScore(test.apiScore)}</div>
              <div class="tr-detail-stat-label">API</div>
            </div>
            <div class="tr-detail-stat">
              <div class="tr-detail-stat-value" style="color:${this.getScoreColor(test.visualScore)}">${this.formatScore(test.visualScore)}</div>
              <div class="tr-detail-stat-label">Visual</div>
            </div>
            <div class="tr-detail-stat">
              <div class="tr-detail-stat-value" style="color:${this.getScoreColor(test.overallScore)}; font-weight:700;">${this.formatScore(test.overallScore)}</div>
              <div class="tr-detail-stat-label">Overall</div>
            </div>
          </div>

          <div style="font-size:12px; color:var(--text-muted); margin-bottom:16px;">
            Tested on ${dateStr}
            ${test.thresholds ? ' | Thresholds: DOM ' + test.thresholds.dom + '%, API ' + test.thresholds.api + '%, Visual ' + test.thresholds.visual + '%' : ''}
          </div>

          <!-- Per-Screen Results -->
          <div class="tr-detail-section-block">
            <div class="tr-detail-section-title">
              Per-Screen Results
              <span style="font-size:11px; font-weight:400; color:var(--text-muted);">(${screens.length} screen${screens.length !== 1 ? 's' : ''})</span>
            </div>
            ${screenResultsHtml}
          </div>

          ${domDiffHtml}
          ${apiDiffHtml}
          ${visualHtml}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close handlers
    const closeBtn = document.getElementById('trModalClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => overlay.remove());
    }
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    // ESC to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  },

  // ---------------------------------------------------------------------------
  //  Delete Test
  // ---------------------------------------------------------------------------
  async deleteTest(testId) {
    if (!testId || !state.currentProject) return;

    if (!confirm('Delete this test result?')) return;

    try {
      await api.fetch(
        '/api/test-runner/' + encodeURIComponent(state.currentProject) +
        '/results/' + encodeURIComponent(testId),
        { method: 'DELETE' }
      );

      showToast('Test result deleted', 'success');

      // Close detail modal if open
      const modal = document.getElementById('trDetailModal');
      if (modal) modal.remove();

      this.loadStatistics();
      this.loadHistory(this.currentPage);
    } catch (err) {
      showToast('Failed to delete: ' + (err.message || 'Unknown error'), 'error');
    }
  },

  // ---------------------------------------------------------------------------
  //  Section Card Integration
  // ---------------------------------------------------------------------------
  _observeSectionCards() {
    // Use MutationObserver to inject test buttons when sections are rendered
    const sectionsList = document.getElementById('sectionsList');
    if (!sectionsList) return;

    const observer = new MutationObserver(() => {
      this.injectTestButtons();
    });

    observer.observe(sectionsList, { childList: true, subtree: true });

    // Initial injection
    this.injectTestButtons();
  },

  injectTestButtons() {
    const sectionCards = document.querySelectorAll('.section-card');

    sectionCards.forEach(card => {
      // Skip replay sections
      if (card.classList.contains('replay-section')) return;

      // Skip if already injected
      if (card.querySelector('.tr-run-btn')) return;

      // Find the section actions container
      const actionsEl = card.querySelector('.section-actions');
      if (!actionsEl) return;

      // Get section timestamp from existing buttons
      const existingBtn = actionsEl.querySelector('[data-timestamp]');
      if (!existingBtn) return;
      const timestamp = existingBtn.getAttribute('data-timestamp');

      // Create test run button
      const btn = document.createElement('button');
      btn.className = 'section-action-btn section-action-accent tr-run-btn';
      btn.setAttribute('data-timestamp', timestamp);
      btn.title = 'Run Regression Test';
      btn.innerHTML = `<span class="section-action-icon" style="display:inline-flex">${this.icons.play}</span><span>Test</span>`;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.runTest(timestamp);
      });

      // Insert before delete button or at the end
      const deleteBtn = actionsEl.querySelector('.delete-btn');
      if (deleteBtn) {
        actionsEl.insertBefore(btn, deleteBtn);
      } else {
        actionsEl.appendChild(btn);
      }

      // Add badge container to the section header
      const headerEl = card.querySelector('.section-header');
      if (headerEl && !headerEl.querySelector('.tr-section-badge')) {
        const badge = document.createElement('span');
        badge.className = 'tr-section-badge';
        badge.id = 'tr-badge-' + timestamp;
        badge.style.display = 'none';
        badge.addEventListener('click', (e) => {
          e.stopPropagation();
          this._activateTab();
        });
        headerEl.appendChild(badge);
      }
    });
  },

  _updateSectionBadge(timestamp, status, result) {
    const badge = document.getElementById('tr-badge-' + timestamp);
    if (!badge) return;

    badge.style.display = 'inline-flex';
    badge.className = 'tr-section-badge';

    if (status === 'running') {
      badge.innerHTML = this.icons.running + ' Testing...';
      badge.classList.add('pass'); // neutral color during run
    } else if (status === 'pass') {
      const overall = result ? this.formatScore(result.overallScore) : '';
      badge.innerHTML = '<span style="display:inline-flex">' + this.icons.check + '</span>' + (overall ? ' ' + overall : ' PASS');
      badge.classList.add('pass');
    } else {
      const overall = result ? this.formatScore(result.overallScore) : '';
      badge.innerHTML = '<span style="display:inline-flex">' + this.icons.cross + '</span>' + (overall ? ' ' + overall : ' FAIL');
      badge.classList.add('fail');
    }
  },

  // ---------------------------------------------------------------------------
  //  Project Change Listener
  // ---------------------------------------------------------------------------
  _listenForProjectChanges() {
    const projectSelect = document.getElementById('projectSelect');
    if (projectSelect) {
      projectSelect.addEventListener('change', () => {
        // Reset state when project changes
        this.testHistory = [];
        this.statistics = null;
        this.currentPage = 1;

        // Refresh if tab is active
        const tab = document.getElementById('testRunnerContent');
        if (tab && tab.classList.contains('active')) {
          this.renderTab();
          this.loadStatistics();
          this.loadHistory(1);
        }
      });
    }
  },

  // ---------------------------------------------------------------------------
  //  Helpers
  // ---------------------------------------------------------------------------
  getStatusIcon(passed) {
    return passed ? this.icons.check : this.icons.cross;
  },

  getScoreColor(score) {
    if (score === null || score === undefined) return 'var(--text-muted)';
    if (score >= 90) return 'var(--success)';
    if (score >= 70) return 'var(--warning)';
    return 'var(--danger)';
  },

  formatScore(score) {
    if (score === null || score === undefined) return '--';
    return Number(score).toFixed(1) + '%';
  },

  _escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => TestRunnerUI.init());
