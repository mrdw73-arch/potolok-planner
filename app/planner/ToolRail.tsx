'use client';

import './tool-rail.css';

type Action = { key: string; label: string; icon: string; hint: string };

const actions: Action[] = [
  { key: 'select', label: 'Выбор', icon: '↖', hint: 'Выбор и редактирование' },
  { key: 'draw', label: 'Геометрия', icon: '⌁', hint: 'Построение контура' },
  { key: 'diagonal', label: 'Диагональ', icon: '╱', hint: 'Построение диагонали' },
  { key: 'orthogonal', label: 'Прямые углы', icon: '⌜', hint: 'Прямые углы' },
  { key: 'angles', label: 'Углы', icon: '∠', hint: 'Показать углы' },
  { key: 'dimensions', label: 'Размеры', icon: '↔', hint: 'Показать размеры сторон' },
  { key: 'diagonals', label: 'Диагонали', icon: '⌁', hint: 'Показать диагонали' },
  { key: 'spot', label: 'Точечный светильник', icon: '●', hint: 'Добавить точечный светильник' },
  { key: 'chandelier', label: 'Люстра', icon: '✦', hint: 'Добавить люстру' },
  { key: 'lightLine', label: 'Световая линия', icon: '━', hint: 'Добавить световую линию' },
  { key: 'cornice', label: 'Карниз', icon: '⌒', hint: 'Добавить карниз' },
  { key: 'zoomOut', label: 'Уменьшить', icon: '−', hint: 'Уменьшить масштаб' },
  { key: 'zoomIn', label: 'Увеличить', icon: '+', hint: 'Увеличить масштаб' },
];

function clickExisting(action: Action) {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'));
  const target = buttons.find((button) => {
    const text = button.textContent?.trim() ?? '';
    if (action.key === 'select') return text.includes('Выбор');
    if (action.key === 'draw') return text.includes('Геометрия');
    if (action.key === 'diagonal') return text.includes('Диагональ') && !text.includes('Диагонали');
    if (action.key === 'orthogonal') return text.includes('Прямые углы');
    if (action.key === 'angles') return text.includes('Углы');
    if (action.key === 'dimensions') return text.includes('Показывать длины');
    if (action.key === 'diagonals') return text.includes('Диагонали');
    if (action.key === 'spot') return text.includes('Точечный светильник');
    if (action.key === 'chandelier') return text.includes('Люстра');
    if (action.key === 'lightLine') return text.includes('Световая линия');
    if (action.key === 'cornice') return text.includes('Карниз');
    if (action.key === 'zoomOut') return text === '−';
    if (action.key === 'zoomIn') return text === '＋';
    return false;
  });
  target?.click();
}

export default function ToolRail() {
  return (
    <nav className="tool-rail" aria-label="Инструменты построения потолка">
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          className="tool-rail-button"
          title={action.hint}
          aria-label={action.label}
          onClick={() => clickExisting(action)}
        >
          <span>{action.icon}</span>
        </button>
      ))}
    </nav>
  );
}
