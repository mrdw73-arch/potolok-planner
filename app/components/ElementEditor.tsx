'use client';

type ElementType = 'spot' | 'chandelier' | 'cornice' | 'lightLine';

type Element = {
  id: number;
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  price?: number;
};

type Props = {
  element: Element | null;
  onChange: (patch: Partial<Element>) => void;
  onDelete: () => void;
};

const labels: Record<ElementType, string> = {
  spot: 'Светильник',
  chandelier: 'Люстра',
  cornice: 'Карниз',
  lightLine: 'Световая линия',
};

export default function ElementEditor({ element, onChange, onDelete }: Props) {
  if (!element) {
    return (
      <aside className="panel element-editor">
        <div className="panel-title">Элемент</div>
        <div className="muted">Выберите светильник, люстру или карниз на чертеже.</div>
      </aside>
    );
  }

  const numberField = (label: string, value: number, patch: keyof Element) => (
    <label>
      {label}
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min="0"
        step="1"
        onChange={(e) => onChange({ [patch]: Number(e.target.value) })}
      />
    </label>
  );

  return (
    <aside className="panel element-editor">
      <div className="panel-title">Параметры элемента</div>
      <div className="element-type">{labels[element.type]}</div>
      {numberField('X, мм', element.x, 'x')}
      {numberField('Y, мм', element.y, 'y')}
      {element.type !== 'spot' && numberField('Ширина, мм', element.width ?? (element.type === 'chandelier' ? 600 : 1000), 'width')}
      {element.type === 'cornice' && numberField('Высота, мм', element.height ?? 80, 'height')}
      {numberField('Цена, ₽', element.price ?? 0, 'price')}
      <button className="delete-feature" onClick={onDelete}>Удалить элемент</button>
    </aside>
  );
}
