'use client';

import { useMemo } from 'react';
import { buildEstimate, CatalogItem } from '../../lib/catalog';

type Props = { catalog: CatalogItem[]; quantities: Record<string, number>; onQuantityChange: (id: string, value: number) => void };

export default function EstimatePanel({ catalog, quantities, onQuantityChange }: Props) {
  const lines = useMemo(() => buildEstimate(catalog, quantities), [catalog, quantities]);
  const materials = lines.filter((line) => line.category === 'material');
  const works = lines.filter((line) => line.category === 'work');
  const total = lines.reduce((sum, line) => sum + line.total, 0);
  const margin = lines.reduce((sum, line) => sum + line.margin, 0);
  const section = (title: string, rows: typeof lines) => (
    <section className="estimate-section">
      <h3>{title}</h3>
      {rows.map((line) => (
        <div className="estimate-row" key={line.id}>
          <div><strong>{line.name}</strong><small>{line.unit} · {line.sellPrice.toLocaleString('ru-RU')} ₽</small></div>
          <input aria-label={`Количество: ${line.name}`} type="number" min="0" step="0.1" value={quantities[line.id] ?? 0} onChange={(e) => onQuantityChange(line.id, Number(e.target.value))} />
          <b>{line.total.toLocaleString('ru-RU')} ₽</b>
        </div>
      ))}
    </section>
  );
  return <aside className="estimate-panel">
    <div className="estimate-head"><div><span className="eyebrow">Расчёт</span><h2>Смета проекта</h2></div><span className="estimate-total">{total.toLocaleString('ru-RU')} ₽</span></div>
    {section('Материалы', materials)}
    {section('Работы', works)}
    <div className="estimate-footer"><span>Маржа</span><strong>{margin.toLocaleString('ru-RU')} ₽</strong></div>
  </aside>;
}
