import test from 'node:test';
import assert from 'node:assert/strict';
import { makeDemoData, normalizeData, availableQuantity } from '../src/data.ts';
import { addPosition, allocate, moveStock, receiveTransfer, saveProduct, submitCount, reviewCount } from '../src/domain.ts';
import { commitImport, inspectImport, parseCsv, template, csvCell } from '../src/importing.ts';
import readXlsx from 'read-excel-file/node';
import { fileURLToPath } from 'node:url';

test('Excel real é lido e importado preservando códigos e lotes', async () => {
  const workbook = await readXlsx(fileURLToPath(new URL('./fixtures/estoque-exemplo.xlsx', import.meta.url)));
  assert.equal(workbook[0].sheet, 'Estoque');
  const base = makeDemoData();
  const result = commitImport(workbook[0].data, base);
  assert.equal(result.products.at(-1).code, 'DEMO-XLSX-001');
  assert.equal(result.stock.at(-1).lot, 'XLSX-001');
  assert.equal(result.stock.at(-1).quantity, 3);
  assert.equal(base.stock.length, 8);
});

test('migração conserva saldos da versão anterior sem inventar reservas', () => {
  const old = makeDemoData();
  const migrated = normalizeData({ stock: old.stock.map(({ reserved, blocked, quarantined, revision, ...s }) => s), movements: old.movements });
  assert.equal(migrated.stock[0].quantity, old.stock[0].quantity);
  assert.equal(migrated.stock[0].reserved, 0);
  assert.equal(migrated.products.length, 6);
  assert.deepEqual(migrated.counts, []);
});
test('disponível exclui todas as situações e vencidos, sem duplicar saldos', () => {
  const stock = { ...makeDemoData().stock[0], quantity: 100, reserved: 20, blocked: 7, quarantined: 3 };
  assert.equal(availableQuantity(stock), 70);
  assert.equal(availableQuantity({ ...stock, expiresAt: '2020-01-01' }), 0);
});
test('alocações exigem motivo e não podem exceder o físico', () => {
  const data = makeDemoData();
  assert.throws(() => allocate(data, 's1', 6, 1, 0, 'teste'), /excede/);
  assert.throws(() => allocate(data, 's1', 1, 0, 0, ''), /motivo/);
  assert.throws(() => allocate(data, 's1', -1, 0, 0, 'teste'), /inteiro/);
  assert.equal(data.stock[0].reserved, 2);
});
test('saída bloqueia saldo comprometido; entrada reabastece posição zerada', () => {
  const data = makeDemoData();
  assert.throws(() => moveStock(data, 's1', 'Saída', 5), /disponível/);
  let next = allocate(data, 's1', 0, 0, 0, 'liberação');
  next = moveStock(next, 's1', 'Saída', 6);
  next = moveStock(next, 's1', 'Entrada', 2);
  assert.equal(next.stock[0].quantity, 2);
});
test('transferência conserva total entre físico e trânsito e recebe uma única vez', () => {
  const data = makeDemoData(); const total = data.stock.reduce((sum, s) => sum + s.quantity, 0);
  let next = moveStock(data, 's1', 'Transferência', 3, 'Porto Alegre · B9');
  assert.equal(next.stock.reduce((sum, s) => sum + s.quantity, 0) + next.transfers[0].quantity, total);
  assert.equal(next.stock.some((s) => s.location === 'Porto Alegre · B9'), false);
  const id = next.transfers[0].id;
  next = receiveTransfer(next, id);
  const target = next.stock.find((s) => s.location === 'Porto Alegre · B9');
  assert.equal(target.quarantined, 3);
  assert.equal(availableQuantity(target), 0);
  assert.equal(next.stock.reduce((sum, s) => sum + s.quantity, 0), total);
  assert.throws(() => receiveTransfer(next, id), /já recebida/);
});
test('contagem exige justificativa, não muda saldo até revisão e aplica uma vez', () => {
  const data = makeDemoData();
  assert.throws(() => submitCount(data, 's1', 0, 5, ''), /justificativa/);
  let next = submitCount(data, 's1', 0, 5, 'Uma unidade não localizada');
  assert.equal(next.stock[0].quantity, 6);
  assert.throws(() => submitCount(next, 's1', 0, 5, 'teste'), /pendente/);
  const id = next.counts[0].id; next = reviewCount(next, id, true);
  assert.equal(next.stock[0].quantity, 5);
  assert.equal(next.movements[0].type, 'Ajuste');
  assert.equal(next.movements[0].quantity, -1);
  assert.throws(() => reviewCount(next, id, true), /já revisada/);
});
test('contagem desatualizada não sobrescreve movimentação posterior', () => {
  let data = submitCount(makeDemoData(), 's1', 0, 5, 'Recontagem');
  data = moveStock(data, 's1', 'Entrada', 2);
  assert.throws(() => reviewCount(data, data.counts[0].id, true), /Houve movimentação/);
  assert.throws(() => submitCount(data, 's2', 99, 11, ''), /saldo mudou/);
  assert.equal(reviewCount(data, data.counts[0].id, false).stock[0].quantity, 8);
});
test('ajuste não reduz o físico para abaixo das quantidades comprometidas', () => {
  const data = submitCount(makeDemoData(), 's1', 0, 1, 'Falta encontrada');
  assert.throws(() => reviewCount(data, data.counts[0].id, true), /comprometidas/);
});
test('cadastro rejeita código duplicado, datas impossíveis e lote/local duplicados', () => {
  const data = makeDemoData();
  assert.throws(() => saveProduct(data, { ...data.products[0], id: 'new', code: ' imp-pp-001 ' }), /Já existe/);
  assert.throws(() => addPosition(data, { ...data.stock[0], expiresAt: '2027-02-30' }), /validade válida/);
  assert.throws(() => addPosition(data, { ...data.stock[0], location: ' curitiba · a1-02-03 ' }), /já cadastrados/);
});
test('importação é aditiva e impede reimportar o mesmo lote/local', () => {
  const data = makeDemoData(), rows = parseCsv(template);
  const next = commitImport(rows, data);
  assert.equal(next.products.length, data.products.length + 1);
  assert.equal(next.stock.length, data.stock.length + 1);
  assert.throws(() => commitImport(rows, next), /Corrija/);
  assert.equal(data.stock.length, 8);
});
test('uma linha inválida bloqueia o lote inteiro de importação', () => {
  const data = makeDemoData(), rows = parseCsv(template);
  rows.push([...rows[1]]); rows[2][6] = 'OUTRO'; rows[2][9] = '-1';
  assert.equal(inspectImport(rows, data).rows.filter((r) => r.error).length, 1);
  assert.throws(() => commitImport(rows, data), /Nenhum dado/);
  assert.equal(data.stock.length, 8);
});
test('CSV preserva delimitadores e quebras entre aspas; exportação neutraliza fórmulas', () => {
  assert.deepEqual(parseCsv('a;b\n"x;y";"linha\nseguinte"'), [['a', 'b'], ['x;y', 'linha\nseguinte']]);
  assert.throws(() => parseCsv('a;b\n"incompleto'), /aspas/);
  assert.equal(csvCell('=1+1'), '"\'=1+1"');
});
test('prévia da importação mostra a validade normalizada também nas linhas com erro', () => {
  const data = makeDemoData(), rows = parseCsv(template);
  rows.push([...rows[1]]); rows[2][0] = 'TESTE-UX-IMP'; rows[2][6] = 'TESTE-UX-LOTE'; rows[2][8] = '31/12/2028'; rows[2][9] = 'abc';
  const preview = inspectImport(rows, data).rows;
  assert.equal(preview[0].expiresAt, '2028-12-31');
  assert.equal(preview[1].expiresAt, '2028-12-31');
  assert.ok(preview[1].error);
  assert.equal(data.stock.length, 8);
});
test('códigos numéricos do Excel não passam sem preservar zeros iniciais', () => {
  const rows = parseCsv(template); rows[1][0] = 123;
  assert.match(inspectImport(rows, makeDemoData()).rows[0].error, /texto/);
});
