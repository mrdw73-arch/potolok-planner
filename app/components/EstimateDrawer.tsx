'use client';

import { useMemo, useState } from 'react';
import type { CatalogItem } from '../../lib/catalog';

type Props = {
  items: CatalogItem[];
  quantities: Record<string, number>;
  onQuantityChange: (id: string, value: number) => void;
};

export default function EstimateDrawer({ items, quantities, onQuantityChange }: Props) {
  const [open, setOpen] = useState(false);
  const lines = useMemo(() => items.map(item => ({ ...item, quantity: Math.max(0, quantities[item.id] ?? 0), total: Math.max(0, quantities[item.id] ?? 0) * item.sellPrice, margin: Math.max(0, quantities[item.id] ?? 0) * (item.sellPrice - item.costPrice) })).filter(x => x.quantity > 0), [items, quantities]);
  const total = lines.reduce((s, x) => s + x.total, 0);
  const cost = lines.reduce((s, x) => s + x.quantity * x.costPrice, 0);

  return <section className={`estimate-drawer ${open ? 'is-open' : ''}`}>
    <button className="estimate-drawer-tab" onClick={() => setOpen(v => !v)} aria-expanded={open}>
      <span>Смета</span><strong>{Math.round(total).toLocaleString('ru-RU')} ₽</strong><span>{open ? '⌄' : '⌃'}</span>
    </button>
    {open && <div className="estimate-drawer-body">
      <div className="estimate-drawer-head"><b>Расчёт потолка</b><span>{lines.length} поз.</span></div>
      <div className="estimate-lines">
        {lines.length === 0 && <div className="estimate-empty">Добавьте материалы или элементы потолка.</div>}
        {lines.map(line => <div className="estimate-line" key={line.id}>
          <div><b>{line.name}</b><small>{line.unit} · себестоимость {line.costPrice.toLocaleString('ru-RU')} ₽</small></div>
          <input type="number" min="0" step="0.01" value={line.quantity} onChange={e => onQuantityChange(line.id, Number(e.target.value))}/>
          <strong>{Math.round(line.total).toLocaleString('ru-RU')} ₽</strong>
        </div>)}
      </div>
      <div className="estimate-drawer-total"><span>Себестоимость <b>{Math.round(cost).toLocaleString('ru-RU')} ₽</b></span><span>Продажа <b>{Math.round(total).toLocaleString('ru-RU')} ₽</b></span><span>Маржа <b>{Math.round(total-cost).toLocaleString('ru-RU')} ₽</b></span></div>
    </div>}
  </section>;
}
