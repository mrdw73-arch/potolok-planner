'use client';

import { useMemo, useState } from 'react';
import type { CatalogItem } from '../../lib/catalog';
import { removeCatalogItem, resetCatalog, upsertCatalogItem } from '../../lib/catalog-store';

type Props = { catalog: CatalogItem[]; onChange: (catalog: CatalogItem[]) => void };

export default function CatalogEditor({ catalog, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'material' | 'work'>('all');
  const filtered = useMemo(() => catalog.filter((item) =>
    (category === 'all' || item.category === category) &&
    item.name.toLowerCase().includes(query.toLowerCase())
  ), [catalog, category, query]);

  const add = () => {
    const id = `custom-${Date.now()}`;
    onChange(upsertCatalogItem({ id, name: 'Новая позиция', category: 'material', unit: 'шт.', costPrice: 0, sellPrice: 0 }, catalog));
  };

  const edit = (item: CatalogItem, patch: Partial<CatalogItem>) =>
    onChange(upsertCatalogItem({ ...item, ...patch }, catalog));

  return <section className="catalog-editor">
    <div className="catalog-head"><div><b>Каталог</b><span>{catalog.length} позиций</span></div><button onClick={add}>＋ Добавить</button></div>
    <div className="catalog-filters"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по каталогу"/><select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}><option value="all">Все</option><option value="material">Материалы</option><option value="work">Работы</option></select></div>
    <div className="catalog-list">{filtered.map((item) => <div className="catalog-row" key={item.id}>
      <input value={item.name} onChange={(e) => edit(item, { name: e.target.value })}/>
      <select value={item.category} onChange={(e) => edit(item, { category: e.target.value as CatalogItem['category'] })}><option value="material">Материал</option><option value="work">Работа</option></select>
      <select value={item.unit} onChange={(e) => edit(item, { unit: e.target.value as CatalogItem['unit'] })}><option>м²</option><option>м.п.</option><option>шт.</option></select>
      <input type="number" min="0" value={item.costPrice} onChange={(e) => edit(item, { costPrice: Number(e.target.value) || 0 })}/>
      <input type="number" min="0" value={item.sellPrice} onChange={(e) => edit(item, { sellPrice: Number(e.target.value) || 0 })}/>
      <button title="Удалить" onClick={() => onChange(removeCatalogItem(item.id, catalog))}>×</button>
    </div>)}</div>
    <div className="catalog-foot"><span>Слева — название и тип, далее единица, себестоимость и цена продажи.</span><button onClick={() => onChange(resetCatalog())}>Сбросить каталог</button></div>
  </section>;
}
