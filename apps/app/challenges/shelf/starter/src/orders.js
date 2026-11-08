const { orderTotal } = require('./pricing');

let nextId = 1;

function placeOrder(inventory, lines, discountPct = 0) {
  for (const line of lines) {
    inventory.take(line.sku, line.qty);
  }
  const total = orderTotal(inventory, lines, discountPct);
  return { id: nextId++, lines, total, cancelled: false };
}

function cancelOrder(inventory, receipt) {
  throw new Error('not implemented');
}

module.exports = { placeOrder, cancelOrder };
