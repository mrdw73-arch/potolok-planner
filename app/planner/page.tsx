'use client';

import { MouseEvent, PointerEvent, useMemo, useRef, useState } from 'react';
import './planner.css';
import { angleAt, orthogonalizeRoom, resizeOrthogonalWall, resizeWallKeepingAdjacent } from '../../lib/geometry';

type Mode = 'select' | 'room' | 'element' | 'price';
type ElementTool = 'spot' | 'chandelier' | 'lightLine' | 'cornice';
type Point = { x: number; y: number };
type CeilingElement = { id: number; type: ElementTool; x: number; y: number; x2?: number; y2?: number; size?: number; price: number };
type Snapshot = { points: Point[]; elements: CeilingElement[]; mode: Mode; elementTool: ElementTool; grid: number; orthogonal: boolean };

const W = 900;
const H = 620;
const initialPoints: Point[] = [{ x: 120, y: 100 }, { x: 780, y: 100 }, { x: 780, y: 520 }, { x: 120, y: 520 }];
const prices: Record<ElementTool, number> = { spot: 700, chandelier: 1200, lightLine: 950, cornice: 650 };
const labels: Record<ElementTool, string> = { spot: 'Точечный светильник', chandelier: 'Люстра', lightLine: 'Световая линия', cornice: 'Карниз' };
const units: Record<ElementTool, string> = { spot: 'шт.', chandelier: 'шт.', lightLine: 'м.п.', cornice: 'м.п.' };
const snap = (v: number, step: number) => Math.round(v / step) * step;
const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const polygonArea = (p: Point[]) => Math.abs(p.reduce((s, a, i) => s + a.x * p[(i + 1) % p.length].y - p[(i + 1) % p.length].x * a.y, 0)) / 2;
const polygonPerimeter = (p: Point[]) => p.reduce((s, a, i) => s + dist(a, p[(i + 1) % p.length]), 0);

export default function PlannerWorkspace() {
  const [points, setPoints] = useState<Point[]>(initialPoints);
  const [elements, setElements] = useState<CeilingElement[]>([]);
  const [mode, setMode] = useState<Mode>('select');
  const [elementTool, setElementTool] = useState<ElementTool>('spot');
  const [selectedElement, setSelectedElement] = useState<number | null>(null);
  const [grid, setGrid] = useState(50);
  const [orthogonal, setOrthogonal] = useState(true);
  const [projectName, setProjectName] = useState('Новая комната');
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [dragPoint, setDragPoint] = useState<number | null>(null);
  const [dragWall, setDragWall] = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [selectedWall, setSelectedWall] = useState<number | null>(null);
  const [showDiagonals, setShowDiagonals] = useState(true);
  const [showAngles, setShowAngles] = useState(true);
  const [nextId, setNextId] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [estimateOpen, setEstimateOpen] = useState(true);
  const dragStart = useRef<Snapshot | null>(null);

  const area = useMemo(() => polygonArea(points) / 10000, [points]);
  const perimeter = useMemo(() => polygonPerimeter(points) / 100, [points]);
  const diagonal = useMemo(() => points.length === 4 ? dist(points[0], points[2]) / 100 : 0, [points]);
  const spotCount = elements.filter(e => e.type === 'spot').length;
  const chandelierCount = elements.filter(e => e.type === 'chandelier').length;
  const lineLength = elements.filter(e => e.type === 'lightLine').reduce((s, e) => s + (e.size ?? 2), 0);
  const corniceLength = elements.filter(e => e.type === 'cornice').reduce((s, e) => s + (e.size ?? 1), 0);
  const estimate = useMemo(() => area * 500 + perimeter * 350 + area * 120 + spotCount * prices.spot + chandelierCount * prices.chandelier + lineLength * prices.lightLine + corniceLength * prices.cornice, [area, perimeter, spotCount, chandelierCount, lineLength, corniceLength]);
  const snapshot = (): Snapshot => ({ points: points.map(p => ({ ...p })), elements: elements.map(e => ({ ...e })), mode, elementTool, grid, orthogonal });
  const pushHistory = (s: Snapshot) => setHistory(h => [...h.slice(-49), s]);
  const commit = (nextPoints = points, nextElements = elements) => { pushHistory(snapshot()); setFuture([]); setPoints(nextPoints); setElements(nextElements); setSaved(false); };
  const apply = (s: Snapshot) => { setPoints(s.points); setElements(s.elements); setMode(s.mode); setElementTool(s.elementTool); setGrid(s.grid); setOrthogonal(s.orthogonal); setSelectedElement(null); setSaved(false); };
  const undo = () => { const s = history.at(-1); if (!s) return; setFuture(f => [...f.slice(-49), snapshot()]); setHistory(h => h.slice(0, -1)); apply(s); };
  const redo = () => { const s = future.at(-1); if (!s) return; pushHistory(snapshot()); setFuture(f => f.slice(0, -1)); apply(s); };

  const pointFromEvent = (e: { clientX: number; clientY: number; currentTarget: Element }) => {
    const target = e.currentTarget as Element & { ownerSVGElement?: SVGSVGElement | null };
    const svg = target instanceof SVGSVGElement ? target : target.ownerSVGElement;
    const r = svg?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: Math.max(0, Math.min(W, (e.clientX - r.left) / zoom)), y: Math.max(0, Math.min(H, (e.clientY - r.top) / zoom)) };
  };

  const startPointDrag = (i: number, e: PointerEvent<SVGCircleElement>) => { e.stopPropagation(); dragStart.current = snapshot(); setDragPoint(i); setSelectedPoint(i); setSelectedWall(null); setSelectedElement(null); e.currentTarget.setPointerCapture(e.pointerId); };
  const movePoint = (i: number, e: PointerEvent<SVGCircleElement>) => { const p = pointFromEvent(e); let next = points.map((v, j) => j === i ? { x: snap(p.x, grid / 10), y: snap(p.y, grid / 10) } : v); if (orthogonal && next.length === 4) next = orthogonalizeRoom(next); setPoints(next); setSaved(false); };
  const finishPointDrag = (e?: PointerEvent<SVGCircleElement>) => { if (dragPoint === null) return; if (dragStart.current) { pushHistory(dragStart.current); dragStart.current = null; } if (e && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); setFuture([]); setDragPoint(null); };

  const startWallDrag = (i: number, e: PointerEvent<SVGLineElement>) => { if (mode !== 'room') return; e.stopPropagation(); dragStart.current = snapshot(); setDragWall(i); setSelectedWall(i); setSelectedPoint(null); setSelectedElement(null); e.currentTarget.setPointerCapture(e.pointerId); };
  const moveWall = (i: number, e: PointerEvent<SVGLineElement>) => { if (dragWall !== i) return; const initial = dragStart.current?.points[i] ?? points[i]; const initialEnd = dragStart.current?.points[(i + 1) % points.length] ?? points[(i + 1) % points.length]; const cursor = pointFromEvent(e); const mx = (initial.x + initialEnd.x) / 2, my = (initial.y + initialEnd.y) / 2; const wx = initialEnd.x - initial.x, wy = initialEnd.y - initial.y; const len = Math.max(Math.hypot(wx, wy), 1); const nx = -wy / len, ny = wx / len; const offset = snap((cursor.x - mx) * nx + (cursor.y - my) * ny, grid / 10); let next = (dragStart.current?.points ?? points).map(p => ({ ...p })); next[i] = { x: initial.x + nx * offset, y: initial.y + ny * offset }; const ni = (i + 1) % next.length; next[ni] = { x: initialEnd.x + nx * offset, y: initialEnd.y + ny * offset }; if (orthogonal && next.length === 4) next = orthogonalizeRoom(next); setPoints(next); setSaved(false); };
  const finishWallDrag = (e?: PointerEvent<SVGLineElement>) => { if (dragWall === null) return; if (dragStart.current) { pushHistory(dragStart.current); dragStart.current = null; } if (e && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); setFuture([]); setDragWall(null); };

  const addPointOnWall = (wall: number, e: MouseEvent<SVGLineElement>) => { if (mode !== 'room') return; const p = pointFromEvent(e); const a = points[wall], b = points[(wall + 1) % points.length]; const t = Math.max(0, Math.min(1, ((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y)) / Math.max(dist(a,b)**2,1))); const n = { x: snap(a.x + (b.x-a.x)*t, grid/10), y: snap(a.y + (b.y-a.y)*t, grid/10) }; commit([...points.slice(0, wall + 1), n, ...points.slice(wall + 1)], elements); setSelectedPoint(wall + 1); setSelectedWall(wall); };
  const deletePoint = (i: number) => { if (points.length <= 3) return; commit(points.filter((_, j) => j !== i), elements); setSelectedPoint(null); setSelectedWall(null); };

  const chooseElementTool = (tool: ElementTool) => { setElementTool(tool); setMode('element'); setSelectedElement(null); setSaved(false); };
  const addElement = (e: PointerEvent<SVGSVGElement>) => {
    if (mode !== 'element') return;
    const p = pointFromEvent(e);
    const size = elementTool === 'lightLine' ? 2 : elementTool === 'cornice' ? 1 : 0;
    const item: CeilingElement = { id: nextId, type: elementTool, x: snap(p.x, grid / 10), y: snap(p.y, grid / 10), size, price: prices[elementTool] };
    if (elementTool === 'lightLine') { item.x2 = item.x + 140; item.y2 = item.y; }
    if (elementTool === 'cornice') { item.x2 = item.x + 90; item.y2 = item.y; }
    commit(points, [...elements, item]); setNextId(n => n + 1); setSelectedElement(item.id); setSelectedPoint(null); setSelectedWall(null);
  };
  const updateElement = (id: number, patch: Partial<CeilingElement>) => commit(points, elements.map(e => e.id === id ? { ...e, ...patch } : e));
  const deleteElement = (id: number) => { commit(points, elements.filter(e => e.id !== id)); setSelectedElement(null); };

  const updateWallLength = (i: number, value: string) => { const targetMm = Number(value); if (!Number.isFinite(targetMm) || targetMm <= 100) return; const mmPoints = points.map(p => ({ x: p.x * 10, y: p.y * 10 })); const resized = orthogonal && mmPoints.length === 4 ? resizeOrthogonalWall(mmPoints, i, targetMm) : resizeWallKeepingAdjacent(mmPoints, i, targetMm); commit(resized.map(p => ({ x: p.x / 10, y: p.y / 10 })), elements); };
  const toggleOrthogonal = () => { const next = !orthogonal; setOrthogonal(next); setSaved(false); if (next && points.length >= 4) { pushHistory(snapshot()); setPoints(orthogonalizeRoom(points)); setFuture([]); } };
  const resetRoom = () => commit(initialPoints, []);
  const selectMode = (m: Mode) => { setMode(m); setSelectedElement(null); setSaved(false); };
  const selected = elements.find(e => e.id === selectedElement);

  return (
    <main className="planner-page">
      <header className="planner-header">
        <div className="planner-brand"><div className="planner-logo">P</div><div><strong>Potolok Planner</strong><span>Планировщик натяжных потолков</span></div></div>
        <div className="planner-project"><label>Проект</label><input value={projectName} onChange={e => { setProjectName(e.target.value); setSaved(false); }} /></div>
        <div className="planner-actions"><button onClick={undo} disabled={!history.length}>↶ Отмена</button><button onClick={redo} disabled={!future.length}>↷ Повтор</button><button onClick={() => setSaved(true)}>{saved ? 'Сохранено ✓' : 'Сохранить'}</button><button className="primary" onClick={() => window.print()}>Печать / PDF</button></div>
      </header>
      <section className="planner-toolbar">
        <button className={mode === 'select' ? 'active' : ''} onClick={() => selectMode('select')}>↖ Выбор</button>
        <button className={mode === 'room' ? 'active' : ''} onClick={() => selectMode('room')}>⌘ Геометрия</button>
        <button className={mode === 'element' ? 'active' : ''} onClick={() => selectMode('element')}>✦ Элементы</button>
        <button className={mode === 'price' ? 'active' : ''} onClick={() => selectMode('price')}>₽ Расчёт</button>
        <span className="toolbar-divider" />
        <button className={orthogonal ? 'active' : ''} onClick={toggleOrthogonal}>□ Прямые углы</button>
        <button onClick={() => setShowAngles(v => !v)}>{showAngles ? '∠ Углы' : '∠ Углы выкл.'}</button>
        <button onClick={() => setShowDiagonals(v => !v)}>{showDiagonals ? '⌁ Диагонали' : '⌁ Диагонали выкл.'}</button>
        <button onClick={resetRoom}>Сбросить контур</button>
        <span className="grid-control">Сетка <select value={grid} onChange={e => setGrid(Number(e.target.value))}><option value={10}>10 мм</option><option value={50}>50 мм</option><option value={100}>100 мм</option></select></span>
      </section>
      <div className="planner-grid">
        <aside className="planner-sidebar">
          <div className="panel-title">Построитель потолка</div>
          <div className="hint">Редактируйте контур, затем добавляйте элементы. Двойной клик по стене создаёт новый угол.</div>
          <div className="metric-grid"><div><span>Площадь</span><b>{area.toFixed(2)} м²</b></div><div><span>Периметр</span><b>{perimeter.toFixed(2)} м</b></div></div>
          <div className="panel-divider" />
          <div className="panel-title">Элементы потолка</div>
          <button className="element-btn" onClick={() => chooseElementTool('spot')}>＋ Точечный светильник</button>
          <button className="element-btn" onClick={() => chooseElementTool('chandelier')}>＋ Люстра</button>
          <button className="element-btn" onClick={() => chooseElementTool('lightLine')}>＋ Световая линия</button>
          <button className="element-btn" onClick={() => chooseElementTool('cornice')}>＋ Карниз</button>
          <div className="hint">Выберите инструмент и кликните в нужном месте на чертеже.</div>
          <div className="panel-divider" />
          <div className="panel-title">Выбранный объект</div>
          {selectedPoint !== null && <div className="selection-card"><b>Угол №{selectedPoint + 1}</b><span>X: {Math.round(points[selectedPoint].x * 10)} мм</span><span>Y: {Math.round(points[selectedPoint].y * 10)} мм</span><button onClick={() => deletePoint(selectedPoint)}>Удалить угол</button></div>}
          {selectedWall !== null && <div className="selection-card"><b>Сторона №{selectedWall + 1}</b><label>Длина, мм<input key={`${selectedWall}-${Math.round(dist(points[selectedWall], points[(selectedWall+1)%points.length]) * 10)}`} defaultValue={Math.round(dist(points[selectedWall], points[(selectedWall+1)%points.length]) * 10)} onBlur={e => updateWallLength(selectedWall, e.target.value)} /></label><span>Угол начала: {angleAt(points[(selectedWall-1+points.length)%points.length], points[selectedWall], points[(selectedWall+1)%points.length]).toFixed(1)}°</span></div>}
          {selected && <div className="selection-card"><b>{labels[selected.type]}</b><label>X, мм<input type="number" value={Math.round(selected.x * 10)} onChange={e => updateElement(selected.id, { x: Number(e.target.value) / 10 })} /></label><label>Y, мм<input type="number" value={Math.round(selected.y * 10)} onChange={e => updateElement(selected.id, { y: Number(e.target.value) / 10 })} /></label>{(selected.type === 'lightLine' || selected.type === 'cornice') && <label>Длина, м<input type="number" min="0.1" step="0.1" value={selected.size ?? 1} onChange={e => updateElement(selected.id, { size: Number(e.target.value) })} /></label>}<label>Цена, ₽<input type="number" min="0" value={selected.price} onChange={e => updateElement(selected.id, { price: Number(e.target.value) })} /></label><span>Ед.: {units[selected.type]}</span><button onClick={() => deleteElement(selected.id)}>Удалить элемент</button></div>}
        </aside>
        <section className="canvas-panel">
          <div className="canvas-head"><span>План потолка</span><span className="scale">{mode === 'room' ? 'Построение' : mode === 'element' ? `Элементы · ${labels[elementTool]}` : mode === 'price' ? 'Расчёт' : 'Выбор'} · масштаб {Math.round(zoom*100)}%</span></div>
          <div className="drawing-area">
            <svg className="ceiling-canvas" viewBox={`0 0 ${W} ${H}`} onPointerDown={addElement} style={{ transform: `scale(${zoom})` }}>
              <defs><pattern id="smallGrid" width={grid/5} height={grid/5} patternUnits="userSpaceOnUse"><path d={`M ${grid/5} 0 L 0 0 0 ${grid/5}`} fill="none" stroke="#e8eaed" strokeWidth="1" /></pattern></defs>
              <rect width={W} height={H} fill="url(#smallGrid)" />
              {showDiagonals && points.length === 4 && <><line className="diagonal-line" x1={points[0].x} y1={points[0].y} x2={points[2].x} y2={points[2].y} /><line className="diagonal-line" x1={points[1].x} y1={points[1].y} x2={points[3].x} y2={points[3].y} /><text className="diagonal-label" x={(points[0].x+points[2].x)/2} y={(points[0].y+points[2].y)/2-8}>{diagonal.toFixed(2)} м</text></>}
              <polygon className="ceiling-shape" points={points.map(p => `${p.x},${p.y}`).join(' ')} />
              {points.map((p, i) => { const n = points[(i+1)%points.length]; const len = dist(p,n)/10; const mx=(p.x+n.x)/2, my=(p.y+n.y)/2; return <g key={`wall-${i}`}><line className={`wall ${selectedWall===i?'selected':''}`} x1={p.x} y1={p.y} x2={n.x} y2={n.y} onPointerDown={e=>startWallDrag(i,e)} onPointerMove={e=>moveWall(i,e)} onPointerUp={finishWallDrag} onPointerCancel={finishWallDrag} onDoubleClick={e=>addPointOnWall(i,e)} /><text className="dimension-text" x={mx} y={my-10}>{len.toFixed(0)} см</text>{showAngles && <text className="angle-text" x={p.x+12} y={p.y-12}>{angleAt(points[(i-1+points.length)%points.length],p,n).toFixed(0)}°</text>}</g>; })}
              {points.map((p,i)=><circle key={`point-${i}`} className={`vertex ${selectedPoint===i?'selected':''}`} cx={p.x} cy={p.y} r="8" onPointerDown={e=>startPointDrag(i,e)} onPointerMove={e=>dragPoint===i&&movePoint(i,e)} onPointerUp={finishPointDrag} onPointerCancel={finishPointDrag} onContextMenu={e=>{e.preventDefault(); deletePoint(i);}} onClick={e=>{e.stopPropagation();setSelectedPoint(i);setSelectedWall(null);setSelectedElement(null);}} />)}
              {elements.map(el => <g key={el.id} className={`ceiling-light ${selectedElement===el.id?'selected':''}`} transform={`translate(${el.x} ${el.y})`} onClick={e=>{e.stopPropagation();setSelectedElement(el.id);setSelectedPoint(null);setSelectedWall(null);}}>{el.type==='spot' && <><circle r="15"/><circle r="5"/><text y="29">S</text></>}{el.type==='chandelier' && <><circle r="22"/><path d="M-12,-4 L0,10 L12,-4" fill="none" stroke="#fff" strokeWidth="3"/><text y="35">L</text></>}{(el.type==='lightLine'||el.type==='cornice') && <line x1="0" y1="0" x2={(el.x2??el.x+140)-el.x} y2={(el.y2??el.y)-el.y} stroke="#17191d" strokeWidth={el.type==='lightLine'?8:5} strokeLinecap="round"/>}</g>)}
            </svg>
          </div>
          <div className="canvas-footer"><span>Диагональ: {diagonal ? diagonal.toFixed(2) : '—'} м</span><span><button onClick={()=>setZoom(z=>Math.max(.7,z-.1))}>−</button> {Math.round(zoom*100)}% <button onClick={()=>setZoom(z=>Math.min(1.5,z+.1))}>＋</button></span></div>
          <section className={`estimate-drawer ${estimateOpen ? 'open' : ''}`}>
            <button className="estimate-toggle" onClick={() => setEstimateOpen(v => !v)}><span>Предварительный расчёт</span><b>{estimate.toLocaleString('ru-RU')} ₽</b><span>{estimateOpen ? '⌄' : '⌃'}</span></button>
            {estimateOpen && <div className="estimate-drawer-body"><div><span>Полотно + монтаж</span><b>{(area*500 + area*120).toLocaleString('ru-RU')} ₽</b></div><div><span>Профиль</span><b>{(perimeter*350).toLocaleString('ru-RU')} ₽</b></div><div><span>Светильники</span><b>{(spotCount*prices.spot + chandelierCount*prices.chandelier).toLocaleString('ru-RU')} ₽</b></div><div><span>Световые линии</span><b>{(lineLength*prices.lightLine).toLocaleString('ru-RU')} ₽</b></div><div><span>Карниз</span><b>{(corniceLength*prices.cornice).toLocaleString('ru-RU')} ₽</b></div><div className="drawer-total"><span>Итого</span><strong>{estimate.toLocaleString('ru-RU')} ₽</strong></div></div>}
          </section>
        </section>
        <aside className="estimate-panel"><div className="panel-title">Расчёт</div><div className="estimate-line"><span>Площадь</span><b>{area.toFixed(2)} м²</b></div><div className="estimate-line"><span>Периметр</span><b>{perimeter.toFixed(2)} м</b></div><div className="estimate-line"><span>Светильники</span><b>{spotCount} шт.</b></div><div className="estimate-line"><span>Люстры</span><b>{chandelierCount} шт.</b></div><div className="estimate-line"><span>Световая линия</span><b>{lineLength.toFixed(1)} м</b></div><div className="estimate-line"><span>Карниз</span><b>{corniceLength.toFixed(1)} м</b></div><div className="estimate-total"><span>Итого</span><strong>{estimate.toLocaleString('ru-RU')} ₽</strong></div><button className="full primary" onClick={()=>setMode('price')}>Открыть расчёт</button><div className="estimate-note">Стоимость предварительная. Каталог и наценки подключим следующим этапом.</div></aside>
      </div>
    </main>
  );
}
