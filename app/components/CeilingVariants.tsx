'use client';

export type CeilingVariant = {
  id: string;
  name: string;
  price: number;
  active?: boolean;
  points?: { x: number; y: number }[];
  elements?: {
    id: number;
    type: 'spot' | 'chandelier' | 'lightLine' | 'cornice';
    x: number;
    y: number;
    x2?: number;
    y2?: number;
    width?: number;
    height?: number;
    price?: number;
  }[];
  quantityOverrides?: Record<string, number>;
};

type Props = {
  variants: CeilingVariant[];
  activeId: string;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
};

export default function CeilingVariants({ variants, activeId, onSelect, onDuplicate, onAdd, onRename, onDelete }: Props) {
  return <div className="variant-strip">
    <div><span className="eyebrow">Варианты</span><h2>Конфигурация потолка</h2></div>
    <div className="variant-list">
      {variants.map((variant) => <button key={variant.id} className={`variant-card ${variant.id === activeId ? 'active' : ''}`} onClick={() => onSelect(variant.id)}>
        <span>{variant.name}</span><b>{variant.price.toLocaleString('ru-RU')} ₽</b>
        <small onClick={(e) => { e.stopPropagation(); onDuplicate(variant.id); }}>Дублировать</small>
        <small onClick={(e) => { e.stopPropagation(); onRename(variant.id); }}>Переименовать</small>
        {variants.length > 1 && <small className="delete-feature" onClick={(e) => { e.stopPropagation(); onDelete(variant.id); }}>Удалить</small>}
      </button>)}
      <button className="variant-add" onClick={onAdd}>+ Новый вариант</button>
    </div>
  </div>;
}
