// Tracks how many units of each SKU are on the shelf, and what they cost.
class Inventory {
  constructor() {
    this.stock = new Map();
    this.prices = new Map();
  }

  add(sku, price, qty = 0) {
    this.prices.set(sku, price);
    this.stock.set(sku, (this.stock.get(sku) || 0) + qty);
  }

  qty(sku) {
    return this.stock.get(sku) || 0;
  }

  price(sku) {
    if (!this.prices.has(sku)) throw new Error(`Unknown SKU: ${sku}`);
    return this.prices.get(sku);
  }

  take(sku, n) {
    if (this.qty(sku) < n) throw new Error(`Not enough stock for ${sku}`);
    this.stock.set(sku, this.qty(sku) - n);
  }

  give(sku, n) {
    this.stock.set(sku, this.qty(sku) + n);
  }

  lowStock(threshold) {
    const out = [];
    for (const [sku, n] of this.stock) {
      if (n < threshold) out.push(sku);
    }
    return out.sort();
  }
}

module.exports = { Inventory };
