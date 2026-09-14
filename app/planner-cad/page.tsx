'use client';

import { PointerEvent, useMemo, useRef, useState } from 'react';
import { angleAt, distance, parseDimension, resizeOrthogonalWall, resizeWallKeepingAdjacent } from '../../lib/geometry';
import './cad.css';

type Point = { x: number; y: number };
type Tool = 'select' | 'draw' | 'spot' | 'chandelier' | 'line' | 'cornice';
type Element = { id: number; type: Exclude<Tool, 'select' | 'draw'>; x: number; y: number; x2?: number; y2?: number };

const W = 1000;
const H = 650;
const area = (p: Point[]) => Math.abs(p.reduce((s, a, i) => s + a.x * p[(i + 1) % p.length].y - p[(i + 1) % p.length].x * a.y, 0)) / 2;
const perimeter = (p: Point[]) => p.length > 1 ? p.reduce((s, a, i) => s + distance(a, p[(i + 1) % p.length]), 0) : 0;

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
  const [showDiagonals, setShowDiagonals] = useState(true);
  const [showAngles, setShowAngles] = useState(true);
  const [history, setHistory] = useState<Point[][]>([]);
  const [editingWall, setEditingWall] = useState<number | null>(null);
  const [wallInput, setWallInput] = useState('');
  const [sideLength, setSideLength] = useState('3000');
  const [sideAngle, setSideAngle] = useState('0');
  const [dragPoint, setDragPoint] = useState<{ index: number; start: Point[] } | null>(null);
  const [dragElement, setDragElement] = useState<{ id: number; offset: Point; start: Element } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const snap = (p: Point) => ({ x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid });
  const cursorPoint = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return snap({ x: Math.max(0, Math.min(W, ((e.clientX - r.left) / r.width) * W)), y: Math.max(0, Math.min(H, ((e.clientY - r.top) / r.height) * H)) });
  };
  const commitPoints = (next: Point[]) => { setHistory(h => [...h.slice(-39), points.map(p => ({ ...p }))]); setPoints(next); };

  const drawPoint = (e: PointerEvent<SVGSVGElement>) => {
    const p0 = cursorPoint(e);
    if (points.length >= 3 && distance(p0, points[0]) < 25) { setTool('select'); setHover(null); setSelectedPoint(0); return; }
    let p = p0;
    if (orthogonal && points.length) {
      const last = points[points.length - 1];
      p = Math.abs(p.x - last.x) >= Math.abs(p.y - last.y) ? { x: p.x, y: last.y } : { x: last.x, y: p.y };
    }
    commitPoints([...points, p]);
    setSelectedPoint(points.length);
  };

  const editWallLength = (i: number, value: string) => {
    const mm = parseDimension(value);
    if (!mm || mm < 100 || points.length < 2) return;
    const next = points.length === 4 && orthogonal ? resizeOrthogonalWall(points, i, mm / 10) : resizeWallKeepingAdjacent(points, i, mm / 10);
    commitPoints(next);
    setWallInput(String(mm));
  };

  const addSideByLength = () => {
    if (!points.length) return;
    const mm = parseDimension(sideLength);
    const deg = Number(sideAngle.replace(',', '.'));
    if (!mm || mm < 100 || !Number.isFinite(deg)) return;
    const last = points[points.length - 1];
    const r = deg * Math.PI / 180;
    const raw = { x: last.x + (mm / 10) * Math.cos(r), y: last.y - (mm / 10) * Math.sin(r) };
    const next = orthogonal ? (Math.abs(raw.x - last.x) >= Math.abs(raw.y - last.y) ? { x: raw.x, y: last.y } : { x: last.x, y: raw.y }) : raw;
    commitPoints([...points, snap(next)]);
  };

  const startPointDrag = (index: number, e: PointerEvent<SVGCircleElement>) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    setSelectedPoint(index); setSelectedWall(null); setSelectedElement(null);
    setDragPoint({ index, start: points.map(p => ({ ...p })) });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const movePoint = (index: number, e: PointerEvent<SVGCircleElement>) => {
    if (!dragPoint || dragPoint.index !== index) return;
    const cursor = cursorPoint(e);
    const next = dragPoint.start.map((p, i) => i === index ? cursor : { ...p });
    if (orthogonal && next.length === 4) {
      const prev = (index + 3) % 4, following = (index + 1) % 4;
      if (Math.abs(cursor.x - dragPoint.start[index].x) >= Math.abs(cursor.y - dragPoint.start[index].y)) {
        next[prev] = { ...next[prev], y: cursor.y }; next[following] = { ...next[following], y: cursor.y };
      } else {
        next[prev] = { ...next[prev], x: cursor.x }; next[following] = { ...next[following], x: cursor.x };
      }
    }
    setPoints(next);
  };

  const finishPointDrag = (e: PointerEvent<SVGCircleElement>) => {
    if (!dragPoint) return;
    setHistory(h => [...h.slice(-39), dragPoint.start]); setDragPoint(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const addElement = (e: PointerEvent<SVGSVGElement>) => {
    if (!['spot', 'chandelier', 'line', 'cornice'].includes(tool)) return;
    const p = cursorPoint(e); const type = tool as Element['type'];
    const item: Element = { id: nextId, type, x: p.x, y: p.y };
    if (type === 'line') { item.x2 = p.x + 150; item.y2 = p.y; }
    if (type === 'cornice') { item.x2 = p.x + 100; item.y2 = p.y; }
    setElements(prev => [...prev, item]); setSelectedElement(nextId); setNextId(id => id + 1); setTool('select');
  };

  const startElementDrag = (el: Element, e: PointerEvent<SVGGElement>) => {
    if (tool !== 'select') return;
    e.stopPropagation(); setSelectedElement(el.id); setSelectedPoint(null); setSelectedWall(null);
    const p = cursorPoint(e); setDragElement({ id: el.id, offset: { x: p.x - el.x, y: p.y - el.y }, start: { ...el } });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveElement = (e: PointerEvent<SVGGElement>) => {
    if (!dragElement) return;
    const p = cursorPoint(e); const nx = p.x - dragElement.offset.x; const ny = p.y - dragElement.offset.y;
    const dx = nx - dragElement.start.x; const dy = ny - dragElement.start.y;
    setElements(prev => prev.map(x => x.id !== dragElement.id ? x : { ...x, x: nx, y: ny, x2: x.x2 == null ? x.x2 : dragElement.start.x2! + dx, y2: x.y2 == null ? x.y2 : dragElement.start.y2! + dy }));
  };

  const finishElementDrag = (e: PointerEvent<SVGGElement>) => {
    if (!dragElement) return;
    setDragElement(null); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const updateElementCoordinate = (id: number, axis: 'x' | 'y', value: string) => {
    const n = Number(value); if (!Number.isFinite(n)) return; const next = n / 10;
    setElements(prev => prev.map(x => {
      if (x.id !== id) return x; const delta = next - x[axis];
      return axis === 'x' ? { ...x, x: next, x2: x.x2 == null ? x.x2 : x.x2 + delta } : { ...x, y: next, y2: x.y2 == null ? x.y2 : x.y2 + delta };
    }));
  };

  const updateElementLength = (id: number, value: string) => {
    const mm = parseDimension(value); if (!mm || mm < 50) return;
    setElements(prev => prev.map(x => {
      if (x.id !== id || x.x2 == null || x.y2 == null) return x;
      const current = distance({ x: x.x, y: x.y }, { x: x.x2, y: x.y2 }); if (!current) return x;
      const scale = (mm / 10) / current;
      return { ...x, x2: x.x + (x.x2 - x.x) * scale, y2: x.y + (x.y2 - x.y) * scale };
    }));
  };

  const undo = () => { const h = history.at(-1); if (!h) return; setHistory(history.slice(0, -1)); setPoints(h); };
  const startNew = () => { setHistory([]); setPoints([]); setElements([]); setTool('draw'); setSelectedWall(null); setSelectedPoint(null); setSelectedElement(null); setDragPoint(null); };
  const A = useMemo(() => area(points) / 10000, [points]);
  const P = useMemo(() => perimeter(points) / 100, [points]);
  const selected = selectedElement ? elements.find(e => e.id === selectedElement) : undefined;
  const estimate = Math.round(A * 500 + P * 350 + A * 120 + elements.filter(e => e.type === 'spot').length * 700 + elements.filter(e => e.type === 'chandelier').length * 1200 + elements.filter(e => e.type === 'cornice').reduce((s, e) => s + distance({ x: e.x, y: e.y }, { x: e.x2 ?? e.x, y: e.y2 ?? e.y }) / 100, 0) * 650);

  return <main className="cad-page">
    <header className="cad-header"><div className="cad-brand"><div className="cad-logo">P</div><div><b>Potolok Planner</b><span>Профессиональный построитель потолка</span></div></div><div className="cad-title">Новый чертёж</div><div className="cad-actions"><button onClick={undo} disabled={!history.length}>↶ Отмена</button><button onClick={startNew} className="primary">＋ Новый контур</button><button onClick={() => window.print()}>Печать / PDF</button></div></header>
    <div className="cad-layout">
      <aside className="cad-left"><h3>Инструменты</h3><button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}>↖ Выбор</button><button className={tool === 'draw' ? 'active' : ''} onClick={() => setTool('draw')}>⌁ Новый контур</button><div className="cad-sep"/><h3>Элементы</h3><button onClick={() => setTool('spot')}>＋ Точечный</button><button onClick={() => setTool('chandelier')}>＋ Люстра</button><button onClick={() => setTool('line')}>＋ Световая линия</button><button onClick={() => setTool('cornice')}>＋ Карниз</button><div className="cad-sep"/><label className="check"><input type="checkbox" checked={orthogonal} onChange={e => setOrthogonal(e.target.checked)}/> Прямые углы</label><label className="check"><input type="checkbox" checked={showDiagonals} onChange={e => setShowDiagonals(e.target.checked)}/> Диагонали</label><label className="check"><input type="checkbox" checked={showAngles} onChange={e => setShowAngles(e.target.checked)}/> Углы</label><label className="select-label">Сетка<select value={grid} onChange={e => setGrid(Number(e.target.value))}><option value={10}>10 мм</option><option value={25}>25 мм</option><option value={50}>50 мм</option><option value={100}>100 мм</option></select></label><div className="cad-hint">Размеры: мм, см или м. Клик по стороне выбирает её, двойной клик по размеру открывает точный ввод.</div>{tool === 'draw' && points.length > 0 && <div className="property-card side-builder"><b>Добавить сторону</b><label>Длина<input value={sideLength} onChange={e => setSideLength(e.target.value)}/><span>мм</span></label><label>Угол<input value={sideAngle} onChange={e => setSideAngle(e.target.value)}/><span>°</span></label><button onClick={addSideByLength}>Добавить</button></div>}</aside>
      <section className="cad-center"><div className="cad-ruler-top">{Array.from({ length: 11 }, (_, i) => <span key={i}>{i * 1000}</span>)}</div>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="cad-svg" onPointerDown={e => { if (tool === 'draw') drawPoint(e); else if (tool !== 'select') addElement(e); else { setSelectedWall(null); setSelectedPoint(null); setSelectedElement(null); } }} onPointerMove={e => setHover(cursorPoint(e))} onPointerLeave={() => setHover(null)} tabIndex={0} onKeyDown={e => { if (e.key === 'Escape') { setTool('select'); setHover(null); setEditingWall(null); setDragPoint(null); setDragElement(null); } if (e.key === 'Backspace' && tool === 'draw') { e.preventDefault(); commitPoints(points.slice(0, -1)); } }}>
          <defs><pattern id="grid" width={grid} height={grid} patternUnits="userSpaceOnUse"><path d={`M ${grid} 0 L 0 0 0 ${grid}`} fill="none" stroke="currentColor" opacity=".08"/></pattern></defs><rect width={W} height={H} fill="url(#grid)"/>
          {points.length > 2 && <polygon points={points.map(p => `${p.x},${p.y}`).join(' ')} className="ceiling-fill"/>}
          {showDiagonals && points.length > 2 && points.slice(2).map((p, i) => <line key={`d${i}`} x1={points[0].x} y1={points[0].y} x2={p.x} y2={p.y} className="diagonal"/>)}
          {points.map((a, i) => { const b = points[(i + 1) % points.length]; const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; const len = distance(a, b); const angle = points.length > 2 ? angleAt(points[(i + points.length - 1) % points.length], a, b) : 0; return <g key={`w${i}`}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={selectedWall === i ? 'wall selected' : 'wall'} onPointerDown={e => { e.stopPropagation(); if (tool === 'select') { setSelectedWall(i); setSelectedPoint(null); setSelectedElement(null); setWallInput(String(Math.round(len * 10))); } }}/>{editingWall === i ? <foreignObject x={mid.x - 75} y={mid.y - 18} width="150" height="40"><input autoFocus value={wallInput} onChange={e => setWallInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { editWallLength(i, wallInput); setEditingWall(null); } if (e.key === 'Escape') setEditingWall(null); }}/></foreignObject> : <text x={mid.x} y={mid.y - 10} className="dimension" textAnchor="middle" onDoubleClick={() => { setSelectedWall(i); setWallInput(String(Math.round(len * 10))); setEditingWall(i); }}>{Math.round(len * 10)} мм</text>}{showAngles && points.length > 2 && <text x={a.x + 14} y={a.y - 12} className="angle-label">{Math.round(angle)}°</text>}</g>; })}
          {points.map((p, i) => <circle key={`p${i}`} cx={p.x} cy={p.y} r={selectedPoint === i ? 8 : 6} className={selectedPoint === i ? 'vertex selected' : 'vertex'} onPointerDown={e => startPointDrag(i, e)} onPointerMove={e => movePoint(i, e)} onPointerUp={finishPointDrag}/>)}
          {tool === 'draw' && hover && points.length > 0 && <line x1={points[points.length - 1].x} y1={points[points.length - 1].y} x2={hover.x} y2={hover.y} className="preview"/>}
          {elements.map(el => <g key={el.id} className={selectedElement === el.id ? 'element selected' : 'element'} onPointerDown={e => startElementDrag(el, e)} onPointerMove={moveElement} onPointerUp={finishElementDrag}>{el.type === 'spot' && <circle cx={el.x} cy={el.y} r="12" className="spot"/>}{el.type === 'chandelier' && <g><circle cx={el.x} cy={el.y} r="18" className="chandelier"/><path d={`M ${el.x - 12} ${el.y} L ${el.x + 12} ${el.y} M ${el.x} ${el.y - 12} L ${el.x} ${el.y + 12}`} className="element-mark"/></g>}{(el.type === 'line' || el.type === 'cornice') && <line x1={el.x} y1={el.y} x2={el.x2} y2={el.y2} className={el.type === 'line' ? 'light-line' : 'cornice'}/>}</g>)}
        </svg>
      </section>
      <aside className="cad-right"><h3>Параметры</h3>{selectedWall !== null && points.length > 1 && <div className="property-card"><b>Сторона {selectedWall + 1}</b><label>Длина<input value={wallInput || String(Math.round(distance(points[selectedWall], points[(selectedWall + 1) % points.length]) * 10))} onChange={e => setWallInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') editWallLength(selectedWall, wallInput); }}/><span>мм</span></label><button onClick={() => editWallLength(selectedWall, wallInput)}>Применить</button></div>}{selectedPoint !== null && points[selectedPoint] && <div className="property-card"><b>Точка {selectedPoint + 1}</b><label>X<input value={Math.round(points[selectedPoint].x * 10)} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) commitPoints(points.map((p, i) => i === selectedPoint ? { ...p, x: n / 10 } : p)); }}/><span>мм</span></label><label>Y<input value={Math.round(points[selectedPoint].y * 10)} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) commitPoints(points.map((p, i) => i === selectedPoint ? { ...p, y: n / 10 } : p)); }}/><span>мм</span></label></div>}{selected && <div className="property-card"><b>{selected.type === 'spot' ? 'Точечный светильник' : selected.type === 'chandelier' ? 'Люстра' : selected.type === 'line' ? 'Световая линия' : 'Карниз'}</b><label>X<input value={Math.round(selected.x * 10)} onChange={e => updateElementCoordinate(selected.id, 'x', e.target.value)}/><span>мм</span></label><label>Y<input value={Math.round(selected.y * 10)} onChange={e => updateElementCoordinate(selected.id, 'y', e.target.value)}/><span>мм</span></label>{(selected.type === 'line' || selected.type === 'cornice') && <label>Длина<input value={Math.round(distance({ x: selected.x, y: selected.y }, { x: selected.x2 ?? selected.x, y: selected.y2 ?? selected.y }) * 10)} onChange={e => updateElementLength(selected.id, e.target.value)}/><span>мм</span></label>}<button className="danger" onClick={() => { setElements(prev => prev.filter(x => x.id !== selected.id)); setSelectedElement(null); }}>Удалить</button></div>}<div className="property-card"><b>Расчёт</b><div>Площадь: {A.toFixed(2)} м²</div><div>Периметр: {P.toFixed(2)} м</div><div>Углов: {points.length}</div><div>Элементов: {elements.length}</div><strong>≈ {estimate.toLocaleString('ru-RU')} ₽</strong></div></aside>
    </div>
  </main>;
}
