/**
 * DOM Element Pool
 * Reuses DOM elements to reduce createElement overhead and GC pressure
 */

class DOMPool {
  constructor() {
    this.pools = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      created: 0,
      released: 0
    };
  }

  _getPoolKey(tagName, className = '') {
    return `${tagName.toLowerCase()}:${className}`;
  }

  _createPool(key, tagName, maxSize = 50) {
    return new ObjectPool({
      factory: () => {
        const el = document.createElement(tagName);
        this.stats.created++;
        return el;
      },
      reset: (el) => {
        el.className = '';
        el.innerHTML = '';
        el.removeAttribute('style');
        el.removeAttribute('title');
        el.removeAttribute('data-path');
        el.removeAttribute('data-type');
        el.onclick = null;
        el.ondblclick = null;
        el.ondragstart = null;
        el.ondragend = null;
        el.ondragover = null;
        el.ondragleave = null;
        el.ondrop = null;

        const clean = el.cloneNode(false);
        if (el.parentNode) {
          el.parentNode.replaceChild(clean, el);
          return clean;
        }
        return el;
      },
      maxSize: maxSize
    });
  }

  acquire(tagName, className = '') {
    const key = this._getPoolKey(tagName, className);

    if (!this.pools.has(key)) {
      this.pools.set(key, this._createPool(key, tagName));
    }

    const pool = this.pools.get(key);
    const el = pool.acquire();

    if (className) {
      el.className = className;
    }

    this.stats.hits++;
    return el;
  }

  release(element) {
    if (!element || !element.tagName) return;

    const key = this._getPoolKey(element.tagName, '');

    if (!this.pools.has(key)) {
      this.pools.set(key, this._createPool(key, element.tagName));
    }

    const pool = this.pools.get(key);
    pool.release(element);
    this.stats.released++;
  }

  releaseAll(elements) {
    elements.forEach(el => this.release(el));
  }

  clearAll() {
    this.pools.forEach(pool => pool.clear());
    this.pools.clear();
  }

  getStats() {
    const poolStats = {};
    this.pools.forEach((pool, key) => {
      poolStats[key] = pool.getStats();
    });

    return {
      global: this.stats,
      pools: poolStats
    };
  }

  logStats() {
    console.log('[DOM Pool] Global Stats:', this.stats);
    this.pools.forEach((pool, key) => {
      pool.logStats(`DOM Pool: ${key}`);
    });
  }
}

window.DOMPool = new DOMPool();
