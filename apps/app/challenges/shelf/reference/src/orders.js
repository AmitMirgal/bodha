const { orderTotal } = require('./pricing');

let nextId = 1;

function placeOrder(inventory, lines, discountPct = 0) {
  // Check everything first, adding up repeated SKUs, so a failure takes nothing.
  const wanted = new Map();
  for (const { sku, qty } of lines) {
    wanted.set(sku, (wanted.get(sku) || 0) + qty);
  }
  for (const [sku, qty] of wanted) {
    if (inventory.qty(sku) < qty) throw new Error(`Not enough stock for ${sku}`);
  }
  const total = orderTotal(inventory, lines, discountPct);
  for (const [sku, qty] of wanted) {
    inventory.take(sku, qty);
  }
  return { id: nextId++, lines, total, cancelled: false };
}

function cancelOrder(inventory, receipt) {
  if (receipt.cancelled) throw new Error('Order already cancelled');
  for (const line of receipt.lines) {
    inventory.give(line.sku, line.qty);
  }
  receipt.cancelled = true;
  return receipt;
}

module.exports = { placeOrder, cancelOrder };
