import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDemoData, normalizeData, availableQuantity, orderReservedQuantity } from '../src/data.ts';
import { allocate, addPosition, moveStock, submitCount, reviewCount } from '../src/domain.ts';
import { lotTrace } from '../src/lotTrace.ts';
import { createOrder, reserveOrder, reserveByExpiry, releaseOrderAllocation, checkOrderAllocation, resetOrderCheck, cancelOrder, dispatchOrder, orderStage, orderMetrics, todayDate } from '../src/orderDomain.ts';

const input = (extra = {}) => ({ reference: 'PED-001', hospital: 'Hospital demonstrativo', procedure: 'Coluna demonstrativa', neededAt: todayDate(), unit: 'Curitiba', responsible: 'Equipe demo', notes: '', lines: [{ productId: 'p1', quantity: 3 }], ...extra });
const latest = (data) => data.orders[0];
const reserve = (data) => reserveByExpiry(data, latest(data).id);
function checked(data) {
  const order = latest(data);
  let next = data;
  for (const a of order.allocations) {
    const s = data.stock.find((s) => s.id === a.stockId), p = data.products.find((p) => p.id === s.productId);
    next = checkOrderAllocation(next, order.id, a.id, p.code, s.lot, a.quantity - a.checked);
  }
  return next;
}

test('criação valida referência, data, unidade e itens sem afetar estoque', () => {
  const base = makeDemoData();
  const data = createOrder(base, input());
  assert.deepEqual(data.stock, base.stock);
  assert.equal(orderStage(data, latest(data)), 'Pendente');
  assert.throws(() => createOrder(data, input({ reference: ' ped-001 ' })), /referência/);
  assert.throws(() => createOrder(base, input({ neededAt: '2020-01-01' })), /data/);
  assert.throws(() => createOrder(base, input({ unit: 'Outra' })), /unidade/);
  assert.throws(() => createOrder(base, input({ lines: [] })), /produto/);
  assert.throws(() => createOrder(base, input({ lines: [{productId:'p1',quantity:1},{productId:'p1',quantity:2}] })), /única linha/);
  assert.throws(() => createOrder(base, input({ lines: [{productId:'p1',quantity:-1}] })), /inteiro/);
});

test('migração preserva reservas internas e não inventa pedidos', () => {
  const base = makeDemoData();
  const { orders, ...v2 } = base;
  const next = normalizeData({ ...v2, schemaVersion: 2 });
  assert.deepEqual(next.orders, []);
  assert.equal(next.stock[0].reserved, 2);
  assert.equal(next.schemaVersion, 3);
});

test('reserva compromete saldo livre sem baixar físico e sem permitir dupla reserva', () => {
  let data = reserve(createOrder(makeDemoData(), input()));
  const first = latest(data);
  assert.equal(data.stock[0].quantity, 6);
  assert.equal(data.stock[0].reserved, 5);
  assert.equal(availableQuantity(data.stock[0]), 1);
  assert.equal(orderReservedQuantity(data, 's1'), 3);
  data = reserve(createOrder(data, input({reference:'PED-002'})));
  assert.equal(latest(data).allocations[0].quantity, 1);
  assert.equal(orderStage(data, latest(data)), 'Reserva parcial');
  assert.equal(data.stock[0].reserved, 6);
  assert.throws(() => reserveOrder(data, first.id, first.lines[0].id, 's1', 1), /pendente/);
  assert.throws(() => reserve(data), /Nenhum saldo/);
  assert.throws(() => moveStock(data, 's1', 'Saída', 1), /disponível/);
});

test('seleção por validade divide lotes e exclui outra unidade, vencidos e data insuficiente', () => {
  let base = makeDemoData();
  base = addPosition(base, { productId: 'p1', lot: 'PRIMEIRO', location: 'Curitiba · C1', expiresAt: todayDate(), quantity: 2 });
  let data = reserve(createOrder(base, input({ lines: [{ productId: 'p1', quantity: 5 }] })));
  assert.deepEqual(latest(data).allocations.map((a) => a.quantity), [2,3]);
  assert.equal(data.stock.find((s) => s.id === 's2').reserved, 0);
  const future = new Date(); future.setDate(future.getDate() + 25);
  data = createOrder(base, input({ neededAt: `${future.getFullYear()}-${String(future.getMonth()+1).padStart(2,'0')}-${String(future.getDate()).padStart(2,'0')}` }));
  assert.throws(() => reserve(data), /Nenhum saldo/);
  const o = latest(data);
  assert.throws(() => reserveOrder(data, o.id, o.lines[0].id, 's2', 1), /unidade/);
});

test('reservas vinculadas não são reduzidas pela tela de situações', () => {
  const data = reserve(createOrder(makeDemoData(), input()));
  assert.throws(() => allocate(data, 's1', 2, 0, 0, 'teste'), /vinculadas/);
  const next = allocate(data, 's1', 3, 1, 0, 'Libera apenas reserva interna');
  assert.equal(orderReservedQuantity(next,'s1'),3);
  assert.equal(next.stock[0].reserved,3);
});

test('conferência valida produto, lote e quantidade e impede expedição parcial', () => {
  let data = reserve(createOrder(makeDemoData(), input()));
  const o = latest(data), a = o.allocations[0];
  assert.throws(() => checkOrderAllocation(data,o.id,a.id,'ERRADO','PP26A091',1), /Código/);
  assert.throws(() => checkOrderAllocation(data,o.id,a.id,'IMP-PP-001','ERRADO',1), /Lote/);
  assert.throws(() => checkOrderAllocation(data,o.id,a.id,'IMP-PP-001','PP26A091',4), /ultrapassa/);
  data = checkOrderAllocation(data,o.id,a.id,'IMP-PP-001','PP26A091',1);
  assert.equal(orderStage(data,latest(data)),'Em separação');
  assert.throws(() => dispatchOrder(data,o.id,'ROM-001'), /todos os itens/);
  data = checked(data);
  assert.equal(orderStage(data,latest(data)),'Pronto para expedir');
  assert.throws(() => checkOrderAllocation(data,o.id,a.id,'IMP-PP-001','PP26A091',1), /ultrapassa/);
  data = resetOrderCheck(data,o.id,a.id);
  assert.equal(latest(data).allocations[0].checked,0);
});

test('expedição baixa físico e reserva uma vez e preserva reservas internas', () => {
  const base = makeDemoData();
  let data = checked(reserve(createOrder(base,input())));
  const o = latest(data);
  assert.throws(() => dispatchOrder(data,o.id,''), /referência/);
  data = dispatchOrder(data,o.id,'ROM-001');
  assert.equal(data.stock[0].quantity,3);
  assert.equal(data.stock[0].reserved,2);
  assert.equal(availableQuantity(data.stock[0]),1);
  assert.equal(latest(data).status,'Expedido');
  assert.equal(data.movements[0].orderId,o.id);
  assert.equal(data.movements[0].quantity,3);
  assert.equal(data.movements[0].to,o.hospital);
  assert.throws(() => dispatchOrder(data,o.id,'ROM-001'), /encerrado/);
  assert.throws(() => cancelOrder(data,o.id,'teste'), /encerrado/);
  assert.equal(base.stock[0].quantity,6);
  assert.deepEqual(normalizeData(data).orders,data.orders);
});

test('cancelamento libera somente a reserva do pedido e exige motivo', () => {
  let data = reserve(createOrder(makeDemoData(),input()));
  const first = latest(data).id;
  data = reserve(createOrder(data,input({reference:'PED-002',lines:[{productId:'p1',quantity:1}]})));
  assert.throws(() => cancelOrder(data,first,''), /motivo/);
  data = cancelOrder(data,first,'Atendimento cancelado');
  assert.equal(data.stock[0].reserved,3);
  assert.equal(data.stock[0].quantity,6);
  assert.equal(orderReservedQuantity(data,'s1'),1);
  assert.throws(() => cancelOrder(data,first,'teste'), /encerrado/);
});

test('liberação remove conferência e reserva; complemento de reserva exige nova conferência', () => {
  let data = createOrder(makeDemoData(),input());
  const o=latest(data);
  data = reserveOrder(data,o.id,o.lines[0].id,'s1',1);
  data = checked(data);
  data = reserveOrder(data,o.id,o.lines[0].id,'s1',1);
  assert.equal(latest(data).allocations[0].checked,0);
  data = releaseOrderAllocation(data,o.id,latest(data).allocations[0].id,'Troca de lote');
  assert.equal(data.stock[0].reserved,2);
  assert.equal(latest(data).allocations.length,0);
});

test('validade é revalidada na conferência e na expedição sem mutação parcial', () => {
  let data = checked(reserve(createOrder(makeDemoData(),input())));
  const o=latest(data);
  data={...data,stock:data.stock.map((s)=>s.id==='s1'?{...s,expiresAt:'2020-01-01'}:s)};
  assert.equal(orderStage(data,latest(data)),'Revisar reserva');
  const snapshot=JSON.stringify(data);
  assert.throws(() => dispatchOrder(data,o.id,'ROM-001'), /lotes válidos/);
  assert.equal(JSON.stringify(data),snapshot);
});

test('reserva e expedição invalidam contagem anterior e ajuste respeita comprometidos', () => {
  let data = submitCount(makeDemoData(),'s1',0,5,'Diferença');
  data=reserve(createOrder(data,input()));
  assert.throws(() => reviewCount(data,data.counts[0].id,true), /Houve movimentação/);
  data=reviewCount(data,data.counts[0].id,false);
  data=submitCount(data,'s1',data.stock[0].revision,4,'Diferença');
  assert.throws(() => reviewCount(data,data.counts[0].id,true), /comprometidas/);
});

test('indicadores refletem estágio, prazo e unidade de origem', () => {
  let data=createOrder(makeDemoData(),input());
  assert.deepEqual(orderMetrics(data),{open:1,incomplete:1,ready:0,urgent:1});
  assert.deepEqual(orderMetrics(data,'Porto Alegre'),{open:0,incomplete:0,ready:0,urgent:0});
  data=checked(reserve(data));
  assert.deepEqual(orderMetrics(data),{open:1,incomplete:0,ready:1,urgent:0});
  data=dispatchOrder(data,latest(data).id,'ROM-001');
  assert.deepEqual(orderMetrics(data),{open:0,incomplete:0,ready:0,urgent:0});
});

test('ficha do lote reúne saldo, pedidos, movimentações e contagens só daquela posição', () => {
  let data = makeDemoData();
  // Mesmo lote em outro local (registro fictício de teste) não entra na ficha de s1.
  data = addPosition(data, { productId: 'p1', lot: 'PP26A091', location: 'Curitiba · TESTE-UX-99', expiresAt: data.stock[0].expiresAt, quantity: 4 });
  data = moveStock(data, data.stock.at(-1).id, 'Saída', 1);
  data = checked(reserve(createOrder(data, input({ reference: 'TESTE-UX-LOTE', lines: [{ productId: 'p1', quantity: 3 }] }))));
  const before = lotTrace(data, 's1');
  const c = before.composition;
  assert.equal(c.available + c.orderReserved + c.internalReserved + c.blocked + c.quarantined + c.expiredFree, before.stock.quantity);
  assert.equal(c.orderReserved, 3);
  assert.equal(c.internalReserved, 2);
  assert.equal(before.orders.length, 1);
  assert.equal(before.orders[0].reserved, 3);
  assert.equal(before.orders[0].checked, 3);
  assert.ok(before.movements.every((m) => m.from === 'Curitiba · A1-02-03' || m.to === 'Curitiba · A1-02-03'));
  data = dispatchOrder(data, latest(data).id, 'ROM-TESTE-UX');
  const after = lotTrace(data, 's1');
  assert.equal(after.orders[0].order.status, 'Expedido');
  assert.equal(after.orders[0].shipped, 3);
  assert.equal(after.composition.orderReserved, 0);
  assert.equal(after.movements[0].orderId, latest(data).id);
  data = submitCount(data, 's1', after.stock.revision, after.stock.quantity, '');
  assert.equal(lotTrace(data, 's1').counts.length, 1);
  assert.equal(lotTrace(data, data.stock.at(-1).id).counts.length, 0);
  assert.equal(lotTrace(data, 'inexistente'), null);
});
