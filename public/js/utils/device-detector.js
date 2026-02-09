/**
 * Device Detector & Simplified Mode
 * Detects low-end devices and applies optimizations
 */

class DeviceDetector {
  constructor() {
    this.tier = this.detectPerformanceTier();
    this.isLowEnd = this.tier === 'low';
    this.isMobile = this.detectMobile();
    this.settings = this.getOptimalSettings();
  }

  detectPerformanceTier() {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;

    if (cores <= 2 || memory <= 2) return 'low';
    if (cores <= 4 || memory <= 4) return 'medium';
    return 'high';
  }

  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  getOptimalSettings() {
    const baseSettings = {
      enableAnimations: true,
      shadowQuality: 'high',
      imageQuality: 1.0,
      chunkSize: 100,
      maxCachedScreens: 1000,
      enableVirtualization: false,
      enableWebWorkers: true,
      throttleInterval: 16,
    };

    if (this.tier === 'low') {
      return {
        ...baseSettings,
        enableAnimations: false,
        shadowQuality: 'none',
        imageQuality: 0.7,
        chunkSize: 50,
        maxCachedScreens: 100,
        enableVirtualization: true,
        enableWebWorkers: false,
        throttleInterval: 33,
      };
    }

    if (this.tier === 'medium') {
      return {
        ...baseSettings,
        enableAnimations: true,
        shadowQuality: 'medium',
        imageQuality: 0.85,
        chunkSize: 75,
        maxCachedScreens: 500,
        enableVirtualization: false,
        enableWebWorkers: true,
        throttleInterval: 16,
      };
    }

    return baseSettings;
  }

  applyOptimizations() {
    console.log(`[DeviceDetector] Performance tier: ${this.tier}`);
    console.log('[DeviceDetector] Applying optimizations:', this.settings);

    this.applyCSSOptimizations();

    window.deviceSettings = this.settings;

    if (this.isLowEnd && window.showToast) {
      window.showToast(
        'Low-end device detected. Simplified mode enabled for better performance.',
        'info',
        5000
      );
    }
  }

  applyCSSOptimizations() {
    const root = document.documentElement;

    if (this.settings.shadowQuality === 'none') {
      root.style.setProperty('--shadow-sm', 'none');
      root.style.setProperty('--shadow-md', 'none');
      root.style.setProperty('--shadow-lg', 'none');
    } else if (this.settings.shadowQuality === 'medium') {
      root.style.setProperty('--shadow-lg', '0 4px 6px rgba(0,0,0,0.1)');
    }

    if (!this.settings.enableAnimations) {
      root.style.setProperty('--transition-duration', '0s');

      const style = document.createElement('style');
      style.textContent = `
        *, *::before, *::after {
          animation-duration: 0s !important;
          transition-duration: 0s !important;
        }
      `;
      document.head.appendChild(style);
    }

    if (this.isMobile) {
      root.style.setProperty('--scroll-behavior', 'auto');
      document.body.classList.add('mobile-device');
    }

    document.body.classList.add(`performance-${this.tier}`);
  }

  getBatteryInfo() {
    return new Promise((resolve) => {
      if ('getBattery' in navigator) {
        navigator.getBattery().then(battery => {
          resolve({
            level: battery.level,
            charging: battery.charging,
            chargingTime: battery.chargingTime,
            dischargingTime: battery.dischargingTime
          });
        });
      } else {
        resolve(null);
      }
    });
  }

  async shouldReducePerformance() {
    const battery = await this.getBatteryInfo();

    if (battery && !battery.charging && battery.level < 0.2) {
      return true;
    }

    return this.isLowEnd;
  }
}

window.DeviceDetector = DeviceDetector;
