import { useState, type RefObject } from 'react';
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import { daysToExpiry, formatDate, getProduct, type DemoData } from './data';
import { lotTrace } from './lotTrace';
import { orderStage } from './orderDomain';
import { AllocationForm } from './StockControls';

type Props = {
  data: DemoData;
  stockId: string;
  status: { label: string; tone: string };
  headingRef: RefObject<HTMLHeadingElement | null>;
  onChange: (data: DemoData) => void;
  onClose: () => void;
  onMovement: (stockId: string) => void;
  onOpenOrder: (orderId: string) => void;
};

const LIMIT = 5;
const dateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Ficha do lote (página de objeto em painel lateral): tudo sobre uma posição produto + lote + local. */
export default function LotSheet({ data, stockId, status, headingRef, onChange, onClose, onMovement, onOpenOrder }: Props) {
  const trace = lotTrace(data, stockId);
  const [message, setMessage] = useState('');
  const [showAllMovements, setShowAllMovements] = useState(false), [showAllAudit, setShowAllAudit] = useState(false);
  if (!trace) return null;
  const { stock, composition: c, orders, movements, counts, audit, outgoing, incoming } = trace;
  const product = getProduct(stock.productId, data.products);
  const days = daysToExpiry(stock.expiresAt);
  const segments = [
    { key: 'available', label: 'Disponível', value: c.available },
    { key: 'order', label: 'Reserva de pedidos', value: c.orderReserved },
    { key: 'internal', label: 'Reserva interna', value: c.internalReserved },
    { key: 'blocked', label: 'Bloqueado', value: c.blocked },
    { key: 'quarantine', label: 'Quarentena', value: c.quarantined },
    { key: 'expired', label: 'Vencido sem situação', value: c.expiredFree },
  ];
  const shownMovements = showAllMovements ? movements : movements.slice(0, LIMIT);
  const shownAudit = showAllAudit ? audit : audit.slice(0, LIMIT);

  return <aside className="panel lot-sheet" id="ficha-lote" aria-labelledby="lot-sheet-title">
    <div className="lot-sheet-head">
      <div className="lot-sheet-nav"><button type="button" className="text-link lot-sheet-back" onClick={onClose}><ArrowLeft size={15}/> Voltar à lista</button><button type="button" className="icon-button lot-sheet-close" aria-label="Fechar ficha do lote" title="Fechar (Esc)" onClick={onClose}><X size={18}/></button></div>
      <span className="lot-sheet-caption">Ficha do lote</span>
      <h2 id="lot-sheet-title" ref={headingRef} tabIndex={-1}>{product.name}</h2>
      <p className="lot-sheet-sub"><span className="mono">{product.code}</span> · {product.category}</p>
      <span className={`status status-${status.tone}`}>{status.label}</span>
    </div>

    <dl className="lot-facts">
      <div><dt>Lote</dt><dd className="mono">{stock.lot}</dd></div>
      <div><dt>Validade</dt><dd>{formatDate(stock.expiresAt)}<small>{days < 0 ? `vencido há ${-days} ${-days === 1 ? 'dia' : 'dias'}` : days === 0 ? 'vence hoje' : `${days} ${days === 1 ? 'dia' : 'dias'} restantes`}</small></dd></div>
      <div><dt>Localização</dt><dd>{stock.location}</dd></div>
      <div><dt>UDI</dt><dd className="is-muted">Não registrada<small>Campo previsto; sem leitura de UDI nesta versão</small></dd></div>
      {product.manufacturer && <div><dt>Fabricante</dt><dd>{product.manufacturer}</dd></div>}
      {product.supplier && <div><dt>Fornecedor</dt><dd>{product.supplier}</dd></div>}
    </dl>

    <section className="lot-section" aria-labelledby="lot-balance-title">
      <div className="lot-section-head"><h3 id="lot-balance-title">Saldo da posição</h3><span><strong>{stock.quantity} un.</strong> físicas</span></div>
      <div className="composition-bar lot-bar" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value} un.`).join('; ')}>{segments.filter((s) => s.value > 0).map((s) => <span key={s.key} className={`seg seg-${s.key}`} style={{ flexGrow: s.value }}/>)}</div>
      <ul className="lot-balance">{segments.map((s) => <li key={s.key} className={s.value ? '' : 'is-empty'}><span className={`swatch seg-${s.key}`} aria-hidden="true"/><span>{s.label}</span><strong>{s.value} un.</strong></li>)}</ul>
      {(outgoing.length > 0 || incoming.length > 0) && <p className="module-note">{outgoing.map((t) => `${t.quantity} un. em trânsito para ${t.to}`).concat(incoming.map((t) => `${t.quantity} un. a receber de ${t.from}`)).join(' · ')}. Em trânsito não compõe o físico.</p>}
      <div className="module-actions"><button type="button" className="button primary" onClick={() => onMovement(stock.id)}><Plus size={16}/> Registrar movimentação</button></div>
    </section>

    <section className="lot-section" aria-labelledby="lot-situations-title">
      <div className="lot-section-head"><h3 id="lot-situations-title">Situações</h3></div>
      <div className="module-form lot-form">
        {message && <p className="module-success" role="status">{message}</p>}
        <AllocationForm key={`${stock.id}:${stock.revision}`} stock={stock} data={data} onChange={(next) => { onChange(next); setMessage('Situações atualizadas. O disponível foi recalculado.'); }}/>
      </div>
    </section>

    <section className="lot-section" aria-labelledby="lot-orders-title">
      <div className="lot-section-head"><h3 id="lot-orders-title">Pedidos vinculados</h3><span>{orders.length}</span></div>
      {orders.length ? <ul className="lot-list">{orders.map(({ order, reserved, checked, shipped }) => { const stage = orderStage(data, order); return <li key={order.id}><div><strong>{order.reference}</strong><small>{order.hospital} · para {formatDate(order.neededAt)}</small><small>{order.status === 'Expedido' ? `${shipped} un. expedidas deste lote` : order.status === 'Cancelado' ? 'Reserva liberada no cancelamento' : `${reserved} un. reservadas · ${checked} conferidas`}</small></div><span className={`status status-${stage === 'Expedido' || stage === 'Pronto para expedir' ? 'neutral' : stage === 'Revisar reserva' ? 'danger' : stage === 'Reserva parcial' ? 'warning' : 'info'}`}>{stage}</span><button type="button" className="text-link" onClick={() => onOpenOrder(order.id)}>Abrir pedido <ArrowRight size={14}/></button></li>; })}</ul> : <p className="module-note">Nenhum pedido reservou este lote.</p>}
    </section>

    <section className="lot-section" aria-labelledby="lot-movements-title">
      <div className="lot-section-head"><h3 id="lot-movements-title">Movimentações</h3><span>{movements.length}</span></div>
      {movements.length ? <ul className="lot-list lot-timeline">{shownMovements.map((m) => <li key={m.id}><div><strong>{m.type} · {m.quantity > 0 && m.type === 'Ajuste' ? '+' : ''}{m.quantity} un.</strong><small>{m.from ?? '—'}{m.to ? ` → ${m.to}` : ''}</small>{m.reason && <small>{m.reason}</small>}</div><time>{dateTime(m.date)}</time></li>)}</ul> : <p className="module-note">Nenhuma movimentação registrada para este lote neste local.</p>}
      {movements.length > LIMIT && <button type="button" className="text-link" aria-expanded={showAllMovements} onClick={() => setShowAllMovements((v) => !v)}>{showAllMovements ? 'Mostrar menos' : `Mostrar todas (${movements.length})`}</button>}
    </section>

    <section className="lot-section" aria-labelledby="lot-counts-title">
      <div className="lot-section-head"><h3 id="lot-counts-title">Contagens</h3><span>{counts.length}</span></div>
      {counts.length ? <ul className="lot-list">{counts.map((count) => <li key={count.id}><div><strong>{count.status}{count.status === 'Pendente' && count.revision !== stock.revision ? ' · desatualizada' : ''}</strong><small>Esperado {count.expected} · contado {count.counted} · diferença {count.counted - count.expected > 0 ? '+' : ''}{count.counted - count.expected}</small></div><time>{dateTime(count.date)}</time></li>)}</ul> : <p className="module-note">Nenhuma contagem física registrada.</p>}
    </section>

    <section className="lot-section" aria-labelledby="lot-audit-title">
      <div className="lot-section-head"><h3 id="lot-audit-title">Alterações registradas</h3><span>{audit.length}</span></div>
      {audit.length ? <ul className="lot-list lot-timeline">{shownAudit.map((event) => <li key={event.id}><div><strong>{event.action}</strong><small>{event.detail}</small></div><time>{dateTime(event.date)}</time></li>)}</ul> : <p className="module-note">Sem alterações registradas neste navegador.</p>}
      {audit.length > LIMIT && <button type="button" className="text-link" aria-expanded={showAllAudit} onClick={() => setShowAllAudit((v) => !v)}>{showAllAudit ? 'Mostrar menos' : `Mostrar todas (${audit.length})`}</button>}
      <p className="module-note">Registro local e demonstrativo; não é trilha de auditoria de produção.</p>
    </section>
  </aside>;
}
