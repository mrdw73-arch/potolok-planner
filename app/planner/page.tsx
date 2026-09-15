'use client';

import { useEffect, useMemo, useState } from 'react';
import { angleAt, parseDimension, pointFromLengthAngle, polygonArea, polygonPerimeter, resizeOrthogonalWall, resizeWallKeepingAdjacent } from '../../lib/geometry';
import { rebuildQuadrilateralByDiagonal } from '../../lib/geometry/construction';
import { calculateEstimate } from '../../lib/estimate';
import { CeilingProject, createProjectId, loadProjects, upsertProject } from '../../lib/project';
import './planner.css';
import './planner-next.css';

type Point = { x: number; y: number };
type ElementType = 'spot' | 'chandelier' | 'lightLine' | 'cornice';
type Item = { id: number; type: ElementType; x: number; y: number; x2?: number; y2?: number };
type HistoryState = { points: Point[]; items: Item[] };
type Diagonal = { id: number; a: number; b: number; lengthMm: number };
type Variant = { id: string; name: string; points: Point[]; items: Item[] };

const W = 900, H = 620;
const initial: Point[] = [{ x: 120, y: 100 }, { x: 780, y: 100 }, { x: 780, y: 520 }, { x: 120, y: 520 }];
const prices: Record<ElementType, number> = { spot: 700, chandelier: 1200, lightLine: 950, cornice: 650 };
const labels: Record<ElementType, string> = { spot: 'Точечный светильник', chandelier: 'Люстра', lightLine: 'Световая линия', cornice: 'Карниз' };
const units: Record<ElementType, string> = { spot: 'шт.', chandelier: 'шт.', lightLine: 'м.п.', cornice: 'м.п.' };
const clonePoints = (v: Point[]) => v.map(p => ({ ...p }));
const cloneItems = (v: Item[]) => v.map(x => ({ ...x }));
const snap = (v: number, step: number) => Math.round(v / step) * step;
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

export default function PlannerWorkspace() {
  const [projects, setProjects] = useState<CeilingProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('Новая комната');
  const [points, setPoints] = useState(initial), [items, setItems] = useState<Item[]>([]);
  const [variants, setVariants] = useState<Variant[]>([{ id: 'standard', name: 'Стандарт', points: clonePoints(initial), items: [] }]);
  const [activeVariant, setActiveVariant] = useState('standard');
  const [tool, setTool] = useState<'select' | 'draw' | 'diagonal' | ElementType>('select');
  const [orthogonal, setOrthogonal] = useState(true), [grid, setGrid] = useState(50);
  const [sideLength, setSideLength] = useState(''), [sideAngle, setSideAngle] = useState('0');
  const [diagonals, setDiagonals] = useState<Diagonal[]>([{ id: 1, a: 0, b: 2, lengthMm: distance(initial[0], initial[2]) * 10 }]);
  const [diagonalLength, setDiagonalLength] = useState('');
  const [selectedWall, setSelectedWall] = useState<number | null>(null), [selectedPoint, setSelectedPoint] = useState<number | null>(null), [selectedItem, setSelectedItem] = useState<number | null>(null), [selectedDiagonal, setSelectedDiagonal] = useState<number | null>(1);
  const [showDiagonals, setShowDiagonals] = useState(true), [showAngles, setShowAngles] = useState(true), [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<HistoryState[]>([]), [future, setFuture] = useState<HistoryState[]>([]), [ready, setReady] = useState(false), [status, setStatus] = useState('');

  const area = useMemo(() => polygonArea(points) / 10000, [points]);
  const perimeter = useMemo(() => polygonPerimeter(points) / 100, [points]);
  const estimate = useMemo(() => calculateEstimate(points, items.map(x => ({ ...x, price: prices[x.type] })), { canvasPricePerM2: 900, profilePricePerM: 350, insertPricePerM: 120, fastenerPricePerM: 45, spotlightPrice: 700, chandelierPrice: 1200, lightLinePricePerM: 950, cornicePricePerM: 650, wastePercent: 7, laborPricePerM2: 500 }), [points, items]);
  const diagonal = useMemo(() => points.length >= 3 ? distance(points[0], points[2]) / 100 : 0, [points]);

  useEffect(() => {
    const stored = loadProjects();
    setProjects(stored);
    if (stored[0]) openProject(stored[0]);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !projectId) return;
    const timer = window.setTimeout(() => saveCurrent('Автосохранено'), 900);
    return () => window.clearTimeout(timer);
  }, [ready, projectId, projectName, points, items, variants, activeVariant, orthogonal]);

  const snapshot = (): HistoryState => ({ points: clonePoints(points), items: cloneItems(items) });
  const commit = (nextPoints: Point[], nextItems = items) => { setHistory(h => [...h.slice(-49), snapshot()]); setFuture([]); setPoints(nextPoints); setItems(nextItems); };
  const undo = () => { const s = history.at(-1); if (!s) return; setFuture(f => [...f.slice(-49), snapshot()]); setHistory(h => h.slice(0, -1)); setPoints(s.points); setItems(s.items); };
  const redo = () => { const s = future.at(-1); if (!s) return; setHistory(h => [...h.slice(-49), snapshot()]); setFuture(f => f.slice(0, -1)); setPoints(s.points); setItems(s.items); };

  function projectVariants() { return variants.map(v => v.id === activeVariant ? { ...v, points: clonePoints(points), items: cloneItems(items) } : { ...v, points: clonePoints(v.points), items: cloneItems(v.items) }); }
  function currentProject(): CeilingProject {
    const id = projectId || createProjectId();
    const vs = projectVariants();
    return { id, name: projectName.trim() || 'Без названия', updatedAt: new Date().toISOString(), points: points.map(p => ({ x: p.x * 10, y: p.y * 10 })), elements: items.map(x => ({ ...x, price: prices[x.type] })), prices: { canvasPricePerM2: 900, profilePricePerM: 350, insertPricePerM: 120, fastenerPricePerM: 45, spotlightPrice: 700, chandelierPrice: 1200, lightLinePricePerM: 950, cornicePricePerM: 650, wastePercent: 7, laborPricePerM2: 500 }, client: { name: '', phone: '', address: '' }, notes: '', orthogonalMode: orthogonal, variants: vs.map(v => ({ id: v.id, name: v.name, price: v.id === activeVariant ? estimate.totalSell : 0, points: v.points.map(p => ({ x: p.x * 10, y: p.y * 10 })), elements: v.items.map(x => ({ ...x, price: prices[x.type] })) })), activeVariantId: activeVariant };
  }
  function saveCurrent(message = 'Сохранено') { const project = currentProject(); const next = upsertProject(project, loadProjects()); setProjects(next); setProjectId(project.id); setStatus(message); }
  function openProject(project: CeilingProject) {
    const raw = project.variants?.length ? project.variants : [{ id: 'standard', name: 'Стандарт', points: project.points, elements: project.elements }];
    const normalized: Variant[] = raw.map(v => ({ id: v.id, name: v.name, points: clonePoints(v.points ?? project.points).map(p => ({ x: p.x / 10, y: p.y / 10 })), items: cloneItems(v.elements ?? project.elements) }));
    const active = normalized.find(v => v.id === project.activeVariantId) ?? normalized[0];
    setProjectId(project.id); setProjectName(project.name); setVariants(normalized); setActiveVariant(active.id); setPoints(clonePoints(active.points)); setItems(cloneItems(active.items)); setOrthogonal(project.orthogonalMode ?? true); setSelectedWall(null); setSelectedPoint(null); setSelectedItem(null); setHistory([]); setFuture([]); setStatus('Проект открыт');
  }
  function newProject() { setProjectId(''); setProjectName('Новая комната'); setPoints(clonePoints(initial)); setItems([]); setVariants([{ id: 'standard', name: 'Стандарт', points: clonePoints(initial), items: [] }]); setActiveVariant('standard'); setDiagonals([{ id: 1, a: 0, b: 2, lengthMm: distance(initial[0], initial[2]) * 10 }]); setHistory([]); setFuture([]); setSelectedWall(null); setSelectedPoint(null); setSelectedItem(null); setStatus('Новый проект'); }
  function addVariant() { const id = `variant-${Date.now()}`; setVariants(list => [...list, { id, name: `Вариант ${list.length + 1}`, points: clonePoints(points), items: cloneItems(items) }]); setActiveVariant(id); setStatus('Создан новый вариант'); }
  function switchVariant(id: string) { if (id === activeVariant) return; const target = variants.find(v => v.id === id); if (!target) return; setVariants(list => list.map(v => v.id === activeVariant ? { ...v, points: clonePoints(points), items: cloneItems(items) } : v)); setPoints(clonePoints(target.points)); setItems(cloneItems(target.items)); setActiveVariant(id); setSelectedWall(null); setSelectedPoint(null); setSelectedItem(null); setStatus(`Вариант: ${target.name}`); }
  function renameVariant() { const target = variants.find(v => v.id === activeVariant); if (!target) return; const name = window.prompt('Название варианта', target.name)?.trim(); if (!name) return; setVariants(list => list.map(v => v.id === activeVariant ? { ...v, name } : v)); }

  const pointFromEvent = (e: React.PointerEvent<SVGSVGElement | SVGLineElement>) => { const svg = e.currentTarget instanceof SVGSVGElement ? e.currentTarget : e.currentTarget.ownerSVGElement, r = svg?.getBoundingClientRect(); if (!r) return { x: 0, y: 0 }; return { x: Math.max(0, Math.min(W, (e.clientX - r.left) / zoom)), y: Math.max(0, Math.min(H, (e.clientY - r.top) / zoom)) }; };
  const addSide = () => { const mm = parseDimension(sideLength), deg = Number(sideAngle.replace(',', '.').replace('°', '')); if (!mm || mm < 100 || !Number.isFinite(deg) || !points.length) return; const last = points[points.length - 1], next = pointFromLengthAngle({ x: last.x * 10, y: last.y * 10 }, mm, deg); commit([...points, { x: snap(next.x / 10, grid / 10), y: snap(next.y / 10, grid / 10) }]); };
  const updateWall = (i: number, value: string) => { const mm = parseDimension(value); if (!mm || mm <= 100) return; const source = points.map(p => ({ x: p.x * 10, y: p.y * 10 })), next = orthogonal && source.length === 4 ? resizeOrthogonalWall(source, i, mm) : resizeWallKeepingAdjacent(source, i, mm); commit(next.map(p => ({ x: p.x / 10, y: p.y / 10 }))); };
  const updateDiagonal = (id: number, value: string) => { const mm = parseDimension(value); if (!mm || mm <= 100) return; const d = diagonals.find(x => x.id === id); if (!d) return; const result = rebuildQuadrilateralByDiagonal(points.map(p => ({ x: p.x * 10, y: p.y * 10 })), mm, d.a === 0 ? 0 : 1); if (!result.ok) { window.alert(result.reason); return; } commit(result.points.map(p => ({ x: p.x / 10, y: p.y / 10 }))); setDiagonals(ds => ds.map(x => x.id === id ? { ...x, lengthMm: mm } : x)); setDiagonalLength(String(Math.round(mm))); };
  const addItem = (e: React.PointerEvent<SVGSVGElement>) => { if (tool === 'select' || tool === 'draw' || tool === 'diagonal') return; const p = pointFromEvent(e), id = items.length ? Math.max(...items.map(x => x.id)) + 1 : 1, item: Item = { id, type: tool, x: snap(p.x, grid / 10), y: snap(p.y, grid / 10) }; if (tool === 'lightLine') { item.x2 = item.x + 140; item.y2 = item.y; } if (tool === 'cornice') { item.x2 = item.x + 90; item.y2 = item.y; } commit(points, [...items, item]); setSelectedItem(id); setSelectedWall(null); setSelectedPoint(null); };

  return <main className="planner-page">
    <header className="planner-header"><div className="planner-brand"><div className="planner-logo">P</div><div><strong>Potolok Planner</strong><span>Планировщик натяжных потолков</span></div></div><div className="planner-project"><label>Проект</label><input value={projectName} onChange={e => setProjectName(e.target.value)} /></div><div className="planner-actions"><button onClick={newProject}>Новый</button><button onClick={() => saveCurrent()}>Сохранить</button><button onClick={undo} disabled={!history.length}>↶ Отмена</button><button onClick={redo} disabled={!future.length}>↷ Повтор</button><button className="primary" onClick={() => window.print()}>Печать / PDF</button></div></header>
    <section className="planner-toolbar"><button className={tool === 'select' ? 'active' : ''} onClick={() => setTool('select')}>↖ Выбор</button><button className={tool === 'draw' ? 'active' : ''} onClick={() => setTool('draw')}>⌘ Геометрия</button><button className={tool === 'diagonal' ? 'active' : ''} onClick={() => setTool('diagonal')}>⌁ Диагональ</button><span className="toolbar-divider" /><button className={orthogonal ? 'active' : ''} onClick={() => setOrthogonal(v => !v)}>□ Прямые углы</button><button onClick={() => setShowAngles(v => !v)}>{showAngles ? '∠ Углы' : '∠ Углы выкл.'}</button><button onClick={() => setShowDiagonals(v => !v)}>{showDiagonals ? '⌁ Диагонали' : '⌁ Диагонали выкл.'}</button><span className="grid-control">Сетка <select value={grid} onChange={e => setGrid(Number(e.target.value))}><option value={10}>10 мм</option><option value={50}>50 мм</option><option value={100}>100 мм</option></select></span><button onClick={() => setZoom(v => Math.max(.7, v - .1))}>−</button><button onClick={() => setZoom(v => Math.min(1.6, v + .1))}>＋</button><span className="planner-status">{status}</span></section>
    <div className="planner-grid">
      <aside className="planner-sidebar"><div className="panel-title">Построитель потолка</div><div className="hint">Контур строится по точным сторонам, углам и диагоналям. Размеры вводятся в мм, см или м.</div><div className="metric-grid"><div><span>Площадь</span><b>{area.toFixed(2)} м²</b></div><div><span>Периметр</span><b>{perimeter.toFixed(2)} м</b></div></div><div className="property-card"><b>Добавить сторону</b><label>Длина<input value={sideLength} onChange={e => setSideLength(e.target.value)} placeholder="350 см" /><span>мм / см / м</span></label><label>Угол<input value={sideAngle} onChange={e => setSideAngle(e.target.value)} placeholder="0" /><span>°</span></label><button onClick={addSide}>Добавить сторону</button></div><div className="panel-divider" /><div className="panel-title">Варианты</div><div className="variant-list">{variants.map(v => <button key={v.id} className={v.id === activeVariant ? 'active' : ''} onClick={() => switchVariant(v.id)}>{v.name}</button>)}</div><div className="variant-actions"><button onClick={addVariant}>＋ Вариант</button><button onClick={renameVariant}>Переименовать</button></div><div className="panel-divider" /><div className="panel-title">Элементы потолка</div>{(Object.keys(labels) as ElementType[]).map(t => <button key={t} className="element-btn" onClick={() => setTool(t)}>＋ {labels[t]}</button>)}</aside>
      <section className="planner-canvas-wrap"><svg className="planner-canvas" viewBox={`0 0 ${W} ${H}`} onPointerDown={addItem} style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}><defs><pattern id="grid-main" width={grid / 10} height={grid / 10} patternUnits="userSpaceOnUse"><path d={`M ${grid / 10} 0 L 0 0 0 ${grid / 10}`} fill="none" stroke="currentColor" opacity=".08" /></pattern></defs><rect width={W} height={H} fill="url(#grid-main)" />{points.map((p, i) => { const q = points[(i + 1) % points.length], len = distance(p, q), mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2; return <g key={i}><line x1={p.x} y1={p.y} x2={q.x} y2={q.y} className={selectedWall === i ? 'room-wall selected' : 'room-wall'} onClick={() => setSelectedWall(i)} /><text x={mx} y={my - 8} className="dimension-label" textAnchor="middle" onDoubleClick={() => { setSelectedWall(i); const v = window.prompt('Длина стороны', `${Math.round(len * 10)} мм`); if (v) updateWall(i, v); }}>{Math.round(len * 10)} мм</text>{showAngles && <text x={p.x + 12} y={p.y + 18} className="angle-label">{angleAt(points, i).toFixed(0)}°</text>}</g>; })}{points.map((p, i) => <circle key={`p${i}`} cx={p.x} cy={p.y} r={7} className={selectedPoint === i ? 'room-point selected' : 'room-point'} onClick={e => { e.stopPropagation(); setSelectedPoint(i); setSelectedWall(null); setSelectedItem(null); }} />)}{showDiagonals && diagonals.map(d => { const a = points[d.a], b = points[d.b]; if (!a || !b) return null; return <g key={d.id}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={selectedDiagonal === d.id ? 'diagonal-line selected' : 'diagonal-line'} onClick={e => { e.stopPropagation(); setSelectedDiagonal(d.id); setSelectedWall(null); setSelectedPoint(null); }} /><text x={(a.x + b.x) / 2 + 8} y={(a.y + b.y) / 2 - 8} className="dimension-label">{Math.round(distance(a, b) * 10)} мм</text></g>; })}{items.map(item => item.type === 'spot' ? <circle key={item.id} cx={item.x} cy={item.y} r={8} className="ceiling-element" onClick={e => { e.stopPropagation(); setSelectedItem(item.id); }} /> : item.type === 'chandelier' ? <circle key={item.id} cx={item.x} cy={item.y} r={15} className="ceiling-element" onClick={e => { e.stopPropagation(); setSelectedItem(item.id); }} /> : <line key={item.id} x1={item.x} y1={item.y} x2={item.x2} y2={item.y2} className="ceiling-element" onClick={e => { e.stopPropagation(); setSelectedItem(item.id); }} />)}<text x={20} y={30} className="canvas-caption">{tool === 'draw' ? 'Построение контура' : tool === 'diagonal' ? 'Редактирование диагонали' : 'CAD-режим потолка'}</text></svg></section>
      <aside className="planner-sidebar"><div className="panel-title">Параметры</div>{selectedWall !== null && <div className="property-card"><b>Сторона {selectedWall + 1}</b><label>Длина<input defaultValue={Math.round(distance(points[selectedWall], points[(selectedWall + 1) % points.length]) * 10)} onBlur={e => updateWall(selectedWall, e.target.value)} /><span>мм</span></label><div>Угол: {angleAt(points, selectedWall).toFixed(1)}°</div></div>}{selectedPoint !== null && <div className="property-card"><b>Вершина {selectedPoint + 1}</b><div>X: {(points[selectedPoint].x * 10).toFixed(0)} мм</div><div>Y: {(points[selectedPoint].y * 10).toFixed(0)} мм</div></div>}{selectedItem !== null && <div className="property-card"><b>{labels[items.find(x => x.id === selectedItem)?.type ?? 'spot']}</b><div>Ед.: {units[items.find(x => x.id === selectedItem)?.type ?? 'spot']}</div><div>Цена: {prices[items.find(x => x.id === selectedItem)?.type ?? 'spot']} ₽</div></div>}{selectedDiagonal !== null && <div className="property-card"><b>Диагональ {selectedDiagonal}</b><label>Длина<input value={diagonalLength || Math.round(diagonals.find(d => d.id === selectedDiagonal)?.lengthMm ?? 0)} onChange={e => setDiagonalLength(e.target.value)} onBlur={e => updateDiagonal(selectedDiagonal, e.target.value)} /><span>мм</span></label><small>Изменение перестраивает четырёхугольник по треугольникам.</small></div>}<div className="property-card"><b>Смета</b><div>Продажа: <strong>{Math.round(estimate.totalSell).toLocaleString('ru-RU')} ₽</strong></div><div>Себестоимость: {Math.round(estimate.totalCost).toLocaleString('ru-RU')} ₽</div><div>Маржа: {Math.round(estimate.margin).toLocaleString('ru-RU')} ₽ ({estimate.marginPercent.toFixed(1)}%)</div></div><div className="property-card"><b>Проекты</b>{projects.slice(0, 8).map(p => <button key={p.id} className="element-btn" onClick={() => openProject(p)}>{p.name}</button>)}</div></aside>
    </div>
  </main>;
}
