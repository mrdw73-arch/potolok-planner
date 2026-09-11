'use client';

import { PointerEvent, useMemo, useState } from 'react';

type Point = { x: number; y: number };
const MIN = 1000;
const MAX = 20000;
const initialPoints: Point[] = [
  { x: 150, y: 120 },
  { x: 650, y: 120 },
  { x: 650, y: 480 },
  { x: 150, y: 480 },
];

export default function Home() {
  const [points, setPoints] = useState<Point[]>(initialPoints);
  const [selected, setSelected] = useState(0);
  const [width, setWidth] = useState(5000);
  const [height, setHeight] = useState(3600);
  const [name, setName] = useState('Новая комната');
  const [dragging, setDragging] = useState<number | null>(null);

  const area = useMemo(() => (width * height) / 1_000_000, [width, height]);
  const perimeter = useMemo(() => (2 * (width + height)) / 1000, [width, height]);
  const selectedPoint = points[selected];

  function updateSelectedSize(value: number, axis: 'width' | 'height') {
    const next = Math.max(MIN, Math.min(MAX, value || MIN));
    if (axis === 'width') setWidth(next);
    else setHeight(next);
  }

  function movePoint(index: number, event: PointerEvent<SVGCircleElement>) {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 800;
    const y = ((event.clientY - rect.top) / rect.height) * 600;
    setPoints(current => current.map((point, i) => i === index ? { x: Math.max(80, Math.min(720, x)), y: Math.max(70, Math.min(530, y)) } : point));
  }

  function resetRoom() {
    setPoints(initialPoints);
    setSelected(0);
    setWidth(5000);
    setHeight(3600);
    setName('Новая комната');
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">P</span><span>Potolok Planner</span></div>
        <div className="project-name"><input value={name} onChange={e => setName(e.target.value)} aria-label="Название проекта" /></div>
        <div className="top-actions"><button className="ghost" onClick={resetRoom}>Новый</button><button className="primary">Сохранить</button></div>
      </header>

      <section className="workspace">
        <aside className="panel left-panel">
          <div className="panel-title">Конструктор</div>
          <label>Название<input value={name} onChange={e => setName(e.target.value)} /></label>
          <div className="section-title">Выбранный участок</div>
          <label>Ширина, мм<input type="number" min={MIN} max={MAX} step={100} value={width} onChange={e => updateSelectedSize(Number(e.target.value), 'width')} /></label>
          <label>Длина, мм<input type="number" min={MIN} max={MAX} step={100} value={height} onChange={e => updateSelectedSize(Number(e.target.value), 'height')} /></label>
          <button className="add-button" onClick={() => setSelected((selected + 1) % points.length)}>Следующая точка →</button>
          <div className="hint">Перетаскивай белые узлы на плане мышью. Выбранный угол подсвечивается. Это основа для произвольного контура.</div>
        </aside>

        <div className="canvas-area">
          <div className="canvas-toolbar"><span>2D-план · редактирование</span><span className="muted">Узлы: {points.length}</span></div>
          <div className="drawing-wrap">
            <svg className="drawing" viewBox="0 0 800 600" onPointerUp={() => setDragging(null)} onPointerLeave={() => setDragging(null)} role="img" aria-label="Интерактивный план комнаты">
              <defs><pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M 25 0 L 0 0 0 25" fill="none" stroke="currentColor" strokeOpacity=".07" /></pattern></defs>
              <rect width="800" height="600" fill="url(#grid)" />
              <polygon points={points.map(point => `${point.x},${point.y}`).join(' ')} className="room" />
              {points.map((point, index) => {
                const next = points[(index + 1) % points.length];
                const mx = (point.x + next.x) / 2;
                const my = (point.y + next.y) / 2;
                return <g key={index}><text x={mx} y={my - 10} className="dimension-text" textAnchor="middle">{index % 2 === 0 ? width : height} мм</text><circle cx={point.x} cy={point.y} r={selected === index ? 10 : 8} className={selected === index ? 'handle selected' : 'handle'} onPointerDown={() => { setSelected(index); setDragging(index); }} onPointerMove={event => dragging === index && movePoint(index, event)} /></g>;
              })}
              <text x="400" y="315" className="area-text" textAnchor="middle">{area.toFixed(2)} м²</text>
            </svg>
          </div>
        </div>

        <aside className="panel right-panel">
          <div className="panel-title">Параметры</div>
          <div className="stat"><span>Площадь</span><strong>{area.toFixed(2)} м²</strong></div>
          <div className="stat"><span>Периметр</span><strong>{perimeter.toFixed(2)} м</strong></div>
          <div className="stat"><span>Углы</span><strong>{points.length}</strong></div>
          <div className="divider" />
          <div className="section-title">Инструменты</div>
          <button className="feature">＋ Добавить угол</button>
          <button className="feature">＋ Светильник</button>
          <button className="feature">＋ Люстра</button>
          <button className="feature">＋ Карниз</button>
          <div className="coming">Следующим шагом добавим вставку новых точек на стену и удаление углов.</div>
        </aside>
      </section>
    </main>
  );
}
