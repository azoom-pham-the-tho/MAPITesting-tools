/**
 * Performance Utilities
 * Throttle, debounce, and optimization helpers
 */

const PerformanceUtils = {
  throttle(func, wait = 16) {
    let timeout = null;
    let previous = 0;

    return function (...args) {
      const now = Date.now();
      const remaining = wait - (now - previous);

      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        return func.apply(this, args);
      } else if (!timeout) {
        timeout = setTimeout(() => {
          previous = Date.now();
          timeout = null;
          return func.apply(this, args);
        }, remaining);
      }
    };
  },

  debounce(func, wait = 200) {
    let timeout = null;

    return function (...args) {
      const later = () => {
        timeout = null;
        return func.apply(this, args);
      };

      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  rafThrottle(func) {
    let rafId = null;
    let lastArgs = null;

    return function (...args) {
      lastArgs = args;

      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          func.apply(this, lastArgs);
          rafId = null;
        });
      }
    };
  },

  batchDOM(operations) {
    requestAnimationFrame(() => {
      operations();
    });
  },

  async measure(name, fn) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    console.log(`[Performance] ${name}: ${Math.round(end - start)}ms`);
    return result;
  },

  isLowEndDevice() {
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
      return true;
    }

    if (navigator.deviceMemory && navigator.deviceMemory <= 2) {
      return true;
    }

    if (navigator.connection) {
      const conn = navigator.connection;
      if (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') {
        return true;
      }
    }

    return false;
  },

  getPerformanceTier() {
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4;

    if (cores <= 2 || memory <= 2) return 'low';
    if (cores <= 4 || memory <= 4) return 'medium';
    return 'high';
  },

  lazyLoadImage(img, src) {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            img.src = src;
            observer.unobserve(img);
          }
        });
      });
      observer.observe(img);
    } else {
      img.src = src;
    }
  },

  preloadResource(url, type = 'fetch') {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = type;
    document.head.appendChild(link);
  },

  deferScript(src, callback) {
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    if (callback) script.onload = callback;
    document.head.appendChild(script);
  }
};

window.PerformanceUtils = PerformanceUtils;
