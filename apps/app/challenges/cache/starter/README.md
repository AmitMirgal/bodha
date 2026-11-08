# Cache

An in-memory LRU cache with optional expiry.

    src/lru.js    the cache

## How it should behave

- `new LRUCache({ capacity, ttlMs, now })`. `now` is a clock function, which
  lets tests control time. It defaults to `Date.now`.
- `set(key, value)` stores a value. Setting an existing key replaces its value
  and counts as a use. Going over `capacity` evicts the least recently used key.
- `get(key)` returns the value or `undefined`. A successful `get` counts as a
  use, so that key becomes the most recently used.
- An entry expires once its age is **at least** `ttlMs`. Expired entries
  behave as if they were never there and don't take up space.
- Any string is a valid key.
- `size` is the number of live entries.
- Every `get` is a hit or a miss. An expired entry is a miss.
- `stats()` returns `{ hits, misses, hitRate, size }`, where `hitRate` is
  `hits / (hits + misses)`, or `0` before any lookups.
- `delete(key)` removes a key and returns whether it was there.
