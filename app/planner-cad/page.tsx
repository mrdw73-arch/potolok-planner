'use client';

import { PointerEvent, useMemo, useRef, useState } from 'react';
import './cad.css';

type Point = { x: number; y: number };
type Tool = 'select' | 'draw' | 'spot' | 'chandelier' | 'line' | 'cornice';
type Element = { id: number; type: Tool; x: number; y: number; x2?: number; y2?: number; length?: number };

const W = 1000;
const H = 650;
const STEP = 10;
const snap = (v: number) => Math.round(v / STEP) * STEP;
const d = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const area = (p: Point[]) => Math.abs(p.reduce((s, a, i) => s + a.x * p[(i + 1) % p.length].y - p[(i + 1) % p.length].x * a.y, 0)) / 2;
const perimeter = (p: Point[]) => p.reduce((s, a, i) => s + d(a, p[(i + 1) % p.length]), 0);
const angle = (a: Point, b: Point, c: Point) => {
  const ax = a.x - b.x, ay = a.y - b.y, cx = c.x - b.x, cy = c.y - b.y;
  const den = Math.hypot(ax, ay) * Math.hypot(cx, cy);
  return den ? Math.round(Math.acos(Math.max(-1, Math.min(1, (ax * cx + ay * cy) / den))) * 180 / Math.PI) : 0;
};

export default function PlannerCadPage() {
  const [points, setPoints] = useState<Point[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [hover, setHover] = useState<Point | null>(null);
  const [selectedWall, setSelectedWall] = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [elements, setElements] = useState<Element[]>([]);
  const [selectedElement, setSelectedElement] = useState<number | null>(null);
  const [nextId, setNextId] = useState(1);
  const [grid, setGrid] = useState(10);
  const [orthogonal, setOrthogonal] = useState(true);
  const [history, setHistory] = useState<Point[][]>([]);
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ id: number; start: Point; offset: Point } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const snapToGrid = (p: Point) => ({ x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid });
  const cursorPoint = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return snapToGrid({ x: Math.max(0, Math.min(W, (e.clientX - r.left) / zoom)), y: Math.max(0, Math.min(H, (e.clientY - r.top) / zoom)) });
  };

  const drawPoint = (e: PointerEvent<SVGSVGElement>) => {
    if (tool !== 'draw') return;
    const p0 = cursorPoint(e);
    if (points.length >= 3 && d(p0, points[0]) < 18) {
      setTool('select'); setHover(null); setSelectedPoint(0); setSelectedWall(null); return;
    }
    let p = p0;
    if (orthogonal && points.length) {
      const last = points[points.length - 1];
      if (Math.abs(p.x - last.x) >= Math.abs(p.y - last.y)) p = { x: p.x, y: last.y };
      else p = { x: last.x, y: p.y };
    }
    setHistory(h => [...h.slice(-39), points.map(x => ({ ...x }))]);
    setPoints([...points, p]);
    setSelectedPoint(points.length);
  };

  const editWallLength = (i: number, value: string) => {
    const mm = Number(value);
    if (!Number.isFinite(mm) || mm < 100 || !points.length) return;
    const a = points[i], b = points[(i + 1) % points.length];
    const len = d(a, b) || 1;
    const end = { x: a.x + (b.x - a.x) * mm / len, y: a.y + (b.y - a.y) * mm / len };
    const next = points.map(p => ({ ...p }));
    next[(i + 1) % points.length] = snapToGrid(end);
    setHistory(h => [...h.slice(-39), points.map(p => ({ ...p }))]);
    setPoints(next);
  };

  const addElement = (e: PointerEvent<SVGSVGElement>) => {
    if (!['spot', 'chandelier', 'line', 'cornice'].includes(tool)) return;
    const p = cursorPoint(e);
    const item: Element = { id: nextId, type: tool, x: p.x, y: p.y };
    if (tool === 'line') { item.x2 = p.x + 150; item.y2 = p.y; item.length = 1.5; }
    if (tool === 'cornice') { item.x2 = p.x + 100; item.y2 = p.y; item.length = 1; }
    setElements([...elements, item]); setSelectedElement(nextId); setNextId(nextId + 1); setTool('select');
  };

  const onCanvasPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (tool === 'draw') drawPoint(e);
    else if (tool !== 'select') addElement(e);
    else { setSelectedWall(null); setSelectedPoint(null); setSelectedElement(null); }
  };

  const moveElement = (id: number, e: PointerEvent<SVGElement>) => {
    const p = cursorPoint(e);
    const item = elements.find(x => x.id === id);
    if (!item) return;
    const dx = p.x - item.x, dy = p.y - item.y;
    setElements(elements.map(x => x.id === id ? { ...x, x: p.x, y: p.y, x2: x.x2 == null ? x.x2 : x.x2 + dx, y2: x.y2 == null ? x.y2 : x.y2 + dy } : x));
  };

  const undo = () => { const h = history.at(-1); if (!h) return; setHistory(history.slice(0, -1)); setPoints(h); };
  const startNew = () => { setHistory([]); setPoints([]); setElements([]); setTool('draw'); setSelectedWall(null); };

  const A = useMemo(() => area(points) / 10000, [points]);
  const P = useMemo(() => perimeter(points) / 100, [points]);
  const selected = selectedElement ? elements.find(e => e.id === selectedElement) : undefined;

  return <main className="cad-page">
    <header className="cad-header">
      <div className="cad-brand"><div className="cad-logo">P</div><div><b>Potolok Planner</b><span>Профессиональный построитель потолка</span></div></div>
      <div className="cad-title">Новый чертёж</div>
      <div className="cad-actions"><button onClick={undo} disabled={!history.length}>↶ Отмена</button><button onClick={startNew} className="primary">＋ Новый контур</button><button onClick={() => window.print()}>Печать / PDF</button></div>
    </header>
    <div className="cad-layout">
      <aside className="cad-left">
        <h3>Инструменты</h3>
        <button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}>↖ Выбор</button>
        <button className={tool === 'draw' ? 'active' : ''} onClick={() => setTool('draw')}>⌁ Новый контур</button>
        <div className="cad-sep" />
        <h3>Элементы</h3>
        <button onClick={() => setTool('spot')}>＋ Точечный</button>
        <button onClick={() => setTool('chandelier')}>＋ Люстра</button>
        <button onClick={() => setTool('line')}>＋ Световая линия</button>
        <button onClick={() => setTool('cornice')}>＋ Карниз</button>
        <div className="cad-sep" />
        <label className="check"><input type="checkbox" checked={orthogonal} onChange={e => setOrthogonal(e.target.checked)} /> Прямые углы</label>
        <label className="select-label">Сетка<select value={grid} onChange={e => setGrid(Number(e.target.value))}><option value={10}>10 мм</option><option value={25}>25 мм</option><option value={50}>50 мм</option><option value={100}>100 мм</option></select></label>
        <div className="cad-hint">В режиме контура кликайте точки на поле. Клик возле первой точки замыкает фигуру. Esc отменяет построение, Backspace удаляет последнюю точку.</div>
      </aside>
      <section className="cad-center">
        <div className="cad-ruler-top">{Array.from({ length: 11 }, (_, i) => <span key={i}>{i * 1000}</span>)}</div>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="cad-svg" onPointerDown={onCanvasPointerDown} onPointerMove={e => setHover(cursorPoint(e))} onPointerLeave={() => setHover(null)} tabIndex={0} onKeyDown={e => { if (e.key === 'Escape') { setTool('select'); setHover(null); } if (e.key === 'Backspace' && tool === 'draw') { e.preventDefault(); setPoints(p => p.slice(0, -1)); } }}>
          <defs><pattern id="grid" width={grid} height={grid} patternUnits="userSpaceOnUse"><path d={`M ${grid} 0 L 0 0 0 ${grid}`} fill="none" stroke="currentColor" opacity=".08" /></pattern></defs>
          <rect width={W} height={H} fill="url(#grid)" />
          {points.length > 2 && <polygon points={points.map(p => `${p.x},${p.y}`).join(' ')} className="ceiling-fill" />}
          {points.map((a, i) => {
            const b = points[(i + 1) % points.length];
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const len = d(a, b);
            return <g key={`w${i}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={selectedWall === i ? 'wall selected' : 'wall'} onPointerDown={e => { e.stopPropagation(); if (tool === 'select') { setSelectedWall(i); setSelectedPoint(null); setSelectedElement(null); } }} onDoubleClick={e => { e.stopPropagation(); setSelectedWall(i); }} />
              <g className="dimension" onDoubleClick={e => { e.stopPropagation(); const v = window.prompt('Длина стороны, мм', String(Math.round(len * 10))); if (v) editWallLength(i, v); }}><rect x={mid.x - 42} y={mid.y - 13} width="84" height="26" rx="5" /><text x={mid.x} y={mid.y + 5}>{Math.round(len * 10)} мм</text></g>
              {points.length > 2 && <text x={mid.x + 10} y={mid.y - 16} className="wall-index">С{i + 1}</text>}
            </g>;
          })}
          {points.map((p, i) => <circle key={`p${i}`} cx={p.x} cy={p.y} r={selectedPoint === i ? 8 : 6} className={selectedPoint === i ? 'vertex selected' : 'vertex'} onPointerDown={e => { e.stopPropagation(); setSelectedPoint(i); setSelectedWall(null); setSelectedElement(null); }} />)}
          {tool === 'draw' && points.length > 0 && hover && <><line x1={points.at(-1)!.x} y1={points.at(-1)!.y} x2={hover.x} y2={hover.y} className="preview" />{points.length > 2 && <circle cx={points[0].x} cy={points[0].y} r="15" className="close-target" />}</>}
          {showAngles(points).map((x, i) => <text key={`a${i}`} x={x.x} y={x.y} className="angle">{x.v}°</text>)}
          {elements.map(el => <g key={el.id} className={selectedElement === el.id ? 'element selected' : 'element'} onPointerDown={e => { e.stopPropagation(); setSelectedElement(el.id); setTool('select'); }} onPointerMove={e => { if (drag.current?.id === el.id) moveElement(el.id, e); }} onPointerUp={() => { drag.current = null; }} onPointerDownCapture={e => { const p = cursorPoint(e); drag.current = { id: el.id, start: p, offset: { x: p.x - el.x, y: p.y - el.y } }; }}>
            {el.type === 'spot' && <><circle cx={el.x} cy={el.y} r="14" /><circle cx={el.x} cy={el.y} r="5" /></>}
            {el.type === 'chandelier' && <><circle cx={el.x} cy={el.y} r="19" /><path d={`M ${el.x-10} ${el.y+4} Q ${el.x} ${el.y+18} ${el.x+10} ${el.y+4}`} /></>}
            {(el.type === 'line' || el.type === 'cornice') && <line x1={el.x} y1={el.y} x2={el.x2} y2={el.y2} strokeWidth={el.type === 'line' ? 8 : 4} />}
          </g>)}
        </svg>
        <div className="cad-status">{tool === 'draw' ? `Построение контура · ${points.length} точек · клик по первой точке — замкнуть` : 'Готово'}<span>Масштаб {Math.round(zoom * 100)}%</span></div>
      </section>
      <aside className="cad-right">
        <h3>Параметры</h3>
        {selectedWall !== null && points.length > 1 && <div className="property-card"><b>Сторона {selectedWall + 1}</b><label>Длина<input defaultValue={Math.round(d(points[selectedWall], points[(selectedWall + 1) % points.length]) * 10)} onBlur={e => editWallLength(selectedWall, e.target.value)} /> <span>мм</span></label><p>Двойной клик по размеру на чертеже открывает точный ввод.</p></div>}
        {selectedPoint !== null && points[selectedPoint] && <div className="property-card"><b>Точка {selectedPoint + 1}</b><label>X<input value={Math.round(points[selectedPoint].x * 10)} onChange={e => setPoints(p => p.map((x, i) => i === selectedPoint ? { ...x, x: Number(e.target.value) / 10 } : x))} /> мм</label><label>Y<input value={Math.round(points[selectedPoint].y * 10)} onChange={e => setPoints(p => p.map((x, i) => i === selectedPoint ? { ...x, y: Number(e.target.value) / 10 } : x))} /> мм</label></div>}
        {selected && <div className="property-card"><b>{selected.type === 'spot' ? 'Точечный светильник' : selected.type === 'chandelier' ? 'Люстра' : selected.type === 'line' ? 'Световая линия' : 'Карниз'}</b><label>X<input value={Math.round(selected.x * 10)} onChange={e => setElements(elements.map(x => x.id === selected.id ? { ...x, x: Number(e.target.value) / 10 } : x))} /> мм</label><label>Y<input value={Math.round(selected.y * 10)} onChange={e => setElements(elements.map(x => x.id === selected.id ? { ...x, y: Number(e.target.value) / 10 } : x))} /> мм</label><button className="danger" onClick={() => { setElements(elements.filter(x => x.id !== selected.id)); setSelectedElement(null); }}>Удалить</button></div>}
        <div className="summary"><div><span>Площадь</span><b>{A.toFixed(2)} м²</b></div><div><span>Периметр</span><b>{P.toFixed(2)} м</b></div><div><span>Углов</span><b>{points.length}</b></div></div>
      </aside>
    </div>
  </main>;
}

function showAngles(points: Point[]) {
  if (points.length < 3) return [] as { x: number; y: number; v: number }[];
  return points.map((p, i) => { const prev = points[(i - 1 + points.length) % points.length], next = points[(i + 1) % points.length]; return { x: p.x + 14, y: p.y - 14, v: angle(prev, p, next) }; });
}
