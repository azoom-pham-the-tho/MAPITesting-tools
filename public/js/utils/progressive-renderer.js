/**
 * Progressive Rendering System
 * Renders large lists in chunks to maintain 60fps performance
 */

class ProgressiveRenderer {
  constructor(options = {}) {
    this.options = {
      chunkSize: options.chunkSize || 100,
      batchDelay: options.batchDelay || 0,
      priorityChunkSize: options.priorityChunkSize || 20,
      onProgress: options.onProgress || null,
      onComplete: options.onComplete || null,
    };

    this.renderQueue = [];
    this.isRendering = false;
    this.cancelToken = null;
  }

  async render(items, container, renderFn, options = {}) {
    this.cancel();

    const mergedOptions = { ...this.options, ...options };
    this.renderQueue = [...items];
    this.isRendering = true;
    this.cancelToken = { cancelled: false };

    const token = this.cancelToken;
    let renderedCount = 0;
    let isFirstChunk = true;

    container.innerHTML = '';

    while (this.renderQueue.length > 0 && !token.cancelled) {
      const chunkSize = isFirstChunk
        ? mergedOptions.priorityChunkSize
        : mergedOptions.chunkSize;

      const chunk = this.renderQueue.splice(0, chunkSize);
      const fragment = document.createDocumentFragment();

      chunk.forEach(item => {
        const element = renderFn(item);
        if (element) fragment.appendChild(element);
      });

      container.appendChild(fragment);
      renderedCount += chunk.length;

      if (mergedOptions.onProgress) {
        mergedOptions.onProgress(renderedCount, items.length);
      }

      isFirstChunk = false;

      if (this.renderQueue.length > 0) {
        if (mergedOptions.batchDelay > 0) {
          await this.delay(mergedOptions.batchDelay);
        } else {
          await this.waitForIdle();
        }
      }
    }

    this.isRendering = false;

    if (!token.cancelled && mergedOptions.onComplete) {
      mergedOptions.onComplete(renderedCount);
    }
  }

  async renderWithVirtualization(items, container, renderFn, options = {}) {
    const mergedOptions = {
      itemHeight: options.itemHeight || 50,
      viewportHeight: options.viewportHeight || container.clientHeight,
      overscan: options.overscan || 5,
      ...this.options,
      ...options
    };

    this.cancel();
    this.isRendering = true;
    this.cancelToken = { cancelled: false };

    const token = this.cancelToken;
    const viewportItems = Math.ceil(mergedOptions.viewportHeight / mergedOptions.itemHeight);
    const initialCount = viewportItems + mergedOptions.overscan;

    const visibleItems = items.slice(0, initialCount);
    const hiddenItems = items.slice(initialCount);

    container.style.position = 'relative';
    const totalHeight = items.length * mergedOptions.itemHeight;
    container.style.minHeight = totalHeight + 'px';

    const fragment = document.createDocumentFragment();
    visibleItems.forEach(item => {
      const element = renderFn(item);
      if (element) fragment.appendChild(element);
    });
    container.appendChild(fragment);

    if (mergedOptions.onProgress) {
      mergedOptions.onProgress(visibleItems.length, items.length);
    }

    if (hiddenItems.length > 0) {
      await this.waitForIdle();

      if (!token.cancelled) {
        await this.render(hiddenItems, container, renderFn, {
          ...mergedOptions,
          append: true
        });
      }
    }

    this.isRendering = false;
  }

  cancel() {
    if (this.cancelToken) {
      this.cancelToken.cancelled = true;
    }
    this.renderQueue = [];
    this.isRendering = false;
  }

  waitForIdle(timeout = 50) {
    return new Promise(resolve => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(resolve, { timeout });
      } else {
        requestAnimationFrame(resolve);
      }
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

window.ProgressiveRenderer = ProgressiveRenderer;
