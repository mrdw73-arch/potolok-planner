'use client';

import { ChangeEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import EstimatePanel from './components/EstimatePanel';
import CeilingVariants, { CeilingVariant } from './components/CeilingVariants';
import ClientsPanel from './components/ClientsPanel';
import ElementEditor from './components/ElementEditor';
import { defaultCatalog } from '../lib/catalog';
import { Client, createClientId, loadClients, onClientsChanged, removeClientLocally, upsertClient } from '../lib/client';
import { angleAt, distance, orthogonalizeRoom, polygonArea, polygonPerimeter, resizeOrthogonalWall, resizeWallKeepingAdjacent, snapPoint } from '../lib/geometry';
import { CeilingProject, createProjectId, duplicateProject, exportProjectsJson, importProjectsJson, loadProjects, onProjectsChanged, removeProjectLocally, upsertProject } from '../lib/project';

type Point = { x: number; y: number };
type ElementType = 'spot' | 'chandelier' | 'cornice' | 'lightLine';
type CeilingElement = { id: number; type: ElementType; x: number; y: number; width?: number; height?: number; price?: number };
const W = 800;
const H = 600;
const initialPoints: Point[] = [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 3600 }, { x: 0, y: 3600 }];
const labels: Record<ElementType, string> = { spot: 'Светильник', chandelier: 'Люстра', cornice: 'Карниз', lightLine: 'Световая линия' };
const defaultPrices = { canvasPricePerM2: 900, profilePricePerM: 350, insertPricePerM: 120, fastenerPricePerM: 45, spotlightPrice: 700, chandelierPrice: 1200, cornicePricePerM: 650, wastePercent: 0, laborPricePerM2: 500 };

function clonePoints(points: Point[]) { return points.map(p => ({ ...p })); }
function cloneElements(elements: CeilingElement[]) { return elements.map(e => ({ ...e })); }

export default function Home() {
  const [projects, setProjects] = useState<CeilingProject[]>([]);
  const [projectId, setProjectId] = useState('');
  const [points, setPoints] = useState<Point[]>(initialPoints);
  const [selectedWall, setSelectedWall] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const [editingWall, setEditingWall] = useState<number | null>(null);
  const [editingWallValue, setEditingWallValue] = useState('');
  const [showDiagonals, setShowDiagonals] = useState(true);
  const [orthogonalMode, setOrthogonalMode] = useState(false);
  const [elements, setElements] = useState<CeilingElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<number | null>(null);
  const [nextId, setNextId] = useState(1);
  const [name, setName] = useState('Новая комната');
  const [client, setClient] = useState({ name: '', phone: '', address: '' });
  const [clientId, setClientId] = useState<string | undefined>(undefined);
  const [clients, setClients] = useState<Client[]>([]);
  const [showClients, setShowClients] = useState(false);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('');
  const [showProjects, setShowProjects] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [variants, setVariants] = useState<CeilingVariant[]>([{ id: 'standard', name: 'Стандарт', price: 0, active: true, points: clonePoints(initialPoints), elements: [], quantityOverrides: {} }]);
  const [activeVariant, setActiveVariant] = useState('standard');
  const [ready, setReady] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = loadProjects();
    setProjects(stored);
    if (stored[0]) loadProject(stored[0]);
    setClients(loadClients());
    setReady(true);
  }, []);

  useEffect(() => onProjectsChanged(() => setProjects(loadProjects())), []);
  useEffect(() => onClientsChanged(() => setClients(loadClients())), []);

  const clientProjectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const project of projects) if (project.clientId) counts[project.clientId] = (counts[project.clientId] ?? 0) + 1;
    return counts;
  }, [projects]);

  const area = useMemo(() => polygonArea(points) / 1e6, [points]);
  const perimeter = useMemo(() => polygonPerimeter(points) / 1000, [points]);
  const selectedWallLength = useMemo(() => distance(points[selectedWall], points[(selectedWall + 1) % points.length]), [points, selectedWall]);
  const signedArea = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < points.length; i += 1) { const a = points[i], b = points[(i + 1) % points.length]; sum += a.x * b.y - b.x * a.y; }
    return sum / 2;
  }, [points]);
  const diagonalPairs = useMemo(() => {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < points.length; i += 1) for (let j = i + 1; j < points.length; j += 1) if (!(j === i + 1 || (i === 0 && j === points.length - 1))) pairs.push([i, j]);
    return pairs;
  }, [points.length]);
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

  function snapshotCurrent() {
    return { points: clonePoints(points), elements: cloneElements(elements), quantityOverrides: { ...overrides }, price: variantPrice };
  }

  function loadProject(project: CeilingProject) {
    setProjectId(project.id); setName(project.name); setClient(project.client); setClientId(project.clientId); setNotes(project.notes); setOrthogonalMode(project.orthogonalMode ?? false);
    const rawVariants = project.variants?.length ? project.variants : [{ id: 'standard', name: 'Стандарт', price: 0, points: project.points, elements: project.elements, quantityOverrides: project.quantityOverrides ?? {} }];
    const activeId = project.activeVariantId ?? rawVariants[0].id;
    const normalized = rawVariants.map(v => ({ ...v, active: v.id === activeId, points: v.points ? clonePoints(v.points) : clonePoints(project.points), elements: v.elements ? cloneElements(v.elements) : cloneElements(project.elements), quantityOverrides: { ...(v.quantityOverrides ?? project.quantityOverrides ?? {}) } }));
    const active = normalized.find(v => v.id === activeId) ?? normalized[0];
    setVariants(normalized); setActiveVariant(active.id); setPoints(clonePoints(active.points ?? project.points)); setElements(cloneElements(active.elements ?? project.elements)); setOverrides({ ...(active.quantityOverrides ?? project.quantityOverrides ?? {}) });
    setNextId(Math.max(0, ...((active.elements ?? project.elements).map(e => e.id))) + 1); setSelectedPoint(0); setSelectedWall(0); setSelectedElement(null); setEditingWall(null); setStatus('Проект открыт');
  }

  function currentProject(): CeilingProject {
    const current = snapshotCurrent();
    const savedVariants = variants.map(v => v.id === activeVariant ? { id: v.id, name: v.name, price: current.price, points: current.points, elements: current.elements, quantityOverrides: current.quantityOverrides } : { id: v.id, name: v.name, price: v.price, points: v.points ? clonePoints(v.points) : clonePoints(points), elements: v.elements ? cloneElements(v.elements) : cloneElements(elements), quantityOverrides: { ...(v.quantityOverrides ?? {}) } });
    return { id: projectId || createProjectId(), name: name.trim() || 'Без названия', updatedAt: new Date().toISOString(), points: current.points, elements: current.elements, prices: defaultPrices, client, clientId, notes, variants: savedVariants, activeVariantId: activeVariant, quantityOverrides: current.quantityOverrides, orthogonalMode };
  }

  useEffect(() => {
    if (!ready || !projectId) return;
    const timer = window.setTimeout(() => {
      const project = currentProject();
      const next = upsertProject(project, loadProjects());
      setProjects(next); setProjectId(project.id); setStatus('Автосохранено');
    }, 800);
    return () => window.clearTimeout(timer);
  }, [ready, projectId, name, points, elements, client, clientId, notes, overrides, variants, activeVariant, orthogonalMode, variantPrice]);

  function saveCurrent() { const project = currentProject(); const next = upsertProject(project, projects); setProjects(next); setProjectId(project.id); setStatus('Сохранено'); }

  function newProject() {
    setProjectId(''); setName('Новая комната'); setPoints(clonePoints(initialPoints)); setElements([]); setClient({ name: '', phone: '', address: '' }); setClientId(undefined); setNotes(''); setOverrides({}); setVariants([{ id: 'standard', name: 'Стандарт', price: 0, active: true, points: clonePoints(initialPoints), elements: [], quantityOverrides: {} }]); setActiveVariant('standard'); setNextId(1); setSelectedPoint(0); setSelectedWall(0); setSelectedElement(null); setEditingWall(null); setShowDiagonals(true); setOrthogonalMode(false); setStatus('Новый проект');
  }

  function selectVariant(id: string) {
    if (id === activeVariant) return;
    const target = variants.find(v => v.id === id); if (!target) return;
    const current = snapshotCurrent();
    setVariants(list => list.map(v => v.id === activeVariant ? { ...v, active: false, points: current.points, elements: current.elements, quantityOverrides: current.quantityOverrides, price: current.price } : { ...v, active: v.id === id }));
    const nextPoints = target.points?.length ? clonePoints(target.points) : clonePoints(points);
    const nextElements = target.elements ? cloneElements(target.elements) : [];
    setPoints(nextPoints); setElements(nextElements); setOverrides({ ...(target.quantityOverrides ?? {}) }); setActiveVariant(id); setSelectedPoint(0); setSelectedWall(0); setSelectedElement(null); setNextId(Math.max(0, ...nextElements.map(e => e.id)) + 1); setStatus(`Выбран вариант: ${target.name}`);
  }

  function addVariant() {
    const current = snapshotCurrent(); const id = `variant-${Date.now()}`;
    const next = { id, name: `Вариант ${variants.length + 1}`, price: current.price, active: true, points: current.points, elements: current.elements, quantityOverrides: current.quantityOverrides };
    setVariants(list => [...list.map(v => ({ ...v, active: false })), next]); setActiveVariant(id); setStatus('Новый вариант создан');
  }

  function duplicateVariant(id: string) {
    const v = variants.find(x => x.id === id); if (!v) return;
    const source = v.id === activeVariant ? snapshotCurrent() : { points: clonePoints(v.points ?? points), elements: cloneElements(v.elements ?? []), quantityOverrides: { ...(v.quantityOverrides ?? {}) }, price: v.price };
    const copy = { ...v, id: `${id}-${Date.now()}`, name: `${v.name} — копия`, active: true, price: source.price, points: source.points, elements: source.elements, quantityOverrides: source.quantityOverrides };
    setVariants(list => [...list.map(item => ({ ...item, active: false })), copy]); setActiveVariant(copy.id); setPoints(clonePoints(source.points)); setElements(cloneElements(source.elements)); setOverrides({ ...source.quantityOverrides }); setSelectedElement(null); setNextId(Math.max(0, ...source.elements.map(e => e.id)) + 1); setStatus('Вариант продублирован');
  }

  function renameVariant(id: string) {
    const v = variants.find(x => x.id === id); if (!v) return;
    const nextName = window.prompt('Название варианта', v.name)?.trim(); if (!nextName) return;
    setVariants(list => list.map(item => item.id === id ? { ...item, name: nextName } : item)); setStatus('Вариант переименован');
  }

  function deleteVariant(id: string) {
    if (variants.length <= 1) return;
    const v = variants.find(x => x.id === id); if (!v) return;
    if (!window.confirm(`Удалить вариант «${v.name}»?`)) return;
    const remaining = variants.filter(x => x.id !== id);
    if (id === activeVariant) {
      const target = remaining[0];
      setVariants(remaining.map(x => ({ ...x, active: x.id === target.id })));
      setActiveVariant(target.id); setPoints(clonePoints(target.points ?? points)); setElements(cloneElements(target.elements ?? [])); setOverrides({ ...(target.quantityOverrides ?? {}) }); setNextId(Math.max(0, ...((target.elements ?? []).map(e => e.id))) + 1);
    } else setVariants(remaining);
    setStatus('Вариант удалён');
  }

  function selectClient(id: string) { if (!id) { setClientId(undefined); return; } const found = clients.find(c => c.id === id); if (!found) return; setClient({ name: found.name, phone: found.phone, address: found.address }); setClientId(found.id); }
  function saveClientToDatabase() { if (!client.name.trim()) { setStatus('Укажите имя клиента'); return; } const existing = clientId ? clients.find(c => c.id === clientId) : undefined; const saved: Client = { id: existing?.id ?? createClientId(), name: client.name.trim(), phone: client.phone.trim(), address: client.address.trim(), notes: existing?.notes ?? '', updatedAt: new Date().toISOString() }; const next = upsertClient(saved, clients); setClients(next); setClientId(saved.id); setStatus('Клиент сохранён в базе'); }
  function saveClient(record: Client) { setClients(upsertClient(record, clients)); }
  function deleteClient(id: string) { setClients(removeClientLocally(id, clients)); if (clientId === id) setClientId(undefined); }
  function toggleOrthogonalMode(enabled: boolean) { setOrthogonalMode(enabled); if (enabled && points.length === 4) { setPoints(current => orthogonalizeRoom(current)); setStatus('Ортогональный режим включён'); } else if (!enabled) setStatus('Свободная геометрия'); }
  function removeProject(id: string) { const next = removeProjectLocally(id, projects); setProjects(next); if (id === projectId) newProject(); }
  function duplicateCurrent() { const project = duplicateProject(currentProject()); const next = upsertProject(project, projects); setProjects(next); loadProject(project); }
  function exportBackup() { const data = exportProjectsJson(projects); const blob = new Blob([data], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `potolok-planner-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url); }
  function importBackup(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const next = importProjectsJson(String(reader.result), projects); setProjects(next); setStatus('Резервная копия импортирована'); } catch (error) { setStatus(error instanceof Error ? error.message : 'Ошибка импорта'); } }; reader.readAsText(file); event.target.value = ''; }
  function movePoint(index: number, e: PointerEvent<SVGCircleElement>) { const svg = e.currentTarget.ownerSVGElement; if (!svg) return; const r = svg.getBoundingClientRect(); const sx = (e.clientX - r.left) / r.width * W, sy = (e.clientY - r.top) / r.height * H; const raw = { x: (sx - bounds.ox) / bounds.scale + bounds.minX, y: (sy - bounds.oy) / bounds.scale + bounds.minY }; const snapped = snapPoint(raw, 10); setPoints(current => current.map((point, pointIndex) => pointIndex === index ? snapped : point)); }
  function setWallLength(index: number, value: number) { if (!Number.isFinite(value) || value <= 0) return; setPoints(current => orthogonalMode && current.length === 4 ? resizeOrthogonalWall(current, index, value) : resizeWallKeepingAdjacent(current, index, value)); }
  function beginWallEdit(index: number) { setEditingWall(index); setEditingWallValue(String(Math.round(distance(points[index], points[(index + 1) % points.length])))); }
  function commitWallEdit() { if (editingWall === null) return; const value = Number(editingWallValue); if (Number.isFinite(value) && value > 0) setWallLength(editingWall, value); setEditingWall(null); }
  function cancelWallEdit() { setEditingWall(null); }
  function addCorner() { const n = (selectedWall + 1) % points.length, a = points[selectedWall], b = points[n], m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; setPoints(c => [...c.slice(0, n), m, ...c.slice(n)]); setSelectedPoint(n); setSelectedWall(n); }
  function addElement(type: ElementType) { const x = points.reduce((s, p) => s + p.x, 0) / points.length, y = points.reduce((s, p) => s + p.y, 0) / points.length; const defaults: Record<ElementType, Partial<CeilingElement>> = { spot: { width: 120, price: 700 }, chandelier: { width: 600, price: 1200 }, cornice: { width: 1000, height: 80, price: 650 }, lightLine: { width: 1400, price: 950 } }; const element = { id: nextId, type, x, y, ...defaults[type] }; setElements(c => [...c, element]); setSelectedElement(nextId); setNextId(n => n + 1); }
  function updateElement(id: number, patch: Partial<CeilingElement>) { setElements(current => current.map(element => element.id === id ? { ...element, ...patch } : element)); }
  function deleteElement(id: number) { setElements(current => current.filter(element => element.id !== id)); if (selectedElement === id) setSelectedElement(null); }
  function moveElement(id: number, e: PointerEvent<SVGGElement>) { const svg = e.currentTarget.ownerSVGElement; if (!svg) return; const r = svg.getBoundingClientRect(); const sx = (e.clientX - r.left) / r.width * W, sy = (e.clientY - r.top) / r.height * H; setElements(c => c.map(v => v.id === id ? { ...v, x: (sx - bounds.ox) / bounds.scale + bounds.minX, y: (sy - bounds.oy) / bounds.scale + bounds.minY } : v)); }
  function setQuantity(id: string, value: number) { setOverrides(x => ({ ...x, [id]: Math.max(0, Number.isFinite(value) ? value : 0) })); }

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">P</span><span>Potolok Planner</span></div><div className="project-name"><input value={name} onChange={e => setName(e.target.value)} aria-label="Название проекта" /></div><div className="top-actions"><button className="ghost" onClick={() => setShowProjects(v => !v)}>Проекты</button><button className="ghost" onClick={() => setShowClients(v => !v)}>Клиенты</button><button className="ghost" onClick={newProject}>Новый</button><button className="ghost" onClick={exportBackup}>Экспорт</button><button className="ghost" onClick={() => fileRef.current?.click()}>Импорт</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={importBackup} /><button className="ghost" onClick={duplicateCurrent}>Копия</button><button className="ghost" onClick={() => window.print()}>PDF / Печать</button><button className="primary" onClick={saveCurrent}>Сохранить</button></div></header>
    {showProjects && <section className="panel" style={{ margin: '12px 16px', padding: 16 }}><div className="panel-title">Сохранённые проекты</div>{projects.length === 0 ? <div className="muted">Пока нет сохранённых проектов.</div> : projects.map(p => <div key={p.id} className="stat"><button className="ghost" onClick={() => { loadProject(p); setShowProjects(false); }}>{p.name}</button><span>{new Date(p.updatedAt).toLocaleString('ru-RU')}</span><button className="delete-feature" onClick={() => removeProject(p.id)}>Удалить</button></div>)}</section>}
    {showClients && <ClientsPanel clients={clients} projectCounts={clientProjectCounts} onSave={saveClient} onDelete={deleteClient} onClose={() => setShowClients(false)} />}
    <CeilingVariants variants={variants.map(v => v.id === activeVariant ? { ...v, active: true, price: variantPrice } : v)} activeId={activeVariant} onSelect={selectVariant} onDuplicate={duplicateVariant} onAdd={addVariant} onRename={renameVariant} onDelete={deleteVariant} />
    <section className="workspace"><aside className="panel left-panel"><div className="panel-title">Конструктор</div><label>Название<input value={name} onChange={e => setName(e.target.value)} /></label><div className="section-title">Клиент</div><select value={clientId ?? ''} onChange={e => selectClient(e.target.value)} aria-label="Выбрать клиента из базы"><option value="">— Новый / без привязки —</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input placeholder="Имя" value={client.name} onChange={e => setClient({ ...client, name: e.target.value })} /><input placeholder="Телефон" value={client.phone} onChange={e => setClient({ ...client, phone: e.target.value })} /><input placeholder="Адрес" value={client.address} onChange={e => setClient({ ...client, address: e.target.value })} /><button className="ghost" disabled={!client.name.trim()} onClick={saveClientToDatabase} style={{ width: '100%' }}>{clientId ? 'Обновить клиента в базе' : 'Сохранить как клиента'}</button><div className="section-title">Заметки</div><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} /><div className="section-title">Геометрия</div><div className="stat"><span>Площадь</span><strong>{area.toFixed(2)} м²</strong></div><div className="stat"><span>Периметр</span><strong>{perimeter.toFixed(2)} м</strong></div><label className="toggle-row"><input type="checkbox" checked={orthogonalMode} onChange={e => toggleOrthogonalMode(e.target.checked)} /><span>Ортогональная геометрия</span></label>{orthogonalMode && <div className="muted geometry-hint">Стены фиксируются под 90°. Изменение стены синхронизирует противоположную.</div>}<label>Длина стены, мм<input type="number" min="1" step="10" value={Math.round(selectedWallLength)} onChange={e => setWallLength(selectedWall, Number(e.target.value))} /></label><div className="stat"><span>Выбрана стена</span><strong>№ {selectedWall + 1}</strong></div><div className="button-row"><button className="add-button" onClick={addCorner}>＋ Угол</button><button className="delete-button" disabled={points.length <= 3} onClick={() => { if (points.length > 3) setPoints(p => p.filter((_, i) => i !== selectedPoint)); }}>− Угол</button></div><div className="section-title">Элементы потолка</div>{(['spot', 'chandelier', 'cornice'] as ElementType[]).map(type => <button key={type} className="feature" onClick={() => addElement(type)}>＋ {labels[type]}</button>)}{selectedElement !== null && <button className="delete-feature" onClick={() => selectedElement !== null && deleteElement(selectedElement)}>Удалить выбранный элемент</button>}<div className="section-title">Углы</div><div className="angle-list">{points.map((p, i) => <span key={i}>∠{i + 1}: {angleAt(points[(i - 1 + points.length) % points.length], p, points[(i + 1) % points.length]).toFixed(1)}°</span>)}</div></aside>
      <div className="canvas-area"><div className="canvas-toolbar"><span>2D-план · {name} · {variants.find(v => v.id === activeVariant)?.name}</span><span className="muted">Шаг 10 мм · {status}</span></div><div className="drawing-wrap"><svg className="drawing" viewBox={`0 0 ${W} ${H}`} onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)}><defs><pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="currentColor" strokeOpacity=".07" /></pattern></defs><rect width={W} height={H} fill="url(#grid)" /><polygon points={points.map(toSvg).map(p => `${p.x},${p.y}`).join(' ')} className="room" />{showDiagonals && diagonalPairs.map(([i, j]) => { const a = toSvg(points[i]), b = toSvg(points[j]), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; return <g key={`d-${i}-${j}`} pointerEvents="none"><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="diagonal-line" /><text x={m.x} y={m.y - 6} className="diagonal-text" textAnchor="middle">{Math.round(distance(points[i], points[j]))} мм</text></g>; })}{points.map((p, i) => { const n = points[(i + 1) % points.length], a = toSvg(p), b = toSvg(n); const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, nx = signedArea >= 0 ? -dy / len : dy / len, ny = signedArea >= 0 ? dx / len : -dx / len, offset = 28; const da = { x: a.x + nx * offset, y: a.y + ny * offset }, db = { x: b.x + nx * offset, y: b.y + ny * offset }, m = { x: (da.x + db.x) / 2, y: (da.y + db.y) / 2 }; const ux = dx / len, uy = dy / len, arrow = 8; const wallLength = Math.round(distance(p, n)); const isSelected = selectedWall === i; return <g key={i}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={isSelected ? 'wall-hit selected-wall' : 'wall-hit'} onPointerDown={() => { setSelectedWall(i); setSelectedPoint(i); }} /><line x1={a.x} y1={a.y} x2={da.x} y2={da.y} stroke="currentColor" strokeWidth="1" strokeOpacity=".5" pointerEvents="none" /><line x1={b.x} y1={b.y} x2={db.x} y2={db.y} stroke="currentColor" strokeWidth="1" strokeOpacity=".5" pointerEvents="none" /><line x1={da.x} y1={da.y} x2={db.x} y2={db.y} stroke="currentColor" strokeWidth={isSelected ? "2" : "1.5"} strokeOpacity={isSelected ? "0.9" : "0.65"} onClick={() => { setSelectedWall(i); setSelectedPoint(i); }} style={{ cursor: 'pointer' }} /><path d={`M ${da.x} ${da.y} l ${ux * arrow + uy * arrow * 0.5} ${uy * arrow - ux * arrow * 0.5} l ${-ux * arrow * 2} ${-uy * arrow * 2} z M ${db.x} ${db.y} l ${-ux * arrow - uy * arrow * 0.5} ${-uy * arrow + ux * arrow * 0.5} l ${ux * arrow * 2} ${uy * arrow * 2} z`} fill="currentColor" opacity={isSelected ? "0.95" : "0.65"} pointerEvents="none" /><g onClick={() => { setSelectedWall(i); setSelectedPoint(i); }} onDoubleClick={() => beginWallEdit(i)} style={{ cursor: 'pointer' }}><rect x={m.x - 44} y={m.y - 14} width="88" height="28" rx="7" fill="white" fillOpacity=".94" stroke="currentColor" strokeOpacity={isSelected ? ".55" : ".18"} pointerEvents="all" /><text x={m.x} y={m.y + 1} className={isSelected ? 'dimension-text selected-dimension' : 'dimension-text'} textAnchor="middle" dominantBaseline="middle" pointerEvents="none">{wallLength} мм</text></g>{editingWall === i && <foreignObject x={m.x - 48} y={m.y - 18} width="96" height="36"><input autoFocus type="number" min="1" step="10" value={editingWallValue} onChange={e => setEditingWallValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commitWallEdit(); if (e.key === 'Escape') cancelWallEdit(); }} onBlur={commitWallEdit} style={{ width: '96px', height: '36px', boxSizing: 'border-box', border: '2px solid #17191d', borderRadius: '7px', background: '#fff', padding: '4px 7px', textAlign: 'center', fontWeight: 750, fontSize: '14px', outline: 'none' }} /></foreignObject>}<circle cx={a.x} cy={a.y} r={selectedPoint === i ? 10 : 8} className={selectedPoint === i ? 'handle selected' : 'handle'} onPointerDown={e => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); setSelectedPoint(i); setSelectedWall(i); setDragging(i); }} onPointerMove={e => dragging === i && movePoint(i, e)} onPointerUp={e => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} setDragging(null); }} /></g>; })}{elements.map(el => { const p = toSvg(el), sel = selectedElement === el.id; const width = (el.width ?? (el.type === 'spot' ? 120 : el.type === 'chandelier' ? 600 : 1000)) * bounds.scale; const height = (el.height ?? (el.type === 'cornice' ? 80 : el.type === 'chandelier' ? 120 : 120)) * bounds.scale; return <g key={el.id} transform={`translate(${p.x} ${p.y})`} className={`ceiling-element ${sel ? 'selected-element' : ''}`} onPointerDown={e => { e.stopPropagation(); setSelectedElement(el.id); e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => sel && moveElement(el.id, e)} onPointerUp={e => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} }}>{el.type === 'spot' ? <><circle r={Math.max(10, width / 2)} className="spot-symbol" /><circle r={Math.max(3, Math.min(6, height / 16))} className="spot-core" /></> : el.type === 'chandelier' ? <><ellipse rx={Math.max(18, width / 2)} ry={Math.max(18, height / 2)} className="chandelier-symbol" /><path d={`M-${Math.min(12, width / 4)} ${Math.min(18, height / 4)}Q0-${Math.min(14, height / 5)} ${Math.min(12, width / 4)} ${Math.min(18, height / 4)}`} className="chandelier-lines" /></> : <><rect x={-Math.max(40, width / 2)} y={-Math.max(5, height / 2)} width={Math.max(80, width)} height={Math.max(10, height)} rx={Math.max(5, height / 2)} className="cornice-symbol" /><text y={-Math.max(12, height / 2 + 8)} textAnchor="middle" className="element-label">карниз</text></>}</g>; })}<text x={W / 2} y={H / 2 + 8} className="area-text" textAnchor="middle">{area.toFixed(2)} м²</text></svg></div></div>
      <ElementEditor element={selectedElementData} onChange={patch => selectedElement !== null && updateElement(selectedElement, patch)} onDelete={() => selectedElement !== null && deleteElement(selectedElement)} />
      <EstimatePanel catalog={defaultCatalog} quantities={quantities} onQuantityChange={setQuantity} />
    </section>
  </main>;
}
