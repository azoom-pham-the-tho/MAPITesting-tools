/**
 * Image Pool
 * Reuses Image objects for lazy loading and thumbnails
 */

class ImagePool {
  constructor(config = {}) {
    this.maxSize = config.maxSize || 20;
    this.pool = [];
    this.inUse = new Set();
    this.stats = {
      hits: 0,
      misses: 0,
      created: 0,
      released: 0
    };
  }

  acquire() {
    let img;

    if (this.pool.length > 0) {
      img = this.pool.pop();
      this.stats.hits++;
    } else {
      img = new Image();
      this.stats.created++;
      this.stats.misses++;
    }

    img.src = '';
    img.onload = null;
    img.onerror = null;
    img.removeAttribute('style');
    img.removeAttribute('class');

    this.inUse.add(img);
    return img;
  }

  load(src) {
    return new Promise((resolve, reject) => {
      const img = this.acquire();

      img.onload = () => {
        resolve(img);
      };

      img.onerror = (error) => {
        this.release(img);
        reject(error);
      };

      img.src = src;
    });
  }

  release(img) {
    if (!img || !this.inUse.has(img)) return;

    this.inUse.delete(img);

    if (this.pool.length >= this.maxSize) {
      this.stats.released++;
      return;
    }

    img.src = '';
    img.onload = null;
    img.onerror = null;

    this.pool.push(img);
    this.stats.released++;
  }

  clear() {
    this.pool = [];
    this.inUse.clear();
  }

  getStats() {
    return {
      ...this.stats,
      poolSize: this.pool.length,
      inUse: this.inUse.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }

  logStats() {
    const stats = this.getStats();
    console.log('[Image Pool] Stats:', {
      'Pool Size': stats.poolSize,
      'In Use': stats.inUse,
      'Hit Rate': (stats.hitRate * 100).toFixed(1) + '%',
      'Created': stats.created
    });
  }
}

window.ImagePool = new ImagePool();
