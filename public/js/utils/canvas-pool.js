/**
 * Canvas Pool
 * Reuses canvas elements for image processing and diff generation
 */

class CanvasPool {
  constructor(config = {}) {
    this.maxSize = config.maxSize || 4;
    this.pool = [];
    this.inUse = new Set();
    this.stats = {
      hits: 0,
      misses: 0,
      created: 0,
      released: 0,
      resizes: 0
    };
  }

  acquire(width = 800, height = 600) {
    let canvas;

    for (let i = 0; i < this.pool.length; i++) {
      const candidate = this.pool[i];

      if (candidate.width >= width && candidate.height >= height) {
        canvas = candidate;
        this.pool.splice(i, 1);
        this.stats.hits++;
        break;
      }
    }

    if (!canvas) {
      if (this.pool.length > 0 && this.pool.length + this.inUse.size >= this.maxSize) {
        canvas = this.pool.pop();
        this.stats.resizes++;
      } else {
        canvas = document.createElement('canvas');
        this.stats.created++;
        this.stats.misses++;
      }
    }

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      this.stats.resizes++;
    }

    const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
    ctx.clearRect(0, 0, width, height);

    this.inUse.add(canvas);
    return canvas;
  }

  release(canvas) {
    if (!canvas || !this.inUse.has(canvas)) return;

    this.inUse.delete(canvas);

    if (this.pool.length >= this.maxSize) {
      this.stats.released++;
      return;
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    this.pool.push(canvas);
    this.stats.released++;
  }

  acquireContext(width, height) {
    const canvas = this.acquire(width, height);
    const ctx = canvas.getContext('2d', {
      alpha: true,
      willReadFrequently: true,
      desynchronized: true
    });
    return { canvas, ctx };
  }

  clear() {
    this.pool.forEach(canvas => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
    this.pool = [];
    this.inUse.clear();
  }

  getStats() {
    return {
      ...this.stats,
      poolSize: this.pool.length,
      inUse: this.inUse.size,
      totalAllocated: this.pool.length + this.inUse.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
    };
  }

  logStats() {
    const stats = this.getStats();
    console.log('[Canvas Pool] Stats:', {
      'Pool Size': stats.poolSize,
      'In Use': stats.inUse,
      'Total Allocated': stats.totalAllocated,
      'Hit Rate': (stats.hitRate * 100).toFixed(1) + '%',
      'Resizes': stats.resizes,
      'Created': stats.created
    });
  }
}

window.CanvasPool = new CanvasPool();
