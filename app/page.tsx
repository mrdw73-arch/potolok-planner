'use client';

import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import EstimatePanel from './components/EstimatePanel';
import CeilingVariants, { CeilingVariant } from './components/CeilingVariants';
import ElementEditor from './components/ElementEditor';
import { defaultCatalog } from '../lib/catalog';
import { angleAt, distance, polygonArea, polygonPerimeter, snapPoint } from '../lib/geometry';
import { CeilingProject, createProjectId, duplicateProject, exportProjectsJson, importProjectsJson, loadProjects, upsertProject } from '../lib/project';

type Point = { x: number; y: number };
type ElementType = 'spot' | 'chandelier' | 'cornice';
type CeilingElement = { id: number; type: ElementType; x: number; y: number; width?: number; height?: number; price?: number };
const W = 800;
const H = 600;
const initialPoints: Point[] = [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 3600 }, { x: 0, y: 3600 }];
const labels: Record<ElementType, string> = { spot: 'Светильник', chandelier: 'Люстра', cornice: 'Карниз' };
const defaultPrices = { canvasPricePerM2: 900, profilePricePerM: 350, insertPricePerM: 120, fastenerPricePerM: 45, spotlightPrice: 700, chandelierPrice: 1200, cornicePricePerM: 650, wastePercent: 0, laborPricePerM2: 500 };

export default function Home() {
  const [projects, setProjects] = useState<CeilingProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [points, setPoints] = useState<Point[]>(initialPoints);
  const [selectedWall, setSelectedWall] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const [elements, setElements] = useState<CeilingElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<number | null>(null);
  const [nextId, setNextId] = useState(1);
  const [name, setName] = useState('Новая комната');
  const [client, setClient] = useState({ name: '', phone: '', address: '' });
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [showProjects, setShowProjects] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [variants, setVariants] = useState<CeilingVariant[]>([{ id: 'standard', name: 'Стандарт', price: 0, active: true }]);
  const [activeVariant, setActiveVariant] = useState('standard');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = loadProjects();
    setProjects(stored);
    if (stored[0]) loadProject(stored[0]);
  }, []);

  const area = useMemo(() => polygonArea(points) / 1e6, [points]);
  const perimeter = useMemo(() => polygonPerimeter(points) / 1000, [points]);
  const selectedWallLength = useMemo(() => distance(points[selectedWall], points[(selectedWall + 1) % points.length]), [points, selectedWall]);
  const bounds = useMemo(() => {
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = Math.min(660 / Math.max(maxX - minX, 1), 460 / Math.max(maxY - minY, 1));
    return { minX, minY, scale, ox: (W - (maxX - minX) * scale) / 2, oy: (H - (maxY - minY) * scale) / 2 };
  }, [points]);
  const toSvg = (p: Point) => ({ x: bounds.ox + (p.x - bounds.minX) * bounds.scale, y: bounds.oy + (p.y - bounds.minY) * bounds.scale });
  const quantities = useMemo(() => {
    const auto = { canvas: area, profile: perimeter, insert: perimeter, fastener: perimeter, spot: elements.filter(e => e.type === 'spot').length, chandelier: elements.filter(e => e.type === 'chandelier').length, cornice: perimeter, installation: area };
    return Object.fromEntries(Object.entries(auto).map(([id, value]) => [id, overrides[id] ?? value]));
  }, [area, perimeter, elements, overrides]);
  const variantPrice = useMemo(() => defaultCatalog.reduce((s, i) => s + (quantities[i.id] || 0) * i.sellPrice, 0), [quantities]);
  const selectedElementData = useMemo(() => elements.find(element => element.id === selectedElement) ?? null, [elements, selectedElement]);

  function loadProject(project: CeilingProject) {
    setProjectId(project.id); setName(project.name); setPoints(project.points); setElements(project.elements); setClient(project.client); setNotes(project.notes);
    setOverrides(project.quantityOverrides ?? {});
    const savedVariants = project.variants?.map(v => ({ ...v, active: v.id === (project.activeVariantId ?? project.variants?.[0]?.id) }));
    setVariants(savedVariants?.length ? savedVariants : [{ id: 'standard', name: 'Стандарт', price: 0, active: true }]);
    setActiveVariant(project.activeVariantId ?? savedVariants?.[0]?.id ?? 'standard');
    setNextId(Math.max(0, ...project.elements.map(e => e.id)) + 1); setSelectedPoint(0); setSelectedWall(0); setSelectedElement(null); setStatus('Проект открыт');
  }

  function currentProject(): CeilingProject {
    return { id: projectId || createProjectId(), name: name.trim() || 'Без названия', updatedAt: new Date().toISOString(), points, elements, prices: defaultPrices, client, notes, variants: variants.map(v => ({ id: v.id, name: v.name, price: v.id === activeVariant ? variantPrice : v.price })), activeVariantId: activeVariant, quantityOverrides: overrides };
  }

  function saveCurrent() {
    const project = currentProject();
    const next = upsertProject(project, projects);
    setProjects(next); setProjectId(project.id); setStatus('Сохранено');
  }

  function newProject() {
    setProjectId(''); setName('Новая комната'); setPoints(initialPoints); setElements([]); setClient({ name: '', phone: '', address: '' }); setNotes(''); setOverrides({}); setVariants([{ id: 'standard', name: 'Стандарт', price: 0, active: true }]); setActiveVariant('standard'); setNextId(1); setSelectedPoint(0); setSelectedWall(0); setSelectedElement(null); setStatus('Новый проект');
  }

  function removeProject(id: string) {
    const next = projects.filter(p => p.id !== id); localStorage.setItem('potolok-planner-projects', JSON.stringify(next)); setProjects(next); if (id === projectId) newProject();
  }

  function duplicateCurrent() {
    const copy = duplicateProject(currentProject()); const next = upsertProject(copy, projects); setProjects(next); loadProject(copy);
  }

  function exportBackup() {
    const blob = new Blob([exportProjectsJson(projects)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'potolok-planner-backup.json'; a.click(); URL.revokeObjectURL(url); setStatus('Резервная копия выгружена');
  }

  function importBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => { try { const next = importProjectsJson(String(reader.result), projects); setProjects(next); if (next[0]) loadProject(next[0]); setStatus('Импорт завершён'); } catch (error) { setStatus(error instanceof Error ? error.message : 'Ошибка импорта'); } }; reader.readAsText(file); e.target.value = '';
  }

  function fromEvent(e: PointerEvent<SVGCircleElement>) {
    const svg = e.currentTarget.ownerSVGElement; if (!svg) return null; const r = svg.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  function movePoint(i: number, e: PointerEvent<SVGCircleElement>) {
    const p = fromEvent(e); if (!p) return;
    setPoints(c => c.map((v, j) => j === i ? snapPoint({ x: Math.max(0, (p.x - bounds.ox) / bounds.scale + bounds.minX), y: Math.max(0, (p.y - bounds.oy) / bounds.scale + bounds.minY) }, 10) : v));
  }
  function setWallLength(index: number, lengthMm: number) {
    if (!Number.isFinite(lengthMm) || lengthMm <= 0) return;
    setPoints(current => {
      if (current.length < 3) return current;
      const nextIndex = (index + 1) % current.length;
      const a = current[index];
      const b = current[nextIndex];
      const currentLength = distance(a, b);
      if (!currentLength) return current;
      const scale = lengthMm / currentLength;
      const next = [...current];
      next[nextIndex] = { x: Math.round(a.x + (b.x - a.x) * scale), y: Math.round(a.y + (b.y - a.y) * scale) };
      return next;
    });
  }
  function addCorner() { const n = (selectedWall + 1) % points.length, a = points[selectedWall], b = points[n], m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; setPoints(c => [...c.slice(0, n), m, ...c.slice(n)]); setSelectedPoint(n); setSelectedWall(n); }
  function addElement(type: ElementType) {
    const x = points.reduce((s, p) => s + p.x, 0) / points.length;
    const y = points.reduce((s, p) => s + p.y, 0) / points.length;
    const defaults: Record<ElementType, Partial<CeilingElement>> = {
      spot: { width: 120, price: 700 },
      chandelier: { width: 600, price: 1200 },
      cornice: { width: 1000, height: 80, price: 650 },
    };
    const element = { id: nextId, type, x, y, ...defaults[type] };
    setElements(c => [...c, element]); setSelectedElement(nextId); setNextId(n => n + 1);
  }
  function updateElement(id: number, patch: Partial<CeilingElement>) {
    setElements(current => current.map(element => element.id === id ? { ...element, ...patch } : element));
  }
  function deleteElement(id: number) {
    setElements(current => current.filter(element => element.id !== id));
    if (selectedElement === id) setSelectedElement(null);
  }
  function moveElement(id: number, e: PointerEvent<SVGGElement>) {
    const svg = e.currentTarget.ownerSVGElement; if (!svg) return; const r = svg.getBoundingClientRect();
    const sx = (e.clientX - r.left) / r.width * W, sy = (e.clientY - r.top) / r.height * H;
    setElements(c => c.map(v => v.id === id ? { ...v, x: (sx - bounds.ox) / bounds.scale + bounds.minX, y: (sy - bounds.oy) / bounds.scale + bounds.minY } : v));
  }
  function duplicateVariant(id: string) { const v = variants.find(x => x.id === id); if (!v) return; const copy = { ...v, id: `${id}-${Date.now()}`, name: `${v.name} — копия`, active: true, price: variantPrice }; setVariants(x => [...x.map(v => ({ ...v, active: false })), copy]); setActiveVariant(copy.id); }
  function addVariant() { const id = `variant-${Date.now()}`; setVariants(x => [...x.map(v => ({ ...v, active: false })), { id, name: `Вариант ${x.length + 1}`, price: variantPrice, active: true }]); setActiveVariant(id); }
  function setQuantity(id: string, value: number) { setOverrides(x => ({ ...x, [id]: Math.max(0, Number.isFinite(value) ? value : 0) })); }

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">P</span><span>Potolok Planner</span></div><div className="project-name"><input value={name} onChange={e => setName(e.target.value)} aria-label="Название проекта" /></div><div className="top-actions"><button className="ghost" onClick={() => setShowProjects(v => !v)}>Проекты</button><button className="ghost" onClick={newProject}>Новый</button><button className="ghost" onClick={exportBackup}>Экспорт</button><button className="ghost" onClick={() => fileRef.current?.click()}>Импорт</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={importBackup} /><button className="ghost" onClick={duplicateCurrent}>Копия</button><button className="ghost" onClick={() => window.print()}>PDF / Печать</button><button className="primary" onClick={saveCurrent}>Сохранить</button></div></header>
    {showProjects && <section className="panel" style={{ margin: '12px 16px', padding: 16 }}><div className="panel-title">Сохранённые проекты</div>{projects.length === 0 ? <div className="muted">Пока нет сохранённых проектов.</div> : projects.map(p => <div key={p.id} className="stat"><button className="ghost" onClick={() => { loadProject(p); setShowProjects(false); }}>{p.name}</button><span>{new Date(p.updatedAt).toLocaleString('ru-RU')}</span><button className="delete-feature" onClick={() => removeProject(p.id)}>Удалить</button></div>)}</section>}
    <CeilingVariants variants={variants.map(v => v.id === activeVariant ? { ...v, active: true, price: variantPrice } : v)} activeId={activeVariant} onSelect={id => setActiveVariant(id)} onDuplicate={duplicateVariant} onAdd={addVariant} />
    <section className="workspace"><aside className="panel left-panel"><div className="panel-title">Конструктор</div><label>Название<input value={name} onChange={e => setName(e.target.value)} /></label><div className="section-title">Клиент</div><input placeholder="Имя" value={client.name} onChange={e => setClient({ ...client, name: e.target.value })} /><input placeholder="Телефон" value={client.phone} onChange={e => setClient({ ...client, phone: e.target.value })} /><input placeholder="Адрес" value={client.address} onChange={e => setClient({ ...client, address: e.target.value })} /><div className="section-title">Заметки</div><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} /><div className="section-title">Геометрия</div><div className="stat"><span>Площадь</span><strong>{area.toFixed(2)} м²</strong></div><div className="stat"><span>Периметр</span><strong>{perimeter.toFixed(2)} м</strong></div><label>Длина стены, мм<input type="number" min="1" step="10" value={Math.round(selectedWallLength)} onChange={e => setWallLength(selectedWall, Number(e.target.value))} /></label><div className="stat"><span>Выбрана стена</span><strong>№ {selectedWall + 1}</strong></div><div className="button-row"><button className="add-button" onClick={addCorner}>＋ Угол</button><button className="delete-button" disabled={points.length <= 3} onClick={() => { if (points.length > 3) setPoints(p => p.filter((_, i) => i !== selectedPoint)); }}>− Угол</button></div><div className="section-title">Элементы потолка</div>{(['spot', 'chandelier', 'cornice'] as ElementType[]).map(type => <button key={type} className="feature" onClick={() => addElement(type)}>＋ {labels[type]}</button>)}{selectedElement !== null && <button className="delete-feature" onClick={() => deleteElement(selectedElement)}>Удалить выбранный элемент</button>}<div className="section-title">Углы</div><div className="angle-list">{points.map((p, i) => <span key={i}>∠{i + 1}: {angleAt(points[(i - 1 + points.length) % points.length], p, points[(i + 1) % points.length]).toFixed(1)}°</span>)}</div></aside>
      <div className="canvas-area"><div className="canvas-toolbar"><span>2D-план · {name}</span><span className="muted">Шаг 10 мм · {status}</span></div><div className="drawing-wrap"><svg className="drawing" viewBox={`0 0 ${W} ${H}`} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)}><defs><pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="currentColor" strokeOpacity=".07" /></pattern></defs><rect width={W} height={H} fill="url(#grid)" /><polygon points={points.map(toSvg).map(p => `${p.x},${p.y}`).join(' ')} className="room" />{points.map((p, i) => { const n = points[(i + 1) % points.length], a = toSvg(p), b = toSvg(n), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; return <g key={i}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={selectedWall === i ? 'wall-hit selected-wall' : 'wall-hit'} onPointerDown={() => { setSelectedWall(i); setSelectedPoint(i); }} /><text x={m.x} y={m.y - 12} className="dimension-text" textAnchor="middle" onClick={() => { setSelectedWall(i); setSelectedPoint(i); }}>{Math.round(distance(p, n))} мм</text><circle cx={a.x} cy={a.y} r={selectedPoint === i ? 10 : 8} className={selectedPoint === i ? 'handle selected' : 'handle'} onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setSelectedPoint(i); setSelectedWall(i); setDragging(i); }} onPointerMove={e => dragging === i && movePoint(i, e)} onPointerUp={e => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} setDragging(null); }} /></g>; })}{elements.map(el => { const p = toSvg(el), sel = selectedElement === el.id; const width = (el.width ?? (el.type === 'spot' ? 120 : el.type === 'chandelier' ? 600 : 1000)) * bounds.scale; const height = (el.height ?? (el.type === 'cornice' ? 80 : el.type === 'chandelier' ? 120 : 120)) * bounds.scale; return <g key={el.id} transform={`translate(${p.x} ${p.y})`} className={`ceiling-element ${sel ? 'selected-element' : ''}`} onPointerDown={e => { e.stopPropagation(); setSelectedElement(el.id); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => sel && moveElement(el.id, e)} onPointerUp={e => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} }}>{el.type === 'spot' ? <><circle r={Math.max(10, width / 2)} className="spot-symbol" /><circle r={Math.max(3, Math.min(6, height / 16))} className="spot-core" /></> : el.type === 'chandelier' ? <><ellipse rx={Math.max(18, width / 2)} ry={Math.max(18, height / 2)} className="chandelier-symbol" /><path d={`M-${Math.min(12, width / 4)} ${Math.min(18, height / 4)}Q0-${Math.min(14, height / 5)} ${Math.min(12, width / 4)} ${Math.min(18, height / 4)}`} className="chandelier-lines" /></> : <><rect x={-Math.max(40, width / 2)} y={-Math.max(5, height / 2)} width={Math.max(80, width)} height={Math.max(10, height)} rx={Math.max(5, height / 2)} className="cornice-symbol" /><text y={-Math.max(12, height / 2 + 8)} textAnchor="middle" className="element-label">карниз</text></>}</g>; })}<text x={W / 2} y={H / 2 + 8} className="area-text" textAnchor="middle">{area.toFixed(2)} м²</text></svg></div></div>
      <ElementEditor element={selectedElementData} onChange={patch => selectedElement !== null && updateElement(selectedElement, patch)} onDelete={() => selectedElement !== null && deleteElement(selectedElement)} />
      <EstimatePanel catalog={defaultCatalog} quantities={quantities} onQuantityChange={setQuantity} />
    </section>
  </main>;
}
