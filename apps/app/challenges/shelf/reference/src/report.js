function topSellers(orders, n) {
  const totals = new Map();
  for (const order of orders) {
    if (order.cancelled) continue;
    for (const line of order.lines) {
      totals.set(line.sku, (totals.get(line.sku) || 0) + line.qty);
    }
  }
  return [...totals]
    .map(([sku, units]) => ({ sku, units }))
    .sort((a, b) => b.units - a.units || (a.sku < b.sku ? -1 : 1))
    .slice(0, n);
}

module.exports = { topSellers };
