'use client';

import { useState } from 'react';
import './workspace.css';

const tools = [
  ['select', '↖', 'Выбор'],
  ['draw', '⌁', 'Контур'],
  ['spot', '○', 'Светильник'],
  ['chandelier', '◉', 'Люстра'],
  ['line', '━', 'Световая линия'],
  ['cornice', '⌒', 'Карниз'],
];

export default function WorkspacePage() {
  const [tool, setTool] = useState('select');
  const [estimateOpen, setEstimateOpen] = useState(true);
  const [grid, setGrid] = useState('25');

  return (
    <main className="workspace">
      <header className="workspace-header">
        <div className="workspace-brand"><strong>Potolok Planner</strong><span>Построитель потолка</span></div>
        <div className="workspace-project"><b>Новая комната</b><span>Вариант: Стандарт</span></div>
        <div className="workspace-actions"><button>Сохранить</button><button>Экспорт PDF</button></div>
      </header>

      <section className="workspace-body">
        <aside className="workspace-left">
          <div className="panel-title">Инструменты</div>
          {tools.map(([id, icon, label]) => (
            <button key={id} className={tool === id ? 'tool active' : 'tool'} onClick={() => setTool(id)}><i>{icon}</i>{label}</button>
          ))}
          <div className="panel-separator" />
          <label className="setting"><span>Сетка</span><select value={grid} onChange={e => setGrid(e.target.value)}><option value="10">10 мм</option><option value="25">25 мм</option><option value="50">50 мм</option><option value="100">100 мм</option></select></label>
          <label className="check"><input type="checkbox" defaultChecked /> Прямые углы</label>
          <label className="check"><input type="checkbox" defaultChecked /> Размеры</label>
          <label className="check"><input type="checkbox" defaultChecked /> Диагонали</label>
          <div className="workspace-help">Используйте CAD-редактор для построения контура. Все размеры можно уточнять непосредственно на чертеже.</div>
        </aside>

        <section className="workspace-canvas">
          <div className="canvas-toolbar"><span>Инструмент: <b>{tools.find(t => t[0] === tool)?.[2]}</b></span><span>Масштаб 1:50</span><a href="/planner-cad">Открыть полный CAD</a></div>
          <iframe title="CAD-построитель потолка" src="/planner-cad" />
        </section>

        <aside className="workspace-right">
          <div className="panel-title">Параметры</div>
          <div className="property"><b>Проект</b><label>Название<input defaultValue="Новая комната" /></label><label>Клиент<input placeholder="Имя клиента" /></label></div>
          <div className="property"><b>Геометрия</b><div className="metric"><span>Площадь</span><strong>— м²</strong></div><div className="metric"><span>Периметр</span><strong>— м.п.</strong></div><div className="metric"><span>Углов</span><strong>—</strong></div></div>
          <div className="property"><b>Выбранный объект</b><p>Выберите стену, точку или элемент на чертеже.</p></div>
          <div className="variants"><div className="panel-title">Варианты</div><button className="variant active">Стандарт <span>›</span></button><button className="add-variant">＋ Добавить вариант</button></div>
        </aside>
      </section>

      <section className={estimateOpen ? 'workspace-estimate open' : 'workspace-estimate'}>
        <button className="estimate-toggle" onClick={() => setEstimateOpen(v => !v)}><span>Смета</span><b>{estimateOpen ? '⌄' : '⌃'}</b></button>
        {estimateOpen && <div className="estimate-content"><div><span>ПВХ полотно</span><b>— м²</b></div><div><span>Профиль</span><b>— м.п.</b></div><div><span>Световые линии</span><b>— м.п.</b></div><div><span>Монтаж</span><b>— м²</b></div><div className="estimate-total"><span>Итого</span><strong>— ₽</strong></div></div>}
      </section>
    </main>
  );
}
