/**
 * Quality Settings UI Component
 * Hiển thị và quản lý cấu hình chất lượng của hệ thống
 */

(function() {
  'use strict';

  class QualitySettingsUI {
    constructor() {
      this.qualityManager = null;
      this.isOpen = false;
      this.initialized = false; // Prevent multiple init
    }

    initialize(qualityManager) {
      // CRITICAL: Prevent multiple initialization
      if (this.initialized) {
        console.warn('[QualitySettingsUI] Already initialized, skipping');
        return;
      }

      this.qualityManager = qualityManager;
      this.createUI();
      this.attachEventListeners();
      this.updateDisplay();
      this.initialized = true;
      console.log('[QualitySettingsUI] Initialized successfully');
    }

    createUI() {
      // CRITICAL: Check if already created (prevent duplicates)
      if (document.getElementById('quality-settings-modal')) {
        console.warn('[QualitySettingsUI] Modal already exists, skipping creation');
        return;
      }

      // NOTE: Button is now in HTML (perfMetricsToggleBtn), no longer created here
      // This prevents duplicate Performance buttons in the header

      // Tạo modal settings
      const modal = document.createElement('div');
      modal.id = 'quality-settings-modal';
      modal.className = 'quality-modal'; // NO 'active' class - closed by default
      modal.innerHTML = `
        <div class="quality-modal-overlay"></div>
        <div class="quality-modal-content">
          <div class="quality-modal-header">
            <h3>⚙️ Cấu Hình Chất Lượng</h3>
            <button class="quality-close-btn">&times;</button>
          </div>

          <div class="quality-modal-body">
            <!-- Current Status -->
            <div class="quality-status-section">
              <div class="quality-status-header">
                <strong>Cấu hình hiện tại:</strong>
                <span id="current-quality-display" class="quality-current-badge"></span>
              </div>
              <div id="quality-description" class="quality-description"></div>
            </div>

            <!-- Quality Options -->
            <div class="quality-options-section">
              <h4>Chọn chế độ:</h4>

              <div class="quality-option" data-quality="auto">
                <input type="radio" id="quality-auto" name="quality" value="auto">
                <label for="quality-auto">
                  <div class="quality-option-header">
                    <strong>🔄 Tự động (Auto)</strong>
                    <span class="quality-recommended">Khuyến nghị</span>
                  </div>
                  <p class="quality-option-desc">
                    Hệ thống tự động phát hiện cấu hình máy và chọn mức chất lượng phù hợp.
                  </p>
                  <div class="quality-details">
                    <strong>Hoạt động:</strong>
                    <ul>
                      <li>CPU ≤ 2 cores hoặc RAM ≤ 2GB → <strong>Low</strong></li>
                      <li>CPU ≤ 4 cores hoặc RAM ≤ 4GB → <strong>Medium</strong></li>
                      <li>CPU > 4 cores và RAM > 4GB → <strong>High</strong></li>
                    </ul>
                  </div>
                </label>
              </div>

              <div class="quality-option" data-quality="low">
                <input type="radio" id="quality-low" name="quality" value="low">
                <label for="quality-low">
                  <div class="quality-option-header">
                    <strong>⚡ Thấp (Low)</strong>
                    <span class="quality-tag quality-tag-low">Nhanh nhất</span>
                  </div>
                  <p class="quality-option-desc">
                    Tối ưu cho máy yếu hoặc khi cần tốc độ tối đa.
                  </p>
                  <div class="quality-specs">
                    <div class="quality-spec-item">
                      <span class="spec-label">Animations:</span>
                      <span class="spec-value spec-disabled">❌ Tắt</span>
                    </div>
                    <div class="quality-spec-item">
                      <span class="spec-label">Chất lượng ảnh:</span>
                      <span class="spec-value">50%</span>
                    </div>
                    <div class="quality-spec-item">
                      <span class="spec-label">FPS giới hạn:</span>
                      <span class="spec-value">30 FPS</span>
                    </div>
                  </div>
                  <div class="quality-use-case">
                    <strong>Phù hợp cho:</strong> Máy cấu hình thấp, cần tiết kiệm pin, kết nối mạng chậm
                  </div>
                </label>
              </div>

              <div class="quality-option" data-quality="medium">
                <input type="radio" id="quality-medium" name="quality" value="medium">
                <label for="quality-medium">
                  <div class="quality-option-header">
                    <strong>⚖️ Trung bình (Medium)</strong>
                    <span class="quality-tag quality-tag-medium">Cân bằng</span>
                  </div>
                  <p class="quality-option-desc">
                    Cân bằng giữa hiệu suất và chất lượng hiển thị.
                  </p>
                  <div class="quality-specs">
                    <div class="quality-spec-item">
                      <span class="spec-label">Animations:</span>
                      <span class="spec-value spec-enabled">✓ Bật</span>
                    </div>
                    <div class="quality-spec-item">
                      <span class="spec-label">Chất lượng ảnh:</span>
                      <span class="spec-value">75%</span>
                    </div>
                    <div class="quality-spec-item">
                      <span class="spec-label">FPS giới hạn:</span>
                      <span class="spec-value">45 FPS</span>
                    </div>
                  </div>
                  <div class="quality-use-case">
                    <strong>Phù hợp cho:</strong> Máy cấu hình trung bình, sử dụng hàng ngày
                  </div>
                </label>
              </div>

              <div class="quality-option" data-quality="high">
                <input type="radio" id="quality-high" name="quality" value="high">
                <label for="quality-high">
                  <div class="quality-option-header">
                    <strong>✨ Cao (High)</strong>
                    <span class="quality-tag quality-tag-high">Chất lượng tốt nhất</span>
                  </div>
                  <p class="quality-option-desc">
                    Chất lượng hiển thị và hiệu ứng tối đa.
                  </p>
                  <div class="quality-specs">
                    <div class="quality-spec-item">
                      <span class="spec-label">Animations:</span>
                      <span class="spec-value spec-enabled">✓ Bật (Full)</span>
                    </div>
                    <div class="quality-spec-item">
                      <span class="spec-label">Chất lượng ảnh:</span>
                      <span class="spec-value">100%</span>
                    </div>
                    <div class="quality-spec-item">
                      <span class="spec-label">FPS giới hạn:</span>
                      <span class="spec-value">60 FPS</span>
                    </div>
                  </div>
                  <div class="quality-use-case">
                    <strong>Phù hợp cho:</strong> Máy cấu hình mạnh, demo, presentation
                  </div>
                </label>
              </div>
            </div>

            <!-- System Info -->
            <div class="quality-system-info">
              <h4>📊 Thông tin hệ thống:</h4>
              <div class="system-info-grid">
                <div class="system-info-item">
                  <span class="info-label">CPU Cores:</span>
                  <span id="system-cores" class="info-value">-</span>
                </div>
                <div class="system-info-item">
                  <span class="info-label">Memory:</span>
                  <span id="system-memory" class="info-value">-</span>
                </div>
                <div class="system-info-item">
                  <span class="info-label">Khuyến nghị:</span>
                  <span id="system-recommendation" class="info-value">-</span>
                </div>
              </div>
            </div>
          </div>

          <div class="quality-modal-footer">
            <button id="quality-apply-btn" class="btn-primary">Áp dụng</button>
            <button id="quality-cancel-btn" class="btn-secondary">Hủy</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Add CSS
      this.injectStyles();
    }

    injectStyles() {
      const style = document.createElement('style');
      style.textContent = `
        .quality-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #52c41a;
        }

        .quality-badge.low { background: #ff4d4f; }
        .quality-badge.medium { background: #faad14; }
        .quality-badge.high { background: #52c41a; }

        .quality-modal {
          display: none;
          position: fixed;
          top: 60px;
          right: 20px;
          z-index: 10000;
        }

        .quality-modal.active {
          display: block;
        }

        .quality-modal-overlay {
          display: none;
        }

        .quality-modal-content {
          position: relative;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          width: 320px;
          max-height: 500px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .quality-modal-header {
          padding: 12px 16px;
          border-bottom: 1px solid #e8e8e8;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .quality-modal-header h3 {
          margin: 0;
          font-size: 14px;
          color: #262626;
        }

        .quality-close-btn {
          background: none;
          border: none;
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          color: #8c8c8c;
          padding: 0;
          width: 24px;
          height: 24px;
        }

        .quality-close-btn:hover {
          color: #262626;
        }

        .quality-modal-body {
          padding: 12px;
          overflow-y: auto;
          flex: 1;
        }

        .quality-status-section {
          background: #f0f2f5;
          padding: 10px;
          border-radius: 6px;
          margin-bottom: 12px;
        }

        .quality-status-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 12px;
        }

        .quality-current-badge {
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .quality-current-badge.auto { background: #d9d9d9; color: #595959; }
        .quality-current-badge.low { background: #fff1f0; color: #ff4d4f; }
        .quality-current-badge.medium { background: #fffbe6; color: #faad14; }
        .quality-current-badge.high { background: #f6ffed; color: #52c41a; }

        .quality-description {
          font-size: 11px;
          color: #595959;
          line-height: 1.4;
        }

        .quality-options-section h4 {
          margin: 0 0 10px 0;
          font-size: 13px;
          color: #262626;
        }

        .quality-option {
          border: 1px solid #d9d9d9;
          border-radius: 6px;
          padding: 10px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .quality-option:hover {
          border-color: #40a9ff;
          background: #f0f7ff;
        }

        .quality-option input[type="radio"] {
          display: none;
        }

        .quality-option input[type="radio"]:checked + label {
          cursor: default;
        }

        .quality-option:has(input:checked) {
          border-color: #1890ff;
          background: #e6f7ff;
        }

        .quality-option label {
          cursor: pointer;
          display: block;
        }

        .quality-option-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .quality-option-header strong {
          font-size: 12px;
          color: #262626;
        }

        .quality-recommended {
          background: #52c41a;
          color: white;
          padding: 1px 6px;
          border-radius: 3px;
          font-size: 9px;
          font-weight: 600;
        }

        .quality-tag {
          padding: 1px 6px;
          border-radius: 3px;
          font-size: 9px;
          font-weight: 600;
        }

        .quality-tag-low { background: #fff1f0; color: #ff4d4f; }
        .quality-tag-medium { background: #fffbe6; color: #faad14; }
        .quality-tag-high { background: #f6ffed; color: #52c41a; }

        .quality-option-desc {
          font-size: 11px;
          color: #595959;
          margin: 6px 0;
        }

        .quality-details,
        .quality-specs,
        .quality-use-case {
          margin-top: 8px;
          padding: 8px;
          background: rgba(255,255,255,0.6);
          border-radius: 4px;
        }

        .quality-details strong,
        .quality-use-case strong {
          font-size: 10px;
          color: #262626;
          display: block;
          margin-bottom: 4px;
        }

        .quality-details ul {
          margin: 0;
          padding-left: 16px;
          font-size: 10px;
          color: #595959;
        }

        .quality-details li {
          margin: 2px 0;
        }

        .quality-spec-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 4px 0;
          font-size: 11px;
        }

        .spec-label {
          color: #595959;
          font-weight: 500;
        }

        .spec-value {
          font-weight: 600;
          color: #262626;
        }

        .spec-enabled {
          color: #52c41a;
        }

        .spec-disabled {
          color: #ff4d4f;
        }

        .quality-use-case {
          font-size: 10px;
          color: #595959;
        }

        .quality-system-info {
          margin-top: 12px;
          padding: 10px;
          background: #fafafa;
          border-radius: 6px;
        }

        .quality-system-info h4 {
          margin: 0 0 8px 0;
          font-size: 12px;
          color: #262626;
        }

        .system-info-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .system-info-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .info-label {
          font-size: 10px;
          color: #8c8c8c;
        }

        .info-value {
          font-size: 11px;
          font-weight: 600;
          color: #262626;
        }

        .quality-modal-footer {
          padding: 10px 12px;
          border-top: 1px solid #e8e8e8;
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .btn-primary,
        .btn-secondary {
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-primary {
          background: #1890ff;
          color: white;
        }

        .btn-primary:hover {
          background: #40a9ff;
        }

        .btn-secondary {
          background: #fff;
          color: #262626;
          border: 1px solid #d9d9d9;
        }

        .btn-secondary:hover {
          border-color: #40a9ff;
          color: #40a9ff;
        }

        @media (max-width: 768px) {
          .quality-modal-content {
            width: 95%;
          }

          .system-info-grid {
            grid-template-columns: 1fr;
          }
        }
      `;
      document.head.appendChild(style);
    }

    attachEventListeners() {
      // Open modal using the existing perfMetricsToggleBtn from HTML
      // This button now opens the quality settings modal
      const btn = document.getElementById('perfMetricsToggleBtn');
      if (btn) {
        // Remove existing onclick to replace with our handler
        btn.removeAttribute('onclick');
        btn.addEventListener('click', () => this.openModal());
      }

      // Close modal
      const modal = document.getElementById('quality-settings-modal');
      if (!modal) {
        console.error('[QualitySettingsUI] Modal not found in attachEventListeners');
        return;
      }

      const closeBtn = modal.querySelector('.quality-close-btn');
      const overlay = modal.querySelector('.quality-modal-overlay');
      const cancelBtn = document.getElementById('quality-cancel-btn');

      if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
      if (overlay) overlay.addEventListener('click', () => this.closeModal());
      if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeModal());

      // Quality option click
      const options = modal.querySelectorAll('.quality-option');
      options.forEach(option => {
        option.addEventListener('click', () => {
          const radio = option.querySelector('input[type="radio"]');
          radio.checked = true;
        });
      });

      // Apply button
      const applyBtn = document.getElementById('quality-apply-btn');
      if (applyBtn) {
        applyBtn.addEventListener('click', () => this.applyQuality());
      }

      // ESC key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.closeModal();
        }
      });
    }

    openModal() {
      const modal = document.getElementById('quality-settings-modal');
      if (!modal) {
        console.error('[QualitySettingsUI] Cannot open modal - not found');
        return;
      }

      if (this.isOpen) {
        console.warn('[QualitySettingsUI] Modal already open');
        return;
      }

      modal.classList.add('active');
      this.isOpen = true;
      console.log('[QualitySettingsUI] Modal opened');

      // Update current selection
      const currentQuality = this.qualityManager.currentQuality;
      const radio = document.getElementById(`quality-${currentQuality}`);
      if (radio) radio.checked = true;

      // Update system info
      this.updateSystemInfo();
      this.updateCurrentDescription();
    }

    closeModal() {
      const modal = document.getElementById('quality-settings-modal');
      if (!modal) {
        console.error('[QualitySettingsUI] Cannot close modal - not found');
        return;
      }

      modal.classList.remove('active');
      this.isOpen = false;
      console.log('[QualitySettingsUI] Modal closed');
    }

    applyQuality() {
      const selected = document.querySelector('input[name="quality"]:checked');
      if (selected) {
        this.qualityManager.setQuality(selected.value);
        this.updateDisplay();
        this.closeModal();

        // Show notification
        this.showNotification(`Đã chuyển sang chế độ: ${this.getQualityLabel(selected.value)}`);
      }
    }

    updateDisplay() {
      const indicator = document.getElementById('quality-indicator');
      const appliedQuality = this.qualityManager.appliedQuality;

      if (indicator) {
        indicator.className = `quality-badge ${appliedQuality}`;
      }

      this.updateCurrentDescription();
    }

    updateCurrentDescription() {
      const currentQuality = this.qualityManager.currentQuality;
      const appliedQuality = this.qualityManager.appliedQuality;
      const badge = document.getElementById('current-quality-display');
      const description = document.getElementById('quality-description');

      if (badge) {
        badge.textContent = this.getQualityLabel(currentQuality);
        badge.className = `quality-current-badge ${currentQuality}`;
      }

      if (description) {
        let desc = '';
        if (currentQuality === 'auto') {
          desc = `Hệ thống đang tự động sử dụng chế độ <strong>${this.getQualityLabel(appliedQuality)}</strong> dựa trên cấu hình máy của bạn.`;
        } else {
          desc = `Bạn đang sử dụng chế độ <strong>${this.getQualityLabel(appliedQuality)}</strong> cố định.`;
        }
        description.innerHTML = desc;
      }
    }

    updateSystemInfo() {
      const cores = navigator.hardwareConcurrency || 'Unknown';
      const memory = navigator.deviceMemory || 'Unknown';
      const recommendation = this.qualityManager.detectTier();

      document.getElementById('system-cores').textContent = cores;
      document.getElementById('system-memory').textContent =
        memory !== 'Unknown' ? `${memory} GB` : memory;
      document.getElementById('system-recommendation').textContent =
        this.getQualityLabel(recommendation);

      // Thêm performance metrics nếu optimizer đang chạy
      if (window.performanceOptimizer) {
        const metrics = window.performanceOptimizer.getMetrics();
        const perfInfo = document.createElement('div');
        perfInfo.className = 'performance-live-metrics';
        perfInfo.innerHTML = `
          <h4 style="margin: 12px 0 8px 0; font-size: 13px; color: #262626;">📈 Performance Metrics (Real-time):</h4>
          <div class="perf-metrics-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #595959;">Average FPS:</span>
              <strong style="color: ${metrics.avgFPS < 45 ? '#ff4d4f' : '#52c41a'};">${metrics.avgFPS}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #595959;">Min FPS:</span>
              <strong>${metrics.minFPS}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #595959;">Lag %:</span>
              <strong style="color: ${metrics.lagPercentage > 15 ? '#ff4d4f' : '#52c41a'};">${metrics.lagPercentage}%</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #595959;">Memory:</span>
              <strong style="color: ${metrics.memoryUsage > 70 ? '#ff4d4f' : '#52c41a'};">${metrics.memoryUsage}%</strong>
            </div>
            <div style="display: flex; justify-content: space-between; grid-column: 1 / -1;">
              <span style="color: #595959;">Current Quality:</span>
              <strong style="color: #1890ff;">${metrics.currentTier.toUpperCase()}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; grid-column: 1 / -1;">
              <span style="color: #595959;">Status:</span>
              <strong style="color: ${metrics.isStable ? '#52c41a' : '#faad14'};">
                ${metrics.isStable ? '✓ Stable' : '⚠ Unstable'}
              </strong>
            </div>
          </div>
          ${metrics.isAutoMode ? '<p style="margin: 8px 0 0 0; font-size: 11px; color: #8c8c8c;">🔄 Auto-optimization is active</p>' : '<p style="margin: 8px 0 0 0; font-size: 11px; color: #8c8c8c;">🔒 Manual mode - no auto-adjustment</p>'}
        `;

        const systemInfo = document.querySelector('.quality-system-info');
        const existingPerfInfo = systemInfo.querySelector('.performance-live-metrics');
        if (existingPerfInfo) {
          existingPerfInfo.replaceWith(perfInfo);
        } else {
          systemInfo.appendChild(perfInfo);
        }
      }
    }

    getQualityLabel(quality) {
      const labels = {
        auto: 'Tự động',
        low: 'Thấp',
        medium: 'Trung bình',
        high: 'Cao'
      };
      return labels[quality] || quality;
    }

    showNotification(message) {
      // Simple notification (you can enhance this)
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 24px;
        background: #52c41a;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10001;
        font-size: 14px;
        animation: slideIn 0.3s ease;
      `;
      notification.textContent = message;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
      }, 3000);

      // Add animations
      if (!document.querySelector('#notification-animations')) {
        const style = document.createElement('style');
        style.id = 'notification-animations';
        style.textContent = `
          @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }
    }
  }

  // Export
  window.QualitySettingsUI = QualitySettingsUI;
})();
