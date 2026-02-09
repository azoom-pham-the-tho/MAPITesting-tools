/**
 * Performance Optimizer - Smart Auto-Tuning System
 * Tự động điều chỉnh quality dựa trên FPS, lag detection và memory usage
 * CHỈ hoạt động khi user chọn mode "auto"
 */

class PerformanceOptimizer {
  constructor() {
    // FPS Tracking
    this.fps = 60;
    this.fpsHistory = [];
    this.fpsHistorySize = 60; // 60 frames = ~1 second at 60fps
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.rafId = null;

    // Lag Detection
    this.lagCount = 0;
    this.lagThreshold = 40; // FPS < 40 = lag
    this.consecutiveLagFrames = 0;
    this.lagTriggerThreshold = 30; // 30 consecutive bad frames = downgrade

    // Quality Management
    this.currentTier = 'medium';
    this.targetTier = 'medium';
    this.isAutoMode = true; // Chỉ optimize khi user chọn "auto"
    this.adjustmentCooldown = 10000; // 10 seconds giữa các lần điều chỉnh
    this.lastAdjustmentTime = 0;

    // Performance Metrics
    this.metrics = {
      avgFPS: 60,
      minFPS: 60,
      maxFPS: 60,
      lagPercentage: 0,
      memoryUsage: 0,
      isStable: true
    };

    // Thresholds for quality tiers
    this.qualityThresholds = {
      high: { minFPS: 55, maxLagPercent: 5 },
      medium: { minFPS: 45, maxLagPercent: 15 },
      low: { minFPS: 30, maxLagPercent: 30 }
    };

    // User preference
    this.userManualSelection = null; // null = auto, 'low'/'medium'/'high' = manual
  }

  /**
   * Khởi động optimizer
   */
  start() {
    console.log('[PerformanceOptimizer] Starting...');
    this.isRunning = true;
    this.startFPSTracking();
    this.startPeriodicAnalysis();

    // Listen to quality changes from UI
    window.addEventListener('qualityChanged', (e) => {
      this.handleQualityChange(e.detail.quality);
    });
  }

  /**
   * Dừng optimizer
   */
  stop() {
    console.log('[PerformanceOptimizer] Stopped');
    this.isRunning = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.analysisInterval) clearInterval(this.analysisInterval);
  }

  /**
   * Xử lý khi user thay đổi quality setting
   */
  handleQualityChange(quality) {
    console.log('[PerformanceOptimizer] User changed quality to:', quality);

    if (quality === 'auto') {
      this.isAutoMode = true;
      this.userManualSelection = null;
      console.log('[PerformanceOptimizer] AUTO MODE enabled - will optimize automatically');
    } else {
      this.isAutoMode = false;
      this.userManualSelection = quality;
      this.currentTier = quality;
      console.log('[PerformanceOptimizer] MANUAL MODE - respecting user choice:', quality);
    }
  }

  /**
   * Tracking FPS real-time
   */
  startFPSTracking() {
    const trackFrame = (currentTime) => {
      this.frameCount++;
      const delta = currentTime - this.lastFrameTime;

      if (delta >= 1000) { // Calculate FPS every second
        this.fps = Math.round((this.frameCount * 1000) / delta);
        this.fpsHistory.push(this.fps);

        if (this.fpsHistory.length > this.fpsHistorySize) {
          this.fpsHistory.shift();
        }

        // Detect lag
        if (this.fps < this.lagThreshold) {
          this.consecutiveLagFrames++;
          this.lagCount++;
        } else {
          this.consecutiveLagFrames = 0;
        }

        this.frameCount = 0;
        this.lastFrameTime = currentTime;

        // Auto-adjust if needed (chỉ khi auto mode)
        if (this.isAutoMode && this.consecutiveLagFrames >= this.lagTriggerThreshold) {
          this.considerDowngrade();
        }
      }

      if (this.isRunning) {
        this.rafId = requestAnimationFrame(trackFrame);
      }
    };

    this.rafId = requestAnimationFrame(trackFrame);
  }

  /**
   * Phân tích định kỳ (mỗi 5 giây)
   */
  startPeriodicAnalysis() {
    this.analysisInterval = setInterval(() => {
      this.analyzePerformance();
      this.updateMetrics();

      // Chỉ optimize khi ở auto mode
      if (this.isAutoMode) {
        this.optimizeQuality();
      }
    }, 5000);
  }

  /**
   * Phân tích hiệu năng hiện tại
   */
  analyzePerformance() {
    if (this.fpsHistory.length === 0) return;

    const avgFPS = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
    const minFPS = Math.min(...this.fpsHistory);
    const maxFPS = Math.max(...this.fpsHistory);
    const lagFrames = this.fpsHistory.filter(fps => fps < this.lagThreshold).length;
    const lagPercentage = (lagFrames / this.fpsHistory.length) * 100;

    // Get memory info if available
    let memoryUsage = 0;
    if (performance.memory) {
      memoryUsage = (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100;
    }

    this.metrics = {
      avgFPS: Math.round(avgFPS),
      minFPS,
      maxFPS,
      lagPercentage: Math.round(lagPercentage),
      memoryUsage: Math.round(memoryUsage),
      isStable: lagPercentage < 10 && avgFPS > 50
    };

    console.log('[PerformanceOptimizer] Metrics:', this.metrics);
  }

  /**
   * Tự động tối ưu quality (CHỈ khi auto mode)
   */
  optimizeQuality() {
    if (!this.isAutoMode) return;
    if (!this.canAdjust()) return;

    const { avgFPS, lagPercentage, memoryUsage } = this.metrics;
    let recommendedTier = this.currentTier;

    // Decision logic
    if (avgFPS < 35 || lagPercentage > 30 || memoryUsage > 85) {
      // Tình trạng XẤU → downgrade
      recommendedTier = this.getDowngradeTier(this.currentTier);
    } else if (avgFPS > 55 && lagPercentage < 5 && memoryUsage < 60) {
      // Tình trạng TỐT → có thể upgrade
      recommendedTier = this.getUpgradeTier(this.currentTier);
    }

    if (recommendedTier !== this.currentTier) {
      this.applyQualityTier(recommendedTier);
    }
  }

  /**
   * Xem xét hạ quality khi lag liên tục
   */
  considerDowngrade() {
    if (!this.isAutoMode) return;
    if (!this.canAdjust()) return;

    const newTier = this.getDowngradeTier(this.currentTier);
    if (newTier !== this.currentTier) {
      console.warn('[PerformanceOptimizer] Detecting continuous lag - downgrading quality');
      this.applyQualityTier(newTier);
      this.consecutiveLagFrames = 0; // Reset counter
    }
  }

  /**
   * Kiểm tra xem có thể điều chỉnh không (cooldown)
   */
  canAdjust() {
    const now = Date.now();
    if (now - this.lastAdjustmentTime < this.adjustmentCooldown) {
      return false;
    }
    return true;
  }

  /**
   * Áp dụng quality tier mới
   */
  applyQualityTier(tier) {
    if (tier === this.currentTier) return;

    console.log(`[PerformanceOptimizer] Changing quality: ${this.currentTier} → ${tier}`);

    this.currentTier = tier;
    this.lastAdjustmentTime = Date.now();

    // Notify quality manager
    if (window.qualityManager) {
      // Temporarily apply new tier (internal detection)
      window.qualityManager.appliedQuality = tier;
      window.qualityManager.applyQuality();
    }

    // Show notification
    this.showNotification(`Auto-adjusted to ${tier.toUpperCase()} quality for better performance`);

    // Dispatch event
    window.dispatchEvent(new CustomEvent('performanceOptimized', {
      detail: {
        tier,
        reason: this.getAdjustmentReason(),
        metrics: this.metrics
      }
    }));
  }

  /**
   * Lấy tier thấp hơn
   */
  getDowngradeTier(current) {
    const order = ['high', 'medium', 'low'];
    const index = order.indexOf(current);
    return index < order.length - 1 ? order[index + 1] : current;
  }

  /**
   * Lấy tier cao hơn
   */
  getUpgradeTier(current) {
    const order = ['low', 'medium', 'high'];
    const index = order.indexOf(current);
    return index < order.length - 1 ? order[index + 1] : current;
  }

  /**
   * Lý do điều chỉnh
   */
  getAdjustmentReason() {
    const { avgFPS, lagPercentage, memoryUsage } = this.metrics;

    if (avgFPS < 35) return 'Low FPS detected';
    if (lagPercentage > 30) return 'High lag percentage';
    if (memoryUsage > 85) return 'Memory critical';
    if (avgFPS > 55 && lagPercentage < 5) return 'Performance excellent';

    return 'Performance optimization';
  }

  /**
   * Update metrics display
   */
  updateMetrics() {
    const metricsEl = document.getElementById('performance-metrics');
    if (!metricsEl) return;

    const { avgFPS, minFPS, lagPercentage, memoryUsage, isStable } = this.metrics;
    const statusClass = isStable ? 'stable' : 'unstable';
    const mode = this.isAutoMode ? 'Auto' : this.userManualSelection.toUpperCase();

    metricsEl.innerHTML = `
      <div class="perf-metrics ${statusClass}">
        <div class="perf-mode">${mode}</div>
        <div class="perf-item">
          <span class="perf-label">FPS</span>
          <span class="perf-value ${avgFPS < 45 ? 'warning' : ''}">${avgFPS}</span>
        </div>
        <div class="perf-item">
          <span class="perf-label">Lag</span>
          <span class="perf-value ${lagPercentage > 15 ? 'warning' : ''}">${lagPercentage}%</span>
        </div>
        <div class="perf-item">
          <span class="perf-label">Mem</span>
          <span class="perf-value ${memoryUsage > 70 ? 'warning' : ''}">${memoryUsage}%</span>
        </div>
        <div class="perf-item">
          <span class="perf-label">Quality</span>
          <span class="perf-value tier-${this.currentTier}">${this.currentTier[0].toUpperCase()}</span>
        </div>
      </div>
    `;
  }

  /**
   * Hiển thị thông báo
   */
  showNotification(message) {
    if (window.showToast) {
      window.showToast(message, 'info', 4000);
    } else {
      console.log('[PerformanceOptimizer]', message);
    }
  }

  /**
   * Lấy metrics hiện tại
   */
  getMetrics() {
    return { ...this.metrics, currentTier: this.currentTier, isAutoMode: this.isAutoMode };
  }

  /**
   * Force quality tier (for testing)
   */
  forceQuality(tier) {
    console.log('[PerformanceOptimizer] Force quality:', tier);
    this.isAutoMode = false;
    this.userManualSelection = tier;
    this.applyQualityTier(tier);
  }

  /**
   * Reset về auto mode
   */
  resetToAuto() {
    console.log('[PerformanceOptimizer] Reset to auto mode');
    this.isAutoMode = true;
    this.userManualSelection = null;

    // Re-detect optimal tier
    const deviceTier = this.detectDeviceTier();
    this.applyQualityTier(deviceTier);
  }

  /**
   * Detect device tier based on hardware
   */
  detectDeviceTier() {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;

    if (cores <= 2 || memory <= 2) return 'low';
    if (cores <= 4 || memory <= 4) return 'medium';
    return 'high';
  }
}

// Export
window.PerformanceOptimizer = PerformanceOptimizer;

// KHÔNG tự động khởi chạy - chỉ tạo instance
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPerformanceOptimizer);
} else {
  initPerformanceOptimizer();
}

function initPerformanceOptimizer() {
  window.performanceOptimizer = new PerformanceOptimizer();
  console.log('[PerformanceOptimizer] Instance created (not started yet)');

  // Sync initial state nhưng KHÔNG start ngay
  setTimeout(() => {
    if (window.qualityManager) {
      const currentQuality = window.qualityManager.currentQuality;
      window.performanceOptimizer.handleQualityChange(currentQuality);
    }
  }, 1000);
}

/**
 * Helper function để show/hide widget
 */
window.togglePerformanceWidget = function() {
  const widget = document.getElementById('performance-metrics');
  if (!widget) return;

  if (widget.style.display === 'none' || !widget.style.display) {
    // Mở widget -> start tracking
    widget.style.display = 'block';
    window.performanceOptimizer.start();
    console.log('[PerformanceOptimizer] Widget opened - tracking started');
  } else {
    // Đóng widget -> stop tracking
    widget.style.display = 'none';
    window.performanceOptimizer.stop();
    console.log('[PerformanceOptimizer] Widget closed - tracking stopped');
  }
};
