import { useRef, useState } from 'react';
import { getProduct, type DemoData } from './data';
import { canonical, reviewCount, submitCount } from './domain';
import CameraReader from './CameraReader';

export default function Inventory({ data, onChange }: { data: DemoData; onChange: (data: DemoData) => void }) {
  const [code, setCode] = useState(''), [matches, setMatches] = useState<string[] | null>(null);
  const [selection, setSelection] = useState<{ id: string; revision: number } | null>(null);
  const [counted, setCounted] = useState(''), [reason, setReason] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const quantityInput = useRef<HTMLInputElement>(null);
  function choose(id: string) { const stock = data.stock.find((s) => s.id === id); setSelection(stock ? { id, revision: stock.revision } : null); setCounted(''); setReason(''); setError(''); }
  function lookup(value = code) {
    setError(''); setMessage(''); setCode(value);
    const key = canonical(value);
    if (!key) { setError('Informe um código de produto ou lote.'); return; }
    const items = data.stock.filter((s) => canonical(s.lot) === key || canonical(getProduct(s.productId, data.products).code) === key);
    setMatches(items.map((s) => s.id)); choose(items.length === 1 ? items[0].id : '');
    setMessage(items.length ? `${items.length} posição(ões) encontrada(s). Confira o lote e o local.` : 'Código não encontrado.');
    if (items.length === 1) quantityInput.current?.focus();
  }
  function review(id: string, approve: boolean) { setError(''); setMessage(''); try { onChange(reviewCount(data, id, approve)); setMessage(approve ? 'Revisão simulada concluída. Saldo atualizado.' : 'Contagem rejeitada. Faça uma nova conferência.'); } catch (err) { setError((err as Error).message); } }
  const options = matches ? data.stock.filter((s) => matches.includes(s.id)) : data.stock;
  const chosen = selection ? data.stock.find((s) => s.id === selection.id) : undefined;
  const pendingCount = data.counts.filter((c) => c.status === 'Pendente').length;
  const ordered = [...data.counts].sort((a, b) => Number(b.status === 'Pendente') - Number(a.status === 'Pendente') || b.date.localeCompare(a.date));
  return <div className="module-stack">
    <ol className="flow-hint inventory-flow" aria-label="Etapas do inventário"><li>Contar sem ver o saldo</li><li>Registrar contagem</li><li>Revisar divergência</li><li>Aplicar ajuste ou rejeitar</li></ol>
    <p className="module-note">O saldo esperado aparece somente depois do registro. A revisão nesta demonstração é feita pelo mesmo usuário e não substitui aprovação por outra pessoa.</p>
    {error && <p role="alert" className="module-error">{error}</p>}{message && <p role="status" className="module-success">{message}</p>}
    <section className="panel"><div className="panel-head"><div><h2>Nova contagem física</h2><p>Conte todas as unidades da posição, inclusive reservadas, bloqueadas e em quarentena.</p></div></div><div className="module-form">
      <label>Código ou lote para contagem<div className="scan-input"><input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookup(); } }} placeholder="Bipe ou digite a etiqueta"/><button type="button" className="button secondary" onClick={() => lookup()}>Localizar</button></div></label>
      <CameraReader onRead={lookup}/>
      <form className="module-form-inner" onSubmit={(e) => { e.preventDefault(); setError(''); setMessage(''); try { if (!selection || counted === '') throw new Error('Selecione a posição e informe a contagem.'); onChange(submitCount(data, selection.id, selection.revision, Number(counted), reason)); setMessage('Contagem registrada. Confira o resultado abaixo.'); setSelection(null); setCounted(''); setReason(''); } catch (err) { setError((err as Error).message); } }}>
        <label>Produto · lote · local<select required value={selection?.id ?? ''} onChange={(e) => choose(e.target.value)}><option value="">Selecione a posição a contar</option>{options.map((s) => <option key={s.id} value={s.id}>{getProduct(s.productId, data.products).name} · {s.lot} · {s.location}</option>)}</select></label>
        {matches && <button className="text-link" type="button" onClick={() => { setMatches(null); setCode(''); choose(''); }}>Mostrar todas as posições</button>}
        {chosen && <p className="count-target">Contando: <strong>{getProduct(chosen.productId, data.products).name}</strong> · lote <span className="mono">{chosen.lot}</span> · {chosen.location}</p>}
        <div className="module-form-row"><label>Quantidade contada (un.)<input ref={quantityInput} type="number" required min="0" step="1" inputMode="numeric" value={counted} onChange={(e) => setCounted(e.target.value)}/></label><label>Justificativa / observação<input placeholder="Obrigatória se houver divergência" value={reason} onChange={(e) => setReason(e.target.value)}/></label></div>
        <button className="button primary" type="submit">Registrar contagem</button>
      </form>
    </div></section>
    <section className="panel"><div className="panel-head"><div><h2>Conferência das contagens</h2><p>{pendingCount} {pendingCount === 1 ? 'pendente' : 'pendentes'} de revisão · pendentes primeiro</p></div></div><div className="count-list">{!data.counts.length && <p className="empty-state"><strong>Nenhuma contagem registrada.</strong>Localize uma posição acima e registre a quantidade contada.</p>}{ordered.map((count) => {
      const stock = data.stock.find((s) => s.id === count.stockId)!;
      const diff = count.counted - count.expected;
      const stale = count.status === 'Pendente' && stock.revision !== count.revision;
      const committed = stock.reserved + stock.blocked + stock.quarantined;
      const belowCommitted = count.status === 'Pendente' && !stale && count.counted < committed;
      const tone = count.status === 'Aplicada' ? 'neutral' : count.status === 'Rejeitada' ? 'info' : stale ? 'danger' : diff ? 'warning' : 'info';
      return <article className={`count-record ${count.status === 'Pendente' ? 'is-pending' : ''}`} key={count.id}><div className="record-title"><div><strong>{getProduct(stock.productId, data.products).name}</strong><small><span className="mono">{stock.lot}</span> · {stock.location}</small></div><span className={`status status-${tone}`}>{count.status === 'Pendente' ? (stale ? 'Desatualizada' : diff ? 'Divergente' : 'Sem divergência') : count.status}</span></div><div className="count-values"><span>Esperado<strong>{count.expected}</strong></span><span>Contado<strong>{count.counted}</strong></span><span>Diferença<strong className={diff < 0 ? 'import-error' : diff > 0 ? 'diff-up' : ''}>{diff > 0 ? '+' : ''}{diff}</strong></span></div><p className="module-note">{new Date(count.date).toLocaleString('pt-BR')} · {count.reason || 'Sem observação'}</p>{stale && <p className="module-error">O saldo desta posição mudou depois da contagem. A aplicação está bloqueada: rejeite e conte novamente.</p>}{belowCommitted && <p className="module-error">A contagem ({count.counted} un.) é menor que o comprometido na posição ({committed} un. em reserva, bloqueio ou quarentena). Rejeite, revise as situações e conte novamente.</p>}{count.status === 'Pendente' && !stale && !belowCommitted && <p className="count-effect">{diff ? <>Ao aplicar, o físico passa de <strong>{count.expected}</strong> para <strong>{count.counted} un.</strong> e um ajuste é registrado no histórico.</> : 'Contagem igual ao saldo. Aplicar apenas registra a conferência.'}</p>}{count.status === 'Pendente' && <div className="module-actions"><button className="button primary" disabled={stale || belowCommitted} title={stale ? 'Saldo alterado após a contagem' : belowCommitted ? 'Contagem menor que o comprometido' : undefined} onClick={() => review(count.id, true)}>{diff ? 'Aplicar ajuste' : 'Confirmar contagem'}</button><button className="button secondary" onClick={() => review(count.id, false)}>Rejeitar contagem</button></div>}</article>;
    })}</div></section>
  </div>;
}
