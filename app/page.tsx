'use client';

import { PointerEvent, useMemo, useState } from 'react';

type Point = { x: number; y: number };

const MIN_WALL = 100;
const SVG_W = 800;
const SVG_H = 600;
const initialPoints: Point[] = [
  { x: 0, y: 0 },
  { x: 5000, y: 0 },
  { x: 5000, y: 3600 },
  { x: 0, y: 3600 },
];

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function polygonArea(points: Point[]) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function polygonPerimeter(points: Point[]) {
  return points.reduce((sum, point, i) => sum + distance(point, points[(i + 1) % points.length]), 0);
}

export default function Home() {
  const [points, setPoints] = useState<Point[]>(initialPoints);
  const [selectedPoint, setSelectedPoint] = useState(0);
  const [selectedWall, setSelectedWall] = useState(0);
  const [name, setName] = useState('Новая комната');
  const [dragging, setDragging] = useState<number | null>(null);

  const area = useMemo(() => polygonArea(points) / 1_000_000, [points]);
  const perimeter = useMemo(() => polygonPerimeter(points) / 1000, [points]);
  const wallLength = distance(points[selectedWall], points[(selectedWall + 1) % points.length]);

  const bounds = useMemo(() => {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const scale = Math.min(660 / Math.max(maxX - minX, 1), 460 / Math.max(maxY - minY, 1));
    return { minX, minY, scale, offsetX: (SVG_W - (maxX - minX) * scale) / 2, offsetY: (SVG_H - (maxY - minY) * scale) / 2 };
  }, [points]);

  function toSvg(point: Point) {
    return { x: bounds.offsetX + (point.x - bounds.minX) * bounds.scale, y: bounds.offsetY + (point.y - bounds.minY) * bounds.scale };
  }

  function fromSvg(x: number, y: number) {
    return { x: (x - bounds.offsetX) / bounds.scale + bounds.minX, y: (y - bounds.offsetY) / bounds.scale + bounds.minY };
  }

  function movePoint(index: number, event: PointerEvent<SVGCircleElement>) {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const sx = ((event.clientX - rect.left) / rect.width) * SVG_W;
    const sy = ((event.clientY - rect.top) / rect.height) * SVG_H;
    const next = fromSvg(sx, sy);
    setPoints(current => current.map((point, i) => i === index ? { x: Math.round(Math.max(0, next.x)), y: Math.round(Math.max(0, next.y)) } : point));
  }

  function addCorner() {
    const nextIndex = (selectedWall + 1) % points.length;
    const a = points[selectedWall];
    const b = points[nextIndex];
    const midpoint = { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
    setPoints(current => [...current.slice(0, nextIndex), midpoint, ...current.slice(nextIndex)]);
    setSelectedPoint(nextIndex);
    setSelectedWall(nextIndex);
  }

  function deleteCorner() {
    if (points.length <= 3) return;
    const removed = selectedPoint;
    setPoints(current => current.filter((_, index) => index !== removed));
    setSelectedPoint(Math.max(0, removed - 1));
    setSelectedWall(Math.max(0, removed - 1));
  }

  function updateWallLength(value: number) {
    const length = Math.max(MIN_WALL, Math.round(value || MIN_WALL));
    const start = points[selectedWall];
    const endIndex = (selectedWall + 1) % points.length;
    const end = points[endIndex];
    const currentLength = distance(start, end);
    if (!currentLength) return;
    const dx = (end.x - start.x) / currentLength;
    const dy = (end.y - start.y) / currentLength;
    setPoints(current => current.map((point, index) => index === endIndex ? { x: Math.round(start.x + dx * length), y: Math.round(start.y + dy * length) } : point));
    setSelectedPoint(endIndex);
  }

  function resetRoom() {
    setPoints(initialPoints);
    setSelectedPoint(0);
    setSelectedWall(0);
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
          <div className="section-title">Выбранная стена</div>
          <label>Длина, мм<input type="number" min={MIN_WALL} step={10} value={Math.round(wallLength)} onChange={e => updateWallLength(Number(e.target.value))} /></label>
          <div className="wall-meta">Стена {selectedWall + 1} · угол {selectedWall + 1} → {((selectedWall + 1) % points.length) + 1}</div>
          <div className="button-row"><button className="add-button" onClick={addCorner}>＋ Угол</button><button className="delete-button" onClick={deleteCorner} disabled={points.length <= 3}>− Угол</button></div>
          <div className="hint">Нажми на стену, чтобы выбрать её. Узлы можно перетаскивать. Длина выбранной стены задаётся точно в миллиметрах.</div>
        </aside>

        <div className="canvas-area">
          <div className="canvas-toolbar"><span>2D-план · точный контур</span><span className="muted">Углы: {points.length}</span></div>
          <div className="drawing-wrap">
            <svg className="drawing" viewBox={`0 0 ${SVG_W} ${SVG_H}`} onPointerUp={() => setDragging(null)} onPointerLeave={() => setDragging(null)} role="img" aria-label="Интерактивный план потолка">
              <defs><pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M 25 0 L 0 0 0 25" fill="none" stroke="currentColor" strokeOpacity=".07" /></pattern></defs>
              <rect width={SVG_W} height={SVG_H} fill="url(#grid)" />
              <polygon points={points.map(toSvg).map(p => `${p.x},${p.y}`).join(' ')} className="room" />
              {points.map((point, index) => {
                const next = points[(index + 1) % points.length];
                const a = toSvg(point);
                const b = toSvg(next);
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;
                const selectedEdge = selectedWall === index;
                return <g key={index}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={selectedEdge ? 'wall-hit selected-wall' : 'wall-hit'} onPointerDown={() => { setSelectedWall(index); setSelectedPoint(index); }} />
                  <text x={mx} y={my - 12} className={selectedEdge ? 'dimension-text selected-dimension' : 'dimension-text'} textAnchor="middle">{Math.round(distance(point, next))} мм</text>
                  <circle cx={a.x} cy={a.y} r={selectedPoint === index ? 10 : 8} className={selectedPoint === index ? 'handle selected' : 'handle'} onPointerDown={event => { event.stopPropagation(); setSelectedPoint(index); setSelectedWall(index); setDragging(index); }} onPointerMove={event => dragging === index && movePoint(index, event)} />
                </g>;
              })}
              <text x={SVG_W / 2} y={SVG_H / 2 + 8} className="area-text" textAnchor="middle">{area.toFixed(2)} м²</text>
            </svg>
          </div>
        </div>

        <aside className="panel right-panel">
          <div className="panel-title">Параметры</div>
          <div className="stat"><span>Площадь</span><strong>{area.toFixed(2)} м²</strong></div>
          <div className="stat"><span>Периметр</span><strong>{perimeter.toFixed(2)} м</strong></div>
          <div className="stat"><span>Стена</span><strong>{Math.round(wallLength)} мм</strong></div>
          <div className="stat"><span>Углы</span><strong>{points.length}</strong></div>
          <div className="divider" />
          <div className="section-title">Инструменты</div>
          <button className="feature" onClick={addCorner}>＋ Добавить угол</button>
          <button className="feature">＋ Светильник</button>
          <button className="feature">＋ Люстра</button>
          <button className="feature">＋ Карниз</button>
          <div className="coming">Следующий этап: светильники, люстры, карнизы и автоматический расчёт материалов.</div>
        </aside>
      </section>
    </main>
  );
}
