import { availableQuantity, daysToExpiry, orderReservedQuantity, type DemoData } from './data.ts';

/**
 * Tudo o que o protótipo sabe sobre uma posição (produto + lote + local),
 * reunido para a ficha do lote. Somente leitura: não altera a base.
 */
export function lotTrace(data: DemoData, stockId: string) {
  const stock = data.stock.find((s) => s.id === stockId);
  if (!stock) return null;
  const sameLot = (productId: string, lot: string) => productId === stock.productId && lot === stock.lot;
  const atThisPlace = (from?: string, to?: string) => from === stock.location || to === stock.location;

  const linked = orderReservedQuantity(data, stock.id);
  const expired = daysToExpiry(stock.expiresAt) < 0;
  const committed = stock.reserved + stock.blocked + stock.quarantined;
  const composition = {
    available: availableQuantity(stock),
    orderReserved: linked,
    internalReserved: stock.reserved - linked,
    blocked: stock.blocked,
    quarantined: stock.quarantined,
    expiredFree: expired ? Math.max(0, stock.quantity - committed) : 0,
  };

  const orders = data.orders
    .filter((order) => order.allocations.some((a) => a.stockId === stock.id) || (order.status === 'Expedido' && data.movements.some((m) => m.orderId === order.id && sameLot(m.productId, m.lot) && m.from === stock.location)))
    .map((order) => {
      const allocations = order.allocations.filter((a) => a.stockId === stock.id);
      const shipped = data.movements.filter((m) => m.orderId === order.id && sameLot(m.productId, m.lot) && m.from === stock.location).reduce((sum, m) => sum + m.quantity, 0);
      return { order, reserved: allocations.reduce((sum, a) => sum + a.quantity, 0), checked: allocations.reduce((sum, a) => sum + a.checked, 0), shipped };
    })
    .sort((a, b) => Number(b.order.status === 'Aberto') - Number(a.order.status === 'Aberto') || a.order.neededAt.localeCompare(b.order.neededAt));

  const movements = data.movements.filter((m) => sameLot(m.productId, m.lot) && atThisPlace(m.from, m.to));
  const counts = data.counts.filter((c) => c.stockId === stock.id);
  const audit = data.audit.filter((event) => event.stockId === stock.id);
  const outgoing = data.transfers.filter((t) => !t.receivedAt && sameLot(t.productId, t.lot) && t.from === stock.location);
  const incoming = data.transfers.filter((t) => !t.receivedAt && sameLot(t.productId, t.lot) && t.to === stock.location);

  return { stock, composition, orders, movements, counts, audit, outgoing, incoming };
}
