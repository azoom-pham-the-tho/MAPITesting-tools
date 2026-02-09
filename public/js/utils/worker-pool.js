/**
 * Worker Pool
 * Manages Web Worker lifecycle and reuse
 */

class WorkerPool {
  constructor(config = {}) {
    this.workerScript = config.workerScript;
    this.maxWorkers = config.maxWorkers || Math.min(navigator.hardwareConcurrency || 4, 4);
    this.idleTimeout = config.idleTimeout || 30000;

    this.workers = [];
    this.idleWorkers = [];
    this.taskQueue = [];
    this.workerTimers = new Map();

    this.stats = {
      tasksCompleted: 0,
      tasksQueued: 0,
      workersCreated: 0,
      workersTerminated: 0,
      queueWaitTime: 0
    };
  }

  _createWorker() {
    const worker = new Worker(this.workerScript);
    worker._busy = false;
    worker._id = this.stats.workersCreated++;

    this.workers.push(worker);
    this.idleWorkers.push(worker);

    console.log(`[Worker Pool] Created worker #${worker._id} (${this.workers.length}/${this.maxWorkers})`);

    return worker;
  }

  _terminateWorker(worker) {
    const index = this.workers.indexOf(worker);
    if (index > -1) {
      this.workers.splice(index, 1);
    }

    const idleIndex = this.idleWorkers.indexOf(worker);
    if (idleIndex > -1) {
      this.idleWorkers.splice(idleIndex, 1);
    }

    worker.terminate();
    this.stats.workersTerminated++;

    console.log(`[Worker Pool] Terminated worker #${worker._id} (${this.workers.length} remaining)`);
  }

  _startIdleTimer(worker) {
    this._clearIdleTimer(worker);

    const timer = setTimeout(() => {
      if (!worker._busy && this.workers.length > 1) {
        this._terminateWorker(worker);
      }
    }, this.idleTimeout);

    this.workerTimers.set(worker, timer);
  }

  _clearIdleTimer(worker) {
    const timer = this.workerTimers.get(worker);
    if (timer) {
      clearTimeout(timer);
      this.workerTimers.delete(worker);
    }
  }

  _getWorker() {
    if (this.idleWorkers.length > 0) {
      const worker = this.idleWorkers.pop();
      this._clearIdleTimer(worker);
      return worker;
    }

    if (this.workers.length < this.maxWorkers) {
      return this._createWorker();
    }

    return null;
  }

  _releaseWorker(worker) {
    worker._busy = false;
    this.idleWorkers.push(worker);
    this._startIdleTimer(worker);

    if (this.taskQueue.length > 0) {
      const nextTask = this.taskQueue.shift();
      this._executeTask(nextTask);
    }
  }

  _executeTask(task) {
    const worker = this._getWorker();

    if (!worker) {
      this.taskQueue.push(task);
      this.stats.tasksQueued++;
      return;
    }

    worker._busy = true;

    const handleMessage = (e) => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);

      this._releaseWorker(worker);
      this.stats.tasksCompleted++;

      task.resolve(e.data);
    };

    const handleError = (error) => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);

      this._releaseWorker(worker);
      task.reject(error);
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);

    worker.postMessage(task.data, task.transfer);
  }

  execute(data, transfer = []) {
    return new Promise((resolve, reject) => {
      this._executeTask({ data, transfer, resolve, reject });
    });
  }

  terminate() {
    this.workerTimers.forEach(timer => clearTimeout(timer));
    this.workerTimers.clear();

    this.workers.forEach(worker => worker.terminate());

    this.workers = [];
    this.idleWorkers = [];
    this.taskQueue = [];
  }

  getStats() {
    return {
      ...this.stats,
      activeWorkers: this.workers.length,
      idleWorkers: this.idleWorkers.length,
      busyWorkers: this.workers.length - this.idleWorkers.length,
      queuedTasks: this.taskQueue.length,
      avgQueueWait: this.stats.tasksQueued > 0 ? this.stats.queueWaitTime / this.stats.tasksQueued : 0
    };
  }

  logStats() {
    const stats = this.getStats();
    console.log('[Worker Pool] Stats:', {
      'Active Workers': stats.activeWorkers,
      'Idle': stats.idleWorkers,
      'Busy': stats.busyWorkers,
      'Queued Tasks': stats.queuedTasks,
      'Completed': stats.tasksCompleted,
      'Created': stats.workersCreated,
      'Terminated': stats.workersTerminated
    });
  }
}

window.WorkerPool = WorkerPool;
