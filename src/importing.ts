import { type DemoData, type Product } from './data.ts';
import { addPosition, canonical, saveProduct } from './domain.ts';

export type SheetRows = unknown[][];
export type ImportRow = { line: number; code: string; product: string; lot: string; location: string; expiresAt: string; quantity: string; error?: string };
const required = ['codigo', 'produto', 'especialidade', 'lote', 'local', 'validade', 'quantidade'];
export const template = 'codigo;produto;especialidade;minimo;fabricante;fornecedor;lote;local;validade;quantidade\nDEMO-NOVO-001;Produto de exemplo;Ortopedia;2;Fabricante exemplo;Fornecedor exemplo;DEMO-001;Curitiba · A3-01-01;2028-12-31;10';

export function parseCsv(text: string): SheetRows {
  const source = text.replace(/^\uFEFF/, '');
  const first = source.split(/\r?\n/)[0];
  const delimiter = first.includes(';') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (char === '"') {
      if (quoted && source[index + 1] === '"') { value += '"'; index++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index++;
      row.push(value); rows.push(row); row = []; value = '';
    } else value += char;
  }
  if (quoted) throw new Error('CSV com aspas sem fechamento.');
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}
const cellText = (cell: unknown) => cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? '').trim();
const dateText = (cell: unknown) => {
  const value = cellText(cell);
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return brazilian ? `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}` : value;
};
const countText = (value: string, label: string) => {
  if (!/^\d+$/.test(value)) throw new Error(`${label} deve ser um inteiro não negativo.`);
  return Number(value);
};

export function inspectImport(rows: SheetRows, data: DemoData): { rows: ImportRow[]; next: DemoData } {
  if (rows.length < 2) throw new Error('A planilha precisa de cabeçalho e ao menos uma linha de dados.');
  if (rows.length > 2001) throw new Error('Importe até 2.000 linhas por arquivo nesta demonstração.');
  const headers = rows[0].map((cell) => canonical(cellText(cell)));
  if (new Set(headers).size !== headers.length) throw new Error('O cabeçalho contém colunas duplicadas.');
  const missing = required.filter((key) => !headers.includes(key));
  if (missing.length) throw new Error(`Colunas ausentes: ${missing.join(', ')}. Baixe o modelo.`);
  let next = data;
  const preview: ImportRow[] = [];
  rows.slice(1).forEach((cells, index) => {
    if (cells.every((cell) => !cellText(cell))) return;
    const raw = (key: string) => cells[headers.indexOf(key)];
    const get = (key: string) => cellText(raw(key));
    const result: ImportRow = { line: index + 2, code: get('codigo'), product: get('produto'), lot: get('lote'), location: get('local'), expiresAt: dateText(raw('validade')), quantity: get('quantidade') };
    try {
      if (typeof raw('codigo') === 'number' || typeof raw('lote') === 'number') throw new Error('Formate código e lote como texto no Excel para preservar zeros iniciais.');
      const existing = next.products.find((p) => canonical(p.code) === canonical(result.code));
      const minimum = get('minimo') ? countText(get('minimo'), 'Mínimo') : existing?.minimum ?? 0;
      const product: Product = { id: existing?.id ?? crypto.randomUUID(), code: result.code, name: result.product, category: get('especialidade'), minimum, manufacturer: get('fabricante'), supplier: get('fornecedor') };
      if (existing && (canonical(existing.name) !== canonical(product.name) || canonical(existing.category) !== canonical(product.category) || existing.minimum !== minimum || ['manufacturer', 'supplier'].some((key) => { const k = key as 'manufacturer' | 'supplier'; return Boolean(product[k]) && canonical(product[k]!) !== canonical(existing[k] ?? ''); }))) throw new Error('O código já existe com outro cadastro. Confira os dados em Cadastro antes de importar.');
      const withProduct = existing ? next : saveProduct(next, product);
      next = addPosition(withProduct, { productId: product.id, lot: result.lot, location: result.location, expiresAt: dateText(raw('validade')), quantity: countText(result.quantity, 'Quantidade') });
    } catch (error) { result.error = error instanceof Error ? error.message : 'Linha inválida.'; }
    preview.push(result);
  });
  if (!preview.length) throw new Error('Não há linhas preenchidas para importar.');
  return { rows: preview, next };
}
export function commitImport(rows: SheetRows, data: DemoData) {
  const result = inspectImport(rows, data);
  if (result.rows.some((row) => row.error)) throw new Error('Corrija todas as linhas antes de confirmar. Nenhum dado foi importado.');
  return result.next;
}
export function downloadText(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csvCell(value: string) { return `"${(/^[=+\-@\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`; }
