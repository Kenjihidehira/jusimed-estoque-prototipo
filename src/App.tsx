import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Barcode, Bell, Boxes, ChartNoAxesCombined, Check, Download, LayoutDashboard, Menu, Plus, RotateCcw, Search, X } from 'lucide-react';
import { availableQuantity, daysToExpiry, formatDate, getProduct as findProduct, makeDemoData, normalizeData, orderReservedQuantity, storageKey, type DemoData, type Movement, type Stock, type Product } from './data';
import Analytics from './Analytics';
import Catalog from './Catalog';
import Inventory from './Inventory';
import StockControls from './StockControls';
import LotSheet from './LotSheet';
import Orders, { type OrderFilter } from './OrderWorkspace';
import { moveStock } from './domain';
import { csvCell } from './importing';

type Page = 'analytics' | 'overview' | 'stock' | 'scan' | 'movements' | 'alerts' | 'catalog' | 'counts' | 'orders';
type MovementType = Movement['type'];
const nav: { page: Page; slug: string; label: string; icon: typeof Boxes }[] = [
  { page: 'analytics', slug: 'dashboard', label: 'Dashboard', icon: ChartNoAxesCombined },
  { page: 'overview', slug: 'operacao', label: 'Operação', icon: LayoutDashboard },
  { page: 'stock', slug: 'estoque', label: 'Estoque', icon: Boxes },
  { page: 'orders', slug: 'pedidos', label: 'Pedidos', icon: ArrowUpRight },
  { page: 'catalog', slug: 'cadastro', label: 'Cadastro', icon: Plus },
  { page: 'counts', slug: 'inventario', label: 'Inventário físico', icon: Check },
  { page: 'scan', slug: 'leitura', label: 'Leitura de código', icon: Barcode },
  { page: 'movements', slug: 'movimentacoes', label: 'Movimentações', icon: ArrowLeftRight },
  { page: 'alerts', slug: 'alertas', label: 'Alertas', icon: Bell },
];
type Route = { page: Page; lotId?: string };
/** Endereços: #/estoque, #/pedidos… e #/estoque/<id da posição> para a ficha do lote. */
function parseHash(): Route {
  const [, slug = '', lotId = ''] = /^#\/([^/]*)(?:\/(.+))?$/.exec(window.location.hash) ?? [];
  const item = nav.find((entry) => entry.slug === slug);
  if (!item) return { page: 'analytics' };
  return item.page === 'stock' && lotId ? { page: 'stock', lotId: decodeURIComponent(lotId) } : { page: item.page };
}
/** Abaixo de 1280 px a ficha do lote ocupa a tela em vez de ficar ao lado da lista (ver modules.css). */
const narrowScreen = () => window.matchMedia('(max-width: 1279px)').matches;
const pageTitle: Record<Page, string> = { analytics: 'Visão estratégica do estoque', overview: 'Operação de estoque', stock: 'Estoque por lote', scan: 'Leitura de código', movements: 'Movimentações', alerts: 'Alertas de estoque', catalog: 'Cadastro e importação', counts: 'Inventário físico', orders: 'Pedidos e expedição' };
const pageSubtitle: Record<Page, string> = {
  analytics: 'Disponibilidade de dispositivos, exposição por validade e pendências entre unidades.',
  overview: 'Prioridades do dia e últimos registros da equipe.',
  stock: 'Saldo por produto, lote e local. Selecione uma posição para abrir a ficha do lote.',
  orders: 'Fluxo do pedido: criar, reservar lotes, conferir e expedir.',
  catalog: 'Produtos, novos lotes e importação de planilha com validação antes de gravar.',
  counts: 'Contagem cega por posição e revisão da divergência antes do ajuste.',
  scan: 'Consulta por código do produto ou lote, com câmera, digitação ou bipador.',
  movements: 'Histórico de entradas, saídas, transferências, recebimentos e ajustes.',
  alerts: 'Validade próxima, vencidos, bloqueios, quarentena e saldo abaixo do mínimo.',
};
type StockFilter = 'Todas as situações' | 'Com alerta' | 'Com reserva' | 'Bloqueio ou quarentena' | 'Regular';
const stockFilters: StockFilter[] = ['Todas as situações', 'Com alerta', 'Com reserva', 'Bloqueio ou quarentena', 'Regular'];

function initialData(): DemoData {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as DemoData;
      if (Array.isArray(parsed.stock) && Array.isArray(parsed.movements)) return normalizeData(parsed);
    }
  } catch { /* Demo resets if browser storage is unavailable. */ }
  return makeDemoData();
}

function stockStatus(stock: Stock, all: Stock[], catalog: Product[]) {
  const getProduct = (id: string) => findProduct(id, catalog);
  const days = daysToExpiry(stock.expiresAt);
  const product = getProduct(stock.productId);
  const total = all.filter((item) => item.productId === stock.productId).reduce((sum, item) => sum + availableQuantity(item), 0);
  if (days < 0) return { label: 'Vencido', tone: 'danger' };
  if (stock.blocked) return { label: 'Com bloqueio', tone: 'danger' };
  if (stock.quarantined) return { label: 'Em quarentena', tone: 'warning' };
  if (days <= 30) return { label: `Vence em ${days} dias`, tone: 'warning' };
  if (total < product.minimum) return { label: 'Abaixo do mínimo', tone: 'warning' };
  return { label: 'Regular', tone: 'neutral' };
}

function downloadCsv(data: DemoData) {
  const getProduct = (id: string) => findProduct(id, data.products);
  const rows = [['Produto', 'Código', 'Lote', 'Localização', 'Validade', 'Físico', 'Disponível', 'Reservado', 'Bloqueado', 'Quarentena'], ...data.stock.map((item) => [getProduct(item.productId).name, getProduct(item.productId).code, item.lot, item.location, item.expiresAt, String(item.quantity), String(availableQuantity(item)), String(item.reserved), String(item.blocked), String(item.quarantined)])];
  const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'jusimed-estoque-demonstracao.csv'; link.click(); URL.revokeObjectURL(url);
}

export default function App() {
  const [data, setData] = useState<DemoData>(initialData);
  const products = data.products;
  const getProduct = (id: string) => findProduct(id, products);
  const [storageWarning, setStorageWarning] = useState(false);
  const [route, setRoute] = useState<Route>(parseHash);
  const page = route.page;
  const [menuOpen, setMenuOpen] = useState(false);
  const [orderView, setOrderView] = useState<{ filter: OrderFilter; unit: string; orderId?: string }>({ filter: 'Abertos', unit: 'Todas as unidades' });
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('Todas as situações');
  const [modal, setModal] = useState(false);
  const [selectedId, setSelectedId] = useState('s1');
  const [movementType, setMovementType] = useState<'Entrada' | 'Saída' | 'Transferência'>('Saída');
  const [quantity, setQuantity] = useState('1');
  const [destination, setDestination] = useState('Porto Alegre · B1-01-02');
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [scanMessage, setScanMessage] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const modalOpener = useRef<HTMLElement | null>(null);
  const modalFirstField = useRef<HTMLSelectElement>(null);
  const lotHeading = useRef<HTMLHeadingElement>(null);
  const lotOpener = useRef<HTMLElement | null>(null);
  const lotPushedFromList = useRef(false);

  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(data)); setStorageWarning(false); } catch { setStorageWarning(true); } }, [data]);
  useEffect(() => { window.scrollTo(0, 0); }, [page]);
  useEffect(() => { if (page === 'scan') scanInputRef.current?.focus(); }, [page]);
  useEffect(() => {
    function syncFromAddress() { const next = parseHash(); if (!next.lotId) lotPushedFromList.current = false; setRoute(next); setMenuOpen(false); setCameraOn(false); }
    window.addEventListener('hashchange', syncFromAddress);
    return () => window.removeEventListener('hashchange', syncFromAddress);
  }, []);
  useEffect(() => { if (route.lotId) lotHeading.current?.focus({ preventScroll: !narrowScreen() }); }, [route.lotId]);
  useEffect(() => {
    if (!route.lotId || modal || menuOpen) return;
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') closeLot(); }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [route.lotId, modal, menuOpen]);
  useEffect(() => {
    if (!menuOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') { setMenuOpen(false); menuButtonRef.current?.focus(); }
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);
  useEffect(() => {
    if (!modal) return;
    modalFirstField.current?.focus();
    function closeOnEscape(event: KeyboardEvent) { if (event.key === 'Escape') closeModal(); }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [modal]);
  useEffect(() => {
    if (!cameraOn || !videoRef.current) return;
    let active = true;
    let stop: (() => void) | undefined;
    const video = videoRef.current;
    import('@zxing/browser').then(({ BrowserMultiFormatReader }) => new BrowserMultiFormatReader().decodeFromVideoDevice(undefined, video, (result) => {
      if (result && active) {
        setScanInput(result.getText());
        setScanMessage('Código lido. Confira o produto antes de registrar.');
        setCameraOn(false);
      }
    })).then((controls) => { if (active) stop = () => controls.stop(); else controls.stop(); }).catch(() => {
      if (active) { setScanMessage('Não foi possível abrir a câmera. Use HTTPS ou localhost e confira a permissão do navegador.'); setCameraOn(false); }
    });
    return () => { active = false; stop?.(); };
  }, [cameraOn]);

  const sortedStock = useMemo(() => [...data.stock].sort((a, b) => daysToExpiry(a.expiresAt) - daysToExpiry(b.expiresAt)), [data.stock]);
  const term = search.trim().toLocaleLowerCase('pt-BR');
  const filteredStock = sortedStock.filter((item) => {
    const status = stockStatus(item, data.stock, products);
    const matchesStatus = stockFilter === 'Todas as situações' || (stockFilter === 'Com alerta' && status.tone !== 'neutral') || (stockFilter === 'Com reserva' && item.reserved > 0) || (stockFilter === 'Bloqueio ou quarentena' && (item.blocked > 0 || item.quarantined > 0)) || (stockFilter === 'Regular' && status.tone === 'neutral');
    return matchesStatus && `${getProduct(item.productId).name} ${getProduct(item.productId).code} ${item.lot} ${item.location}`.toLocaleLowerCase('pt-BR').includes(term);
  });
  const alertStock = sortedStock.filter((item) => stockStatus(item, data.stock, products).tone !== 'neutral');
  const expiring = data.stock.filter((item) => { const days = daysToExpiry(item.expiresAt); return item.quantity > 0 && days >= 0 && days <= 30; }).length;
  const lowProducts = products.filter((product) => data.stock.filter((item) => item.productId === product.id).reduce((sum, item) => sum + availableQuantity(item), 0) < product.minimum).length;
  const selected = data.stock.find((item) => item.id === selectedId) ?? data.stock[0];
  const selectedLot = route.lotId ? data.stock.find((item) => item.id === route.lotId) : undefined;

  function openLot(id: string) {
    lotOpener.current = document.activeElement as HTMLElement | null;
    const target = `#/estoque/${encodeURIComponent(id)}`;
    if (route.page === 'stock' && route.lotId) window.history.replaceState(null, '', target);
    else { lotPushedFromList.current = route.page === 'stock'; window.location.hash = target.slice(1); }
    setRoute({ page: 'stock', lotId: id }); setMenuOpen(false); setSuccess('');
    if (narrowScreen() && route.page === 'stock') window.scrollTo(0, 0);
  }
  function closeLot() {
    const opener = lotOpener.current;
    if (lotPushedFromList.current) { lotPushedFromList.current = false; window.history.back(); }
    else { window.location.hash = '/estoque'; setRoute({ page: 'stock' }); }
    window.setTimeout(() => { if (opener?.isConnected) opener.focus(); }, 60);
  }
  function openOrder(orderId: string) { navigate('orders'); setOrderView({ filter: 'Todos', unit: 'Todas as unidades', orderId }); }

  function openMovement(stockId?: string) { modalOpener.current = document.activeElement as HTMLElement | null; if (stockId) setSelectedId(stockId); setQuantity('1'); setMovementType('Saída'); setFormError(''); setModal(true); }
  function closeModal() { setModal(false); modalOpener.current?.focus?.(); }
  function navigate(next: Page) {
    if (next === 'orders') setOrderView({ filter: 'Abertos', unit: 'Todas as unidades' });
    const slug = nav.find((item) => item.page === next)!.slug;
    if (window.location.hash !== `#/${slug}`) window.location.hash = `/${slug}`;
    lotPushedFromList.current = false;
    setRoute({ page: next }); setMenuOpen(false); setCameraOn(false); setSuccess('');
  }
  function registerMovement(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      setData(moveStock(data, selected.id, movementType, Number(quantity), destination));
      closeModal(); setSuccess(movementType === 'Transferência' ? 'Transferência enviada. Confirme o recebimento na tela Estoque.' : 'Movimentação registrada.');
    } catch (error) { setFormError((error as Error).message); }
  }
  function findCode() {
    const value = scanInput.trim().toLocaleLowerCase('pt-BR');
    if (!value) { setScanMessage('Digite ou leia um código.'); return; }
    const found = data.stock.find((item) => item.lot.toLocaleLowerCase('pt-BR') === value || getProduct(item.productId).code.toLocaleLowerCase('pt-BR') === value);
    if (found) { setSelectedId(found.id); setScanMessage(`Encontrado: ${getProduct(found.productId).name} · lote ${found.lot}.`); }
    else setScanMessage('Código não encontrado nos dados de demonstração.');
  }
  function resetDemo() { if (window.confirm('Restaurar os dados fictícios e apagar as movimentações feitas neste navegador?')) { setData(makeDemoData()); setSuccess('Dados de demonstração restaurados.'); } }

  return <div className="app-shell">
    <a className="skip-link" href="#conteudo" onClick={(event) => { event.preventDefault(); document.getElementById('conteudo')?.focus(); }}>Ir para o conteúdo</a>
    <header className="app-header">
      <div className="header-bar">
        <div className="brand"><img className="brand-logo" src="/brand/jusimed-logo.png" alt="Jusimed — Produtos para Saúde"/><span className="brand-product">Inteligência de estoque<small>Gestão de dispositivos médicos</small></span></div>
        <span className="prototype-label"><span><span className="long">Protótipo independente · </span>dados fictícios</span></span>
        <button ref={menuButtonRef} className="header-menu-toggle icon-button" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen((current) => !current)}>{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button>
      </div>
      <nav id="main-navigation" className={`header-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Menu principal"><span className="header-nav-heading">Áreas do sistema</span>{nav.map(({ page: target, slug, label, icon: Icon }) => <a key={target} href={`#/${slug}`} className={`nav-item ${page === target ? 'active' : ''}`} aria-current={page === target ? 'page' : undefined} onClick={(event) => { event.preventDefault(); navigate(target); }}><Icon size={17} strokeWidth={1.9} aria-hidden="true"/><span>{label}</span></a>)}</nav>
    </header>
    {menuOpen && <button className="header-menu-backdrop" aria-label="Fechar navegação" tabIndex={-1} onClick={() => { setMenuOpen(false); menuButtonRef.current?.focus(); }}/>}
    <main className="main">
      <div className="content" id="conteudo" tabIndex={-1}>
        <div className="page-head"><div><div className="breadcrumb">{page === 'analytics' ? 'Gestão' : 'Operação'} <span>/</span> {pageTitle[page]}</div><h1>{pageTitle[page]}</h1><p className="subhead">{pageSubtitle[page]}</p></div><div className="head-actions">{page === 'stock' && <button className="button secondary" onClick={() => downloadCsv(data)}><Download size={16}/> Exportar CSV</button>}{page === 'analytics' && <button className="button secondary" onClick={() => navigate('stock')}>Ver estoque <ArrowRight size={16}/></button>}{['overview', 'stock', 'movements', 'alerts'].includes(page) && <button className="button primary" onClick={() => openMovement()}><Plus size={17}/> Nova movimentação</button>}</div></div>
        {storageWarning && <p role="alert" className="module-error">Não foi possível salvar no navegador. As alterações desta sessão podem ser perdidas ao fechar a página.</p>}
        {success && <div className="notice success" role="status"><Check size={17}/>{success}<button aria-label="Fechar aviso" onClick={() => setSuccess('')}><X size={15}/></button></div>}
        {page === 'catalog' && <Catalog data={data} onChange={setData}/>}
        {page === 'counts' && <Inventory data={data} onChange={setData}/>}
        {page === 'orders' && <Orders data={data} onChange={setData} initialFilter={orderView.filter} initialUnit={orderView.unit} initialOrderId={orderView.orderId}/>}
        {page === 'analytics' && <Analytics data={data} onViewLot={openLot} onViewAlerts={() => navigate('alerts')} onViewStock={() => navigate('stock')} onViewMovements={() => navigate('movements')} onViewCounts={() => navigate('counts')} onViewOrders={(filter, unit) => { navigate('orders'); setOrderView({ filter, unit }); }} />}
        {page === 'overview' && <>
          <div className="stats"><div><strong>{products.length}</strong><span>produtos cadastrados</span></div><div><strong>{data.stock.filter((item) => item.quantity > 0).length}</strong><span>posições de estoque</span></div><div><strong>{expiring}</strong><span>lotes a vencer em 30 dias</span></div><div><strong>{lowProducts}</strong><span>{lowProducts === 1 ? 'produto abaixo do mínimo' : 'produtos abaixo do mínimo'}</span></div></div>
          <div className="overview-grid"><section className="panel"><div className="panel-head"><div><h2>Prioridades de hoje</h2><p>Itens que exigem atenção da equipe.</p></div><button className="text-link" onClick={() => navigate('alerts')}>Ver alertas <ArrowRight size={16}/></button></div><StockTable items={alertStock.slice(0, 6)} data={data} compact onSelect={openLot}/></section><section className="panel activity-panel"><div className="panel-head"><div><h2>Últimas movimentações</h2><p>Registros feitos no protótipo.</p></div></div><MovementList items={data.movements.slice(0, 5)} catalog={products}/><button className="panel-footer" onClick={() => navigate('movements')}>Ver todas as movimentações <ArrowRight size={16}/></button></section></div>
        </>}
        {page === 'stock' && <div className={`stock-page ${selectedLot ? 'has-selection' : ''}`}><div className="stock-workspace"><section className="panel stock-list"><div className="panel-head toolbar"><div><h2>Posição por lote e local</h2><p aria-live="polite">{filteredStock.length} de {data.stock.length} posições</p></div><div className="toolbar-filters"><label className="search"><Search size={17} aria-hidden="true"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Produto, código, lote ou local" aria-label="Buscar estoque"/>{search && <button type="button" className="icon-button" aria-label="Limpar busca" onClick={() => setSearch('')}><X size={16}/></button>}</label><select aria-label="Filtrar por situação" value={stockFilter} onChange={(event) => setStockFilter(event.target.value as StockFilter)}>{stockFilters.map((item) => <option key={item}>{item}</option>)}</select></div></div><StockTable items={filteredStock} data={data} onSelect={openLot} selectedId={selectedLot?.id} narrow={!!selectedLot} empty={<><strong>Nenhuma posição encontrada.</strong>Revise a busca ou a situação selecionada.{(search || stockFilter !== 'Todas as situações') && <div><button className="button secondary" onClick={() => { setSearch(''); setStockFilter('Todas as situações'); }}>Limpar filtros</button></div>}</>}/><div className="table-foot"><span><strong>Comprometido</strong> = reservas (de pedidos e internas), bloqueio e quarentena. Vencidos nunca ficam disponíveis. Saldos guardados apenas neste navegador.</span><button onClick={resetDemo}><RotateCcw size={14}/> Restaurar demonstração</button></div></section>
          {selectedLot && <LotSheet key={selectedLot.id} data={data} stockId={selectedLot.id} status={stockStatus(selectedLot, data.stock, products)} headingRef={lotHeading} onChange={setData} onClose={closeLot} onMovement={openMovement} onOpenOrder={openOrder}/>}
          </div>
          <div className="stock-extra"><StockControls data={data} onChange={setData} onOpenLot={openLot}/></div>
        </div>}
        {page === 'scan' && <div className="scan-grid"><section className="panel scan-panel"><div className="panel-head"><div><h2>Consultar por código</h2><p>Use câmera, digitação ou leitor USB/Bluetooth em modo teclado.</p></div></div><div className="scan-body"><label className="field-label" htmlFor="scan-code">Código do produto ou lote</label><div className="scan-input"><input ref={scanInputRef} id="scan-code" value={scanInput} autoComplete="off" onChange={(event) => setScanInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') findCode(); }} placeholder="Ex.: IMP-PP-001 ou PP26A091"/><button className="button primary" onClick={findCode}>Consultar</button></div><p className="field-hint">Para bipador em modo teclado, mantenha o campo ativo e leia a etiqueta. A leitura termina com Enter.</p><button className="button secondary camera-button" onClick={() => { setScanMessage(''); setCameraOn((current) => !current); }}><Barcode size={18}/>{cameraOn ? 'Fechar câmera' : 'Ler com a câmera'}</button>{cameraOn && <video ref={videoRef} className="camera-preview" autoPlay muted playsInline/>}{scanMessage && <p className="scan-message" role="status">{scanMessage}</p>}{scanMessage.startsWith('Encontrado:') && <div className="head-actions"><button className="button primary" onClick={() => openLot(selectedId)}>Abrir ficha do lote <ArrowRight size={16}/></button><button className="button secondary" onClick={() => openMovement(selectedId)}>Registrar movimentação</button></div>}</div></section><aside className="scan-help"><h2>Códigos para testar</h2><p>Códigos fictícios. Selecione para preencher a consulta.</p>{data.stock.slice(0, 4).map((item) => <button key={item.id} onClick={() => { setScanInput(item.lot); setScanMessage(''); scanInputRef.current?.focus(); }}><span>{getProduct(item.productId).name}</span><code>{item.lot}</code></button>)}</aside></div>}
        {page === 'movements' && <section className="panel"><div className="panel-head"><div><h2>Histórico de movimentações</h2><p>{data.movements.length} registros neste navegador, do mais recente ao mais antigo.</p></div></div><div className="table-scroll"><table className="data-table movement-table"><thead><tr><th>Data e hora</th><th>Tipo</th><th>Produto</th><th>Lote</th><th className="num">Quantidade</th><th>Origem / destino</th><th>Responsável</th></tr></thead><tbody>{data.movements.length ? data.movements.map((item) => <tr key={item.id}><td data-label="Data e hora">{new Date(item.date).toLocaleString('pt-BR')}</td><td data-label="Tipo"><MovementLabel type={item.type}/></td><td className="cell-strong">{getProduct(item.productId).name}{item.orderId && <small>{item.reason}</small>}</td><td className="mono" data-label="Lote">{item.lot}</td><td className="num" data-label="Quantidade">{item.quantity} un.</td><td className="wide" data-label="Origem / destino">{item.from ? item.from : '—'}{item.to ? ` → ${item.to}` : ''}</td><td data-label="Responsável">{item.actor}</td></tr>) : <tr><td colSpan={7} className="empty-state">Nenhuma movimentação registrada.</td></tr>}</tbody></table></div></section>}
        {page === 'alerts' && <section className="panel"><div className="panel-head"><div><h2>Pontos de atenção</h2><p>Ordenados pela validade mais próxima.</p></div><span className="count-label">{alertStock.length} registros</span></div><StockTable items={alertStock} data={data} onSelect={openLot} empty={<><strong>Nenhum alerta pelas regras demonstrativas.</strong>Todas as posições estão regulares.</>}/><div className="table-foot">Regras ilustrativas. Critérios reais dependem da operação e da área da qualidade.</div></section>}
        <footer className="page-footer">Conceito de estoque para Jusimed · Protótipo independente e não oficial · Dados fictícios</footer>
      </div>
    </main>
    {modal && selected && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="modal-caption">Movimentação de estoque</span><h2 id="modal-title">Novo registro</h2></div><button className="icon-button" aria-label="Fechar" onClick={closeModal}><X size={19}/></button></div><form onSubmit={registerMovement}><div className="modal-body"><label className="field-label" htmlFor="stock-select">Produto · lote · local</label><select ref={modalFirstField} id="stock-select" value={selected.id} onChange={(event) => { setSelectedId(event.target.value); setFormError(''); }}>{data.stock.map((item) => <option key={item.id} value={item.id}>{getProduct(item.productId).name} · {item.lot} · {item.location}</option>)}</select><p className="field-hint">Físico: <strong>{selected.quantity} un.</strong> · Disponível: <strong>{availableQuantity(selected)} un.</strong> · Validade: <strong>{formatDate(selected.expiresAt)}</strong></p><div className="form-row"><div><label className="field-label" htmlFor="movement-type">Tipo</label><select id="movement-type" value={movementType} onChange={(event) => { setMovementType(event.target.value as 'Entrada' | 'Saída' | 'Transferência'); setFormError(''); }}><option>Entrada</option><option>Saída</option><option>Transferência</option></select></div><div><label className="field-label" htmlFor="movement-quantity">Quantidade (un.)</label><input id="movement-quantity" type="number" min="1" step="1" inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} required/></div></div>{movementType !== 'Entrada' && <p className="field-hint">Saída e transferência usam apenas o disponível ({availableQuantity(selected)} un.).</p>}{movementType === 'Transferência' && <><label className="field-label" htmlFor="destination">Destino</label><input id="destination" list="stock-locations" required value={destination} onChange={(event) => setDestination(event.target.value)}/><p className="field-hint">O destino recebe o saldo somente após a confirmação, em quarentena.</p><datalist id="stock-locations">{[...new Set(data.stock.map((item) => item.location))].map((location) => <option key={location} value={location}/>)}</datalist></>}{formError && <div className="form-error" role="alert"><AlertTriangle size={16}/>{formError}</div>}</div><div className="modal-actions"><button type="button" className="button secondary" onClick={closeModal}>Cancelar</button><button type="submit" className="button primary">Registrar movimentação</button></div></form></div></div>}
  </div>;
}

function StockTable({ items, data, compact = false, narrow = false, selectedId, onSelect, empty }: { items: Stock[]; data: DemoData; compact?: boolean; narrow?: boolean; selectedId?: string; onSelect: (id: string) => void; empty?: React.ReactNode }) {
  const getProduct = (id: string) => findProduct(id, data.products);
  const showCommitted = !compact && !narrow;
  return <div className="table-scroll"><table className={`data-table stock-table ${compact ? 'compact-table' : ''} ${narrow ? 'is-narrow' : ''}`}><thead><tr><th>Produto</th><th className="col-code">Código</th><th>Lote · validade</th><th>Localização</th><th className="num">Físico</th><th className="num">Disponível</th>{showCommitted && <th>Comprometido</th>}<th>Situação</th><th><span className="sr-only">Ficha do lote</span></th></tr></thead><tbody>{items.length ? items.map((item) => {
    const status = stockStatus(item, data.stock, data.products);
    const linked = orderReservedQuantity(data, item.id), internal = item.reserved - linked;
    const committed = [linked && { label: `Pedido ${linked}`, order: true }, internal && { label: `Interna ${internal}` }, item.blocked && { label: `Bloq. ${item.blocked}` }, item.quarantined && { label: `Quar. ${item.quarantined}` }].filter(Boolean) as { label: string; order?: boolean }[];
    const available = availableQuantity(item);
    const isSelected = item.id === selectedId;
    return <tr key={item.id} className={`is-clickable ${isSelected ? 'is-selected' : ''}`} onClick={(event) => { if (!(event.target as HTMLElement).closest('button, a')) onSelect(item.id); }}><td className="cell-strong">{getProduct(item.productId).name}<small>{getProduct(item.productId).category}</small></td><td className="mono col-code" data-label="Código">{getProduct(item.productId).code}</td><td data-label="Lote · validade"><span className="mono">{item.lot}</span><small>{formatDate(item.expiresAt)}</small></td><td data-label="Localização">{item.location}</td><td className="num" data-label="Físico">{item.quantity} un.</td><td className="num" data-label="Disponível"><strong className={available ? '' : 'is-zero'}>{available} un.</strong></td>{showCommitted && <td data-label="Comprometido">{committed.length ? <span className="commit-list">{committed.map((c) => <span key={c.label} className={c.order ? 'is-order' : ''} title={c.order ? 'Reserva vinculada a pedido — liberação somente em Pedidos' : undefined}>{c.label}</span>)}</span> : <span className="is-zero">—</span>}</td>}<td data-label="Situação"><span className={`status status-${status.tone}`}>{status.label}</span></td><td className="row-cell"><button className="row-action" aria-label={`Abrir ficha do lote ${item.lot}, ${getProduct(item.productId).name}`} aria-current={isSelected ? 'true' : undefined} title="Abrir ficha do lote" onClick={() => onSelect(item.id)}><ArrowRight size={17}/></button></td></tr>;
  }) : <tr><td colSpan={9} className="empty-state">{empty ?? 'Nenhum registro encontrado.'}</td></tr>}</tbody></table></div>;
}

function MovementLabel({ type }: { type: MovementType }) { const Icon = type === 'Entrada' ? ArrowDownLeft : type === 'Saída' ? ArrowUpRight : ArrowLeftRight; return <span className="movement-label"><Icon size={16} aria-hidden="true"/>{type}</span>; }
function MovementList({ items, catalog }: { items: Movement[]; catalog: Product[] }) { const getProduct = (id: string) => findProduct(id, catalog); return <div className="activity-list">{items.length ? items.map((item) => <div className="activity" key={item.id}><div className="activity-icon" aria-hidden="true">{item.type === 'Entrada' ? <ArrowDownLeft size={17}/> : item.type === 'Saída' ? <ArrowUpRight size={17}/> : <ArrowLeftRight size={17}/>}</div><div><div className="activity-top"><strong>{item.type}</strong><time>{new Date(item.date).toLocaleDateString('pt-BR')}</time></div><p>{getProduct(item.productId).name}</p><small>Lote {item.lot} · {item.quantity} un.</small></div></div>) : <p className="empty-state">Nenhuma movimentação registrada.</p>}</div>; }
