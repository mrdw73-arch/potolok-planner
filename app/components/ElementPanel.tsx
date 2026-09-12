'use client';

type ElementType = 'spot' | 'chandelier' | 'cornice';
type CeilingElement = { id: number; type: ElementType; x: number; y: number; size?: number; price?: number };

type Props = {
  element: CeilingElement | null;
  onChange: (patch: Partial<CeilingElement>) => void;
  onDelete: () => void;
};

const labels: Record<ElementType, string> = {
  spot: 'Светильник',
  chandelier: 'Люстра',
  cornice: 'Карниз',
};

export default function ElementPanel({ element, onChange, onDelete }: Props) {
  if (!element) {
    return <div className="element-editor muted">Выберите элемент на плане, чтобы изменить его параметры.</div>;
  }

  return (
    <div className="element-editor">
      <div className="element-editor-head">
        <div>
          <span className="eyebrow">Элемент</span>
          <strong>{labels[element.type]}</strong>
        </div>
        <span className="element-id">#{element.id}</span>
      </div>
      <label>Тип
        <select value={element.type} onChange={e => onChange({ type: e.target.value as ElementType })}>
          <option value="spot">Светильник</option>
          <option value="chandelier">Люстра</option>
          <option value="cornice">Карниз</option>
        </select>
      </label>
      <div className="element-grid">
        <label>X, мм<input type="number" value={Math.round(element.x)} onChange={e => onChange({ x: Number(e.target.value) || 0 })} /></label>
        <label>Y, мм<input type="number" value={Math.round(element.y)} onChange={e => onChange({ y: Number(e.target.value) || 0 })} /></label>
      </div>
      <div className="element-grid">
        <label>Размер, мм<input type="number" min="1" value={element.size ?? 100} onChange={e => onChange({ size: Math.max(1, Number(e.target.value) || 1) })} /></label>
        <label>Цена, ₽<input type="number" min="0" value={element.price ?? 0} onChange={e => onChange({ price: Math.max(0, Number(e.target.value) || 0) })} /></label>
      </div>
      <button className="delete-feature" onClick={onDelete}>Удалить элемент</button>
    </div>
  );
}
