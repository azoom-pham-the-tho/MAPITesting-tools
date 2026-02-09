/**
 * Comment & Annotation UI Module
 * Provides comment panel, annotation tools, and CRUD operations for screen comments.
 */

const CommentUI = {
  currentScreenId: null,
  comments: [],
  isAnnotating: false,
  annotationTool: null, // 'rectangle', 'arrow', 'text', 'highlight', 'circle', 'line'
  annotationColor: '#ff4444',
  annotations: [],
  currentAnnotation: null,
  canvasOverlay: null,
  canvasCtx: null,
  drawStart: null,
  panelVisible: false,
  filterMode: 'all', // 'all', 'open', 'resolved'
  searchQuery: '',

  // ========================================
  // SVG Icons (no emoji)
  // ========================================
  icons: {
    comment: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    add: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    reply: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>',
    trash: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    edit: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
    filter: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    chevronDown: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
    chevronUp: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>',
    resolve: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    unresolve: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>',
    annotation: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    // Annotation tools
    select: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/><path d="M13 13l6 6"/></svg>',
    rectangle: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>',
    circle: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>',
    arrow: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
    text: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
    highlight: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    line: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="19" x2="19" y2="5"/></svg>',
    save: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    cancel: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    undo: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  },

  // ========================================
  // Preset Colors
  // ========================================
  presetColors: [
    { name: 'Red', value: '#ff4444' },
    { name: 'Blue', value: '#4488ff' },
    { name: 'Green', value: '#44cc44' },
    { name: 'Yellow', value: '#ffcc00' },
    { name: 'White', value: '#ffffff' },
  ],

  // ========================================
  // Initialization
  // ========================================
  init() {
    this.injectStyles();
    this.createCommentPanel();
    this.createAnnotationToolbar();
    this.listenForScreenSelection();
  },

  // ========================================
  // Style Injection
  // ========================================
  injectStyles() {
    if (document.getElementById('comment-ui-styles')) return;
    const style = document.createElement('style');
    style.id = 'comment-ui-styles';
    style.textContent = `
      /* ---- Comment Panel ---- */
      .comment-panel {
        position: absolute;
        top: 0;
        right: 0;
        width: 320px;
        height: 100%;
        background: var(--bg-secondary);
        border-left: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
        z-index: 20;
        transition: transform var(--transition-normal);
        box-shadow: -4px 0 16px rgba(0,0,0,0.3);
      }
      .comment-panel.hidden {
        transform: translateX(100%);
        pointer-events: none;
      }

      .comment-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-tertiary);
        flex-shrink: 0;
      }
      .comment-panel-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .comment-panel-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .comment-count-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
        background: var(--accent-primary);
        color: #fff;
      }
      .comment-panel-header-right {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      /* Filter & Search Bar */
      .comment-filter-bar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--border-color);
        flex-shrink: 0;
      }
      .comment-search-input {
        flex: 1;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        padding: 5px 8px 5px 28px;
        font-size: 12px;
        color: var(--text-primary);
        outline: none;
        transition: border-color var(--transition-fast);
      }
      .comment-search-input:focus {
        border-color: var(--accent-primary);
      }
      .comment-search-wrapper {
        position: relative;
        flex: 1;
      }
      .comment-search-wrapper svg {
        position: absolute;
        left: 8px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted);
        pointer-events: none;
      }
      .comment-filter-btn {
        background: none;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        padding: 5px 8px;
        font-size: 11px;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all var(--transition-fast);
        white-space: nowrap;
      }
      .comment-filter-btn:hover {
        background: var(--bg-glass);
        border-color: var(--accent-primary);
      }
      .comment-filter-btn.active {
        background: rgba(102, 126, 234, 0.15);
        border-color: var(--accent-primary);
        color: var(--accent-primary);
      }

      /* Comment List */
      .comment-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px;
      }
      .comment-list::-webkit-scrollbar { width: 5px; }
      .comment-list::-webkit-scrollbar-track { background: transparent; }
      .comment-list::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }

      .comment-list-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        color: var(--text-muted);
        font-size: 13px;
        text-align: center;
      }
      .comment-list-empty svg {
        margin-bottom: 12px;
        opacity: 0.4;
      }

      /* Comment Item */
      .comment-item {
        padding: 10px;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        margin-bottom: 8px;
        background: var(--bg-primary);
        transition: border-color var(--transition-fast);
      }
      .comment-item:hover {
        border-color: rgba(102, 126, 234, 0.3);
      }
      .comment-item.resolved {
        opacity: 0.6;
      }
      .comment-item.resolved .comment-content-text {
        text-decoration: line-through;
        color: var(--text-muted);
      }

      .comment-item-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
      }
      .comment-avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
        color: #fff;
        flex-shrink: 0;
        text-transform: uppercase;
      }
      .comment-meta {
        flex: 1;
        min-width: 0;
      }
      .comment-author {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-primary);
      }
      .comment-time {
        font-size: 10px;
        color: var(--text-muted);
      }
      .comment-item-actions {
        display: flex;
        gap: 2px;
        opacity: 0;
        transition: opacity var(--transition-fast);
      }
      .comment-item:hover .comment-item-actions {
        opacity: 1;
      }
      .comment-action-btn {
        background: none;
        border: none;
        padding: 4px;
        cursor: pointer;
        color: var(--text-muted);
        border-radius: 4px;
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .comment-action-btn:hover {
        background: var(--bg-glass);
        color: var(--text-primary);
      }
      .comment-action-btn.resolve-btn:hover {
        color: var(--success);
      }
      .comment-action-btn.delete-btn:hover {
        color: var(--danger);
      }

      .comment-content-text {
        font-size: 13px;
        color: var(--text-secondary);
        line-height: 1.5;
        margin-bottom: 6px;
        word-break: break-word;
      }

      .comment-annotations-indicator {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 10px;
        color: var(--accent-primary);
        padding: 2px 6px;
        background: rgba(102, 126, 234, 0.1);
        border-radius: 4px;
        margin-bottom: 6px;
        cursor: pointer;
      }
      .comment-annotations-indicator:hover {
        background: rgba(102, 126, 234, 0.2);
      }

      .comment-footer {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 4px;
      }
      .comment-reply-toggle {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: var(--text-muted);
        cursor: pointer;
        background: none;
        border: none;
        padding: 2px 4px;
        border-radius: 4px;
        transition: all var(--transition-fast);
      }
      .comment-reply-toggle:hover {
        color: var(--accent-primary);
        background: rgba(102, 126, 234, 0.1);
      }

      /* Replies */
      .comment-replies {
        margin-top: 8px;
        padding-left: 16px;
        border-left: 2px solid var(--border-color);
        display: none;
      }
      .comment-replies.expanded {
        display: block;
      }
      .comment-reply-item {
        padding: 8px 0;
        border-bottom: 1px solid rgba(255,255,255,0.03);
      }
      .comment-reply-item:last-child {
        border-bottom: none;
      }
      .comment-reply-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 4px;
      }
      .comment-reply-avatar {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        color: #fff;
        flex-shrink: 0;
        text-transform: uppercase;
      }
      .comment-reply-text {
        font-size: 12px;
        color: var(--text-secondary);
        line-height: 1.4;
      }
      .comment-reply-actions {
        display: flex;
        gap: 2px;
        opacity: 0;
        transition: opacity var(--transition-fast);
        margin-left: auto;
      }
      .comment-reply-item:hover .comment-reply-actions {
        opacity: 1;
      }

      /* Reply Form */
      .comment-reply-form {
        display: none;
        margin-top: 8px;
        padding-left: 16px;
      }
      .comment-reply-form.visible {
        display: flex;
        gap: 6px;
      }
      .comment-reply-form input {
        flex: 1;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        padding: 5px 8px;
        font-size: 12px;
        color: var(--text-primary);
        outline: none;
      }
      .comment-reply-form input:focus {
        border-color: var(--accent-primary);
      }
      .comment-reply-form button {
        background: var(--accent-primary);
        border: none;
        border-radius: var(--border-radius-sm);
        padding: 5px 10px;
        font-size: 11px;
        color: #fff;
        cursor: pointer;
        white-space: nowrap;
      }
      .comment-reply-form button:hover {
        opacity: 0.9;
      }

      /* Add Comment Form (bottom) */
      .comment-add-form {
        padding: 10px 12px;
        border-top: 1px solid var(--border-color);
        background: var(--bg-tertiary);
        flex-shrink: 0;
      }
      .comment-add-form textarea {
        width: 100%;
        min-height: 60px;
        max-height: 120px;
        resize: vertical;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        padding: 8px;
        font-size: 12px;
        color: var(--text-primary);
        font-family: inherit;
        outline: none;
        transition: border-color var(--transition-fast);
      }
      .comment-add-form textarea:focus {
        border-color: var(--accent-primary);
      }
      .comment-add-form-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 8px;
      }
      .comment-add-form-left {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .comment-annotate-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: none;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        padding: 4px 8px;
        font-size: 11px;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all var(--transition-fast);
      }
      .comment-annotate-btn:hover {
        border-color: var(--accent-primary);
        color: var(--accent-primary);
      }
      .comment-annotate-btn.has-annotations {
        border-color: var(--accent-primary);
        color: var(--accent-primary);
        background: rgba(102, 126, 234, 0.1);
      }
      .comment-submit-btn {
        background: var(--accent-primary);
        border: none;
        border-radius: var(--border-radius-sm);
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 500;
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: opacity var(--transition-fast);
      }
      .comment-submit-btn:hover {
        opacity: 0.9;
      }
      .comment-submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Toggle Comment Panel Button */
      .comment-toggle-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 15;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        padding: 6px 10px;
        font-size: 12px;
        color: var(--text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all var(--transition-fast);
        box-shadow: var(--shadow-sm);
      }
      .comment-toggle-btn:hover {
        border-color: var(--accent-primary);
        color: var(--accent-primary);
      }
      .comment-toggle-btn .comment-toggle-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 9px;
        font-size: 10px;
        font-weight: 700;
        background: var(--accent-primary);
        color: #fff;
      }

      /* ---- Annotation Toolbar ---- */
      .annotation-toolbar {
        position: absolute;
        top: 44px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 25;
        display: none;
        align-items: center;
        gap: 4px;
        padding: 6px 8px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-md);
      }
      .annotation-toolbar.visible {
        display: flex;
      }
      .annotation-toolbar-separator {
        width: 1px;
        height: 24px;
        background: var(--border-color);
        margin: 0 4px;
      }
      .annotation-tool-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: none;
        border: 1px solid transparent;
        border-radius: 6px;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all var(--transition-fast);
      }
      .annotation-tool-btn:hover {
        background: var(--bg-glass);
        border-color: var(--border-color);
        color: var(--text-primary);
      }
      .annotation-tool-btn.active {
        background: rgba(102, 126, 234, 0.15);
        border-color: var(--accent-primary);
        color: var(--accent-primary);
      }
      .annotation-tool-btn[title]::after {
        content: attr(title);
      }

      .annotation-color-btn {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 2px solid transparent;
        cursor: pointer;
        transition: all var(--transition-fast);
      }
      .annotation-color-btn:hover {
        transform: scale(1.15);
      }
      .annotation-color-btn.active {
        border-color: var(--text-primary);
        box-shadow: 0 0 0 2px var(--bg-secondary), 0 0 0 4px currentColor;
      }

      .annotation-action-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 5px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: opacity var(--transition-fast);
      }
      .annotation-action-btn:hover { opacity: 0.85; }
      .annotation-action-btn.save {
        background: var(--success);
        color: #000;
      }
      .annotation-action-btn.cancel {
        background: var(--danger);
        color: #fff;
      }
      .annotation-action-btn.undo {
        background: var(--bg-glass);
        color: var(--text-secondary);
        border: 1px solid var(--border-color);
      }

      /* ---- Annotation Canvas Overlay ---- */
      .annotation-canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 22;
        cursor: crosshair;
      }

      /* ---- Annotation SVG Overlay (for saved annotations) ---- */
      .annotation-svg-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10;
        pointer-events: none;
      }

      /* ---- Tree Node Comment Badge ---- */
      .tree-node-comment-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: 8px;
        font-size: 9px;
        font-weight: 700;
        background: var(--accent-primary);
        color: #fff;
        margin-left: 4px;
        vertical-align: middle;
      }

      /* ---- Annotation text input popup ---- */
      .annotation-text-input-popup {
        position: absolute;
        z-index: 30;
        display: flex;
        gap: 4px;
      }
      .annotation-text-input-popup input {
        padding: 4px 8px;
        font-size: 12px;
        border: 1px solid var(--accent-primary);
        border-radius: 4px;
        background: var(--bg-primary);
        color: var(--text-primary);
        outline: none;
        min-width: 120px;
      }
      .annotation-text-input-popup button {
        padding: 4px 8px;
        font-size: 11px;
        border: none;
        border-radius: 4px;
        background: var(--accent-primary);
        color: #fff;
        cursor: pointer;
      }

      /* Edit form for inline comment editing */
      .comment-edit-form {
        margin-top: 4px;
      }
      .comment-edit-form textarea {
        width: 100%;
        min-height: 40px;
        resize: vertical;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-sm);
        padding: 6px 8px;
        font-size: 12px;
        color: var(--text-primary);
        font-family: inherit;
        outline: none;
      }
      .comment-edit-form textarea:focus {
        border-color: var(--accent-primary);
      }
      .comment-edit-form-actions {
        display: flex;
        gap: 4px;
        margin-top: 4px;
        justify-content: flex-end;
      }
      .comment-edit-form-actions button {
        padding: 3px 8px;
        font-size: 11px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      .comment-edit-form-actions .save-edit {
        background: var(--accent-primary);
        color: #fff;
      }
      .comment-edit-form-actions .cancel-edit {
        background: var(--bg-glass);
        color: var(--text-secondary);
        border: 1px solid var(--border-color);
      }
    `;
    document.head.appendChild(style);
  },

  // ========================================
  // Comment Panel
  // ========================================
  createCommentPanel() {
    const previewTab = document.getElementById('previewTab');
    if (!previewTab) return;

    // Make preview tab position relative so panel can be absolute
    previewTab.style.position = 'relative';
    previewTab.style.overflow = 'hidden';

    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'comment-toggle-btn';
    toggleBtn.id = 'commentToggleBtn';
    toggleBtn.innerHTML = this.icons.comment + ' Comments <span class="comment-toggle-badge" id="commentToggleBadge">0</span>';
    toggleBtn.addEventListener('click', () => this.togglePanel());
    previewTab.appendChild(toggleBtn);

    // Panel
    const panel = document.createElement('div');
    panel.className = 'comment-panel hidden';
    panel.id = 'commentPanel';
    panel.innerHTML = `
      <div class="comment-panel-header">
        <div class="comment-panel-header-left">
          <span class="comment-panel-title">
            ${this.icons.comment}
            Comments
            <span class="comment-count-badge" id="commentCountBadge">0</span>
          </span>
        </div>
        <div class="comment-panel-header-right">
          <button class="comment-action-btn" id="commentPanelCloseBtn" title="Close">
            ${this.icons.close}
          </button>
        </div>
      </div>

      <div class="comment-filter-bar">
        <div class="comment-search-wrapper">
          ${this.icons.search}
          <input type="text" class="comment-search-input" id="commentSearchInput" placeholder="Search comments..." />
        </div>
        <button class="comment-filter-btn active" data-filter="all">All</button>
        <button class="comment-filter-btn" data-filter="open">Open</button>
        <button class="comment-filter-btn" data-filter="resolved">Resolved</button>
      </div>

      <div class="comment-list" id="commentList">
        <div class="comment-list-empty">
          ${this.icons.comment}
          <span>No comments yet</span>
        </div>
      </div>

      <div class="comment-add-form" id="commentAddForm">
        <textarea id="commentTextarea" placeholder="Write a comment..." rows="2"></textarea>
        <div class="comment-add-form-actions">
          <div class="comment-add-form-left">
            <button class="comment-annotate-btn" id="commentAnnotateBtn" title="Add annotation">
              ${this.icons.annotation} Annotate
            </button>
          </div>
          <button class="comment-submit-btn" id="commentSubmitBtn" disabled>
            ${this.icons.add} Comment
          </button>
        </div>
      </div>
    `;
    previewTab.appendChild(panel);

    // Bind events
    document.getElementById('commentPanelCloseBtn').addEventListener('click', () => this.togglePanel());

    // Filter buttons
    panel.querySelectorAll('.comment-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('.comment-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.filterMode = btn.dataset.filter;
        this.renderComments(this.comments);
      });
    });

    // Search input
    const searchInput = document.getElementById('commentSearchInput');
    let searchTimeout = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.searchQuery = searchInput.value.trim();
        if (this.searchQuery.length > 0) {
          this.searchComments(this.searchQuery);
        } else {
          this.renderComments(this.comments);
        }
      }, 300);
    });

    // Textarea enable/disable submit
    const textarea = document.getElementById('commentTextarea');
    const submitBtn = document.getElementById('commentSubmitBtn');
    textarea.addEventListener('input', () => {
      submitBtn.disabled = textarea.value.trim().length === 0;
    });

    // Submit comment
    submitBtn.addEventListener('click', () => {
      const content = textarea.value.trim();
      if (!content) return;
      this.addComment(content, [...this.annotations]);
      textarea.value = '';
      submitBtn.disabled = true;
      this.annotations = [];
      this.updateAnnotateButton();
    });

    // Textarea Ctrl+Enter submit
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submitBtn.click();
      }
    });

    // Annotate button
    document.getElementById('commentAnnotateBtn').addEventListener('click', () => {
      if (this.isAnnotating) {
        this.stopAnnotating();
      } else {
        this.startAnnotating('rectangle');
      }
    });
  },

  togglePanel() {
    const panel = document.getElementById('commentPanel');
    if (!panel) return;
    this.panelVisible = !this.panelVisible;
    if (this.panelVisible) {
      panel.classList.remove('hidden');
      if (this.currentScreenId) {
        this.loadComments(this.currentScreenId);
      }
    } else {
      panel.classList.add('hidden');
    }
  },

  // ========================================
  // Render Comments
  // ========================================
  renderComments(comments) {
    const list = document.getElementById('commentList');
    if (!list) return;

    // Apply filter
    let filtered = comments;
    if (this.filterMode === 'open') {
      filtered = comments.filter(c => !c.resolved);
    } else if (this.filterMode === 'resolved') {
      filtered = comments.filter(c => c.resolved);
    }

    // Update badges
    this.updateBadges(comments);

    if (!filtered || filtered.length === 0) {
      const label = this.filterMode === 'all' ? 'No comments yet' :
                    this.filterMode === 'open' ? 'No open comments' : 'No resolved comments';
      list.innerHTML = `
        <div class="comment-list-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>${label}</span>
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(comment => this.renderCommentItem(comment)).join('');

    // Bind events for each comment
    filtered.forEach(comment => {
      const item = list.querySelector(`[data-comment-id="${comment.id}"]`);
      if (!item) return;

      // Reply toggle
      const replyToggle = item.querySelector('.comment-reply-toggle');
      if (replyToggle) {
        replyToggle.addEventListener('click', () => {
          const replies = item.querySelector('.comment-replies');
          const replyForm = item.querySelector('.comment-reply-form');
          if (replies) replies.classList.toggle('expanded');
          if (replyForm) replyForm.classList.toggle('visible');
          // Update icon
          const isExpanded = replies && replies.classList.contains('expanded');
          const iconSpan = replyToggle.querySelector('.reply-chevron');
          if (iconSpan) iconSpan.innerHTML = isExpanded ? this.icons.chevronUp : this.icons.chevronDown;
        });
      }

      // Reply submit
      const replyForm = item.querySelector('.comment-reply-form');
      if (replyForm) {
        const replyInput = replyForm.querySelector('input');
        const replyBtn = replyForm.querySelector('button');
        const submitReply = () => {
          const content = replyInput.value.trim();
          if (!content) return;
          this.addReply(comment.id, content);
          replyInput.value = '';
        };
        replyBtn.addEventListener('click', submitReply);
        replyInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitReply();
          }
        });
      }

      // Resolve button
      const resolveBtn = item.querySelector('.resolve-btn');
      if (resolveBtn) {
        resolveBtn.addEventListener('click', () => {
          this.resolveComment(comment.id, !comment.resolved);
        });
      }

      // Delete button
      const deleteBtn = item.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          this.deleteComment(comment.id);
        });
      }

      // Edit button
      const editBtn = item.querySelector('.edit-btn');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          this.showEditForm(comment.id, comment.content);
        });
      }

      // Annotation indicator click
      const annotationIndicator = item.querySelector('.comment-annotations-indicator');
      if (annotationIndicator) {
        annotationIndicator.addEventListener('click', () => {
          this.renderAnnotationsOnPreview(comment.annotations);
        });
      }

      // Reply delete buttons
      if (comment.replies && comment.replies.length > 0) {
        comment.replies.forEach(reply => {
          const replyDeleteBtn = item.querySelector(`[data-reply-delete="${reply.id}"]`);
          if (replyDeleteBtn) {
            replyDeleteBtn.addEventListener('click', () => {
              this.deleteReply(comment.id, reply.id);
            });
          }
          const replyEditBtn = item.querySelector(`[data-reply-edit="${reply.id}"]`);
          if (replyEditBtn) {
            replyEditBtn.addEventListener('click', () => {
              this.showReplyEditForm(comment.id, reply.id, reply.content);
            });
          }
        });
      }
    });
  },

  renderCommentItem(comment) {
    const avatarColor = this.getAvatarColor(comment.author || 'U');
    const avatarLetter = (comment.author || 'U').charAt(0).toUpperCase();
    const timeAgo = this.timeAgo(comment.createdAt || comment.timestamp);
    const replyCount = (comment.replies && comment.replies.length) || 0;
    const hasAnnotations = comment.annotations && comment.annotations.length > 0;
    const resolvedClass = comment.resolved ? ' resolved' : '';

    let repliesHtml = '';
    if (comment.replies && comment.replies.length > 0) {
      repliesHtml = comment.replies.map(reply => {
        const rAvatarColor = this.getAvatarColor(reply.author || 'U');
        const rAvatarLetter = (reply.author || 'U').charAt(0).toUpperCase();
        const rTimeAgo = this.timeAgo(reply.createdAt || reply.timestamp);
        return `
          <div class="comment-reply-item" data-reply-id="${reply.id}">
            <div class="comment-reply-header">
              <div class="comment-reply-avatar" style="background:${rAvatarColor}">${rAvatarLetter}</div>
              <span class="comment-author">${this.escapeHtml(reply.author || 'User')}</span>
              <span class="comment-time">${rTimeAgo}</span>
              <div class="comment-reply-actions">
                <button class="comment-action-btn edit-btn" data-reply-edit="${reply.id}" title="Edit">${this.icons.edit}</button>
                <button class="comment-action-btn delete-btn" data-reply-delete="${reply.id}" title="Delete">${this.icons.trash}</button>
              </div>
            </div>
            <div class="comment-reply-text" id="replyText-${reply.id}">${this.escapeHtml(reply.content)}</div>
          </div>
        `;
      }).join('');
    }

    return `
      <div class="comment-item${resolvedClass}" data-comment-id="${comment.id}">
        <div class="comment-item-header">
          <div class="comment-avatar" style="background:${avatarColor}">${avatarLetter}</div>
          <div class="comment-meta">
            <div class="comment-author">${this.escapeHtml(comment.author || 'User')}</div>
            <div class="comment-time">${timeAgo}</div>
          </div>
          <div class="comment-item-actions">
            <button class="comment-action-btn edit-btn" title="Edit">${this.icons.edit}</button>
            <button class="comment-action-btn resolve-btn" title="${comment.resolved ? 'Unresolve' : 'Resolve'}">
              ${comment.resolved ? this.icons.unresolve : this.icons.resolve}
            </button>
            <button class="comment-action-btn delete-btn" title="Delete">${this.icons.trash}</button>
          </div>
        </div>
        <div class="comment-content-text" id="commentText-${comment.id}">${this.escapeHtml(comment.content)}</div>
        ${hasAnnotations ? `
          <div class="comment-annotations-indicator">
            ${this.icons.annotation} ${comment.annotations.length} annotation${comment.annotations.length > 1 ? 's' : ''}
          </div>
        ` : ''}
        <div class="comment-footer">
          <button class="comment-reply-toggle">
            ${this.icons.reply} ${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}
            <span class="reply-chevron">${this.icons.chevronDown}</span>
          </button>
        </div>
        <div class="comment-replies${replyCount === 0 ? '' : ''}">
          ${repliesHtml}
        </div>
        <div class="comment-reply-form">
          <input type="text" placeholder="Write a reply..." />
          <button>Reply</button>
        </div>
      </div>
    `;
  },

  showEditForm(commentId, currentContent) {
    const textEl = document.getElementById(`commentText-${commentId}`);
    if (!textEl) return;
    const originalHtml = textEl.innerHTML;
    textEl.innerHTML = `
      <div class="comment-edit-form">
        <textarea id="editArea-${commentId}">${this.escapeHtml(currentContent)}</textarea>
        <div class="comment-edit-form-actions">
          <button class="cancel-edit" id="cancelEdit-${commentId}">Cancel</button>
          <button class="save-edit" id="saveEdit-${commentId}">Save</button>
        </div>
      </div>
    `;
    const editArea = document.getElementById(`editArea-${commentId}`);
    editArea.focus();

    document.getElementById(`cancelEdit-${commentId}`).addEventListener('click', () => {
      textEl.innerHTML = originalHtml;
    });
    document.getElementById(`saveEdit-${commentId}`).addEventListener('click', async () => {
      const newContent = editArea.value.trim();
      if (!newContent) return;
      await this.updateComment(commentId, newContent);
    });
  },

  showReplyEditForm(commentId, replyId, currentContent) {
    const textEl = document.getElementById(`replyText-${replyId}`);
    if (!textEl) return;
    const originalHtml = textEl.innerHTML;
    textEl.innerHTML = `
      <div class="comment-edit-form">
        <textarea id="editReplyArea-${replyId}">${this.escapeHtml(currentContent)}</textarea>
        <div class="comment-edit-form-actions">
          <button class="cancel-edit" id="cancelReplyEdit-${replyId}">Cancel</button>
          <button class="save-edit" id="saveReplyEdit-${replyId}">Save</button>
        </div>
      </div>
    `;
    const editArea = document.getElementById(`editReplyArea-${replyId}`);
    editArea.focus();

    document.getElementById(`cancelReplyEdit-${replyId}`).addEventListener('click', () => {
      textEl.innerHTML = originalHtml;
    });
    document.getElementById(`saveReplyEdit-${replyId}`).addEventListener('click', async () => {
      const newContent = editArea.value.trim();
      if (!newContent) return;
      await this.updateReply(commentId, replyId, newContent);
    });
  },

  updateBadges(comments) {
    const total = comments ? comments.length : 0;
    const badge = document.getElementById('commentCountBadge');
    if (badge) badge.textContent = total;
    const toggleBadge = document.getElementById('commentToggleBadge');
    if (toggleBadge) toggleBadge.textContent = total;
  },

  updateAnnotateButton() {
    const btn = document.getElementById('commentAnnotateBtn');
    if (!btn) return;
    if (this.annotations.length > 0) {
      btn.classList.add('has-annotations');
      btn.innerHTML = `${this.icons.annotation} ${this.annotations.length} annotation${this.annotations.length > 1 ? 's' : ''}`;
    } else {
      btn.classList.remove('has-annotations');
      btn.innerHTML = `${this.icons.annotation} Annotate`;
    }
  },

  // ========================================
  // CRUD Operations
  // ========================================
  async loadComments(screenId) {
    if (!state.currentProject || !screenId) return;
    try {
      const projectName = encodeURIComponent(state.currentProject);
      const sid = encodeURIComponent(screenId);
      const data = await api.fetch(`/api/comments/${projectName}/screens/${sid}/comments`);
      this.comments = Array.isArray(data) ? data : (data.comments || []);
      this.renderComments(this.comments);
    } catch (error) {
      console.error('CommentUI: Failed to load comments', error);
      this.comments = [];
      this.renderComments([]);
    }
  },

  async addComment(content, annotations) {
    if (!state.currentProject || !this.currentScreenId) {
      if (typeof showToast === 'function') showToast('No screen selected', 'warning');
      return;
    }
    try {
      const projectName = encodeURIComponent(state.currentProject);
      await api.fetch(`/api/comments/${projectName}/comments`, {
        method: 'POST',
        body: JSON.stringify({
          screenId: this.currentScreenId,
          content: content,
          author: 'User',
          annotations: annotations && annotations.length > 0 ? annotations : undefined,
        }),
      });
      if (typeof showToast === 'function') showToast('Comment added', 'success');
      await this.loadComments(this.currentScreenId);
    } catch (error) {
      console.error('CommentUI: Failed to add comment', error);
      if (typeof showToast === 'function') showToast('Failed to add comment', 'error');
    }
  },

  async addReply(commentId, content) {
    if (!state.currentProject) return;
    try {
      const projectName = encodeURIComponent(state.currentProject);
      const cid = encodeURIComponent(commentId);
      await api.fetch(`/api/comments/${projectName}/comments/${cid}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          content: content,
          author: 'User',
        }),
      });
      if (typeof showToast === 'function') showToast('Reply added', 'success');
      await this.loadComments(this.currentScreenId);
    } catch (error) {
      console.error('CommentUI: Failed to add reply', error);
      if (typeof showToast === 'function') showToast('Failed to add reply', 'error');
    }
  },

  async resolveComment(commentId, resolved) {
    if (!state.currentProject) return;
    try {
      const projectName = encodeURIComponent(state.currentProject);
      const cid = encodeURIComponent(commentId);
      await api.fetch(`/api/comments/${projectName}/comments/${cid}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolved: resolved }),
      });
      if (typeof showToast === 'function') showToast(resolved ? 'Comment resolved' : 'Comment reopened', 'success');
      await this.loadComments(this.currentScreenId);
    } catch (error) {
      console.error('CommentUI: Failed to resolve comment', error);
      if (typeof showToast === 'function') showToast('Failed to update comment', 'error');
    }
  },

  async deleteComment(commentId) {
    if (!state.currentProject) return;
    if (!confirm('Delete this comment?')) return;
    try {
      const projectName = encodeURIComponent(state.currentProject);
      const cid = encodeURIComponent(commentId);
      await api.fetch(`/api/comments/${projectName}/comments/${cid}`, {
        method: 'DELETE',
      });
      if (typeof showToast === 'function') showToast('Comment deleted', 'success');
      await this.loadComments(this.currentScreenId);
    } catch (error) {
      console.error('CommentUI: Failed to delete comment', error);
      if (typeof showToast === 'function') showToast('Failed to delete comment', 'error');
    }
  },

  async updateComment(commentId, content) {
    if (!state.currentProject) return;
    try {
      const projectName = encodeURIComponent(state.currentProject);
      const cid = encodeURIComponent(commentId);
      await api.fetch(`/api/comments/${projectName}/comments/${cid}`, {
        method: 'PUT',
        body: JSON.stringify({ content: content }),
      });
      if (typeof showToast === 'function') showToast('Comment updated', 'success');
      await this.loadComments(this.currentScreenId);
    } catch (error) {
      console.error('CommentUI: Failed to update comment', error);
      if (typeof showToast === 'function') showToast('Failed to update comment', 'error');
    }
  },

  async deleteReply(commentId, replyId) {
    if (!state.currentProject) return;
    if (!confirm('Delete this reply?')) return;
    try {
      const projectName = encodeURIComponent(state.currentProject);
      const cid = encodeURIComponent(commentId);
      const rid = encodeURIComponent(replyId);
      await api.fetch(`/api/comments/${projectName}/comments/${cid}/replies/${rid}`, {
        method: 'DELETE',
      });
      if (typeof showToast === 'function') showToast('Reply deleted', 'success');
      await this.loadComments(this.currentScreenId);
    } catch (error) {
      console.error('CommentUI: Failed to delete reply', error);
      if (typeof showToast === 'function') showToast('Failed to delete reply', 'error');
    }
  },

  async updateReply(commentId, replyId, content) {
    if (!state.currentProject) return;
    try {
      const projectName = encodeURIComponent(state.currentProject);
      const cid = encodeURIComponent(commentId);
      const rid = encodeURIComponent(replyId);
      await api.fetch(`/api/comments/${projectName}/comments/${cid}/replies/${rid}`, {
        method: 'PUT',
        body: JSON.stringify({ content: content }),
      });
      if (typeof showToast === 'function') showToast('Reply updated', 'success');
      await this.loadComments(this.currentScreenId);
    } catch (error) {
      console.error('CommentUI: Failed to update reply', error);
      if (typeof showToast === 'function') showToast('Failed to update reply', 'error');
    }
  },

  // ========================================
  // Search
  // ========================================
  async searchComments(query) {
    if (!state.currentProject) return;
    try {
      const projectName = encodeURIComponent(state.currentProject);
      const q = encodeURIComponent(query);
      const data = await api.fetch(`/api/comments/${projectName}/comments/search?q=${q}`);
      const results = Array.isArray(data) ? data : (data.comments || []);
      // Filter to current screen if we have one
      const filtered = this.currentScreenId
        ? results.filter(c => c.screenId === this.currentScreenId)
        : results;
      this.renderComments(filtered);
    } catch (error) {
      console.error('CommentUI: Search failed', error);
    }
  },

  // ========================================
  // Annotation Toolbar
  // ========================================
  createAnnotationToolbar() {
    const previewTab = document.getElementById('previewTab');
    if (!previewTab) return;

    const toolbar = document.createElement('div');
    toolbar.className = 'annotation-toolbar';
    toolbar.id = 'annotationToolbar';

    const tools = [
      { name: 'select', label: 'Select' },
      { name: 'rectangle', label: 'Rectangle' },
      { name: 'circle', label: 'Circle' },
      { name: 'arrow', label: 'Arrow' },
      { name: 'line', label: 'Line' },
      { name: 'text', label: 'Text' },
      { name: 'highlight', label: 'Highlight' },
    ];

    // Tool buttons
    tools.forEach(tool => {
      const btn = document.createElement('button');
      btn.className = 'annotation-tool-btn';
      btn.dataset.tool = tool.name;
      btn.title = tool.label;
      btn.innerHTML = this.icons[tool.name];
      btn.addEventListener('click', () => {
        this.selectAnnotationTool(tool.name);
      });
      toolbar.appendChild(btn);
    });

    // Separator
    const sep1 = document.createElement('div');
    sep1.className = 'annotation-toolbar-separator';
    toolbar.appendChild(sep1);

    // Color buttons
    this.presetColors.forEach(color => {
      const btn = document.createElement('button');
      btn.className = 'annotation-color-btn';
      if (color.value === this.annotationColor) btn.classList.add('active');
      btn.style.background = color.value;
      btn.style.color = color.value;
      btn.title = color.name;
      btn.dataset.color = color.value;
      btn.addEventListener('click', () => {
        toolbar.querySelectorAll('.annotation-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.annotationColor = color.value;
      });
      toolbar.appendChild(btn);
    });

    // Separator
    const sep2 = document.createElement('div');
    sep2.className = 'annotation-toolbar-separator';
    toolbar.appendChild(sep2);

    // Undo button
    const undoBtn = document.createElement('button');
    undoBtn.className = 'annotation-action-btn undo';
    undoBtn.innerHTML = this.icons.undo + ' Undo';
    undoBtn.addEventListener('click', () => {
      this.undoAnnotation();
    });
    toolbar.appendChild(undoBtn);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'annotation-action-btn save';
    saveBtn.innerHTML = this.icons.save + ' Done';
    saveBtn.addEventListener('click', () => {
      this.stopAnnotating();
    });
    toolbar.appendChild(saveBtn);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'annotation-action-btn cancel';
    cancelBtn.innerHTML = this.icons.cancel + ' Cancel';
    cancelBtn.addEventListener('click', () => {
      this.annotations = [];
      this.stopAnnotating();
    });
    toolbar.appendChild(cancelBtn);

    previewTab.appendChild(toolbar);
  },

  selectAnnotationTool(toolName) {
    this.annotationTool = toolName;
    const toolbar = document.getElementById('annotationToolbar');
    if (!toolbar) return;
    toolbar.querySelectorAll('.annotation-tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });
    // Update cursor
    if (this.canvasOverlay) {
      this.canvasOverlay.style.cursor = toolName === 'select' ? 'default' : 'crosshair';
    }
  },

  // ========================================
  // Annotation System
  // ========================================
  startAnnotating(tool) {
    this.isAnnotating = true;
    this.annotationTool = tool || 'rectangle';

    // Show toolbar
    const toolbar = document.getElementById('annotationToolbar');
    if (toolbar) {
      toolbar.classList.add('visible');
      this.selectAnnotationTool(this.annotationTool);
    }

    // Create canvas overlay on preview content
    const previewContent = document.getElementById('previewContent');
    if (!previewContent) return;

    // Make sure preview content is positioned
    const computed = window.getComputedStyle(previewContent);
    if (computed.position === 'static') {
      previewContent.style.position = 'relative';
    }

    // Remove existing overlay
    const existingCanvas = previewContent.querySelector('.annotation-canvas');
    if (existingCanvas) existingCanvas.remove();

    const canvas = document.createElement('canvas');
    canvas.className = 'annotation-canvas';
    canvas.width = previewContent.offsetWidth;
    canvas.height = previewContent.offsetHeight;
    this.canvasOverlay = canvas;
    this.canvasCtx = canvas.getContext('2d');
    previewContent.appendChild(canvas);

    // Redraw existing annotations
    this.redrawCanvas();

    // Bind mouse events
    this._onMouseDown = this.handleMouseDown.bind(this);
    this._onMouseMove = this.handleMouseMove.bind(this);
    this._onMouseUp = this.handleMouseUp.bind(this);
    this._onKeyDown = this.handleAnnotationKeyDown.bind(this);

    canvas.addEventListener('mousedown', this._onMouseDown);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('keydown', this._onKeyDown);

    // Update annotate button state
    const annotateBtn = document.getElementById('commentAnnotateBtn');
    if (annotateBtn) {
      annotateBtn.classList.add('has-annotations');
      annotateBtn.innerHTML = `${this.icons.close} Stop Annotating`;
    }
  },

  stopAnnotating() {
    this.isAnnotating = false;

    // Hide toolbar
    const toolbar = document.getElementById('annotationToolbar');
    if (toolbar) toolbar.classList.remove('visible');

    // Remove canvas overlay
    if (this.canvasOverlay) {
      this.canvasOverlay.removeEventListener('mousedown', this._onMouseDown);
      this.canvasOverlay.removeEventListener('mousemove', this._onMouseMove);
      this.canvasOverlay.removeEventListener('mouseup', this._onMouseUp);
      this.canvasOverlay.remove();
      this.canvasOverlay = null;
      this.canvasCtx = null;
    }
    document.removeEventListener('keydown', this._onKeyDown);

    // Remove any text input popup
    const popup = document.querySelector('.annotation-text-input-popup');
    if (popup) popup.remove();

    // Update annotate button
    this.updateAnnotateButton();

    // If we have annotations, render them as SVG overlay
    if (this.annotations.length > 0) {
      this.renderAnnotationsOnPreview(this.annotations);
    }
  },

  handleAnnotationKeyDown(e) {
    if (e.key === 'Escape') {
      this.stopAnnotating();
    } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.undoAnnotation();
    }
  },

  handleMouseDown(e) {
    if (this.annotationTool === 'select') return;
    if (this.annotationTool === 'text') {
      this.showTextInput(e);
      return;
    }

    const rect = this.canvasOverlay.getBoundingClientRect();
    this.drawStart = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    this.currentAnnotation = {
      type: this.annotationTool,
      x: this.drawStart.x,
      y: this.drawStart.y,
      width: 0,
      height: 0,
      color: this.annotationColor,
    };
  },

  handleMouseMove(e) {
    if (!this.drawStart || !this.currentAnnotation) return;
    if (this.annotationTool === 'select' || this.annotationTool === 'text') return;

    const rect = this.canvasOverlay.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    this.currentAnnotation.width = currentX - this.drawStart.x;
    this.currentAnnotation.height = currentY - this.drawStart.y;

    // For arrow and line: endX, endY
    if (this.annotationTool === 'arrow' || this.annotationTool === 'line') {
      this.currentAnnotation.endX = currentX;
      this.currentAnnotation.endY = currentY;
    }

    this.redrawCanvas();
    this.drawAnnotation(this.canvasCtx, this.currentAnnotation);
  },

  handleMouseUp(e) {
    if (!this.drawStart || !this.currentAnnotation) return;
    if (this.annotationTool === 'select' || this.annotationTool === 'text') return;

    const rect = this.canvasOverlay.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    this.currentAnnotation.width = endX - this.drawStart.x;
    this.currentAnnotation.height = endY - this.drawStart.y;

    if (this.annotationTool === 'arrow' || this.annotationTool === 'line') {
      this.currentAnnotation.endX = endX;
      this.currentAnnotation.endY = endY;
    }

    // Only save if the annotation has meaningful size
    const minSize = 5;
    const hasSize = Math.abs(this.currentAnnotation.width) > minSize ||
                    Math.abs(this.currentAnnotation.height) > minSize;
    if (hasSize) {
      this.annotations.push({ ...this.currentAnnotation });
    }

    this.currentAnnotation = null;
    this.drawStart = null;
    this.redrawCanvas();
  },

  showTextInput(e) {
    // Remove existing popup
    const existing = document.querySelector('.annotation-text-input-popup');
    if (existing) existing.remove();

    const rect = this.canvasOverlay.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const popup = document.createElement('div');
    popup.className = 'annotation-text-input-popup';
    popup.style.left = (e.pageX) + 'px';
    popup.style.top = (e.pageY) + 'px';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Enter text...';

    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';

    const addTextAnnotation = () => {
      const text = input.value.trim();
      if (text) {
        this.annotations.push({
          type: 'text',
          x: x,
          y: y,
          width: 0,
          height: 0,
          color: this.annotationColor,
          text: text,
        });
        this.redrawCanvas();
      }
      popup.remove();
    };

    okBtn.addEventListener('click', addTextAnnotation);
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        addTextAnnotation();
      } else if (ev.key === 'Escape') {
        popup.remove();
      }
    });

    popup.appendChild(input);
    popup.appendChild(okBtn);
    document.body.appendChild(popup);
    input.focus();
  },

  undoAnnotation() {
    if (this.annotations.length > 0) {
      this.annotations.pop();
      this.redrawCanvas();
    }
  },

  redrawCanvas() {
    if (!this.canvasCtx || !this.canvasOverlay) return;
    this.canvasCtx.clearRect(0, 0, this.canvasOverlay.width, this.canvasOverlay.height);
    this.annotations.forEach(a => this.drawAnnotation(this.canvasCtx, a));
  },

  drawAnnotation(ctx, annotation) {
    if (!ctx || !annotation) return;

    ctx.save();
    ctx.strokeStyle = annotation.color || '#ff4444';
    ctx.fillStyle = annotation.color || '#ff4444';
    ctx.lineWidth = 2;
    ctx.font = '14px Inter, sans-serif';

    switch (annotation.type) {
      case 'rectangle': {
        ctx.strokeRect(annotation.x, annotation.y, annotation.width, annotation.height);
        break;
      }
      case 'circle': {
        const rx = Math.abs(annotation.width) / 2;
        const ry = Math.abs(annotation.height) / 2;
        const cx = annotation.x + annotation.width / 2;
        const cy = annotation.y + annotation.height / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'arrow': {
        const startX = annotation.x;
        const startY = annotation.y;
        const endX = annotation.endX !== undefined ? annotation.endX : annotation.x + annotation.width;
        const endY = annotation.endY !== undefined ? annotation.endY : annotation.y + annotation.height;

        // Draw line
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(endY - startY, endX - startX);
        const headLen = 12;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLen * Math.cos(angle - Math.PI / 6),
          endY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLen * Math.cos(angle + Math.PI / 6),
          endY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        break;
      }
      case 'line': {
        const lStartX = annotation.x;
        const lStartY = annotation.y;
        const lEndX = annotation.endX !== undefined ? annotation.endX : annotation.x + annotation.width;
        const lEndY = annotation.endY !== undefined ? annotation.endY : annotation.y + annotation.height;
        ctx.beginPath();
        ctx.moveTo(lStartX, lStartY);
        ctx.lineTo(lEndX, lEndY);
        ctx.stroke();
        break;
      }
      case 'text': {
        ctx.fillStyle = annotation.color || '#ff4444';
        ctx.font = 'bold 14px Inter, sans-serif';
        // Draw background
        const text = annotation.text || '';
        const metrics = ctx.measureText(text);
        const padding = 4;
        const bgX = annotation.x - padding;
        const bgY = annotation.y - 14 - padding;
        const bgW = metrics.width + padding * 2;
        const bgH = 14 + padding * 2;
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#000';
        ctx.fillRect(bgX, bgY, bgW, bgH);
        ctx.globalAlpha = 1;
        ctx.fillStyle = annotation.color || '#ff4444';
        ctx.fillText(text, annotation.x, annotation.y);
        break;
      }
      case 'highlight': {
        ctx.globalAlpha = 0.3;
        ctx.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
        ctx.globalAlpha = 1;
        break;
      }
    }

    ctx.restore();
  },

  saveAnnotations() {
    return this.annotations.map(a => ({
      type: a.type,
      x: Math.round(a.x),
      y: Math.round(a.y),
      width: Math.round(a.width),
      height: Math.round(a.height),
      color: a.color,
      text: a.text || undefined,
      endX: a.endX !== undefined ? Math.round(a.endX) : undefined,
      endY: a.endY !== undefined ? Math.round(a.endY) : undefined,
    }));
  },

  renderAnnotationsOnPreview(annotations) {
    if (!annotations || annotations.length === 0) return;

    const previewContent = document.getElementById('previewContent');
    if (!previewContent) return;

    // Make sure preview content is positioned
    const computed = window.getComputedStyle(previewContent);
    if (computed.position === 'static') {
      previewContent.style.position = 'relative';
    }

    // Remove existing overlay
    const existing = previewContent.querySelector('.annotation-svg-overlay');
    if (existing) existing.remove();

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.classList.add('annotation-svg-overlay');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '10';

    annotations.forEach(a => {
      const color = a.color || '#ff4444';

      switch (a.type) {
        case 'rectangle': {
          const rect = document.createElementNS(svgNS, 'rect');
          const x = a.width < 0 ? a.x + a.width : a.x;
          const y = a.height < 0 ? a.y + a.height : a.y;
          rect.setAttribute('x', x);
          rect.setAttribute('y', y);
          rect.setAttribute('width', Math.abs(a.width));
          rect.setAttribute('height', Math.abs(a.height));
          rect.setAttribute('stroke', color);
          rect.setAttribute('stroke-width', '2');
          rect.setAttribute('fill', 'none');
          svg.appendChild(rect);
          break;
        }
        case 'circle': {
          const ellipse = document.createElementNS(svgNS, 'ellipse');
          const cx = a.x + a.width / 2;
          const cy = a.y + a.height / 2;
          ellipse.setAttribute('cx', cx);
          ellipse.setAttribute('cy', cy);
          ellipse.setAttribute('rx', Math.abs(a.width) / 2);
          ellipse.setAttribute('ry', Math.abs(a.height) / 2);
          ellipse.setAttribute('stroke', color);
          ellipse.setAttribute('stroke-width', '2');
          ellipse.setAttribute('fill', 'none');
          svg.appendChild(ellipse);
          break;
        }
        case 'arrow': {
          const endX = a.endX !== undefined ? a.endX : a.x + a.width;
          const endY = a.endY !== undefined ? a.endY : a.y + a.height;

          // Marker for arrowhead
          const markerId = 'arrow-' + Math.random().toString(36).substr(2, 6);
          const defs = document.createElementNS(svgNS, 'defs');
          const marker = document.createElementNS(svgNS, 'marker');
          marker.setAttribute('id', markerId);
          marker.setAttribute('markerWidth', '10');
          marker.setAttribute('markerHeight', '7');
          marker.setAttribute('refX', '10');
          marker.setAttribute('refY', '3.5');
          marker.setAttribute('orient', 'auto');
          const polygon = document.createElementNS(svgNS, 'polygon');
          polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
          polygon.setAttribute('fill', color);
          marker.appendChild(polygon);
          defs.appendChild(marker);
          svg.appendChild(defs);

          const line = document.createElementNS(svgNS, 'line');
          line.setAttribute('x1', a.x);
          line.setAttribute('y1', a.y);
          line.setAttribute('x2', endX);
          line.setAttribute('y2', endY);
          line.setAttribute('stroke', color);
          line.setAttribute('stroke-width', '2');
          line.setAttribute('marker-end', `url(#${markerId})`);
          svg.appendChild(line);
          break;
        }
        case 'line': {
          const endX = a.endX !== undefined ? a.endX : a.x + a.width;
          const endY = a.endY !== undefined ? a.endY : a.y + a.height;
          const line = document.createElementNS(svgNS, 'line');
          line.setAttribute('x1', a.x);
          line.setAttribute('y1', a.y);
          line.setAttribute('x2', endX);
          line.setAttribute('y2', endY);
          line.setAttribute('stroke', color);
          line.setAttribute('stroke-width', '2');
          svg.appendChild(line);
          break;
        }
        case 'text': {
          const textEl = document.createElementNS(svgNS, 'text');
          textEl.setAttribute('x', a.x);
          textEl.setAttribute('y', a.y);
          textEl.setAttribute('fill', color);
          textEl.setAttribute('font-size', '14');
          textEl.setAttribute('font-weight', 'bold');
          textEl.setAttribute('font-family', 'Inter, sans-serif');
          textEl.textContent = a.text || '';
          svg.appendChild(textEl);
          break;
        }
        case 'highlight': {
          const rect = document.createElementNS(svgNS, 'rect');
          const x = a.width < 0 ? a.x + a.width : a.x;
          const y = a.height < 0 ? a.y + a.height : a.y;
          rect.setAttribute('x', x);
          rect.setAttribute('y', y);
          rect.setAttribute('width', Math.abs(a.width));
          rect.setAttribute('height', Math.abs(a.height));
          rect.setAttribute('fill', color);
          rect.setAttribute('fill-opacity', '0.3');
          rect.setAttribute('stroke', 'none');
          svg.appendChild(rect);
          break;
        }
      }
    });

    previewContent.appendChild(svg);

    // Auto-remove overlay after 10 seconds
    setTimeout(() => {
      const overlay = previewContent.querySelector('.annotation-svg-overlay');
      if (overlay) overlay.remove();
    }, 10000);
  },

  // ========================================
  // Screen Selection Listener
  // ========================================
  listenForScreenSelection() {
    // Intercept the global loadItemPreview to detect screen changes
    const self = this;
    function patchLoadItemPreview() {
      const originalLoadItemPreview = window.loadItemPreview;
      if (typeof originalLoadItemPreview === 'function') {
        window.loadItemPreview = async (item, source, sectionTimestamp) => {
          await originalLoadItemPreview(item, source, sectionTimestamp);
          // After preview loads, update comment context
          if (item && item.type === 'ui') {
            const screenId = item.path || item.name || item.id;
            self.onScreenSelected(screenId);
          }
        };
      } else {
        // Retry if loadItemPreview not yet defined
        setTimeout(patchLoadItemPreview, 500);
      }
    }
    patchLoadItemPreview();

    // Also listen for tab changes - when preview tab becomes active
    const tabButtons = document.querySelectorAll('.tab-btn[data-tab="preview"]');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Small delay to ensure the tab is visible
        setTimeout(() => {
          if (this.currentScreenId && this.panelVisible) {
            this.loadComments(this.currentScreenId);
          }
        }, 100);
      });
    });
  },

  onScreenSelected(screenId) {
    if (!screenId) return;
    this.currentScreenId = screenId;

    // Remove existing annotation overlay
    const previewContent = document.getElementById('previewContent');
    if (previewContent) {
      const overlay = previewContent.querySelector('.annotation-svg-overlay');
      if (overlay) overlay.remove();
    }

    // Reset annotations for new screen
    this.annotations = [];
    this.updateAnnotateButton();

    // Load comments if panel is visible
    if (this.panelVisible) {
      this.loadComments(screenId);
    }

    // Update badge count for this screen
    this.updateTreeBadges();
  },

  // ========================================
  // Tree Node Comment Badges
  // ========================================
  async updateTreeBadges() {
    if (!state.currentProject) return;
    try {
      const projectName = encodeURIComponent(state.currentProject);
      const data = await api.fetch(`/api/comments/${projectName}/comments`);
      const allComments = Array.isArray(data) ? data : (data.comments || []);

      // Group by screenId
      const commentsByScreen = {};
      allComments.forEach(c => {
        if (!commentsByScreen[c.screenId]) commentsByScreen[c.screenId] = 0;
        commentsByScreen[c.screenId]++;
      });

      // Update tree node badges
      document.querySelectorAll('.tree-node-comment-badge').forEach(b => b.remove());

      Object.entries(commentsByScreen).forEach(([screenId, count]) => {
        if (count === 0) return;
        // Find tree node elements that match this screenId
        const treeNodes = document.querySelectorAll(`[data-path="${screenId}"], [data-name="${screenId}"]`);
        treeNodes.forEach(node => {
          const label = node.querySelector('.tree-node-label, .node-label');
          if (label && !label.querySelector('.tree-node-comment-badge')) {
            const badge = document.createElement('span');
            badge.className = 'tree-node-comment-badge';
            badge.textContent = count;
            badge.title = count + ' comment' + (count > 1 ? 's' : '');
            label.appendChild(badge);
          }
        });
      });
    } catch (error) {
      // Silently fail - badges are not critical
      console.debug('CommentUI: Could not update tree badges', error);
    }
  },

  // ========================================
  // Helpers
  // ========================================
  getAvatarColor(name) {
    const colors = [
      '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe',
      '#43e97b', '#fa709a', '#fee140', '#a18cd1', '#fbc2eb',
      '#ff9a9e', '#fecfef', '#f6d365', '#fda085', '#a1c4fd',
    ];
    let hash = 0;
    const str = name || 'U';
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  },

  timeAgo(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);

    if (diffSec < 10) return 'just now';
    if (diffSec < 60) return diffSec + ' seconds ago';
    if (diffMin === 1) return '1 minute ago';
    if (diffMin < 60) return diffMin + ' minutes ago';
    if (diffHour === 1) return '1 hour ago';
    if (diffHour < 24) return diffHour + ' hours ago';
    if (diffDay === 1) return '1 day ago';
    if (diffDay < 7) return diffDay + ' days ago';
    if (diffWeek === 1) return '1 week ago';
    if (diffWeek < 5) return diffWeek + ' weeks ago';
    if (diffMonth === 1) return '1 month ago';
    if (diffMonth < 12) return diffMonth + ' months ago';
    return date.toLocaleDateString();
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  getAnnotationToolIcon(tool) {
    return this.icons[tool] || '';
  },
};

// ========================================
// Initialize on DOM ready
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  // Delay init slightly to ensure other modules (state, api, etc.) are ready
  setTimeout(() => {
    CommentUI.init();
  }, 500);
});

// Expose globally
window.CommentUI = CommentUI;
