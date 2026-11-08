# Shelf

A tiny order system for a shop.

    src/inventory.js   stock levels and prices per SKU
    src/pricing.js     discounts and order totals
    src/orders.js      placing and cancelling orders
    src/report.js      sales reports

## How it should behave

**Inventory**
- `add(sku, price, qty)` registers a SKU or adds stock to it.
- `take(sku, n)` removes stock and throws if there isn't enough.
- `lowStock(threshold)` lists SKUs with *at most* `threshold` units left, sorted.

**Pricing**
- Discounts are percentages from 0 to 100. `applyDiscount(100, 10)` is `90`.
- Totals are rounded to cents.

**Orders**
- `placeOrder(inventory, lines, discountPct)` takes `lines` like `[{ sku, qty }]`.
- An order is all-or-nothing. If any line can't be filled, nothing is taken
  from stock and the call throws.
- On success it returns a receipt `{ id, lines, total, cancelled: false }`.
- `cancelOrder(inventory, receipt)` puts the stock back and marks the receipt
  `cancelled`. Cancelling twice is an error.

**Reports**
- `topSellers(orders, n)` returns the `n` best-selling SKUs as
  `[{ sku, units }]`, most units first, ties broken by SKU (A to Z).
- Cancelled orders don't count.
