'use client';

import { useMemo, useState } from 'react';

const MIN = 1000;
const MAX = 20000;

export default function Home() {
  const [width, setWidth] = useState(4000);
  const [length, setLength] = useState(5000);
  const [name, setName] = useState('Новая комната');

  const area = useMemo(() => (width * length) / 1_000_000, [width, length]);
  const perimeter = useMemo(() => (2 * (width + length)) / 1000, [width, length]);
  const ratio = Math.min(width, length) / Math.max(width, length);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">P</span><span>Potolok Planner</span></div>
        <div className="project-name"><input value={name} onChange={e => setName(e.target.value)} aria-label="Название проекта" /></div>
        <div className="top-actions"><button className="ghost">Новый</button><button className="primary">Сохранить</button></div>
      </header>

      <section className="workspace">
        <aside className="panel left-panel">
          <div className="panel-title">Комната</div>
          <label>Название<input value={name} onChange={e => setName(e.target.value)} /></label>
          <div className="section-title">Размеры, мм</div>
          <label>Ширина<input type="number" min={MIN} max={MAX} step={100} value={width} onChange={e => setWidth(Math.max(MIN, Math.min(MAX, Number(e.target.value) || MIN)))} /></label>
          <label>Длина<input type="number" min={MIN} max={MAX} step={100} value={length} onChange={e => setLength(Math.max(MIN, Math.min(MAX, Number(e.target.value) || MIN)))} /></label>
          <button className="add-button">＋ Добавить помещение</button>
          <div className="hint">Все размеры хранятся в миллиметрах. Позже здесь появятся углы, ниши, светильники и карнизы.</div>
        </aside>

        <div className="canvas-area">
          <div className="canvas-toolbar"><span>2D-план</span><span className="muted">Масштаб автоматически</span></div>
          <div className="drawing-wrap">
            <svg className="drawing" viewBox="0 0 800 600" role="img" aria-label="План комнаты">
              <defs><pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M 25 0 L 0 0 0 25" fill="none" stroke="currentColor" strokeOpacity=".07" /></pattern></defs>
              <rect width="800" height="600" fill="url(#grid)" />
              <g transform="translate(140 100)">
                <rect width={520 * ratio} height="360" className="room" rx="2" />
                <line x1="0" y1="-35" x2={520 * ratio} y2="-35" className="dimension" />
                <line x1="0" y1="-45" x2="0" y2="-25" className="tick" /><line x1={520 * ratio} y1="-45" x2={520 * ratio} y2="-25" className="tick" />
                <text x={(260 * ratio)} y="-50" className="dimension-text" textAnchor="middle">{width} мм</text>
                <line x1={550 * ratio} y1="0" x2={550 * ratio} y2="360" className="dimension" />
                <line x1={540 * ratio} y1="0" x2={560 * ratio} y2="0" className="tick" /><line x1={540 * ratio} y1="360" x2={560 * ratio} y2="360" className="tick" />
                <text x={565 * ratio} y="180" className="dimension-text" transform={`rotate(90 ${565 * ratio} 180)`} textAnchor="middle">{length} мм</text>
                <text x={(260 * ratio)} y="190" className="area-text" textAnchor="middle">{area.toFixed(2)} м²</text>
              </g>
            </svg>
          </div>
        </div>

        <aside className="panel right-panel">
          <div className="panel-title">Параметры</div>
          <div className="stat"><span>Площадь</span><strong>{area.toFixed(2)} м²</strong></div>
          <div className="stat"><span>Периметр</span><strong>{perimeter.toFixed(2)} м</strong></div>
          <div className="stat"><span>Тип</span><strong>Прямоугольник</strong></div>
          <div className="divider" />
          <div className="section-title">Следующие элементы</div>
          <button className="feature">＋ Светильник</button>
          <button className="feature">＋ Люстра</button>
          <button className="feature">＋ Карниз</button>
          <button className="feature">＋ Ниша</button>
          <div className="coming">Функции будут добавлены на следующих этапах.</div>
        </aside>
      </section>
    </main>
  );
}
