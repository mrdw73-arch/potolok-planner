'use client';

import { PointerEvent, useMemo, useRef, useState } from 'react';
import {
  angleAt,
  distance,
  parseDimension,
  resizeOrthogonalWall,
  resizeWallKeepingAdjacent,
} from '../../lib/geometry';
import './cad.css';

type Point = { x: number; y: number };
type Tool = 'select' | 'draw' | 'spot' | 'chandelier' | 'line' | 'cornice';
type Element = { id: number; type: Exclude<Tool, 'select' | 'draw'>; x: number; y: number; x2?: number; y2?: number; length?: number };

const W = 1000;
const H = 650;
const area = (p: Point[]) => Math.abs(p.reduce((s, a, i) => s + a.x * p[(i + 1) % p.length].y - p[(i + 1) % p.length].x * a.y, 0)) / 2;
const perimeter = (p: Point[]) => p.reduce((s, a, i) => s + distance(a, p[(i + 1) % p.length]), 0);

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
  const [history, setHistory] = useState<Point[][]>([]);
  const [editingWall, setEditingWall] = useState<number | null>(null);
  const [wallInput, setWallInput] = useState('');
  const [sideLength, setSideLength] = useState('3000');
  const [sideAngle, setSideAngle] = useState('0');
  const [drag, setDrag] = useState<{ id: number; offset: Point } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const snapToGrid = (p: Point) => ({ x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid });
  const cursorPoint = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return snapToGrid({
      x: Math.max(0, Math.min(W, ((e.clientX - r.left) / r.width) * W)),
      y: Math.max(0, Math.min(H, ((e.clientY - r.top) / r.height) * H)),
    });
  };

  const commitPoints = (next: Point[]) => {
    setHistory(h => [...h.slice(-39), points.map(p => ({ ...p }))]);
    setPoints(next);
  };

  const drawPoint = (e: PointerEvent<SVGSVGElement>) => {
    if (tool !== 'draw') return;
    const p0 = cursorPoint(e);
    if (points.length >= 3 && distance(p0, points[0]) < 25) {
      setTool('select'); setHover(null); setSelectedPoint(0); setSelectedWall(null); return;
    }
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
    const next = points.length === 4 && orthogonal
      ? resizeOrthogonalWall(points, i, mm / 10)
      : resizeWallKeepingAdjacent(points, i, mm / 10);
    commitPoints(next);
  };

  const beginWallEdit = (i: number) => {
    setSelectedWall(i);
    setSelectedPoint(null);
    setEditingWall(i);
    setWallInput(String(Math.round(distance(points[i], points[(i + 1) % points.length]) * 10)));
  };

  const finishWallEdit = () => {
    if (editingWall === null) return;
    editWallLength(editingWall, wallInput);
    setEditingWall(null);
  };

  const addSideByLength = () => {
    if (tool !== 'draw' || !points.length) return;
    const mm = parseDimension(sideLength);
    const deg = Number(sideAngle.replace(',', '.'));
    if (!mm || mm < 100 || !Number.isFinite(deg)) return;
    const last = points[points.length - 1];
    const radians = deg * Math.PI / 180;
    const raw = { x: last.x + (mm / 10) * Math.cos(radians), y: last.y - (mm / 10) * Math.sin(radians) };
    const next = orthogonal && points.length ? (() => {
      const dx = raw.x - last.x, dy = raw.y - last.y;
      return Math.abs(dx) >= Math.abs(dy) ? { x: raw.x, y: last.y } : { x: last.x, y: raw.y };
    })() : raw;
    commitPoints([...points, snapToGrid(next)]);
    setSideAngle(orthogonal ? (Math.abs(Math.cos(radians)) >= Math.abs(Math.sin(radians)) ? '0' : '90') : sideAngle);
  };

  const addElement = (e: PointerEvent<SVGSVGElement>) => {
    if (!['spot', 'chandelier', 'line', 'cornice'].includes(tool)) return;
    const p = cursorPoint(e);
    const type = tool as Element['type'];
    const item: Element = { id: nextId, type, x: p.x, y: p.y };
    if (type === 'line') { item.x2 = p.x + 150; item.y2 = p.y; item.length = 1.5; }
    if (type === 'cornice') { item.x2 = p.x + 100; item.y2 = p.y; item.length = 1; }
    setElements(prev => [...prev, item]); setSelectedElement(nextId); setNextId(id => id + 1); setTool('select');
  };

  const onCanvasPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (tool === 'draw') drawPoint(e);
    else if (tool !== 'select') addElement(e);
    else { setSelectedWall(null); setSelectedPoint(null); setSelectedElement(null); }
  };

  const moveElement = (id: number, e: PointerEvent<SVGElement>) => {
    const p = cursorPoint(e);
    setElements(prev => prev.map(x => x.id === id
      ? { ...x, x: p.x - (drag?.offset.x ?? 0), y: p.y - (drag?.offset.y ?? 0), x2: x.x2 == null ? x.x2 : x.x2 + p.x - (drag?.offset.x ?? 0) - x.x, y2: x.y2 == null ? x.y2 : x.y2 + p.y - (drag?.offset.y ?? 0) - x.y }
      : x));
  };

  const undo = () => { const h = history.at(-1); if (!h) return; setHistory(history.slice(0, -1)); setPoints(h); };
  const startNew = () => { setHistory([]); setPoints([]); setElements([]); setTool('draw'); setSelectedWall(null); setSelectedPoint(null); setSelectedElement(null); };
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
        <div className="cad-sep" /><h3>Элементы</h3>
        <button onClick={() => setTool('spot')}>＋ Точечный</button><button onClick={() => setTool('chandelier')}>＋ Люстра</button><button onClick={() => setTool('line')}>＋ Световая линия</button><button onClick={() => setTool('cornice')}>＋ Карниз</button>
        <div className="cad-sep" />
        <label className="check"><input type="checkbox" checked={orthogonal} onChange={e => setOrthogonal(e.target.checked)} /> Прямые углы</label>
        <label className="check"><input type="checkbox" checked={showDiagonals} onChange={e => setShowDiagonals(e.target.checked)} /> Диагонали</label>
        <label className="select-label">Сетка<select value={grid} onChange={e => setGrid(Number(e.target.value))}><option value={10}>10 мм</option><option value={25}>25 мм</option><option value={50}>50 мм</option><option value={100}>100 мм</option></select></label>
        <div className="cad-hint">Размеры принимают 3500, 3500 мм, 350 см и 3.5 м. Двойной клик по размеру открывает точный ввод.</div>
        {tool === 'draw' && points.length > 0 && <div className="property-card side-builder"><b>Добавить сторону</b><label>Длина<input value={sideLength} onChange={e => setSideLength(e.target.value)} /><span>мм</span></label><label>Угол<input value={sideAngle} onChange={e => setSideAngle(e.target.value)} /><span>°</span></label><button onClick={addSideByLength}>Добавить</button></div>}
      </aside>
      <section className="cad-center">
        <div className="cad-ruler-top">{Array.from({ length: 11 }, (_, i) => <span key={i}>{i * 1000}</span>)}</div>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="cad-svg" onPointerDown={onCanvasPointerDown} onPointerMove={e => setHover(cursorPoint(e))} onPointerLeave={() => setHover(null)} tabIndex={0} onKeyDown={e => { if (e.key === 'Escape') { setTool('select'); setHover(null); setEditingWall(null); } if (e.key === 'Backspace' && tool === 'draw') { e.preventDefault(); setPoints(p => p.slice(0, -1)); } }}>
          <defs><pattern id="grid" width={grid} height={grid} patternUnits="userSpaceOnUse"><path d={`M ${grid} 0 L 0 0 0 ${grid}`} fill="none" stroke="currentColor" opacity=".08" /></pattern></defs>
          <rect width={W} height={H} fill="url(#grid)" />
          {points.length > 2 && <polygon points={points.map(p => `${p.x},${p.y}`).join(' ')} className="ceiling-fill" />}
          {points.map((a, i) => {
            const b = points[(i + 1) % points.length]; const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; const len = distance(a, b);
            return <g key={`w${i}`}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={selectedWall === i ? 'wall selected' : 'wall'} onPointerDown={e => { e.stopPropagation(); if (tool === 'select') { setSelectedWall(i); setSelectedPoint(null); setSelectedElement(null); } }} />
              {editingWall === i ? <foreignObject x={mid.x - 70} y={mid.y - 20} width="140" height="42"><input autoFocus value={wallInput} onChange={e => setWallInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') finishWallEdit(); if (e.key === 'Escape') setEditingWall(null); }} onBlur={finishWallEdit} className="dimension-input" /></foreignObject> : <g className="dimension" onDoubleClick={e => { e.stopPropagation(); beginWallEdit(i); }}><rect x={mid.x - 48} y={mid.y - 13} width="96" height="26" rx="5" /><text x={mid.x} y={mid.y + 5}>{Math.round(len * 10)} мм</text></g>}
              {points.length > 2 && <text x={mid.x + 10} y={mid.y - 16} className="wall-index">С{i + 1}</text>}
            </g>;
          })}
          {showDiagonals && points.length > 3 && <><line x1={points[0].x} y1={points[0].y} x2={points[Math.floor(points.length / 2)].x} y2={points[Math.floor(points.length / 2)].y} className="diagonal" /><text x={(points[0].x + points[Math.floor(points.length / 2)].x) / 2} y={(points[0].y + points[Math.floor(points.length / 2)].y) / 2 - 8} className="diagonal-label">{Math.round(distance(points[0], points[Math.floor(points.length / 2)]) * 10)} мм</text></>}
          {points.map((p, i) => <circle key={`p${i}`} cx={p.x} cy={p.y} r={selectedPoint === i ? 8 : 6} className={selectedPoint === i ? 'vertex selected' : 'vertex'} onPointerDown={e => { e.stopPropagation(); setSelectedPoint(i); setSelectedWall(null); setSelectedElement(null); }} />)}
          {points.length > 2 && points.map((p, i) => { const prev = points[(i - 1 + points.length) % points.length]; const next = points[(i + 1) % points.length]; return <text key={`a${i}`} x={p.x + 14} y={p.y - 14} className="angle">{Math.round(angleAt(prev, p, next))}°</text>; })}
          {tool === 'draw' && points.length > 0 && hover && <><line x1={points.at(-1)!.x} y1={points.at(-1)!.y} x2={hover.x} y2={hover.y} className="preview" /><circle cx={points[0].x} cy={points[0].y} r="15" className="close-target" /></>}
          {elements.map(el => <g key={el.id} className={selectedElement === el.id ? 'element selected' : 'element'} onPointerDown={e => { e.stopPropagation(); const p = cursorPoint(e); setSelectedElement(el.id); setTool('select'); setDrag({ id: el.id, offset: { x: p.x - el.x, y: p.y - el.y } }); (e.currentTarget as SVGElement).setPointerCapture?.(e.pointerId); }} onPointerMove={e => { if (drag?.id === el.id) moveElement(el.id, e); }} onPointerUp={() => setDrag(null)}>
            {el.type === 'spot' && <><circle cx={el.x} cy={el.y} r="14" /><circle cx={el.x} cy={el.y} r="5" /></>}
            {el.type === 'chandelier' && <><circle cx={el.x} cy={el.y} r="19" /><path d={`M ${el.x-10} ${el.y+4} Q ${el.x} ${el.y+18} ${el.x+10} ${el.y+4}`} /></>}
            {(el.type === 'line' || el.type === 'cornice') && <line x1={el.x} y1={el.y} x2={el.x2} y2={el.y2} strokeWidth={el.type === 'line' ? 8 : 4} />}
          </g>)}
        </svg>
        <div className="cad-status">{tool === 'draw' ? `Построение контура · ${points.length} точек · клик по первой точке — замкнуть` : 'Готово'}<span>Масштаб 100%</span></div>
      </section>
      <aside className="cad-right"><h3>Параметры</h3>
        {selectedWall !== null && points.length > 1 && <div className="property-card"><b>Сторона {selectedWall + 1}</b><label>Длина<input value={Math.round(distance(points[selectedWall], points[(selectedWall + 1) % points.length]) * 10)} onChange={e => setWallInput(e.target.value)} onBlur={() => editWallLength(selectedWall, wallInput)} /><span>мм</span></label><p>Можно вводить мм, см или м.</p></div>}
        {selectedPoint !== null && points[selectedPoint] && <div className="property-card"><b>Точка {selectedPoint + 1}</b><label>X<input value={Math.round(points[selectedPoint].x * 10)} onChange={e => setPoints(p => p.map((x, i) => i === selectedPoint ? { ...x, x: Number(e.target.value) / 10 } : x))} /> мм</label><label>Y<input value={Math.round(points[selectedPoint].y * 10)} onChange={e => setPoints(p => p.map((x, i) => i === selectedPoint ? { ...x, y: Number(e.target.value) / 10 } : x))} /> мм</label></div>}
        {selected && <div className="property-card"><b>{selected.type === 'spot' ? 'Точечный светильник' : selected.type === 'chandelier' ? 'Люстра' : selected.type === 'line' ? 'Световая линия' : 'Карниз'}</b><label>X<input value={Math.round(selected.x * 10)} onChange={e => setElements(prev => prev.map(x => x.id === selected.id ? { ...x, x: Number(e.target.value) / 10 } : x))} /> мм</label><label>Y<input value={Math.round(selected.y * 10)} onChange={e => setElements(prev => prev.map(x => x.id === selected.id ? { ...x, y: Number(e.target.value) / 10 } : x))} /> мм</label><button className="danger" onClick={() => { setElements(prev => prev.filter(x => x.id !== selected.id)); setSelectedElement(null); }}>Удалить</button></div>}
        <div className="summary"><div><span>Площадь</span><b>{A.toFixed(2)} м²</b></div><div><span>Периметр</span><b>{P.toFixed(2)} м</b></div><div><span>Углов</span><b>{points.length}</b></div></div>
      </aside>
    </div>
  </main>;
}
