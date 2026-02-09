/**
 * Document Compare Module
 * Overlay mode with annotations and version comparison
 */

class DocumentCompare {
  constructor() {
    this.currentDocument = null;
    this.documents = [];
    this.annotations = [];
    this.isComparing = false;
    this.overlayMode = 'v1'; // 'v1', 'v2', 'diff'
    this.selectedV1 = null;
    this.selectedV2 = null;
    this.compareData = null;
    this.init();
  }

  // Self-contained fetch helper (no dependency on window.api)
  async _fetch(url, options = {}) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    const contentType = response.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      if (!response.ok) throw new Error(`Server Error (${response.status})`);
      return text;
    }
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  }

  init() {
    this.setupEventListeners();
    this.setupDropZone();
  }

  setupEventListeners() {
    // Tab switching
    const tabs = document.querySelectorAll('.tab-btn[data-tab="documents"]');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.loadDocuments();
      });
    });

    // Document search
    const searchInput = document.getElementById('docSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterDocuments(e.target.value);
      });
    }
  }

  setupDropZone() {
    const dropZone = document.getElementById('docDropZone');
    const fileInput = document.getElementById('docFileInput');

    if (!dropZone || !fileInput) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', async (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        await this.uploadFiles(Array.from(files));
      }
    });
  }

  async loadDocuments() {
    if (!window.state.currentProject) {
      this.showEmptyState('Chọn project để xem tài liệu');
      return;
    }

    try {
      const response = await this._fetch(
        `/api/documents/${encodeURIComponent(window.state.currentProject)}`
      );

      if (response.success) {
        this.documents = response.documents || [];
        this.renderDocumentList();
        this.updateDocCount();
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
      this.showError('Không thể tải danh sách tài liệu');
    }
  }

  renderDocumentList() {
    const listContainer = document.getElementById('docList');
    const dropZone = document.getElementById('docDropZone');

    if (!listContainer) return;

    if (this.documents.length === 0) {
      dropZone.style.display = 'flex';
      listContainer.innerHTML = '';
      return;
    }

    dropZone.style.display = 'none';

    listContainer.innerHTML = this.documents.map(doc => `
      <div class="doc-card" data-doc-id="${doc.id}" onclick="docCompare.openDocument('${doc.id}')">
        <div class="doc-card-icon">
          ${this.getDocIcon(doc.type)}
        </div>
        <div class="doc-card-info">
          <div class="doc-card-name" title="${doc.name}">${doc.name}</div>
          <div class="doc-card-meta">
            <span class="doc-card-versions">${doc.versions.length} version(s)</span>
            <span class="doc-card-date">${this.formatDate(doc.updatedAt || doc.createdAt)}</span>
          </div>
        </div>
        <div class="doc-card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-xs" onclick="docCompare.downloadLatest('${doc.id}')" title="Download latest">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 11V1M4 7l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12v2h12v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="btn btn-ghost btn-xs" onclick="docCompare.deleteDocument('${doc.id}')" title="Xóa">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 4h10M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5 4v8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');
  }

  async openDocument(docId) {
    try {
      const response = await this._fetch(
        `/api/documents/${encodeURIComponent(window.state.currentProject)}/${docId}`
      );

      if (response.success) {
        this.currentDocument = response.document;
        this.showDocumentDetail();
      }
    } catch (error) {
      console.error('Failed to load document:', error);
      this.showError('Không thể tải tài liệu');
    }
  }

  showDocumentDetail() {
    const listContainer = document.getElementById('docList');
    const detailContainer = document.getElementById('docDetail');
    const nameEl = document.getElementById('docDetailName');
    const versionsEl = document.getElementById('docVersions');

    if (!detailContainer || !this.currentDocument) return;

    listContainer.style.display = 'none';
    detailContainer.style.display = 'flex';
    nameEl.textContent = this.currentDocument.name;

    // Render versions list
    const versions = [...this.currentDocument.versions].reverse();
    versionsEl.innerHTML = `
      <div class="version-list-header">
        <h4>Versions</h4>
        ${versions.length > 1 ? `
          <button class="btn btn-primary btn-xs" onclick="docCompare.startCompare()">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="vertical-align:-2px">
              <path d="M2 8h6M8 8h6M5 5l3 3-3 3M11 5l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            So sánh versions
          </button>
        ` : ''}
      </div>
      <div class="version-list">
        ${versions.map(v => `
          <div class="version-item" data-version="${v.version}">
            <div class="version-item-header">
              <div>
                <span class="version-badge">v${v.version}</span>
                ${v.version === versions[0].version ? '<span class="version-latest">Latest</span>' : ''}
              </div>
              <div class="version-actions">
                <button class="btn btn-ghost btn-xs" onclick="docCompare.previewVersion(${v.version})" title="Xem preview">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.3"/>
                    <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.3"/>
                  </svg>
                </button>
                <button class="btn btn-ghost btn-xs" onclick="docCompare.downloadVersion(${v.version})" title="Download">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M8 11V1M4 7l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M2 12v2h12v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </button>
                ${versions.length > 1 ? `
                  <button class="btn btn-ghost btn-xs" onclick="docCompare.deleteVersion(${v.version})" title="Xóa">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3 4h10M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5 4v8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                  </button>
                ` : ''}
              </div>
            </div>
            <div class="version-meta">
              <span>${this.formatDate(v.uploadedAt)}</span>
              <span>${this.formatSize(v.size)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Reset preview area
    this.showPreviewEmpty();
    this.closeDocCompare();
  }

  async previewVersion(version) {
    const previewArea = document.getElementById('docPreviewArea');
    if (!previewArea || !this.currentDocument) return;

    try {
      previewArea.innerHTML = '<div class="loading-spinner">Đang tải...</div>';

      const response = await this._fetch(
        `/api/documents/${encodeURIComponent(window.state.currentProject)}/${this.currentDocument.id}/${version}/preview`
      );

      if (!response.success) throw new Error('Preview failed');

      this.renderPreview(response, previewArea, version);
    } catch (error) {
      console.error('Preview error:', error);
      previewArea.innerHTML = '<div class="empty-state"><p>Không thể preview file này</p></div>';
    }
  }

  renderPreview(data, container, version) {
    if (data.type === 'html') {
      container.innerHTML = `
        <div class="preview-header">
          <span class="version-badge">v${version}</span>
          <span>Word Document</span>
        </div>
        <div class="preview-content preview-html">
          ${data.content}
        </div>
      `;
    } else if (data.type === 'excel') {
      const sheetsHTML = data.sheetNames.map(name => `
        <div class="excel-sheet">
          <div class="excel-sheet-name">${name}</div>
          <div class="excel-table-wrapper">
            <table class="excel-table">
              ${data.sheets[name].map(row => `
                <tr>${row.map(cell => `<td>${cell || ''}</td>`).join('')}</tr>
              `).join('')}
            </table>
          </div>
        </div>
      `).join('');

      container.innerHTML = `
        <div class="preview-header">
          <span class="version-badge">v${version}</span>
          <span>Excel Spreadsheet</span>
        </div>
        <div class="preview-content preview-excel">
          ${sheetsHTML}
        </div>
      `;
    } else if (data.type === 'pdf') {
      container.innerHTML = `
        <div class="preview-header">
          <span class="version-badge">v${version}</span>
          <span>PDF Document</span>
        </div>
        <div class="preview-content preview-pdf">
          <iframe src="${data.url}" style="width:100%;height:100%;border:none"></iframe>
        </div>
      `;
    } else if (data.type === 'text') {
      container.innerHTML = `
        <div class="preview-header">
          <span class="version-badge">v${version}</span>
          <span>Text File</span>
        </div>
        <div class="preview-content preview-text">
          <pre>${this.escapeHtml(data.content)}</pre>
        </div>
      `;
    } else {
      container.innerHTML = '<div class="empty-state"><p>Preview không khả dụng cho loại file này</p></div>';
    }
  }

  startCompare() {
    if (!this.currentDocument || this.currentDocument.versions.length < 2) {
      return;
    }

    const versions = this.currentDocument.versions;
    const latestVersion = versions[versions.length - 1].version;
    const previousVersion = versions[versions.length - 2].version;

    this.showCompareSelector(previousVersion, latestVersion);
  }

  showCompareSelector(defaultV1, defaultV2) {
    const compareArea = document.getElementById('docCompareArea');
    const previewArea = document.getElementById('docPreviewArea');

    if (!compareArea) return;

    previewArea.style.display = 'none';
    compareArea.style.display = 'block';

    const versions = this.currentDocument.versions;
    const versionsOptions = versions.map(v =>
      `<option value="${v.version}">v${v.version} - ${this.formatDate(v.uploadedAt)}</option>`
    ).join('');

    compareArea.innerHTML = `
      <div class="doc-compare-header">
        <h4>So sánh versions</h4>
        <button class="btn btn-ghost btn-xs" onclick="docCompare.closeDocCompare()">Đóng</button>
      </div>
      <div class="compare-selector">
        <div class="compare-selector-item">
          <label>Version 1 (cũ):</label>
          <select id="compareV1Select" class="select-input">
            ${versionsOptions}
          </select>
        </div>
        <div class="compare-selector-arrow">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14M15 8l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="compare-selector-item">
          <label>Version 2 (mới):</label>
          <select id="compareV2Select" class="select-input">
            ${versionsOptions}
          </select>
        </div>
        <button class="btn btn-primary" onclick="docCompare.executeCompare()">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="vertical-align:-2px">
            <path d="M2 8h6M8 8h6M5 5l3 3-3 3M11 5l3 3-3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          So sánh
        </button>
      </div>
      <div id="compareResultArea" class="compare-result-area"></div>
    `;

    // Set default values
    document.getElementById('compareV1Select').value = defaultV1;
    document.getElementById('compareV2Select').value = defaultV2;
  }

  async executeCompare() {
    const v1 = parseInt(document.getElementById('compareV1Select').value);
    const v2 = parseInt(document.getElementById('compareV2Select').value);

    if (v1 === v2) {
      this.showError('Hãy chọn 2 version khác nhau để so sánh');
      return;
    }

    const resultArea = document.getElementById('compareResultArea');
    if (!resultArea) return;

    try {
      resultArea.innerHTML = '<div class="loading-spinner">Đang so sánh...</div>';

      const response = await this._fetch(
        `/api/documents/${encodeURIComponent(window.state.currentProject)}/${this.currentDocument.id}/compare?v1=${v1}&v2=${v2}`
      );

      if (!response.success) throw new Error('Compare failed');

      this.compareData = response;
      this.selectedV1 = v1;
      this.selectedV2 = v2;
      this.renderCompareResult(response);
    } catch (error) {
      console.error('Compare error:', error);
      resultArea.innerHTML = `<div class="error-state"><p>${error.message || 'Không thể so sánh'}</p></div>`;
    }
  }

  renderCompareResult(data) {
    const resultArea = document.getElementById('compareResultArea');
    if (!resultArea) return;

    const { stats, lineDiff, v1, v2 } = data;
    const changePercent = stats.total > 0 ?
      Math.round(((stats.added + stats.removed) / stats.total) * 100) : 0;

    resultArea.innerHTML = `
      <div class="compare-stats-panel">
        <div class="compare-stats-header">
          <h5>Thống kê thay đổi</h5>
          <div class="compare-stats-summary">
            <span class="stat-badge stat-added">+${stats.added}</span>
            <span class="stat-badge stat-removed">-${stats.removed}</span>
            <span class="stat-badge stat-change">${changePercent}% thay đổi</span>
          </div>
        </div>
      </div>

      <div class="overlay-controls">
        <div class="overlay-mode-switch">
          <button class="overlay-btn ${this.overlayMode === 'v1' ? 'active' : ''}" onclick="docCompare.setOverlayMode('v1')">
            <span class="version-badge">v${v1.version}</span> Cũ
          </button>
          <button class="overlay-btn ${this.overlayMode === 'diff' ? 'active' : ''}" onclick="docCompare.setOverlayMode('diff')">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="vertical-align:-2px">
              <path d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            Overlay Diff
          </button>
          <button class="overlay-btn ${this.overlayMode === 'v2' ? 'active' : ''}" onclick="docCompare.setOverlayMode('v2')">
            <span class="version-badge">v${v2.version}</span> Mới
          </button>
        </div>
        <div class="overlay-tools">
          <button class="btn btn-ghost btn-sm" onclick="docCompare.toggleAnnotations()" title="Bật/tắt annotations">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2h12v10H4l-2 2V2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Ghi chú
          </button>
          <button class="btn btn-ghost btn-sm" onclick="docCompare.askSaveCompare()" title="Lưu kết quả so sánh">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 15H4a2 2 0 01-2-2V3a2 2 0 012-2h6l4 4v8a2 2 0 01-2 2z" stroke="currentColor" stroke-width="1.5"/>
              <path d="M11 1v4h4M5 8h6M5 11h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Lưu
          </button>
        </div>
      </div>

      <div class="overlay-diff-container" id="overlayDiffContainer">
        ${this.renderOverlayContent(lineDiff)}
      </div>

      <div class="annotation-panel" id="annotationPanel" style="display:none">
        <div class="annotation-header">
          <h5>Ghi chú</h5>
          <button class="btn btn-ghost btn-xs" onclick="docCompare.toggleAnnotations()">✖</button>
        </div>
        <div class="annotation-list" id="annotationList">
          <div class="empty-state-small">Chưa có ghi chú nào</div>
        </div>
        <div class="annotation-input">
          <textarea id="annotationInput" placeholder="Nhập ghi chú..." rows="3"></textarea>
          <button class="btn btn-primary btn-sm" onclick="docCompare.addAnnotation()">Thêm</button>
        </div>
      </div>
    `;

    this.isComparing = true;
    this.overlayMode = 'diff';
  }

  renderOverlayContent(lineDiff) {
    if (this.overlayMode === 'v1') {
      // Show only old version
      return `<div class="overlay-content overlay-v1">
        <pre>${lineDiff.filter(p => !p.added).map(p => this.escapeHtml(p.value)).join('')}</pre>
      </div>`;
    } else if (this.overlayMode === 'v2') {
      // Show only new version
      return `<div class="overlay-content overlay-v2">
        <pre>${lineDiff.filter(p => !p.removed).map(p => this.escapeHtml(p.value)).join('')}</pre>
      </div>`;
    } else {
      // Overlay diff mode - show changes highlighted
      return `<div class="overlay-content overlay-diff">
        <pre>${lineDiff.map(part => {
        if (part.added) {
          return `<span class="diff-added">${this.escapeHtml(part.value)}</span>`;
        } else if (part.removed) {
          return `<span class="diff-removed">${this.escapeHtml(part.value)}</span>`;
        } else {
          return this.escapeHtml(part.value);
        }
      }).join('')}</pre>
      </div>`;
    }
  }

  setOverlayMode(mode) {
    this.overlayMode = mode;
    if (this.isComparing && this.compareData) {
      const container = document.getElementById('overlayDiffContainer');
      if (container) {
        container.innerHTML = this.renderOverlayContent(this.compareData.lineDiff);
      }

      // Update button states
      document.querySelectorAll('.overlay-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      document.querySelector(`.overlay-btn[onclick*="${mode}"]`)?.classList.add('active');
    }
  }

  toggleAnnotations() {
    const panel = document.getElementById('annotationPanel');
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  }

  addAnnotation() {
    const input = document.getElementById('annotationInput');
    const list = document.getElementById('annotationList');

    if (!input || !list) return;

    const text = input.value.trim();
    if (!text) return;

    const annotation = {
      id: Date.now(),
      text,
      timestamp: new Date().toISOString(),
      mode: this.overlayMode
    };

    this.annotations.push(annotation);
    this.renderAnnotations();
    input.value = '';
  }

  renderAnnotations() {
    const list = document.getElementById('annotationList');
    if (!list) return;

    if (this.annotations.length === 0) {
      list.innerHTML = '<div class="empty-state-small">Chưa có ghi chú nào</div>';
      return;
    }

    list.innerHTML = this.annotations.map(ann => `
      <div class="annotation-item">
        <div class="annotation-header-item">
          <span class="version-badge">${ann.mode}</span>
          <span class="annotation-time">${this.formatDate(ann.timestamp)}</span>
          <button class="btn btn-ghost btn-xs" onclick="docCompare.deleteAnnotation(${ann.id})">✖</button>
        </div>
        <div class="annotation-text">${this.escapeHtml(ann.text)}</div>
      </div>
    `).join('');
  }

  deleteAnnotation(id) {
    this.annotations = this.annotations.filter(a => a.id !== id);
    this.renderAnnotations();
  }

  async askSaveCompare() {
    const shouldSave = confirm(
      'Bạn có muốn lưu kết quả so sánh này?\n\n' +
      '- Lưu: Tạo file HTML chứa kết quả compare và annotations\n' +
      '- Không lưu: Chỉ xem tạm thời'
    );

    if (shouldSave) {
      await this.saveCompareResult();
    }
  }

  async saveCompareResult() {
    if (!this.isComparing || !this.compareData) return;

    try {
      const container = document.getElementById('overlayDiffContainer');
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Compare Result - ${this.currentDocument.name}</title>
  <style>
    body { font-family: 'Inter', sans-serif; margin: 20px; background: #f5f5f5; }
    .header { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; }
    .stats { display: flex; gap: 16px; margin-top: 12px; }
    .stat-badge { padding: 4px 12px; border-radius: 4px; font-size: 14px; font-weight: 500; }
    .stat-added { background: #dcfce7; color: #166534; }
    .stat-removed { background: #fee2e2; color: #991b1b; }
    .content { background: white; padding: 20px; border-radius: 8px; }
    .diff-added { background: #dcfce7; color: #166534; }
    .diff-removed { background: #fee2e2; color: #991b1b; text-decoration: line-through; }
    pre { white-space: pre-wrap; word-wrap: break-word; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.6; }
    .annotations { background: white; padding: 20px; margin-top: 20px; border-radius: 8px; }
    .annotation-item { padding: 12px; margin-bottom: 8px; background: #f9fafb; border-left: 3px solid #3b82f6; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${this.currentDocument.name}</h1>
    <p>So sánh: v${this.selectedV1} → v${this.selectedV2}</p>
    <div class="stats">
      <span class="stat-badge stat-added">+${this.compareData.stats.added} dòng</span>
      <span class="stat-badge stat-removed">-${this.compareData.stats.removed} dòng</span>
    </div>
  </div>
  <div class="content">
    ${container.innerHTML}
  </div>
  ${this.annotations.length > 0 ? `
    <div class="annotations">
      <h3>Ghi chú</h3>
      ${this.annotations.map(ann => `
        <div class="annotation-item">
          <strong>${ann.mode}</strong> - ${this.formatDate(ann.timestamp)}<br>
          ${this.escapeHtml(ann.text)}
        </div>
      `).join('')}
    </div>
  ` : ''}
  <p style="text-align: center; color: #999; margin-top: 40px; font-size: 12px;">
    Generated by MAPITesting Tool - ${this.formatDate(new Date().toISOString())}
  </p>
</body>
</html>
      `;

      // Download HTML file
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compare_${this.currentDocument.baseName}_v${this.selectedV1}-v${this.selectedV2}.html`;
      a.click();
      URL.revokeObjectURL(url);

      this.showSuccess('Đã lưu kết quả so sánh');
    } catch (error) {
      console.error('Save compare error:', error);
      this.showError('Không thể lưu kết quả');
    }
  }

  closeDocCompare() {
    const compareArea = document.getElementById('docCompareArea');
    const previewArea = document.getElementById('docPreviewArea');

    if (compareArea) compareArea.style.display = 'none';
    if (previewArea) {
      previewArea.style.display = 'block';
      this.showPreviewEmpty();
    }

    this.isComparing = false;
    this.annotations = [];
  }

  showPreviewEmpty() {
    const previewArea = document.getElementById('docPreviewArea');
    if (previewArea) {
      previewArea.innerHTML = '<div class="empty-state"><p>Chọn version để xem preview</p></div>';
    }
  }

  async uploadFiles(files) {
    if (!window.state.currentProject) {
      this.showError('Chọn project trước khi upload');
      return;
    }

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(
          `/api/documents/${encodeURIComponent(window.state.currentProject)}/upload`,
          {
            method: 'POST',
            body: formData
          }
        );

        const result = await response.json();

        if (result.success) {
          this.showSuccess(`Đã upload: ${file.name}`);
        } else {
          throw new Error(result.error || 'Upload failed');
        }
      } catch (error) {
        console.error('Upload error:', error);
        this.showError(`Lỗi upload ${file.name}: ${error.message}`);
      }
    }

    await this.loadDocuments();
  }

  async downloadLatest(docId) {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;

    const latestVersion = doc.versions[doc.versions.length - 1].version;
    this.downloadVersion(latestVersion, docId);
  }

  async downloadVersion(version, docId = this.currentDocument?.id) {
    if (!docId) return;

    const url = `/api/documents/${encodeURIComponent(window.state.currentProject)}/${docId}/${version}/download`;
    window.open(url, '_blank');
  }

  async deleteDocument(docId) {
    if (!confirm('Xác nhận xóa tài liệu này? Tất cả versions sẽ bị xóa.')) return;

    try {
      const response = await this._fetch(
        `/api/documents/${encodeURIComponent(window.state.currentProject)}/${docId}`,
        { method: 'DELETE' }
      );

      if (response.success) {
        this.showSuccess('Đã xóa tài liệu');
        await this.loadDocuments();
      }
    } catch (error) {
      console.error('Delete error:', error);
      this.showError('Không thể xóa tài liệu');
    }
  }

  async deleteCurrentDoc() {
    if (!this.currentDocument) return;
    await this.deleteDocument(this.currentDocument.id);
    this.closeDocDetail();
  }

  async deleteVersion(version) {
    if (!this.currentDocument) return;
    if (!confirm(`Xác nhận xóa version ${version}?`)) return;

    try {
      const response = await this._fetch(
        `/api/documents/${encodeURIComponent(window.state.currentProject)}/${this.currentDocument.id}/${version}`,
        { method: 'DELETE' }
      );

      if (response.success) {
        this.showSuccess('Đã xóa version');
        await this.openDocument(this.currentDocument.id);
      }
    } catch (error) {
      console.error('Delete version error:', error);
      this.showError(error.message || 'Không thể xóa version');
    }
  }

  filterDocuments(query) {
    const cards = document.querySelectorAll('.doc-card');
    const lowerQuery = query.toLowerCase();

    cards.forEach(card => {
      const name = card.querySelector('.doc-card-name').textContent.toLowerCase();
      card.style.display = name.includes(lowerQuery) ? 'flex' : 'none';
    });
  }

  updateDocCount() {
    const countEl = document.getElementById('docCount');
    if (countEl) {
      countEl.textContent = this.documents.length > 0 ? `${this.documents.length} tài liệu` : '';
    }
  }

  closeDocDetail() {
    const listContainer = document.getElementById('docList');
    const detailContainer = document.getElementById('docDetail');

    if (listContainer) listContainer.style.display = 'block';
    if (detailContainer) detailContainer.style.display = 'none';

    this.currentDocument = null;
    this.isComparing = false;
    this.annotations = [];
    this.loadDocuments();
  }

  getDocIcon(type) {
    const icons = {
      word: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="2" width="24" height="28" rx="2" fill="#2B579A"/>
        <path d="M12 10l2 8 2-8h2l2 8 2-8h2l-3 12h-2l-2-8-2 8h-2l-3-12h2z" fill="white"/>
      </svg>`,
      excel: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="2" width="24" height="28" rx="2" fill="#217346"/>
        <path d="M10 10h12v2H10zM10 14h12v2H10zM10 18h12v2H10z" fill="white" opacity="0.8"/>
        <rect x="10" y="10" width="12" height="12" stroke="white" stroke-width="1.5" fill="none"/>
        <path d="M16 10v12M10 16h12" stroke="white" stroke-width="1.5"/>
      </svg>`,
      pdf: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="2" width="24" height="28" rx="2" fill="#E74C3C"/>
        <text x="8" y="20" fill="white" font-size="10" font-weight="bold">PDF</text>
      </svg>`,
      text: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="2" width="24" height="28" rx="2" fill="#95A5A6"/>
        <path d="M10 10h12M10 14h12M10 18h8" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
      csv: `<svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="2" width="24" height="28" rx="2" fill="#16A085"/>
        <text x="8" y="20" fill="white" font-size="9" font-weight="bold">CSV</text>
      </svg>`
    };
    return icons[type] || icons.text;
  }

  formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Hôm nay';
    if (days === 1) return 'Hôm qua';
    if (days < 7) return `${days} ngày trước`;

    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showEmptyState(message) {
    const listContainer = document.getElementById('docList');
    const dropZone = document.getElementById('docDropZone');
    if (listContainer) listContainer.innerHTML = '';
    if (dropZone) {
      dropZone.style.display = 'flex';
      dropZone.querySelector('p').textContent = message;
    }
  }

  showSuccess(message) {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#10b981;color:white;padding:12px 24px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  showError(message) {
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#ef4444;color:white;padding:12px 24px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
}

// Global instance and helper functions
let docCompare;

function handleDocUpload(input) {
  if (input.files && input.files.length > 0) {
    docCompare.uploadFiles(Array.from(input.files));
    input.value = ''; // Reset input
  }
}

function closeDocDetail() {
  docCompare.closeDocDetail();
}

function deleteCurrentDoc() {
  docCompare.deleteCurrentDoc();
}

function closeDocCompare() {
  docCompare.closeDocCompare();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    docCompare = new DocumentCompare();
  });
} else {
  docCompare = new DocumentCompare();
}
