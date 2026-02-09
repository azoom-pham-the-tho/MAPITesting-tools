/**
 * Memory Monitor & Auto-Cleanup System
 * Tracks memory usage and performs automatic cleanup on low-end devices
 */

class MemoryMonitor {
  constructor(options = {}) {
    this.options = {
      warningThreshold: options.warningThreshold || 0.7, // 70%
      criticalThreshold: options.criticalThreshold || 0.85, // 85%
      checkInterval: options.checkInterval || 5000, // 5 seconds
      autoCleanup: options.autoCleanup !== false,
      onWarning: options.onWarning || null,
      onCritical: options.onCritical || null,
    };

    this.isMonitoring = false;
    this.intervalId = null;
    this.lastCleanupTime = 0;
    this.cleanupCooldown = 10000; // 10 seconds between cleanups
    this.memoryHistory = [];
    this.maxHistoryLength = 20;
    this.cleanupCallbacks = [];
  }

  start() {
    if (this.isMonitoring) return;
    this.isMonitoring = true;
    this.checkMemory();
    this.intervalId = setInterval(() => this.checkMemory(), this.options.checkInterval);
    console.log('[MemoryMonitor] Started');
  }

  stop() {
    if (!this.isMonitoring) return;
    this.isMonitoring = false;
    if (this.intervalId) clearInterval(this.intervalId);
    console.log('[MemoryMonitor] Stopped');
  }

  registerCleanup(callback, priority = 0) {
    this.cleanupCallbacks.push({ callback, priority });
    this.cleanupCallbacks.sort((a, b) => b.priority - a.priority);
  }

  async checkMemory() {
    const memoryInfo = await this.getMemoryInfo();
    if (!memoryInfo) return;

    this.memoryHistory.push({ timestamp: Date.now(), ...memoryInfo });
    if (this.memoryHistory.length > this.maxHistoryLength) {
      this.memoryHistory.shift();
    }

    const usageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;

    if (usageRatio >= this.options.criticalThreshold) {
      this.handleCritical(memoryInfo, usageRatio);
    } else if (usageRatio >= this.options.warningThreshold) {
      this.handleWarning(memoryInfo, usageRatio);
    }

    this.updateUI(memoryInfo, usageRatio);
  }

  async getMemoryInfo() {
    if (!performance.memory) return null;
    return {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
    };
  }

  handleWarning(memoryInfo, usageRatio) {
    console.warn('[MemoryMonitor] Warning:', this.formatBytes(memoryInfo.usedJSHeapSize));
    if (this.options.onWarning) this.options.onWarning(memoryInfo, usageRatio);
    if (this.options.autoCleanup && this.canCleanup()) {
      this.performCleanup('warning');
    }
  }

  handleCritical(memoryInfo, usageRatio) {
    console.error('[MemoryMonitor] CRITICAL:', this.formatBytes(memoryInfo.usedJSHeapSize));
    if (this.options.onCritical) this.options.onCritical(memoryInfo, usageRatio);
    this.performCleanup('critical');
    this.showCriticalNotification();
  }

  canCleanup() {
    return Date.now() - this.lastCleanupTime >= this.cleanupCooldown;
  }

  performCleanup(level = 'normal') {
    console.log(`[MemoryMonitor] Performing ${level} cleanup`);
    const startMemory = performance.memory?.usedJSHeapSize || 0;
    this.lastCleanupTime = Date.now();

    this.cleanupCallbacks.forEach(({ callback }) => {
      try {
        callback(level);
      } catch (error) {
        console.error('[MemoryMonitor] Cleanup error:', error);
      }
    });

    if (window.gc) window.gc();

    setTimeout(() => {
      const endMemory = performance.memory?.usedJSHeapSize || 0;
      const freed = startMemory - endMemory;
      console.log('[MemoryMonitor] Freed:', this.formatBytes(freed));
    }, 1000);
  }

  showCriticalNotification() {
    if (window.showToast) {
      window.showToast('Memory critical! Auto-cleanup running...', 'warning', 5000);
    }
  }

  updateUI(memoryInfo, usageRatio) {
    const container = document.getElementById('memoryMonitorWidget');
    if (!container) return;

    const percentage = Math.round(usageRatio * 100);
    const used = this.formatBytes(memoryInfo.usedJSHeapSize);
    const limit = this.formatBytes(memoryInfo.jsHeapSizeLimit);

    let statusClass = 'normal';
    if (usageRatio >= this.options.criticalThreshold) statusClass = 'critical';
    else if (usageRatio >= this.options.warningThreshold) statusClass = 'warning';

    container.innerHTML = `
      <div class="memory-widget ${statusClass}">
        <div class="memory-bar">
          <div class="memory-bar-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="memory-info">
          <span class="memory-percentage">${percentage}%</span>
          <span class="memory-details">${used} / ${limit}</span>
        </div>
      </div>
    `;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  getStats() {
    const memoryInfo = performance.memory;
    if (!memoryInfo) return null;
    const usageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
    return {
      used: memoryInfo.usedJSHeapSize,
      total: memoryInfo.totalJSHeapSize,
      limit: memoryInfo.jsHeapSizeLimit,
      usageRatio,
      usagePercentage: Math.round(usageRatio * 100),
      formatted: {
        used: this.formatBytes(memoryInfo.usedJSHeapSize),
        total: this.formatBytes(memoryInfo.totalJSHeapSize),
        limit: this.formatBytes(memoryInfo.jsHeapSizeLimit),
      }
    };
  }
}

window.MemoryMonitor = MemoryMonitor;
