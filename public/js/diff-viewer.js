/**
 * Diff Viewer Component
 * Renders side-by-side diffs for UI and API changes
 */

const DiffViewer = {
    /**
     * Render UI diff between main and section
     * @param {HTMLElement} container - Container element
     * @param {Object} mainData - Main UI data
     * @param {Object} sectionData - Section UI data
     * @param {Array} changes - Array of changes
     */
    renderUIDiff(container, mainData, sectionData, changes = []) {
        container.innerHTML = `
      <div class="diff-container">
        <div class="diff-panel main-panel">
          <div class="diff-label">Main (Cũ)</div>
          <div class="diff-content" id="diff-main"></div>
        </div>
        <div class="diff-panel section-panel">
          <div class="diff-label">Section (Mới)</div>
          <div class="diff-content" id="diff-section"></div>
        </div>
      </div>
    `;

        const mainContent = container.querySelector('#diff-main');
        const sectionContent = container.querySelector('#diff-section');

        // Render main HTML with highlights
        if (mainData && mainData.snapshot && mainData.snapshot.html) {
            mainContent.innerHTML = this.highlightChanges(
                this.escapeHtml(mainData.snapshot.html),
                changes,
                'main'
            );
        } else {
            mainContent.innerHTML = '<div class="empty-state">Không có dữ liệu</div>';
        }

        // Render section HTML with highlights
        if (sectionData && sectionData.snapshot && sectionData.snapshot.html) {
            sectionContent.innerHTML = this.highlightChanges(
                this.escapeHtml(sectionData.snapshot.html),
                changes,
                'section'
            );
        } else {
            sectionContent.innerHTML = '<div class="empty-state">Không có dữ liệu</div>';
        }
    },

    /**
     * Highlight changes in content
     */
    highlightChanges(content, changes, type) {
        let result = content;

        changes.forEach(change => {
            if (change.type === 'text') {
                const value = type === 'main' ? change.mainValue : change.sectionValue;
                if (value) {
                    const className = type === 'main' ? 'diff-highlight-removed' : 'diff-highlight-added';
                    const escaped = this.escapeRegex(value);
                    result = result.replace(
                        new RegExp(escaped, 'g'),
                        `<span class="${className}">${value}</span>`
                    );
                }
            }
        });

        return result;
    },

    /**
     * Render API diff table
     * @param {HTMLElement} container - Container element
     * @param {Array} mainRequests - Main API requests
     * @param {Array} sectionRequests - Section API requests
     * @param {Array} changes - Array of changes
     */
    renderAPIDiff(container, mainRequests, sectionRequests, changes = []) {
        // Build request map
        const requestMap = new Map();

        // Add main requests
        (mainRequests || []).forEach(req => {
            const key = `${req.method}:${req.url}`;
            requestMap.set(key, { main: req, section: null, status: 'removed' });
        });

        // Add section requests
        (sectionRequests || []).forEach(req => {
            const key = `${req.method}:${req.url}`;
            if (requestMap.has(key)) {
                const item = requestMap.get(key);
                item.section = req;
                item.status = this.compareRequests(item.main, req) ? 'unchanged' : 'modified';
            } else {
                requestMap.set(key, { main: null, section: req, status: 'added' });
            }
        });

        // Render table
        let html = `
      <table class="api-diff-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Method</th>
            <th>URL</th>
            <th>Response Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

        for (const [key, item] of requestMap) {
            const req = item.main || item.section;
            const statusClass = `status-${item.status}`;
            const statusLabel = this.getStatusLabel(item.status);

            html += `
        <tr>
          <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
          <td><strong>${req.method}</strong></td>
          <td class="api-url" title="${req.url}">${this.truncateUrl(req.url)}</td>
          <td>${this.getResponseStatus(item)}</td>
          <td>
            <button class="btn btn-xs btn-secondary" onclick="DiffViewer.showRequestDetails('${key}')">
              Chi tiết
            </button>
          </td>
        </tr>
      `;
        }

        html += '</tbody></table>';

        container.innerHTML = html;

        // Store data for detail view
        this.currentRequestMap = requestMap;
    },

    /**
     * Compare two requests for equality
     */
    compareRequests(main, section) {
        if (!main || !section) return false;

        // Compare status
        if (main.response?.status !== section.response?.status) return false;

        // Compare body (simplified)
        const mainBody = JSON.stringify(main.response?.body || {});
        const sectionBody = JSON.stringify(section.response?.body || {});

        return mainBody === sectionBody;
    },

    /**
     * Get status label
     */
    getStatusLabel(status) {
        switch (status) {
            case 'added': return 'Mới';
            case 'removed': return 'Đã xóa';
            case 'modified': return 'Thay đổi';
            default: return 'Không đổi';
        }
    },

    /**
     * Get response status display
     */
    getResponseStatus(item) {
        const mainStatus = item.main?.response?.status || '-';
        const sectionStatus = item.section?.response?.status || '-';

        if (mainStatus === sectionStatus) {
            return `<span>${mainStatus}</span>`;
        }

        return `
      <span style="color: var(--diff-main);">${mainStatus}</span>
      →
      <span style="color: var(--diff-section);">${sectionStatus}</span>
    `;
    },

    /**
     * Truncate URL for display
     */
    truncateUrl(url) {
        if (url.length <= 60) return url;
        return url.substring(0, 30) + '...' + url.substring(url.length - 25);
    },

    /**
     * Show request details in a modal or panel
     */
    showRequestDetails(key) {
        if (!this.currentRequestMap || !this.currentRequestMap.has(key)) return;

        const item = this.currentRequestMap.get(key);
        const main = item.main;
        const section = item.section;

        // Create detail view
        const detailHtml = `
      <div class="request-detail">
        <h4>Request Details</h4>
        <div class="diff-container">
          <div class="diff-panel main-panel">
            <div class="diff-label">Main</div>
            <div class="diff-content">
              <pre>${main ? JSON.stringify(main, null, 2) : 'N/A'}</pre>
            </div>
          </div>
          <div class="diff-panel section-panel">
            <div class="diff-label">Section</div>
            <div class="diff-content">
              <pre>${section ? JSON.stringify(section, null, 2) : 'N/A'}</pre>
            </div>
          </div>
        </div>
      </div>
    `;

        // Show in a modal or alert (simplified)
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h3>Request: ${key}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">${detailHtml}</div>
      </div>
    `;

        modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        document.body.appendChild(modal);
    },

    /**
     * Render change summary
     */
    renderChangeSummary(container, changes) {
        if (!changes || changes.length === 0) {
            container.innerHTML = `
        <div class="compare-summary">
          <div class="compare-stat success">
            <div class="compare-stat-value">✓</div>
            <div class="compare-stat-label">Không có thay đổi</div>
          </div>
        </div>
      `;
            return;
        }

        // Group changes by type
        const groups = {
            added: changes.filter(c => c.type === 'added'),
            removed: changes.filter(c => c.type === 'removed'),
            modified: changes.filter(c => c.type === 'modified' || c.type === 'text' || c.type === 'structure')
        };

        let html = '<div class="compare-summary">';

        if (groups.added.length > 0) {
            html += `
        <div class="compare-stat" style="background: var(--success-bg);">
          <div class="compare-stat-value" style="color: var(--success);">+${groups.added.length}</div>
          <div class="compare-stat-label">Thêm mới</div>
        </div>
      `;
        }

        if (groups.removed.length > 0) {
            html += `
        <div class="compare-stat" style="background: var(--danger-bg);">
          <div class="compare-stat-value" style="color: var(--danger);">-${groups.removed.length}</div>
          <div class="compare-stat-label">Đã xóa</div>
        </div>
      `;
        }

        if (groups.modified.length > 0) {
            html += `
        <div class="compare-stat" style="background: var(--warning-bg);">
          <div class="compare-stat-value" style="color: var(--warning);">~${groups.modified.length}</div>
          <div class="compare-stat-label">Thay đổi</div>
        </div>
      `;
        }

        html += '</div>';

        // Change details
        html += '<div class="change-list" style="margin-top: 16px;">';
        changes.forEach(change => {
            const typeClass = change.type === 'added' ? 'added' :
                change.type === 'removed' ? 'removed' : 'modified';
            html += `
        <div class="change-item ${typeClass}">
          <div class="change-message">${change.message || change.type}</div>
        </div>
      `;
        });
        html += '</div>';

        container.innerHTML = html;
    },

    /**
     * Escape HTML for display
     */
    escapeHtml(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    },

    /**
     * Escape regex special characters
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
};

// Export for use
window.DiffViewer = DiffViewer;
