function round2(n) {
  return Math.round(n * 100) / 100;
}

function applyDiscount(price, discountPct) {
  return round2(price - (price * discountPct) / 100);
}

function orderTotal(inventory, lines, discountPct = 0) {
  let sum = 0;
  for (const line of lines) {
    sum += inventory.price(line.sku) * line.qty;
  }
  return applyDiscount(sum, discountPct);
}

module.exports = { applyDiscount, orderTotal };
