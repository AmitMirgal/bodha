function topSellers(orders, n) {
  const totals = [];
  for (const order of orders) {
    if (order.cancelled) continue;
    for (const line of order.lines) {
      const i = totals.findIndex((t) => t.sku === line.sku);
      if (i === -1) totals.push({ sku: line.sku, units: line.qty });
      else totals[i].units += line.qty;
    }
  }
  totals.sort((a, b) => b.units - a.units || (a.sku < b.sku ? -1 : 1));
  return totals.slice(0, n);
}

module.exports = { topSellers };
