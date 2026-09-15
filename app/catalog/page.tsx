'use client';

import { useMemo, useState } from 'react';
import { defaultCatalog } from '../../lib/catalog';

export default function CatalogPage() {
  const [items, setItems] = useState(defaultCatalog);
  const [q, setQ] = useState('');
  const filtered = useMemo(() => items.filter(x => x.name.toLowerCase().includes(q.toLowerCase())), [items, q]);
  const total = items.reduce((s, x) => s + x.sellPrice, 0);
  return <main style={{fontFamily:'Inter,system-ui,sans-serif',padding:32,maxWidth:1100,margin:'auto'}}>
    <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:28}}><div><h1 style={{margin:0}}>Каталог</h1><p style={{color:'#737780'}}>Материалы, работы и цены Potolok Planner</p></div><strong>{items.length} позиций</strong></header>
    <div style={{display:'flex',gap:10,marginBottom:18}}><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск по каталогу" style={{flex:1,padding:12,border:'1px solid #dfe2e7',borderRadius:9}}/><button onClick={()=>setItems(v=>[...v,{id:`item-${Date.now()}`,name:'Новая позиция',category:'material',unit:'м.п.',costPrice:0,sellPrice:0}])} style={{padding:'10px 16px',border:0,borderRadius:9,background:'#17191d',color:'#fff',fontWeight:700}}>＋ Добавить</button></div>
    <div style={{border:'1px solid #e3e6ea',borderRadius:12,overflow:'hidden'}}>{filtered.map(item=><div key={item.id} style={{display:'grid',gridTemplateColumns:'2fr .8fr .8fr .8fr .8fr',gap:12,alignItems:'center',padding:'13px 16px',borderBottom:'1px solid #eef0f2'}}><input value={item.name} onChange={e=>setItems(v=>v.map(x=>x.id===item.id?{...x,name:e.target.value}:x))} style={{border:0,fontWeight:650,padding:6}}/><select value={item.unit} onChange={e=>setItems(v=>v.map(x=>x.id===item.id?{...x,unit:e.target.value as typeof item.unit}:x))} style={{padding:7,border:'1px solid #ddd',borderRadius:7}}><option>м²</option><option>м.п.</option><option>шт.</option></select><input type="number" value={item.costPrice} onChange={e=>setItems(v=>v.map(x=>x.id===item.id?{...x,costPrice:Number(e.target.value)}:x))} style={{padding:7,border:'1px solid #ddd',borderRadius:7}}/><input type="number" value={item.sellPrice} onChange={e=>setItems(v=>v.map(x=>x.id===item.id?{...x,sellPrice:Number(e.target.value)}:x))} style={{padding:7,border:'1px solid #ddd',borderRadius:7}}/><button onClick={()=>setItems(v=>v.filter(x=>x.id!==item.id))} style={{border:0,background:'#f3f4f6',borderRadius:7,padding:8}}>Удалить</button></div>)}</div>
    <footer style={{display:'flex',justifyContent:'space-between',marginTop:18,color:'#666'}}><span>Сумма цен за единицу: {Math.round(total).toLocaleString('ru-RU')} ₽</span><span>Изменения применяются к текущему сеансу</span></footer>
  </main>;
}
