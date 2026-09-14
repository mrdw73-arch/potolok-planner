'use client';

import { MouseEvent, PointerEvent, useMemo, useRef, useState } from 'react';
import './planner.css';
import { angleAt, orthogonalizeRoom, resizeOrthogonalWall, resizeWallKeepingAdjacent } from '../../lib/geometry';

type Mode = 'select' | 'room' | 'lights' | 'price';
type Point = { x: number; y: number };
type Light = { id: number; type: 'spot' | 'chandelier'; x: number; y: number };
type Snapshot = { points: Point[]; lights: Light[]; mode: Mode; grid: number; orthogonal: boolean };

const W = 900;
const H = 620;
const initialPoints: Point[] = [{ x: 120, y: 100 }, { x: 780, y: 100 }, { x: 780, y: 520 }, { x: 120, y: 520 }];
const snap = (v: number, step: number) => Math.round(v / step) * step;
const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const polygonArea = (p: Point[]) => Math.abs(p.reduce((s, a, i) => s + a.x * p[(i + 1) % p.length].y - p[(i + 1) % p.length].x * a.y, 0)) / 2;
const polygonPerimeter = (p: Point[]) => p.reduce((s, a, i) => s + dist(a, p[(i + 1) % p.length]), 0);

export default function PlannerWorkspace() {
  const [points, setPoints] = useState<Point[]>(initialPoints);
  const [lights, setLights] = useState<Light[]>([]);
  const [mode, setMode] = useState<Mode>('select');
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
  const [nextLight, setNextLight] = useState(1);
  const [zoom, setZoom] = useState(1);
  const dragStart = useRef<Snapshot | null>(null);

  const area = useMemo(() => polygonArea(points) / 10000, [points]);
  const perimeter = useMemo(() => polygonPerimeter(points) / 100, [points]);
  const diagonal = useMemo(() => points.length === 4 ? dist(points[0], points[2]) / 100 : 0, [points]);
  const snapshot = (): Snapshot => ({ points: points.map(p => ({ ...p })), lights: lights.map(l => ({ ...l })), mode, grid, orthogonal });
  const pushHistory = (s: Snapshot) => setHistory(h => [...h.slice(-49), s]);
  const commit = (nextPoints = points, nextLights = lights) => { pushHistory(snapshot()); setFuture([]); setPoints(nextPoints); setLights(nextLights); setSaved(false); };
  const apply = (s: Snapshot) => { setPoints(s.points); setLights(s.lights); setMode(s.mode); setGrid(s.grid); setOrthogonal(s.orthogonal); setSaved(false); };
  const undo = () => { const s = history.at(-1); if (!s) return; setFuture(f => [...f.slice(-49), snapshot()]); setHistory(h => h.slice(0, -1)); apply(s); };
  const redo = () => { const s = future.at(-1); if (!s) return; pushHistory(snapshot()); setFuture(f => f.slice(0, -1)); apply(s); };

  const pointFromEvent = (e: { clientX: number; clientY: number; currentTarget: Element }) => {
    const svg = e.currentTarget instanceof SVGSVGElement ? e.currentTarget : e.currentTarget.ownerSVGElement;
    const r = svg?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: Math.max(0, Math.min(W, (e.clientX - r.left) / zoom)), y: Math.max(0, Math.min(H, (e.clientY - r.top) / zoom)) };
  };

  const startPointDrag = (i: number, e: PointerEvent<SVGCircleElement>) => {
    e.stopPropagation(); dragStart.current = snapshot(); setDragPoint(i); setSelectedPoint(i); setSelectedWall(null); e.currentTarget.setPointerCapture(e.pointerId);
  };
  const movePoint = (i: number, e: PointerEvent<SVGCircleElement>) => {
    const p = pointFromEvent(e);
    let next = points.map((v, j) => j === i ? { x: snap(p.x, grid / 10), y: snap(p.y, grid / 10) } : v);
    if (orthogonal && next.length === 4) next = orthogonalizeRoom(next);
    setPoints(next); setSelectedPoint(i); setSaved(false);
  };
  const finishPointDrag = (e?: PointerEvent<SVGCircleElement>) => {
    if (dragPoint === null) return;
    if (dragStart.current) { pushHistory(dragStart.current); dragStart.current = null; }
    if (e && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setFuture([]); setDragPoint(null);
  };

  const wallFromEvent = (e: { clientX: number; clientY: number; currentTarget: Element }) => {
    const p = pointFromEvent(e);
    return p;
  };
  const startWallDrag = (i: number, e: PointerEvent<SVGLineElement>) => {
    if (mode !== 'room') return;
    e.stopPropagation(); dragStart.current = snapshot(); setDragWall(i); setSelectedWall(i); setSelectedPoint(null); e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveWall = (i: number, e: PointerEvent<SVGLineElement>) => {
    if (dragWall !== i) return;
    const start = points[i], end = points[(i + 1) % points.length];
    const initial = dragStart.current?.points[i] ?? start;
    const initialEnd = dragStart.current?.points[(i + 1) % points.length] ?? end;
    const cursor = wallFromEvent(e);
    const mx = (initial.x + initialEnd.x) / 2, my = (initial.y + initialEnd.y) / 2;
    const dx = cursor.x - mx, dy = cursor.y - my;
    const wx = initialEnd.x - initial.x, wy = initialEnd.y - initial.y;
    const len = Math.max(Math.hypot(wx, wy), 1);
    const nx = -wy / len, ny = wx / len;
    const offset = snap(dx * nx + dy * ny, grid / 10);
    let next = (dragStart.current?.points ?? points).map(p => ({ ...p }));
    next[i] = { x: initial.x + nx * offset, y: initial.y + ny * offset };
    const ni = (i + 1) % next.length;
    next[ni] = { x: initialEnd.x + nx * offset, y: initialEnd.y + ny * offset };
    if (orthogonal && next.length === 4) next = orthogonalizeRoom(next);
    setPoints(next); setSaved(false);
  };
  const finishWallDrag = (e?: PointerEvent<SVGLineElement>) => {
    if (dragWall === null) return;
    if (dragStart.current) { pushHistory(dragStart.current); dragStart.current = null; }
    if (e && e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setFuture([]); setDragWall(null);
  };

  const addPointOnWall = (wall: number, e: MouseEvent<SVGLineElement>) => {
    if (mode !== 'room') return;
    const p = pointFromEvent(e);
    const a = points[wall], b = points[(wall + 1) % points.length];
    const t = Math.max(0, Math.min(1, ((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y)) / Math.max(dist(a,b)**2,1)));
    const n = { x: snap(a.x + (b.x-a.x)*t, grid/10), y: snap(a.y + (b.y-a.y)*t, grid/10) };
    const next = [...points.slice(0, wall + 1), n, ...points.slice(wall + 1)];
    commit(next, lights); setSelectedPoint(wall + 1); setSelectedWall(wall);
  };

  const deletePoint = (i: number) => { if (points.length <= 3) return; commit(points.filter((_, j) => j !== i), lights); setSelectedPoint(null); setSelectedWall(null); };
  const addLight = (e: PointerEvent<SVGSVGElement>, type: Light['type']) => { const p = pointFromEvent(e); commit(points, [...lights, { id: nextLight, type, x: p.x, y: p.y }]); setNextLight(n => n + 1); };
  const updateWallLength = (i: number, value: string) => {
    const targetMm = Number(value); if (!Number.isFinite(targetMm) || targetMm <= 100) return;
    const mmPoints = points.map(p => ({ x: p.x * 10, y: p.y * 10 }));
    const resized = orthogonal && mmPoints.length === 4 ? resizeOrthogonalWall(mmPoints, i, targetMm) : resizeWallKeepingAdjacent(mmPoints, i, targetMm);
    commit(resized.map(p => ({ x: p.x / 10, y: p.y / 10 })), lights);
  };
  const toggleOrthogonal = () => {
    const next = !orthogonal; setOrthogonal(next); setSaved(false);
    if (next && points.length >= 4) { pushHistory(snapshot()); setPoints(orthogonalizeRoom(points)); setFuture([]); }
  };
  const resetRoom = () => commit(initialPoints, []);
  const setTool = (m: Mode) => { setMode(m); setSaved(false); };

  return (
    <main className="planner-page">
      <header className="planner-header">
        <div className="planner-brand"><div className="planner-logo">P</div><div><strong>Potolok Planner</strong><span>Планировщик натяжных потолков</span></div></div>
        <div className="planner-project"><label>Проект</label><input value={projectName} onChange={e => { setProjectName(e.target.value); setSaved(false); }} /></div>
        <div className="planner-actions"><button onClick={undo} disabled={!history.length}>↶ Отмена</button><button onClick={redo} disabled={!future.length}>↷ Повтор</button><button onClick={() => setSaved(true)}>{saved ? 'Сохранено ✓' : 'Сохранить'}</button><button className="primary" onClick={() => window.print()}>Печать / PDF</button></div>
      </header>
      <section className="planner-toolbar">
        <button className={mode === 'select' ? 'active' : ''} onClick={() => setTool('select')}>↖ Выбор</button>
        <button className={mode === 'room' ? 'active' : ''} onClick={() => setTool('room')}>⌘ Геометрия</button>
        <button className={mode === 'lights' ? 'active' : ''} onClick={() => setTool('lights')}>✦ Освещение</button>
        <button className={mode === 'price' ? 'active' : ''} onClick={() => setTool('price')}>₽ Расчёт</button>
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
          <div className="hint">Перетаскивайте вершины или саму стену. Двойной клик по стене добавляет угол. ПКМ по вершине удаляет её.</div>
          <div className="metric-grid"><div><span>Площадь</span><b>{area.toFixed(2)} м²</b></div><div><span>Периметр</span><b>{perimeter.toFixed(2)} м</b></div></div>
          <div className="panel-divider" />
          <div className="panel-title">Выбранный объект</div>
          {selectedPoint !== null && <div className="selection-card"><b>Угол №{selectedPoint + 1}</b><span>X: {Math.round(points[selectedPoint].x * 10)} мм</span><span>Y: {Math.round(points[selectedPoint].y * 10)} мм</span><button onClick={() => deletePoint(selectedPoint)}>Удалить угол</button></div>}
          {selectedWall !== null && <div className="selection-card"><b>Сторона №{selectedWall + 1}</b><label>Длина, мм<input key={`${selectedWall}-${Math.round(dist(points[selectedWall], points[(selectedWall+1)%points.length]) * 10)}`} defaultValue={Math.round(dist(points[selectedWall], points[(selectedWall+1)%points.length]) * 10)} onBlur={e => updateWallLength(selectedWall, e.target.value)} /></label><span>Угол начала: {angleAt(points[(selectedWall-1+points.length)%points.length], points[selectedWall], points[(selectedWall+1)%points.length]).toFixed(1)}°</span></div>}
          <div className="panel-divider" />
          <div className="panel-title">Обозначения</div>
          <button className="element-btn" onClick={() => setTool('lights')}>＋ Точечный светильник</button>
          <button className="element-btn" onClick={() => setTool('lights')}>＋ Люстра</button>
          <div className="hint">В режиме освещения клик по потолку ставит точечный светильник.</div>
        </aside>
        <section className="canvas-panel">
          <div className="canvas-head"><span>План потолка</span><span className="scale">{mode === 'room' ? 'Построение' : mode === 'lights' ? 'Освещение' : mode === 'price' ? 'Расчёт' : 'Выбор'} · масштаб {Math.round(zoom*100)}%</span></div>
          <div className="drawing-area">
            <svg className="ceiling-canvas" viewBox={`0 0 ${W} ${H}`} onPointerDown={e => { if (mode === 'lights') addLight(e, 'spot'); }} style={{ transform: `scale(${zoom})` }}>
              <defs><pattern id="smallGrid" width={grid/5} height={grid/5} patternUnits="userSpaceOnUse"><path d={`M ${grid/5} 0 L 0 0 0 ${grid/5}`} fill="none" stroke="#e8eaed" strokeWidth="1" /></pattern></defs>
              <rect width={W} height={H} fill="url(#smallGrid)" />
              {showDiagonals && points.length > 3 && <>{points.slice(2).map((_,i) => <line key={`d${i}`} x1={points[0].x} y1={points[0].y} x2={points[i+2].x} y2={points[i+2].y} className="diagonal-line" />)}</>}
              <polygon points={points.map(p => `${p.x},${p.y}`).join(' ')} className="ceiling-shape" />
              {points.map((p,i) => { const q=points[(i+1)%points.length]; const m={x:(p.x+q.x)/2,y:(p.y+q.y)/2}; const a=points[(i-1+points.length)%points.length]; const ang=angleAt(a,p,q); return <g key={i}>
                <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={selectedWall===i?'wall selected':'wall'} onPointerDown={e => startWallDrag(i,e)} onPointerMove={e => moveWall(i,e)} onPointerUp={finishWallDrag} onPointerCancel={finishWallDrag} onDoubleClick={e => addPointOnWall(i,e)} onClick={() => setSelectedWall(i)} />
                <text x={m.x} y={m.y-10} className="dimension-text">{Math.round(dist(p,q)*10)} мм</text>
                {showAngles && <text x={p.x+12} y={p.y-12} className="angle-text">{ang.toFixed(0)}°</text>}
                <circle cx={p.x} cy={p.y} r={selectedPoint===i?9:7} className={selectedPoint===i?'vertex selected':'vertex'} onPointerDown={e => startPointDrag(i,e)} onPointerMove={e => { if(dragPoint===i) movePoint(i,e); }} onPointerUp={finishPointDrag} onPointerCancel={finishPointDrag} onContextMenu={e => { e.preventDefault(); deletePoint(i); }} />
              </g>; })}
              {lights.map(l => <g key={l.id} className="ceiling-light" transform={`translate(${l.x} ${l.y})`}><circle r="18"/><circle r="6"/><text y="32">{l.type === 'spot' ? '●' : 'Л'}</text></g>)}
              {showDiagonals && diagonal > 0 && <text x={W/2} y={H/2+45} className="diagonal-label">Диагональ {Math.round(diagonal*10)} мм</text>}
            </svg>
          </div>
          <div className="canvas-footer"><span>● Привязка к сетке {grid} мм</span><span>Углов: {points.length} · Светильников: {lights.length}</span><span><button onClick={() => setZoom(z => Math.min(1.4,z+.1))}>＋</button> <button onClick={() => setZoom(z => Math.max(.7,z-.1))}>−</button></span></div>
        </section>
        <aside className="estimate-panel">
          <div className="panel-title">Предварительный расчёт</div>
          <div className="estimate-line"><span>Полотно</span><b>{(area*1.05).toFixed(1)} м²</b></div>
          <div className="estimate-line"><span>Профиль</span><b>{perimeter.toFixed(1)} м</b></div>
          <div className="estimate-line"><span>Вставка</span><b>{perimeter.toFixed(1)} м</b></div>
          <div className="estimate-line"><span>Светильники</span><b>{lights.length} шт.</b></div>
          <div className="estimate-line"><span>Монтаж</span><b>{area.toFixed(1)} м²</b></div>
          <div className="estimate-total"><span>Итого ориентировочно</span><strong>{Math.round(area*900 + perimeter*350 + lights.length*700 + area*500).toLocaleString('ru-RU')} ₽</strong></div>
          <button className="primary full" onClick={() => setTool('price')}>Открыть подробную смету →</button>
          <div className="estimate-note">Построитель автоматически пересчитывает площадь, периметр, длины сторон и углы.</div>
        </aside>
      </div>
    </main>
  );
}
