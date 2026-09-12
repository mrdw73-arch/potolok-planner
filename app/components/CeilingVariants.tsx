'use client';

export type CeilingVariant = { id: string; name: string; price: number; active?: boolean };

type Props = { variants: CeilingVariant[]; activeId: string; onSelect: (id: string) => void; onDuplicate: (id: string) => void; onAdd: () => void };

export default function CeilingVariants({ variants, activeId, onSelect, onDuplicate, onAdd }: Props) {
  return <div className="variant-strip">
    <div><span className="eyebrow">Варианты</span><h2>Конфигурация потолка</h2></div>
    <div className="variant-list">
      {variants.map((variant) => <button key={variant.id} className={`variant-card ${variant.id === activeId ? 'active' : ''}`} onClick={() => onSelect(variant.id)}>
        <span>{variant.name}</span><b>{variant.price.toLocaleString('ru-RU')} ₽</b>
        <small onClick={(e) => { e.stopPropagation(); onDuplicate(variant.id); }}>Дублировать</small>
      </button>)}
      <button className="variant-add" onClick={onAdd}>+ Новый вариант</button>
    </div>
  </div>;
}
