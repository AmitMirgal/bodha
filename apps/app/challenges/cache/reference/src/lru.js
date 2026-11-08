class LRUCache {
  constructor({ capacity, ttlMs = Infinity, now = Date.now }) {
    this.capacity = capacity;
    this.ttlMs = ttlMs;
    this.now = now;
    // A Map remembers insertion order, so the first key is always the oldest.
    this.entries = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get size() {
    return this.entries.size;
  }

  get(key) {
    const entry = this.entries.get(key);
    if (entry === undefined) {
      this.misses++;
      return undefined;
    }
    if (this.now() - entry.at >= this.ttlMs) {
      this.entries.delete(key);
      this.misses++;
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key, value) {
    this.entries.delete(key);
    if (this.entries.size >= this.capacity) {
      this.entries.delete(this.entries.keys().next().value);
    }
    this.entries.set(key, { value, at: this.now() });
  }

  stats() {
    const lookups = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: lookups === 0 ? 0 : this.hits / lookups,
      size: this.size,
    };
  }

  delete(key) {
    return this.entries.delete(key);
  }
}

module.exports = { LRUCache };
