import { useState } from 'react';
import { daysToExpiry, getProduct, orderReservedQuantity, type DemoData, type Stock } from './data';
import { allocate, receiveTransfer } from './domain';

type Props = { data: DemoData; onChange: (data: DemoData) => void };

/** Transferências e registro geral. As situações por posição ficam na ficha do lote (LotSheet). */
export default function StockControls({ data, onChange, onOpenLot }: Props & { onOpenLot: (id: string) => void }) {
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const pending = data.transfers.filter((t) => !t.receivedAt);
  const positionOf = (stockId?: string) => data.stock.find((s) => s.id === stockId);
  return <div className="module-stack stock-controls">
    {message && <p className="module-success" role="status">{message}</p>}
    <section className="panel"><div className="panel-head"><div><h2>Transferências em trânsito</h2><p>O saldo só entra no destino após a confirmação, em quarentena para conferência.</p></div></div><div className="module-form">{error && <p className="module-error" role="alert">{error}</p>}{!pending.length && <p className="module-note">Nenhuma transferência aguardando recebimento.</p>}{pending.map((transfer) => <article className="transfer-record" key={transfer.id}><div><strong>{getProduct(transfer.productId, data.products).name} · {transfer.quantity} un.</strong><small>Lote {transfer.lot} · {transfer.from} → {transfer.to}</small><small>{new Date(transfer.date).toLocaleString('pt-BR')}</small></div><button className="button secondary" onClick={() => { setError(''); setMessage(''); try { onChange(receiveTransfer(data, transfer.id)); setMessage('Recebimento confirmado em quarentena. Revise a posição no destino.'); } catch (err) { setError((err as Error).message); } }}>Confirmar recebimento</button></article>)}</div></section>
    <section className="panel"><div className="panel-head"><div><h2>Registro local de alterações</h2><p>Histórico demonstrativo de cadastros, situações e contagens. Sem auditoria de produção.</p></div></div><div className="audit-list">{!data.audit.length && <p className="module-note">As próximas alterações aparecerão aqui.</p>}{data.audit.slice(0, 30).map((event) => { const position = positionOf(event.stockId); return <div key={event.id}><time>{new Date(event.date).toLocaleString('pt-BR')}</time><strong>{event.action}</strong><span>{event.detail}{position && <> · <button type="button" className="text-link inline-link" onClick={() => onOpenLot(position.id)}>ficha do lote {position.lot}</button></>}</span></div>; })}{data.audit.length > 30 && <p className="module-note">Exibindo as 30 alterações mais recentes.</p>}</div></section>
  </div>;
}

/** Formulário de situações de uma posição. Reservas vinculadas a pedidos não podem ser reduzidas aqui. */
export function AllocationForm({ stock, data, onChange }: Props & { stock: Stock }) {
  const linked = orderReservedQuantity(data, stock.id);
  const [reserved, setReserved] = useState(String(stock.reserved)), [blocked, setBlocked] = useState(String(stock.blocked)), [quarantined, setQuarantined] = useState(String(stock.quarantined));
  const [reason, setReason] = useState(''), [error, setError] = useState('');
  return <form className="module-form-inner" onSubmit={(e) => { e.preventDefault(); setError(''); try { onChange(allocate(data, stock.id, Number(reserved), Number(blocked), Number(quarantined), reason)); } catch (err) { setError((err as Error).message); } }}>
    {daysToExpiry(stock.expiresAt) < 0 && <p className="module-error">Lote vencido: nenhuma quantidade disponível para saída ou transferência.</p>}
    <div className="module-form-row three-columns"><label>Reservado<input required type="number" min={linked} step="1" inputMode="numeric" aria-describedby={linked > 0 ? `linked-${stock.id}` : undefined} value={reserved} onChange={(e) => setReserved(e.target.value)}/>{linked > 0 && <small id={`linked-${stock.id}`} className="field-note">Mín. {linked} (pedidos)</small>}</label><label>Bloqueado<input required type="number" min="0" step="1" inputMode="numeric" value={blocked} onChange={(e) => setBlocked(e.target.value)}/></label><label>Quarentena<input required type="number" min="0" step="1" inputMode="numeric" value={quarantined} onChange={(e) => setQuarantined(e.target.value)}/></label></div>
    <label>Motivo da alteração<input required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: reserva interna ou conferência concluída"/></label>
    <p className="module-note">Informe o total em unidades em cada situação. Reserva, bloqueio e quarentena somados não podem passar do físico ({stock.quantity} un.).</p>
    {error && <p className="module-error" role="alert">{error}</p>}<button className="button primary">Salvar situações</button>
  </form>;
}
