/**
 * Preview Component
 * Renders UI snapshots and API request data
 */

const Preview = {
  /**
   * Render UI preview from snapshot data
   * @param {HTMLElement} container - Container element
   * @param {Object} data - Snapshot data
   * @param {Object} options - { transitions: [], onTransition: fn }
   */
  renderUI(container, data, options = {}) {
    if (!data || !data.snapshot) {
      container.innerHTML = '<div class="empty-state">Không có dữ liệu UI</div>';
      return;
    }

    // Create preview container
    container.innerHTML = `
      <div class="workspace-preview">
        <div class="preview-header">
          ${options.transitions && options.transitions.length > 0 ? `<span class="preview-hint" style="font-size: 10px; color: var(--accent-primary);">⚡ Có ${options.transitions.length} tương tác chuyển màn</span>` : '<span></span>'}
          <div class="preview-actions">
            <button class="btn btn-xs btn-secondary" id="preview-fullscreen">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
              Fullscreen
            </button>
            <button class="btn btn-xs btn-secondary" id="preview-new-tab">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Mở tab mới
            </button>
            <button class="btn btn-xs btn-secondary" id="preview-add-comment" title="Click rồi chọn vị trí trên preview để thêm comment">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                <line x1="12" y1="8" x2="12" y2="14"/>
                <line x1="9" y1="11" x2="15" y2="11"/>
              </svg>
              Thêm
            </button>
            <button class="btn btn-xs btn-secondary" id="preview-show-comments" title="Hiện/ẩn tất cả comments">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px;">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Comments <span class="comment-count-badge" id="commentCountBadge">0</span>
            </button>
          </div>
        </div>
        <iframe id="preview-frame" sandbox="allow-same-origin allow-scripts"></iframe>
      </div>

      <style>
        .workspace-preview {
          display: flex;
          flex-direction: column;
          height: 100%;
          border-radius: 8px;
          overflow: hidden;
          background: #fff;
        }
        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border-color);
        }
        .preview-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .preview-actions {
          display: flex;
          gap: 6px;
        }
        #preview-frame {
          flex: 1;
          width: 100%;
          border: none;
          background: #fff;
        }
      </style>
    `;

    const iframe = container.querySelector('#preview-frame');

    // Prepare HTML content
    let htmlContent = '';

    if (data.snapshot.html) {
      htmlContent = data.snapshot.html;
    } else if (typeof data.snapshot === 'string') {
      htmlContent = data.snapshot;
    }

    // Add styles if available
    if (data.styles) {
      const styleTag = `<style>${data.styles}</style>`;
      if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', `${styleTag}</head>`);
      } else if (htmlContent.includes('<body')) {
        htmlContent = htmlContent.replace('<body', `<head>${styleTag}</head><body`);
      } else {
        htmlContent = `${styleTag}${htmlContent}`;
      }
    }

    // Disable scripts for safety, but we might want our own
    htmlContent = htmlContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

    // Set iframe content
    iframe.srcdoc = htmlContent;

    // Handle flow transitions inside iframe
    iframe.onload = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        if (!doc) return;

        // Inject navigation styles
        const navStyle = doc.createElement('style');
        navStyle.innerHTML = `
          .flow-interactive {
             outline: 2px dashed rgba(102, 126, 234, 0.4) !important;
             outline-offset: 2px !important;
             cursor: pointer !important;
             transition: all 0.2s !important;
          }
          .flow-interactive:hover {
             outline: 2px solid var(--accent-primary, #667eea) !important;
             background: rgba(102, 126, 234, 0.1) !important;
             box-shadow: 0 0 15px rgba(102, 126, 234, 0.3) !important;
          }
          .flow-tooltip {
            position: fixed;
            background: #1a1a2e;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            z-index: 999999;
            pointer-events: none;
            display: none;
            border: 1px solid #667eea;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            white-space: nowrap;
          }
        `;
        doc.head.appendChild(navStyle);

        const tooltip = doc.createElement('div');
        tooltip.className = 'flow-tooltip';
        doc.body.appendChild(tooltip);

        if (options.transitions && options.transitions.length > 0) {
          // Helper to find elements across Shadow DOM
          const deepQuerySelectorAll = (root, selector) => {
            let results = Array.from(root.querySelectorAll(selector));
            // Recursive search in shadow roots
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
            while (walker.nextNode()) {
              const node = walker.currentNode;
              if (node.shadowRoot) {
                results = results.concat(deepQuerySelectorAll(node.shadowRoot, selector));
              }
            }
            return results;
          };

          options.transitions.forEach(edge => {
            const selector = edge.interaction?.selector;
            const simpleSelector = edge.interaction?.simpleSelector;

            // Try both selectors for robustness
            const targets = [selector, simpleSelector].filter(s => s);

            targets.forEach(sel => {
              try {
                const elements = deepQuerySelectorAll(doc, sel);
                elements.forEach(el => {
                  // Avoid double binding
                  if (el.dataset.flowBound) return;
                  el.dataset.flowBound = 'true';

                  el.classList.add('flow-interactive');
                  el.title = `Đi đến: ${edge.to}`; // Browser tooltip

                  el.addEventListener('mouseenter', (e) => {
                    tooltip.textContent = `⚡ Next: ${edge.to.split(/[\\/]/).pop()}`;
                    tooltip.style.display = 'block';
                    const rect = el.getBoundingClientRect();
                    tooltip.style.left = `${rect.left}px`;
                    tooltip.style.top = `${rect.top - 25}px`;
                  });

                  el.addEventListener('mouseleave', () => {
                    tooltip.style.display = 'none';
                  });

                  el.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (options.onTransition) {
                      options.onTransition(edge.to);
                    }
                  });
                });
              } catch (err) {
                // console.warn('Failed to apply selector:', sel);
              }
            });
          });
        }
      } catch (err) {
        console.error('Preview interactivity error:', err);
      }
    };

    // Fullscreen handler
    container.querySelector('#preview-fullscreen').addEventListener('click', () => {
      if (iframe.requestFullscreen) {
        iframe.requestFullscreen();
      } else if (iframe.webkitRequestFullscreen) {
        iframe.webkitRequestFullscreen();
      }
    });

    // New tab handler
    container.querySelector('#preview-new-tab').addEventListener('click', () => {
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    });

    // Add Comment handler - activates pin placement mode
    const addCommentBtn = container.querySelector('#preview-add-comment');
    if (addCommentBtn) {
      addCommentBtn.addEventListener('click', () => {
        if (window.CommentUI && typeof window.CommentUI.activatePinMode === 'function') {
          window.CommentUI.activatePinMode();
        }
      });
    }

    // Show Comments handler - toggles all comment pins visibility
    const showCommentsBtn = container.querySelector('#preview-show-comments');
    if (showCommentsBtn) {
      showCommentsBtn.addEventListener('click', () => {
        if (window.CommentUI && typeof window.CommentUI.togglePins === 'function') {
          window.CommentUI.togglePins();
        }
      });
    }
  },

  /**
   * Render API requests table
   * @param {HTMLElement} container - Container element
   * @param {Array} requests - Array of request objects
   */
  renderAPI(container, requests) {
    if (!requests || requests.length === 0) {
      container.innerHTML = '<div class="empty-state">Không có API requests</div>';
      return;
    }

    let html = `
      <div class="api-preview">
        <div class="api-header">
          <span class="api-title">🔗 API Requests (${requests.length})</span>
          <div class="api-filters">
            <input type="text" id="api-search" class="input" placeholder="Tìm kiếm..." style="width: 200px;">
          </div>
        </div>
        <div class="api-table-container">
          <table class="api-diff-table" id="api-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>URL</th>
                <th>Status</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
    `;

    requests.forEach((req, index) => {
      const method = req.method || 'GET';
      const url = req.url || 'Unknown';
      const status = req.response?.status || '-';
      const type = req.type || 'XHR';

      const methodClass = this.getMethodClass(method);
      const statusClass = this.getStatusClass(status);

      html += `
        <tr data-index="${index}" data-url="${url.toLowerCase()}">
          <td><span class="method-badge ${methodClass}">${method}</span></td>
          <td class="api-url-cell">
            <span class="api-url" title="${url}">${this.truncateUrl(url, 50)}</span>
          </td>
          <td><span class="status-code ${statusClass}">${status}</span></td>
          <td>${type}</td>
          <td>
            <button class="btn btn-xs btn-secondary view-detail-btn" data-index="${index}">
              Chi tiết
            </button>
          </td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>

      <style>
        .api-preview {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .api-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: var(--bg-glass);
          border-radius: 8px 8px 0 0;
        }
        .api-title {
          font-size: 14px;
          font-weight: 600;
        }
        .api-table-container {
          flex: 1;
          overflow: auto;
        }
        .method-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }
        .method-get { background: #4dabf7; color: white; }
        .method-post { background: #51cf66; color: white; }
        .method-put { background: #fab005; color: white; }
        .method-delete { background: #ff6b6b; color: white; }
        .method-patch { background: #845ef7; color: white; }
        .status-code {
          font-weight: 600;
        }
        .status-success { color: var(--success); }
        .status-redirect { color: var(--warning); }
        .status-error { color: var(--danger); }
        .api-url-cell {
          max-width: 300px;
        }
        .api-url {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: block;
          font-family: monospace;
          font-size: 12px;
        }
      </style>
    `;

    container.innerHTML = html;

    // Store requests for detail view
    this.currentRequests = requests;

    // Search handler
    const searchInput = container.querySelector('#api-search');
    const table = container.querySelector('#api-table tbody');

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const rows = table.querySelectorAll('tr');

      rows.forEach(row => {
        const url = row.dataset.url || '';
        row.style.display = url.includes(query) ? '' : 'none';
      });
    });

    // Detail view handlers
    container.querySelectorAll('.view-detail-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index);
        this.showRequestDetail(requests[index]);
      });
    });
  },

  /**
   * Show request detail modal
   */
  showRequestDetail(request) {
    const modal = document.createElement('div');
    modal.className = 'modal active';

    modal.innerHTML = `
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h3>${request.method} ${this.truncateUrl(request.url, 60)}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="request-detail-content">
            <div class="section-group">
                <div class="section-title">Request Info</div>
                
                <h4>URL</h4>
                <pre class="code-block">${request.url}</pre>
                
                <h4>Method</h4>
                <pre class="code-block">${request.method}</pre>
                
                ${request.postData ? `
                    <h4>Request Body</h4>
                    <pre class="code-block">${this.formatJson(request.postData)}</pre>
                ` : ''}
                
                 ${request.headers ? `
                    <h4>Request Headers</h4>
                    <pre class="code-block">${this.formatJson(request.headers)}</pre>
                ` : ''}
            </div>

            <div class="section-group">
                <div class="section-title">Response Info</div>
                
                <h4>Status</h4>
                <pre class="code-block">${request.response?.status || 'N/A'} ${request.response?.statusText || ''}</pre>
                
                ${request.response?.body ? `
                    <h4>Response Body</h4>
                    <pre class="code-block">${this.formatJson(request.response.body)}</pre>
                ` : '<p>No response body</p>'}
                
                ${request.response?.headers ? `
                    <h4>Response Headers</h4>
                    <pre class="code-block">${this.formatJson(request.response.headers)}</pre>
                ` : ''}
            </div>
          </div>
        </div>
      </div>
      
      <style>
        .request-detail-content {
            display: flex;
            flex-direction: column;
            gap: 24px;
        }
        .section-group {
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 16px;
            background: var(--bg-secondary);
        }
        .section-title {
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 12px;
            color: var(--accent-primary);
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 8px;
        }
        .request-detail-content h4 {
          margin: 16px 0 8px;
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .request-detail-content h4:first-child {
          margin-top: 0;
        }
        .code-block {
          background: var(--bg-tertiary);
          padding: 12px;
          border-radius: 6px;
          font-family: 'Fira Code', monospace;
          font-size: 12px;
          overflow: auto;
          max-height: 400px;
          white-space: pre-wrap;
          word-break: break-all;
        }
      </style>
    `;

    // Close handlers
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
  },

  /**
   * Format JSON for display
   */
  formatJson(data) {
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return this.escapeHtml(data);
      }
    }
    return this.escapeHtml(JSON.stringify(data, null, 2));
  },

  /**
   * Truncate URL for display
   */
  truncateUrl(url, maxLength = 50) {
    if (!url || url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  },

  /**
   * Get CSS class for HTTP method
   */
  getMethodClass(method) {
    const map = {
      'GET': 'method-get',
      'POST': 'method-post',
      'PUT': 'method-put',
      'DELETE': 'method-delete',
      'PATCH': 'method-patch'
    };
    return map[method.toUpperCase()] || 'method-get';
  },

  /**
   * Get CSS class for status code
   */
  getStatusClass(status) {
    if (!status || status === '-') return '';
    const code = parseInt(status);
    if (code >= 200 && code < 300) return 'status-success';
    if (code >= 300 && code < 400) return 'status-redirect';
    return 'status-error';
  },

  /**
   * Escape HTML for safe display
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Export for use
window.Preview = Preview;
