/**
 * Generic Object Pool
 * Reduces GC pressure by reusing objects instead of creating new ones
 */

class ObjectPool {
  constructor(config = {}) {
    this.factory = config.factory;
    this.reset = config.reset;
    this.validate = config.validate;
    this.maxSize = config.maxSize || 100;
    this.initialSize = config.initialSize || 0;

    this.pool = [];
    this.stats = {
      hits: 0,
      misses: 0,
      created: 0,
      released: 0,
      current: 0,
      peak: 0
    };

    if (this.initialSize > 0) {
      this._preallocate();
    }
  }

  _preallocate() {
    for (let i = 0; i < this.initialSize; i++) {
      const obj = this.factory();
      this.pool.push(obj);
      this.stats.created++;
    }
  }

  acquire() {
    let obj;

    while (this.pool.length > 0) {
      obj = this.pool.pop();

      if (!this.validate || this.validate(obj)) {
        this.stats.hits++;
        this.stats.current++;
        this.stats.peak = Math.max(this.stats.peak, this.stats.current);
        return obj;
      }
    }

    this.stats.misses++;
    this.stats.created++;
    this.stats.current++;
    this.stats.peak = Math.max(this.stats.peak, this.stats.current);

    return this.factory();
  }

  release(obj) {
    if (!obj) return;

    if (this.pool.length >= this.maxSize) {
      this.stats.current--;
      return;
    }

    if (this.reset) {
      this.reset(obj);
    }

    this.pool.push(obj);
    this.stats.released++;
    this.stats.current--;
  }

  releaseAll(objects) {
    objects.forEach(obj => this.release(obj));
  }

  clear() {
    this.pool = [];
    this.stats.current = 0;
  }

  getStats() {
    return {
      ...this.stats,
      poolSize: this.pool.length,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      efficiency: (this.stats.hits / this.stats.created) || 0
    };
  }

  logStats(name = 'Pool') {
    const stats = this.getStats();
    console.log(`[${name}] Stats:`, {
      'Pool Size': stats.poolSize,
      'In Use': stats.current,
      'Peak Used': stats.peak,
      'Hit Rate': (stats.hitRate * 100).toFixed(1) + '%',
      'Efficiency': (stats.efficiency * 100).toFixed(1) + '%',
      'Total Created': stats.created
    });
  }
}

window.ObjectPool = ObjectPool;
