const { Inventory } = require('./src/inventory');
const { applyDiscount, orderTotal } = require('./src/pricing');
const { placeOrder, cancelOrder } = require('./src/orders');
const { topSellers } = require('./src/report');

function shelf() {
  const inv = new Inventory();
  inv.add('A', 10, 5);
  inv.add('B', 4, 1);
  inv.add('C', 2.5, 0);
  return inv;
}

// ---- bugs ----
test('bugs', 'a 10% discount takes a tenth off', () => {
  expect(applyDiscount(100, 10)).toBe(90);
  expect(applyDiscount(19.99, 25)).toBe(14.99);
});
test('bugs', 'order totals apply the discount once, to the whole order', () => {
  expect(orderTotal(shelf(), [{ sku: 'A', qty: 2 }, { sku: 'B', qty: 1 }], 50)).toBe(12);
});
test('bugs', 'lowStock includes SKUs exactly at the threshold', () => {
  expect(shelf().lowStock(1)).toEqual(['B', 'C']);
  expect(shelf().lowStock(0)).toEqual(['C']);
});
test('bugs', 'a failed order leaves stock untouched', () => {
  const inv = shelf();
  expect(() => placeOrder(inv, [{ sku: 'A', qty: 2 }, { sku: 'B', qty: 3 }])).toThrow('Not enough stock');
  expect(inv.qty('A')).toBe(5);
  expect(inv.qty('B')).toBe(1);
});
test('bugs', 'the same SKU on two lines is checked together', () => {
  const inv = shelf();
  expect(() => placeOrder(inv, [{ sku: 'A', qty: 3 }, { sku: 'A', qty: 3 }])).toThrow();
  expect(inv.qty('A')).toBe(5);
});
test('bugs', 'a good order takes stock and returns a receipt', () => {
  const inv = shelf();
  const r = placeOrder(inv, [{ sku: 'A', qty: 2 }], 10);
  expect(inv.qty('A')).toBe(3);
  expect(r.total).toBe(18);
  expect(r.cancelled).toBe(false);
});

// ---- feature ----
test('feature', 'cancelling puts the stock back', () => {
  const inv = shelf();
  const r = placeOrder(inv, [{ sku: 'A', qty: 4 }, { sku: 'B', qty: 1 }]);
  cancelOrder(inv, r);
  expect(inv.qty('A')).toBe(5);
  expect(inv.qty('B')).toBe(1);
});
test('feature', 'cancelling marks the receipt cancelled', () => {
  const inv = shelf();
  const r = placeOrder(inv, [{ sku: 'A', qty: 1 }]);
  cancelOrder(inv, r);
  expect(r.cancelled).toBe(true);
});
test('feature', 'cancelling twice is an error and does not double-restock', () => {
  const inv = shelf();
  const r = placeOrder(inv, [{ sku: 'A', qty: 2 }]);
  cancelOrder(inv, r);
  expect(() => cancelOrder(inv, r)).toThrow('already cancelled');
  expect(inv.qty('A')).toBe(5);
});
test('feature', 'a cancelled order can be placed again', () => {
  const inv = shelf();
  const r = placeOrder(inv, [{ sku: 'B', qty: 1 }]);
  cancelOrder(inv, r);
  expect(() => placeOrder(inv, [{ sku: 'B', qty: 1 }])).not.toThrow();
});

// ---- perf ----
function lcg(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function expectedTop(orders, n) {
  const m = new Map();
  for (const o of orders) {
    if (o.cancelled) continue;
    for (const l of o.lines) m.set(l.sku, (m.get(l.sku) || 0) + l.qty);
  }
  return [...m]
    .map(([sku, units]) => ({ sku, units }))
    .sort((a, b) => b.units - a.units || (a.sku < b.sku ? -1 : 1))
    .slice(0, n);
}

test('perf', 'topSellers skips cancelled orders and breaks ties by SKU', () => {
  const orders = [
    { lines: [{ sku: 'Z', qty: 2 }, { sku: 'B', qty: 2 }, { sku: 'Q', qty: 9 }], cancelled: true },
    { lines: [{ sku: 'Z', qty: 2 }, { sku: 'B', qty: 2 }, { sku: 'M', qty: 1 }] },
  ];
  expect(topSellers(orders, 2)).toEqual([{ sku: 'B', units: 2 }, { sku: 'Z', units: 2 }]);
});
test('perf', 'topSellers handles 120,000 order lines in under 250ms', () => {
  const rnd = lcg(7);
  const orders = [];
  for (let i = 0; i < 40000; i++) {
    const lines = [];
    for (let j = 0; j < 3; j++) {
      lines.push({ sku: 'S' + Math.floor(rnd() * 6000), qty: 1 + Math.floor(rnd() * 4) });
    }
    orders.push({ lines, cancelled: i % 50 === 0 });
  }
  const want = expectedTop(orders, 10);
  const t0 = performance.now();
  const got = topSellers(orders, 10);
  const ms = performance.now() - t0;
  expect(got).toEqual(want);
  expect(ms).toBeLessThan(250);
});
