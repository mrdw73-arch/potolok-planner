'use client';

import { useMemo, useState } from 'react';
import { angleAt, parseDimension, pointFromLengthAngle, polygonArea, polygonPerimeter, resizeOrthogonalWall, resizeWallKeepingAdjacent } from '../../lib/geometry';
import '../planner/planner.css';

type Point = { x: number; y: number };
type ElementType = 'spot' | 'chandelier' | 'lightLine' | 'cornice';
type Item = { id: number; type: ElementType; x: number; y: number; x2?: number; y2?: number };

const W = 900;
const H = 620;
const initial: Point[] = [{ x: 120, y: 100 }, { x: 780, y: 100 }, { x: 780, y: 520 }, { x: 120, y: 520 }];
const snap = (v: number, step: number) => Math.round(v / step) * step;
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const prices: Record<ElementType, number> = { spot: 700, chandelier: 1200, lightLine: 950, cornice: 650 };

export default function PlannerNextPage() {
  const [points, setPoints] = useState(initial);
  const [items, setItems] = useState<Item[]>([]);
  const [orthogonal, setOrthogonal] = useState(true);
  const [grid, setGrid] = useState(50);
  const [tool, setTool] = useState<'select' | 'draw' | ElementType>('select');
  const [sideLength, setSideLength] = useState('');
  const [sideAngle, setSideAngle] = useState('0');
  const [selectedWall, setSelectedWall] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);

  const area = useMemo(() => polygonArea(points) / 10000, [points]);
  const perimeter = useMemo(() => polygonPerimeter(points) / 100, [points]);
  const diagonal = points.length >= 4 ? distance(points[0], points[2]) / 100 : 0;

  const pointFromEvent = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(W, (e.clientX - r.left) / zoom)), y: Math.max(0, Math.min(H, (e.clientY - r.top) / zoom)) };
  };

  const addSide = () => {
    if (!points.length) return;
    const mm = parseDimension(sideLength);
    const deg = Number(sideAngle.replace(',', '.').replace('°', ''));
    if (!mm || mm < 100 || !Number.isFinite(deg)) return;
    const last = points[points.length - 1];
    const next = pointFromLengthAngle({ x: last.x * 10, y: last.y * 10 }, mm, deg);
    setPoints([...points, { x: snap(next.x / 10, grid / 10), y: snap(next.y / 10, grid / 10) }]);
  };

  const updateWall = (i: number, value: string) => {
    const mm = parseDimension(value);
    if (!mm || mm <= 100) return;
    const source = points.map(p => ({ x: p.x * 10, y: p.y * 10 }));
    const next = orthogonal && source.length === 4 ? resizeOrthogonalWall(source, i, mm) : resizeWallKeepingAdjacent(source, i, mm);
    setPoints(next.map(p => ({ x: p.x / 10, y: p.y / 10 })));
  };

  const addItem = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool === 'select' || tool === 'draw') return;
    const p = pointFromEvent(e);
    const id = items.length ? Math.max(...items.map(x => x.id)) + 1 : 1;
    const item: Item = { id, type: tool, x: p.x, y: p.y };
    if (tool === 'lightLine') { item.x2 = p.x + 140; item.y2 = p.y; }
    if (tool === 'cornice') { item.x2 = p.x + 90; item.y2 = p.y; }
    setItems([...items, item]); setSelectedItem(id);
  };

  return <main className="planner-page">
    <header className="planner-header">
      <div className="planner-brand"><div className="planner-logo">P</div><div><strong>Potolok Planner</strong><span>Новый построитель потолка</span></div></div>
      <div className="planner-project"><label>Рабочий чертёж</label><input defaultValue="Новая комната" /></div>
      <div className="planner-actions"><button onClick={() => window.print()}>Печать / PDF</button></div>
    </header>

    <section className="planner-toolbar">
      <button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}>↖ Выбор</button>
      <button className={tool === 'draw' ? 'active' : ''} onClick={() => setTool('draw')}>⌘ Контур</button>
      <button className={orthogonal ? 'active' : ''} onClick={() => setOrthogonal(v => !v)}>□ Прямые углы</button>
      <span className="toolbar-divider" />
      <span className="grid-control">Сетка <select value={grid} onChange={e => setGrid(Number(e.target.value))}><option value={10}>10 мм</option><option value={50}>50 мм</option><option value={100}>100 мм</option></select></span>
      <button onClick={() => setZoom(v => Math.max(.7, v - .1))}>−</button><button onClick={() => setZoom(v => Math.min(1.6, v + .1))}>＋</button>
    </section>

    <div className="planner-grid">
      <aside className="planner-sidebar">
        <div className="panel-title">Построитель потолка</div>
        <div className="metric-grid"><div><span>Площадь</span><b>{area.toFixed(2)} м²</b></div><div><span>Периметр</span><b>{perimeter.toFixed(2)} м</b></div></div>
        <div className="property-card">
          <b>Добавить сторону</b>
          <label>Длина<input value={sideLength} onChange={e => setSideLength(e.target.value)} placeholder="350 см"/><span>мм / см / м</span></label>
          <label>Угол<input value={sideAngle} onChange={e => setSideAngle(e.target.value)} placeholder="0"/><span>°</span></label>
          <button onClick={addSide} disabled={!points.length}>Добавить сторону</button>
          <small>Новая сторона строится от последней вершины. При включённых прямых углах направление автоматически корректируется.</small>
        </div>
        <div className="panel-divider" />
        <div className="panel-title">Элементы</div>
        {(['spot','chandelier','lightLine','cornice'] as ElementType[]).map(t => <button key={t} className="element-btn" onClick={() => setTool(t)}>＋ {t === 'spot' ? 'Точечный светильник' : t === 'chandelier' ? 'Люстра' : t === 'lightLine' ? 'Световая линия' : 'Карниз'}</button>)}
      </aside>

      <section className="planner-canvas-wrap">
        <svg className="planner-canvas" viewBox={`0 0 ${W} ${H}`} onPointerDown={addItem} style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
          <defs><pattern id="grid-next" width={grid / 10} height={grid / 10} patternUnits="userSpaceOnUse"><path d={`M ${grid/10} 0 L 0 0 0 ${grid/10}`} fill="none" stroke="currentColor" opacity=".08"/></pattern></defs>
          <rect width={W} height={H} fill="url(#grid-next)" />
          {points.map((p, i) => { const q = points[(i + 1) % points.length]; const len = distance(p, q); const mx = (p.x + q.x) / 2; const my = (p.y + q.y) / 2; return <g key={i}>
            <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} className="room-wall" onClick={() => setSelectedWall(i)} />
            <text x={mx} y={my - 8} className="dimension-label" textAnchor="middle">{Math.round(len * 10)} мм</text>
          </g>; })}
          {points.map((p, i) => <circle key={`p${i}`} cx={p.x} cy={p.y} r={7} className="room-point" onClick={() => setSelectedWall(null)} />)}
          {points.length === 4 && <line x1={points[0].x} y1={points[0].y} x2={points[2].x} y2={points[2].y} className="diagonal-line" />}
          {items.map(item => item.type === 'spot' ? <circle key={item.id} cx={item.x} cy={item.y} r={8} className="ceiling-element" onClick={e => { e.stopPropagation(); setSelectedItem(item.id); }} /> : item.type === 'chandelier' ? <circle key={item.id} cx={item.x} cy={item.y} r={15} className="ceiling-element" onClick={e => { e.stopPropagation(); setSelectedItem(item.id); }} /> : <line key={item.id} x1={item.x} y1={item.y} x2={item.x2} y2={item.y2} className="ceiling-element" onClick={e => { e.stopPropagation(); setSelectedItem(item.id); }} />)}
          <text x={20} y={30} className="canvas-caption">{tool === 'draw' ? 'Режим построения: добавьте сторону через панель слева' : 'CAD-режим потолка'}</text>
        </svg>
      </section>

      <aside className="planner-sidebar">
        <div className="panel-title">Параметры</div>
        {selectedWall !== null && <div className="property-card"><b>Сторона {selectedWall + 1}</b><label>Длина<input key={selectedWall} defaultValue={Math.round(distance(points[selectedWall], points[(selectedWall + 1) % points.length]) * 10)} onBlur={e => updateWall(selectedWall, e.target.value)} /><span>мм</span></label><div>Угол: {angleAt(points, selectedWall).toFixed(1)}°</div></div>}
        {selectedItem !== null && <div className="property-card"><b>Элемент #{selectedItem}</b><div>{items.find(x => x.id === selectedItem)?.type}</div><div>Цена: {prices[items.find(x => x.id === selectedItem)?.type ?? 'spot']} ₽</div></div>}
        <div className="property-card"><b>Диагональ</b><div>{diagonal.toFixed(2)} м</div></div>
      </aside>
    </div>
  </main>;
}
