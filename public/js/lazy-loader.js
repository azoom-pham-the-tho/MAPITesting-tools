class LazyLoader {
  constructor() {
    this.loadedModules = new Map();
  }

  async load(moduleName) {
    if (this.loadedModules.has(moduleName)) {
      return this.loadedModules.get(moduleName);
    }

    try {
      const module = await import(`/js/${moduleName}.js`);
      this.loadedModules.set(moduleName, module);
      return module;
    } catch (error) {
      console.error(`Failed to load module: ${moduleName}`, error);
      throw error;
    }
  }
}

window.LazyLoader = new LazyLoader();
