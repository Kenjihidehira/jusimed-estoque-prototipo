import { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, CircleAlert, Database, Info } from 'lucide-react';
import { availableQuantity, daysToExpiry, formatDate, getProduct, orderReservedQuantity, type DemoData } from './data';

import { orderMetrics } from './orderDomain';
import type { OrderFilter } from './OrderWorkspace';

type Unit = string;
const number = new Intl.NumberFormat('pt-BR');

export default function Analytics({ data, onViewLot, onViewAlerts, onViewStock, onViewMovements, onViewCounts, onViewOrders }: { data: DemoData; onViewLot: (stockId: string) => void; onViewAlerts: () => void; onViewStock: () => void; onViewMovements: () => void; onViewCounts: () => void; onViewOrders: (filter: OrderFilter, unit: string) => void }) {
  const [unit, setUnit] = useState<Unit>('Todas as unidades');
  const [period, setPeriod] = useState(30);
  const [moreOpen, setMoreOpen] = useState(false); // Só tem efeito no celular; no desktop tudo fica visível.
  const unitNames = [...new Set(data.stock.map((s) => s.location.split('·')[0].trim()))].sort();
  const model = useMemo(() => {
    const products = data.products;
    const stock = data.stock.filter((item) => unit === 'Todas as unidades' || item.location.split('·')[0].trim() === unit);
    const active = stock.filter((item) => item.quantity > 0);
    const physical = active.reduce((sum, item) => sum + item.quantity, 0);
    const available = active.reduce((sum, item) => sum + availableQuantity(item), 0);
    const reserved = active.reduce((sum, s) => sum + s.reserved, 0);
    const orderReserved = active.reduce((sum, s) => sum + orderReservedQuantity(data, s.id), 0);
    const expiredFree = active.filter((item) => daysToExpiry(item.expiresAt) < 0).reduce((sum, s) => sum + Math.max(0, s.quantity - s.reserved - s.blocked - s.quarantined), 0);
    const blocked = active.reduce((sum, s) => sum + s.blocked, 0);
    const quarantined = active.reduce((sum, s) => sum + s.quarantined, 0);
    const inTransit = data.transfers.filter((t) => !t.receivedAt && (unit === 'Todas as unidades' || t.from.split('·')[0].trim() === unit || t.to.split('·')[0].trim() === unit)).reduce((sum, t) => sum + t.quantity, 0);
    const pendingCounts = data.counts.filter((c) => c.status === 'Pendente' && stock.some((s) => s.id === c.stockId));
    const divergentCounts = pendingCounts.filter((c) => c.counted !== c.expected).length;
    const expiring = active.filter((item) => daysToExpiry(item.expiresAt) >= 0 && daysToExpiry(item.expiresAt) <= 30);
    const expiringUnits = expiring.reduce((sum, item) => sum + item.quantity, 0);
    const expiredUnits = active.filter((item) => daysToExpiry(item.expiresAt) < 0).reduce((sum, item) => sum + item.quantity, 0);
    const low = unit === 'Todas as unidades' ? products.filter((product) => stock.filter((item) => item.productId === product.id).reduce((sum, item) => sum + availableQuantity(item), 0) < product.minimum) : [];
    const cutoff = Date.now() - period * 86_400_000;
    const movements = data.movements.filter((item) => new Date(item.date).getTime() >= cutoff && (unit === 'Todas as unidades' || item.from?.split('·')[0].trim() === unit || item.to?.split('·')[0].trim() === unit));
    const entry = movements.filter((item) => item.type === 'Entrada' && (unit === 'Todas as unidades' || item.to?.split('·')[0].trim() === unit)).reduce((sum, item) => sum + item.quantity, 0);
    const exit = movements.filter((item) => item.type === 'Saída' && (unit === 'Todas as unidades' || item.from?.split('·')[0].trim() === unit)).reduce((sum, item) => sum + item.quantity, 0);
    const transfers = movements.filter((item) => item.type === 'Transferência').length;
    const categories = [...new Set(products.map((product) => product.category))].map((category) => ({ name: category, quantity: active.filter((item) => getProduct(item.productId, products).category === category).reduce((sum, item) => sum + item.quantity, 0) })).filter((item) => item.quantity > 0).sort((a, b) => b.quantity - a.quantity);
    const networkTotal = data.stock.filter((item) => item.quantity > 0).reduce((sum, item) => sum + item.quantity, 0);
    const units = [...new Set(data.stock.map((s) => s.location.split('·')[0].trim()))].map((name) => ({ name, quantity: data.stock.filter((item) => item.quantity > 0 && item.location.split('·')[0].trim() === name).reduce((sum, item) => sum + item.quantity, 0) }));
    const trend = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (5 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return { key, label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', ''), count: data.movements.filter((item) => item.date.slice(0, 7) === key && (unit === 'Todas as unidades' || item.from?.split('·')[0].trim() === unit || item.to?.split('·')[0].trim() === unit)).length };
    });
    const quality = [
      { label: 'Lote informado', count: stock.filter((item) => Boolean(item.lot.trim())).length },
      { label: 'Validade informada', count: stock.filter((item) => Boolean(item.expiresAt)).length },
      { label: 'Localização informada', count: stock.filter((item) => Boolean(item.location.trim())).length },
    ];
    const priorities = [
      ...active.filter((item) => daysToExpiry(item.expiresAt) <= 30).map((item) => ({ key: item.id, lotId: item.id as string | undefined, title: getProduct(item.productId, products).name, detail: `Lote ${item.lot} · ${formatDate(item.expiresAt)} · ${item.quantity} un.`, action: daysToExpiry(item.expiresAt) < 0 ? 'Verificar bloqueio e destinação do lote vencido' : 'Avaliar uso ou remanejamento antes do vencimento', severity: daysToExpiry(item.expiresAt) < 0 ? 0 : 1, days: daysToExpiry(item.expiresAt) })),
      ...low.map((product) => ({ key: product.id, lotId: undefined as string | undefined, title: product.name, detail: `Saldo abaixo do mínimo demonstrativo de ${product.minimum} un.`, action: 'Revisar necessidade de reposição com a operação', severity: 2, days: 999 })),
    ].sort((a, b) => a.severity - b.severity || a.days - b.days).slice(0, 5);
    return { physical, reserved, orderReserved, expiredFree, blocked, quarantined, inTransit, pendingCounts: pendingCounts.length, divergentCounts, available, activePositions: active.length, expiringUnits, expiringLots: expiring.length, expiredUnits, lowCount: low.length, entry, exit, transfers, movementCount: movements.length, categories, networkTotal, units, priorities, trend, quality, positionCount: stock.length };
  }, [data, unit, period]);

  const orders = orderMetrics(data, unit);
  const flowMax = Math.max(model.entry, model.exit, 1);
  const periodLabel = period === 1 ? '24 horas' : `${period} dias`;
  const flowPeriod = period === 1 ? 'nas últimas 24 horas' : `nos últimos ${period} dias`;
  const trendMax = Math.max(1, ...model.trend.map((item) => item.count));
  const composition = [
    { key: 'available', label: 'Disponível para saída', value: model.available, action: onViewStock },
    { key: 'order', label: 'Reservado para pedidos', value: model.orderReserved, action: () => onViewOrders('Abertos', unit) },
    { key: 'internal', label: 'Reserva interna', value: model.reserved - model.orderReserved, action: onViewStock },
    { key: 'blocked', label: 'Bloqueado', value: model.blocked, action: onViewStock },
    { key: 'quarantine', label: 'Quarentena', value: model.quarantined, action: onViewStock },
    { key: 'expired', label: 'Vencido sem situação', value: model.expiredFree, action: onViewAlerts },
  ];
  return <div className="analytics">
    <div className="analytics-context"><div><span className="analytics-context-label">Cenário da proposta</span><strong>Dispositivos médicos implantáveis · Curitiba e Porto Alegre</strong></div><small>Amostra local para avaliar lote, validade e distribuição entre unidades. Dados fictícios.</small></div>
    <div className="analytics-intro"><div><h2>Panorama de disponibilidade</h2><p>Selecione um indicador para abrir o detalhe.</p></div><div className="analytics-filters"><label>Unidade<select aria-label="Filtrar unidade" value={unit} onChange={(event) => setUnit(event.target.value as Unit)}><option>Todas as unidades</option>{unitNames.map((name) => <option key={name}>{name}</option>)}</select></label><label>Movimentações<select aria-label="Filtrar período" value={period} onChange={(event) => setPeriod(Number(event.target.value))}><option value="1">Últimas 24 horas</option><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option></select></label></div></div>
    <div className="analytics-kpis">
      <button type="button" onClick={onViewStock}><span>Disponível para saída</span><strong>{number.format(model.available)} <small>un.</small></strong><small>{model.physical} un. físicas · {model.activePositions} posições</small></button>
      <button type="button" className="kpi-risk" onClick={onViewAlerts}><span>Vencimento em 30 dias</span><strong>{number.format(model.expiringUnits)} <small>un.</small></strong><small>{model.expiringLots} {model.expiringLots === 1 ? 'lote exige' : 'lotes exigem'} análise</small></button>
      <button type="button" className="kpi-risk" onClick={onViewAlerts}><span>Abaixo do mínimo</span><strong>{unit === 'Todas as unidades' ? number.format(model.lowCount) : '—'}</strong><small>{unit === 'Todas as unidades' ? 'Disponível vs. mínimo global' : 'Mínimo por unidade não definido'}</small></button>
      <button type="button" className={model.expiredUnits ? 'kpi-danger' : ''} onClick={onViewAlerts}><span>Unidades vencidas</span><strong>{number.format(model.expiredUnits)}</strong><small>Saldo que requer bloqueio</small></button>
      <button type="button" onClick={onViewMovements}><span>Saídas · {periodLabel}</span><strong>{number.format(model.exit)} <small>un.</small></strong><small>Volume registrado na amostra</small></button>
      <button type="button" onClick={onViewMovements}><span>Movimentações · {periodLabel}</span><strong>{number.format(model.movementCount)}</strong><small>Inclui recebimentos e ajustes</small></button>
    </div>
    <div className="analytics-split">
      <section className="panel composition-panel"><div className="panel-head"><div><h2>Composição do saldo físico</h2><p>{number.format(model.physical)} un. físicas = disponível + comprometido. Em trânsito fica fora do físico.</p></div></div>
        <div className="composition-bar" role="img" aria-label={composition.map((c) => `${c.label}: ${c.value} un.`).join('; ')}>{composition.filter((c) => c.value > 0).map((c) => <span key={c.key} className={`seg seg-${c.key}`} style={{ flexGrow: c.value }}/>)}</div>
        <ul className="composition-legend">{composition.map((c) => <li key={c.key}><button type="button" onClick={c.action} className={c.value ? '' : 'is-empty'}><span className={`swatch seg-${c.key}`} aria-hidden="true"/><span>{c.label}</span><strong>{number.format(c.value)} un.</strong></button></li>)}</ul>
        <div className="composition-extra"><span>Em trânsito <strong>{model.inTransit} un.</strong></span><button type="button" className="text-link" onClick={onViewCounts}>{model.divergentCounts ? `${model.divergentCounts} ${model.divergentCounts === 1 ? 'contagem divergente' : 'contagens divergentes'} para revisar` : `Contagens: ${model.pendingCounts} pendente${model.pendingCounts === 1 ? '' : 's'}`} <ArrowRight size={14}/></button></div>
      </section>
      <section className="panel orders-dashboard"><div className="panel-head"><div><h2>Atendimento de pedidos</h2><p>Pendências atuais da origem selecionada, incluindo atrasados.</p></div><button className="text-link" onClick={() => onViewOrders('Abertos', unit)}>Ver pedidos <ArrowRight size={16}/></button></div><div className="orders-dashboard-grid"><button onClick={() => onViewOrders('Abertos', unit)}><span>Pedidos em aberto</span><strong>{orders.open}</strong><small>Abrir lista</small></button><button className={orders.incomplete ? 'needs-action' : ''} onClick={() => onViewOrders('Reserva incompleta', unit)}><span>Reserva incompleta</span><strong>{orders.incomplete}</strong><small>{orders.incomplete ? 'Reservar lotes' : 'Sem pendência'}</small></button><button className={orders.urgent ? 'needs-action' : ''} onClick={() => onViewOrders('Prazo próximo', unit)}><span>Prazo em até 3 dias</span><strong>{orders.urgent}</strong><small>{orders.urgent ? 'Priorizar separação' : 'Sem pendência'}</small></button><button className={orders.ready ? 'is-ready' : ''} onClick={() => onViewOrders('Prontos', unit)}><span>Prontos para expedir</span><strong>{orders.ready}</strong><small>{orders.ready ? 'Registrar expedição' : 'Nenhum pronto'}</small></button></div></section>
    </div>
    <div className="analytics-grid">
      <section className="panel analytics-panel priority-panel"><div className="panel-head"><div><h2>Atenção da gestão</h2><p>Pendências objetivas, sem nota de risco artificial.</p></div><button className="text-link analytics-link" onClick={onViewAlerts}>Ver alertas <ArrowRight size={16}/></button></div>{model.priorities.length ? <div className="priority-list">{model.priorities.map((item, index) => <button className="priority-row" type="button" onClick={() => item.lotId ? onViewLot(item.lotId) : onViewAlerts()} title={item.lotId ? 'Abrir ficha do lote' : 'Ver alertas'} key={item.key}><span className="priority-number">{String(index + 1).padStart(2, '0')}</span><span className="priority-copy"><strong>{item.title}</strong><small>{item.detail}</small></span><span className="priority-action">{item.action}</span><ArrowRight size={14} aria-hidden="true"/></button>)}</div> : <div className="analytics-empty">Nenhuma prioridade pelas regras demonstrativas neste filtro.</div>}</section>
      <section className="panel analytics-panel category-panel"><div className="panel-head"><div><h2>Saldo por linha clínica</h2><p>Unidades registradas por especialidade demonstrativa.</p></div></div><div className="chart-list">{model.categories.map((item) => <div className="chart-row" key={item.name}><div className="chart-label"><span>{item.name}</span><strong>{number.format(item.quantity)} un.</strong></div><div className="chart-track"><div style={{ width: `${model.physical ? item.quantity / model.physical * 100 : 0}%` }} /></div></div>)}</div></section>
    </div>
    <button type="button" className="button secondary analytics-more-toggle" aria-expanded={moreOpen} aria-controls="analytics-more" onClick={() => setMoreOpen((current) => !current)}>{moreOpen ? 'Ocultar análises complementares' : 'Ver análises complementares'} <ChevronDown size={16} className={moreOpen ? 'is-flipped' : ''} aria-hidden="true"/></button>
    <div id="analytics-more" className={`analytics-more ${moreOpen ? 'is-open' : ''}`}>
    <div className="analytics-grid">
      <section className="panel analytics-panel flow-panel"><div className="panel-head"><div><h2>Fluxo registrado</h2><p>Volume na amostra {flowPeriod}.</p></div></div><div className="flow-content"><div className="flow-row"><span>Entradas</span><div className="flow-track"><div className="flow-in" style={{width:`${model.entry / flowMax * 100}%`}}/></div><strong>{number.format(model.entry)} un.</strong></div><div className="flow-row"><span>Saídas</span><div className="flow-track"><div className="flow-out" style={{width:`${model.exit / flowMax * 100}%`}}/></div><strong>{number.format(model.exit)} un.</strong></div><p className="flow-note">{model.transfers} {model.transfers === 1 ? 'transferência registrada' : 'transferências registradas'} no período. Transferências não entram no volume de entradas e saídas.</p></div></section>
      <section className="panel analytics-panel unit-panel"><div className="panel-head"><div><h2>Matriz e filial</h2><p>Distribuição nas unidades cadastradas, independente do filtro.</p></div></div><div className="unit-list">{model.units.map((item) => <div className="unit-row" key={item.name}><span>{item.name}</span><strong>{number.format(item.quantity)} un.</strong><div className="chart-track"><div style={{width:`${model.networkTotal ? item.quantity / model.networkTotal * 100 : 0}%`}}/></div></div>)}</div></section>
    </div>
    <div className="analytics-grid analytics-grid-tertiary">
      <section className="panel analytics-panel trend-panel"><div className="panel-head"><div><h2>Movimentações registradas</h2><p>Quantidade de eventos por mês, nos últimos seis meses.</p></div><button className="text-link analytics-link" onClick={onViewMovements}>Ver histórico <ArrowRight size={16}/></button></div><div className="trend-list">{model.trend.map((item) => <div className="trend-row" key={item.key}><span>{item.label}</span><div className="chart-track"><div style={{ width: `${item.count / trendMax * 100}%` }}/></div><strong>{item.count}</strong></div>)}</div><p className="trend-note">Amostra parcial: o histórico anterior à demonstração não está disponível.</p></section>
      <section className="panel analytics-panel quality-panel"><div className="panel-head"><div><h2>Cobertura dos registros</h2><p>Campos presentes nas posições do filtro atual.</p></div></div><div className="quality-list">{model.quality.map((item) => <div className="quality-row" key={item.label}><span>{item.label}</span><div className="chart-track"><div style={{ width: `${model.positionCount ? item.count / model.positionCount * 100 : 0}%` }}/></div><strong>{item.count} de {model.positionCount}</strong></div>)}</div><p className="quality-note">Preenchimento não comprova exatidão. A planilha e os rótulos reais ainda precisam ser validados.</p></section>
    </div>
    <section className="analytics-data-note"><div className="analytics-data-icon"><Database size={20}/></div><div><h2>Indicadores que ainda dependem de dados reais</h2><p>Giro e cobertura exigem histórico confiável de demanda. Capital imobilizado e perda financeira exigem custo por item. O protótipo não calcula esses números a partir de suposições.</p><div className="data-gaps"><span><Info size={14}/> Custo por produto</span><span><Info size={14}/> Histórico de demanda</span><span><Info size={14}/> Consumo hospitalar e consignação</span></div></div><CircleAlert size={19} className="data-note-mark"/></section>
    </div>
    {model.expiredUnits > 0 && <p className="analytics-expired">Atenção: {number.format(model.expiredUnits)} un. vencidas ainda constam com saldo nesta visualização.</p>}
    <p className="analytics-footnote">O filtro de unidade altera os indicadores, exceto a comparação entre unidades. Saldos são atuais; o período se aplica às movimentações. Dados salvos somente neste navegador.</p>
  </div>;
}
