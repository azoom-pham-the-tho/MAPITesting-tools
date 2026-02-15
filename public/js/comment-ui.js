/**
 * Comment UI Module - Figma-style Pin Comments
 * Click to place a comment pin → enter text → pin shows at position
 */
const CommentUI = {
  comments: [],
  currentScreenId: null,
  pinMode: false,
  pinsVisible: true,

  // ========================================
  // Initialization
  // ========================================
  init() {
    this.injectStyles();
    this.listenForScreenSelection();
    console.log('CommentUI: Figma-style pin system initialized');
  },

  // ========================================
  // LocalStorage
  // ========================================
  getStorageKey() {
    return `pin_comments_${state.currentProject || 'default'}_${this.currentScreenId || 'none'}`;
  },

  save() {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.comments));
    } catch (e) { console.warn('CommentUI: save failed', e); }
  },

  load() {
    try {
      const data = localStorage.getItem(this.getStorageKey());
      this.comments = data ? JSON.parse(data) : [];
    } catch (e) {
      this.comments = [];
    }
  },

  // ========================================
  // Style Injection
  // ========================================
  injectStyles() {
    if (document.getElementById('comment-pin-styles')) return;
    const style = document.createElement('style');
    style.id = 'comment-pin-styles';
    style.textContent = `
      /* Pin cursor when in pin mode */
      .comment-pin-mode .workspace-preview,
      .comment-pin-mode #preview-frame {
        cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%23667eea' stroke='white' stroke-width='1.5'%3E%3Cpath d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/%3E%3C/svg%3E") 12 20, crosshair !important;
      }

      /* Pin mode active button highlight */
      .comment-pin-mode #preview-add-comment {
        background: var(--accent-primary) !important;
        color: #fff !important;
        border-color: var(--accent-primary) !important;
        box-shadow: 0 0 12px rgba(102, 126, 234, 0.5) !important;
      }

      /* Click overlay for capturing clicks on iframe */
      .comment-click-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 30;
        cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%23667eea' stroke='white' stroke-width='1.5'%3E%3Cpath d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/%3E%3C/svg%3E") 12 20, crosshair;
        display: none;
      }
      .comment-click-overlay.active {
        display: block;
      }

      /* Comment Pin Marker */
      .comment-pin {
        position: absolute;
        z-index: 15;
        cursor: pointer;
        transition: transform 0.15s ease;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      }
      .comment-pin:hover {
        transform: scale(1.2);
        z-index: 16;
      }
      .comment-pin .pin-icon {
        width: 28px;
        height: 28px;
        background: var(--accent-primary);
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #fff;
      }
      .comment-pin .pin-number {
        transform: rotate(45deg);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        font-family: 'Inter', sans-serif;
      }
      .comment-pin.resolved .pin-icon {
        background: var(--success);
        opacity: 0.7;
      }

      /* Comment Popup (shows on pin click) */
      .comment-popup {
        position: absolute;
        z-index: 25;
        width: 280px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        font-family: 'Inter', sans-serif;
        overflow: hidden;
      }
      .comment-popup-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--bg-tertiary);
        border-bottom: 1px solid var(--border-color);
      }
      .comment-popup-author {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .comment-popup-avatar {
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #e88e8e;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        color: #fff;
      }
      .comment-popup-name {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-primary);
      }
      .comment-popup-time {
        font-size: 10px;
        color: var(--text-muted);
      }
      .comment-popup-actions {
        display: flex;
        gap: 4px;
      }
      .comment-popup-actions button {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 4px;
        font-size: 11px;
      }
      .comment-popup-actions button:hover {
        background: var(--bg-glass);
        color: var(--text-primary);
      }
      .comment-popup-body {
        padding: 10px 12px;
        font-size: 13px;
        color: var(--text-primary);
        line-height: 1.5;
        word-break: break-word;
      }
      .comment-popup-footer {
        padding: 8px 12px;
        border-top: 1px solid var(--border-color);
        display: flex;
        gap: 6px;
      }
      .comment-popup-footer input {
        flex: 1;
        background: var(--bg-glass);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        padding: 4px 8px;
        font-size: 12px;
        color: var(--text-primary);
        outline: none;
      }
      .comment-popup-footer input:focus {
        border-color: var(--accent-primary);
      }
      .comment-popup-footer button {
        background: var(--accent-primary);
        color: #fff;
        border: none;
        border-radius: 4px;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }
      .comment-popup-footer button:hover {
        opacity: 0.9;
      }
      .comment-popup .replies-section {
        padding: 0 12px 8px;
        border-top: 1px solid var(--border-color);
      }
      .comment-popup .reply-item {
        padding: 6px 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      .comment-popup .reply-item:last-child {
        border-bottom: none;
      }
      .reply-item-header {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 2px;
      }
      .reply-item-avatar {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #8eb8e8;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
        font-weight: 700;
        color: #fff;
      }
      .reply-item-name {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-secondary);
      }
      .reply-item-time {
        font-size: 9px;
        color: var(--text-muted);
      }
      .reply-item-text {
        font-size: 12px;
        color: var(--text-primary);
        padding-left: 20px;
      }

      /* New Comment Modal */
      .comment-modal-overlay {
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .comment-modal {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 12px;
        width: 360px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.5);
        font-family: 'Inter', sans-serif;
        overflow: hidden;
      }
      .comment-modal-title {
        padding: 14px 16px;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .comment-modal-title svg {
        color: var(--accent-primary);
      }
      .comment-modal textarea {
        width: 100%;
        min-height: 100px;
        padding: 12px 16px;
        background: transparent;
        border: none;
        color: var(--text-primary);
        font-size: 13px;
        font-family: 'Inter', sans-serif;
        resize: vertical;
        outline: none;
      }
      .comment-modal textarea::placeholder {
        color: var(--text-muted);
      }
      .comment-modal-buttons {
        padding: 10px 16px;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        border-top: 1px solid var(--border-color);
      }
      .comment-modal-buttons .btn-cancel {
        background: var(--bg-glass);
        color: var(--text-secondary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 6px 16px;
        font-size: 12px;
        cursor: pointer;
      }
      .comment-modal-buttons .btn-submit {
        background: var(--accent-primary);
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 6px 16px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .comment-modal-buttons .btn-submit:hover {
        opacity: 0.9;
      }

      /* Badge style */
      .comment-count-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: 8px;
        font-size: 9px;
        font-weight: 700;
        background: rgba(255, 255, 255, 0.15);
        color: var(--text-primary);
        margin-left: 2px;
      }

      /* Hint bar when pin mode is active */
      .pin-mode-hint {
        position: absolute;
        top: 44px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 35;
        background: var(--accent-primary);
        color: #fff;
        font-size: 12px;
        font-weight: 500;
        padding: 6px 16px;
        border-radius: 20px;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        font-family: 'Inter', sans-serif;
        pointer-events: none;
        animation: fadeInDown 0.2s ease;
      }
      @keyframes fadeInDown {
        from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
  },

  // ========================================
  // Pin Mode (Figma-style click to place)
  // ========================================
  activatePinMode() {
    if (this.pinMode) {
      this.deactivatePinMode();
      return;
    }
    if (!this.currentScreenId) {
      if (typeof showToast === 'function') showToast('Hãy chọn 1 screen trước', 'warning');
      return;
    }

    this.pinMode = true;
    const previewTab = document.getElementById('previewTab');
    if (previewTab) {
      previewTab.classList.add('comment-pin-mode');

      // Create click overlay on top of iframe
      let overlay = previewTab.querySelector('.comment-click-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'comment-click-overlay';
        const previewContent = previewTab.querySelector('.workspace-preview') || previewTab.querySelector('#previewContent');
        if (previewContent) {
          previewContent.style.position = 'relative';
          previewContent.appendChild(overlay);
        }
      }
      overlay.classList.add('active');
      overlay.onclick = (e) => this.handlePinClick(e, overlay);

      // Show hint
      let hint = previewTab.querySelector('.pin-mode-hint');
      if (!hint) {
        hint = document.createElement('div');
        hint.className = 'pin-mode-hint';
        hint.textContent = '💬 Click vào vị trí muốn thêm comment • ESC để hủy';
        const wp = previewTab.querySelector('.workspace-preview') || previewTab;
        wp.style.position = 'relative';
        wp.appendChild(hint);
      }
    }

    // ESC to cancel
    this._escHandler = (e) => {
      if (e.key === 'Escape') this.deactivatePinMode();
    };
    document.addEventListener('keydown', this._escHandler);
  },

  deactivatePinMode() {
    this.pinMode = false;
    const previewTab = document.getElementById('previewTab');
    if (previewTab) {
      previewTab.classList.remove('comment-pin-mode');
      const overlay = previewTab.querySelector('.comment-click-overlay');
      if (overlay) overlay.classList.remove('active');
      const hint = previewTab.querySelector('.pin-mode-hint');
      if (hint) hint.remove();
    }
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
    }
  },

  handlePinClick(e, overlay) {
    const rect = overlay.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Get iframe scroll offset to calculate absolute content position
    let scrollX = 0, scrollY = 0;
    try {
      const iframe = document.getElementById('preview-frame');
      if (iframe && iframe.contentDocument) {
        scrollX = iframe.contentDocument.documentElement.scrollLeft || iframe.contentDocument.body.scrollLeft || 0;
        scrollY = iframe.contentDocument.documentElement.scrollTop || iframe.contentDocument.body.scrollTop || 0;
      }
    } catch (err) { /* iframe access error */ }

    // Store absolute content position (viewport click + scroll offset)
    const contentX = clickX + scrollX;
    const contentY = clickY + scrollY;

    this.deactivatePinMode();
    this.showCommentModal(contentX, contentY);
  },

  // ========================================
  // Comment Modal
  // ========================================
  showCommentModal(contentX, contentY) {
    // Remove existing modal
    const existing = document.querySelector('.comment-modal-overlay');
    if (existing) existing.remove();

    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'comment-modal-overlay';
    modalOverlay.innerHTML = `
      <div class="comment-modal">
        <div class="comment-modal-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Thêm Comment
        </div>
        <textarea placeholder="Nhập nội dung comment..." autofocus></textarea>
        <div class="comment-modal-buttons">
          <button class="btn-cancel">Hủy</button>
          <button class="btn-submit">Thêm</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    const textarea = modalOverlay.querySelector('textarea');
    const cancelBtn = modalOverlay.querySelector('.btn-cancel');
    const submitBtn = modalOverlay.querySelector('.btn-submit');

    setTimeout(() => textarea.focus(), 50);

    cancelBtn.addEventListener('click', () => modalOverlay.remove());
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) modalOverlay.remove();
    });

    const submit = () => {
      const content = textarea.value.trim();
      if (!content) return;
      this.addComment(content, contentX, contentY);
      modalOverlay.remove();
    };

    submitBtn.addEventListener('click', submit);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        submit();
      }
    });
  },

  // ========================================
  // CRUD Operations
  // ========================================
  addComment(content, contentX, contentY) {
    const comment = {
      id: Date.now().toString(),
      screenId: this.currentScreenId,
      content: content,
      author: 'User',
      createdAt: new Date().toISOString(),
      resolved: false,
      // Absolute position in content (viewport position + scroll offset at time of click)
      contentX: contentX,
      contentY: contentY,
      replies: [],
    };
    this.comments.push(comment);
    this.save();
    this.renderPins();
    this.updateBadge();
    if (typeof showToast === 'function') showToast('Comment đã thêm', 'success');
  },

  deleteComment(commentId) {
    this.closePopup();
    this.comments = this.comments.filter(c => c.id !== commentId);
    this.save();
    this.renderPins();
    this.updateBadge();
    if (typeof showToast === 'function') showToast('Đã xóa', 'success');
  },

  resolveComment(commentId) {
    const comment = this.comments.find(c => c.id === commentId);
    if (comment) {
      comment.resolved = !comment.resolved;
      this.save();
      this.closePopup();
      this.renderPins();
      if (typeof showToast === 'function') showToast(
        comment.resolved ? 'Đã resolve' : 'Đã mở lại', 'success'
      );
    }
  },

  addReply(commentId, content) {
    const comment = this.comments.find(c => c.id === commentId);
    if (comment && content.trim()) {
      comment.replies.push({
        id: Date.now().toString(),
        author: 'User',
        content: content.trim(),
        createdAt: new Date().toISOString(),
      });
      this.save();
      // Refresh popup
      this.showCommentPopup(comment);
    }
  },

  // ========================================
  // Render Pins on Preview
  // ========================================
  renderPins() {
    const previewContent = document.getElementById('previewContent') ||
      document.querySelector('.workspace-preview');
    if (!previewContent) return;

    // Remove old pins
    previewContent.querySelectorAll('.comment-pin').forEach(p => p.remove());

    if (!this.pinsVisible) return;

    previewContent.style.position = 'relative';

    let pinIndex = 0;
    this.comments.forEach((comment) => {
      if (comment.screenId !== this.currentScreenId) return;
      pinIndex++;

      const pin = document.createElement('div');
      pin.className = 'comment-pin' + (comment.resolved ? ' resolved' : '');
      pin.dataset.commentId = comment.id;

      pin.innerHTML = `
        <div class="pin-icon">
          <span class="pin-number">${pinIndex}</span>
        </div>
      `;

      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showCommentPopup(comment, pin);
      });

      previewContent.appendChild(pin);
    });

    // Update positions immediately
    this.updatePinPositions();
    // Start the position tracking loop
    this.startPositionLoop();
  },

  // Get current iframe scroll offsets
  getIframeScroll() {
    let scrollX = 0, scrollY = 0;
    try {
      const iframe = document.getElementById('preview-frame');
      if (iframe && iframe.contentDocument) {
        scrollX = iframe.contentDocument.documentElement.scrollLeft || iframe.contentDocument.body.scrollLeft || 0;
        scrollY = iframe.contentDocument.documentElement.scrollTop || iframe.contentDocument.body.scrollTop || 0;
      }
    } catch (e) { /* cross-origin */ }
    return { scrollX, scrollY };
  },

  // Update existing pin positions based on current iframe scroll
  updatePinPositions() {
    const previewContent = document.getElementById('previewContent') ||
      document.querySelector('.workspace-preview');
    if (!previewContent) return;

    const { scrollX, scrollY } = this.getIframeScroll();
    const maxW = previewContent.clientWidth;
    const maxH = previewContent.clientHeight;

    previewContent.querySelectorAll('.comment-pin').forEach(pin => {
      const comment = this.comments.find(c => c.id === pin.dataset.commentId);
      if (!comment) return;

      const viewX = comment.contentX - scrollX;
      const viewY = comment.contentY - scrollY;

      pin.style.left = `${viewX - 14}px`;
      pin.style.top = `${viewY - 28}px`;

      // Hide if outside visible area
      pin.style.display = (viewX < -30 || viewY < -30 || viewX > maxW + 30 || viewY > maxH + 30) ? 'none' : '';
    });
  },

  // Continuously track iframe scroll position using rAF
  _lastScrollX: -1,
  _lastScrollY: -1,
  _rafId: null,

  startPositionLoop() {
    // Stop existing loop
    this.stopPositionLoop();

    const loop = () => {
      const { scrollX, scrollY } = this.getIframeScroll();
      // Only update if scroll changed
      if (scrollX !== this._lastScrollX || scrollY !== this._lastScrollY) {
        this._lastScrollX = scrollX;
        this._lastScrollY = scrollY;
        this.updatePinPositions();
      }
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  },

  stopPositionLoop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  },

  // ========================================
  // Comment Popup (on pin click)
  // ========================================
  showCommentPopup(comment, pinEl) {
    this.closePopup();

    const previewContent = document.getElementById('previewContent') ||
      document.querySelector('.workspace-preview');
    if (!previewContent) return;

    const popup = document.createElement('div');
    popup.className = 'comment-popup';
    popup.id = 'activeCommentPopup';

    // Position popup near pin
    const pinRect = pinEl ? pinEl.getBoundingClientRect() : null;
    const containerRect = previewContent.getBoundingClientRect();

    if (pinRect) {
      let left = pinRect.right - containerRect.left + 8;
      let top = pinRect.top - containerRect.top;
      // Keep within bounds
      if (left + 280 > containerRect.width) left = pinRect.left - containerRect.left - 288;
      if (top + 200 > containerRect.height) top = containerRect.height - 210;
      popup.style.left = `${left}px`;
      popup.style.top = `${Math.max(0, top)}px`;
    }

    const timeAgo = this.timeAgo(comment.createdAt);
    const repliesHtml = (comment.replies || []).map(r => `
      <div class="reply-item">
        <div class="reply-item-header">
          <div class="reply-item-avatar">${(r.author || 'U').charAt(0)}</div>
          <span class="reply-item-name">${this.escapeHtml(r.author || 'User')}</span>
          <span class="reply-item-time">${this.timeAgo(r.createdAt)}</span>
        </div>
        <div class="reply-item-text">${this.escapeHtml(r.content)}</div>
      </div>
    `).join('');

    popup.innerHTML = `
      <div class="comment-popup-header">
        <div class="comment-popup-author">
          <div class="comment-popup-avatar">${(comment.author || 'U').charAt(0)}</div>
          <span class="comment-popup-name">${this.escapeHtml(comment.author || 'User')}</span>
          <span class="comment-popup-time">${timeAgo}</span>
        </div>
        <div class="comment-popup-actions">
          <button data-action="resolve" title="${comment.resolved ? 'Mở lại' : 'Resolve'}">${comment.resolved ? '↩' : '✓'}</button>
          <button data-action="delete" title="Xóa">✕</button>
        </div>
      </div>
      <div class="comment-popup-body">${this.escapeHtml(comment.content)}</div>
      ${repliesHtml ? `<div class="replies-section">${repliesHtml}</div>` : ''}
      <div class="comment-popup-footer">
        <input type="text" placeholder="Trả lời..." />
        <button>Gửi</button>
      </div>
    `;

    // Event handlers
    popup.querySelector('[data-action="resolve"]').addEventListener('click', () => {
      this.resolveComment(comment.id);
    });
    popup.querySelector('[data-action="delete"]').addEventListener('click', () => {
      this.deleteComment(comment.id);
    });

    const replyInput = popup.querySelector('.comment-popup-footer input');
    const replyBtn = popup.querySelector('.comment-popup-footer button');
    const submitReply = () => {
      const val = replyInput.value.trim();
      if (val) this.addReply(comment.id, val);
    };
    replyBtn.addEventListener('click', submitReply);
    replyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submitReply(); }
    });

    // Stop propagation so clicking inside popup doesn't close it
    popup.addEventListener('click', (e) => e.stopPropagation());

    previewContent.appendChild(popup);

    // Close on outside click (delay to prevent immediate closure from the same click)
    setTimeout(() => {
      this._closePopupHandler = (e) => {
        if (!popup.contains(e.target) && !e.target.closest('.comment-pin')) {
          this.closePopup();
        }
      };
      document.addEventListener('click', this._closePopupHandler);
    }, 300);
  },

  closePopup() {
    const popup = document.getElementById('activeCommentPopup');
    if (popup) popup.remove();
    if (this._closePopupHandler) {
      document.removeEventListener('click', this._closePopupHandler);
      this._closePopupHandler = null;
    }
  },

  // ========================================
  // Toggle Pins Visibility
  // ========================================
  togglePins() {
    this.pinsVisible = !this.pinsVisible;
    this.renderPins();

    // Update button appearance
    const btn = document.getElementById('preview-show-comments');
    if (btn) {
      btn.style.opacity = this.pinsVisible ? '1' : '0.5';
    }
  },

  // ========================================
  // Badge Update
  // ========================================
  updateBadge() {
    const badge = document.getElementById('commentCountBadge');
    if (badge) {
      const count = this.comments.filter(c => c.screenId === this.currentScreenId).length;
      badge.textContent = count;
    }
  },

  // ========================================
  // Screen Selection Listener
  // ========================================
  listenForScreenSelection() {
    // Patch loadItemPreview to detect screen changes
    const checkForPreview = () => {
      if (typeof loadItemPreview === 'function') {
        const original = loadItemPreview;
        window.loadItemPreview = (item, source, sectionTimestamp) => {
          original(item, source, sectionTimestamp);
          const screenId = item && (item.id || item.path || item.name);
          if (screenId) {
            setTimeout(() => this.onScreenSelected(screenId), 500);
          }
        };
      }
    };
    setTimeout(checkForPreview, 1000);

    // Also listen for preview tab becoming active
    const observer = new MutationObserver(() => {
      const previewTab = document.getElementById('previewTab');
      if (previewTab && previewTab.style.display !== 'none') {
        setTimeout(() => {
          if (this.currentScreenId) {
            this.renderPins();
          }
        }, 300);
      }
    });
    const previewTab = document.getElementById('previewTab');
    if (previewTab) {
      observer.observe(previewTab, { attributes: true, attributeFilter: ['style'] });
    }
  },

  onScreenSelected(screenId) {
    this.currentScreenId = screenId;
    this.closePopup();
    this.load();
    // Delay to ensure iframe is loaded, then render pins (includes position loop)
    setTimeout(() => {
      this.renderPins();
    }, 300);
    this.updateBadge();
  },

  // ========================================
  // Helpers
  // ========================================
  timeAgo(dateString) {
    if (!dateString) return '';
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
};

// ========================================
// Initialize on DOM ready
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    CommentUI.init();
  }, 500);
});

// Expose globally
window.CommentUI = CommentUI;
