class PaginationManager {
  constructor(options = {}) {
    this.pageSize = options.pageSize || 100;
    this.cache = new Map();
  }

  async fetch(url, page = 1) {
    const key = `${url}:${page}`;
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const response = await fetch(`${url}?page=${page}&limit=${this.pageSize}`);
    const data = await response.json();

    this.cache.set(key, data);
    return data;
  }

  async fetchNext(url, currentPage) {
    return this.fetch(url, currentPage + 1);
  }

  clearCache() {
    this.cache.clear();
  }
}

window.PaginationManager = PaginationManager;
