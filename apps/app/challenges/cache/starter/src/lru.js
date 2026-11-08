class LRUCache {
  constructor({ capacity, ttlMs = Infinity, now = Date.now }) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.now = now;
    this.keys = []; // least recently used first
    this.data = {};
    this.hits = 0;
    this.misses = 0;
  }

  get size() {
    return this.keys.length;
  }

  get(key) {
    const entry = this.data[key];
    if (entry === undefined) {
      this.misses++;
      return undefined;
    }
    if (this.now() - entry.at > this.ttlMs) {
      delete this.data[key];
      this.misses++;
      return undefined;
    }
    this.hits++;
    return entry.value;
  }

  set(key, value) {
    if (this.data[key] === undefined && this.keys.length >= this.capacity) {
      const oldest = this.keys.shift();
      delete this.data[oldest];
    }
    this.keys.push(key);
    this.data[key] = { value, at: this.now() };
  }

  stats() {
    throw new Error('not implemented');
  }

  delete(key) {
    throw new Error('not implemented');
  }
}

module.exports = { LRUCache };
