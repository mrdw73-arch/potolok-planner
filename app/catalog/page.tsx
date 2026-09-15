'use client';

import { useEffect, useState } from 'react';
import CatalogEditor from '../components/CatalogEditor';
import type { CatalogItem } from '../../lib/catalog';
import { loadCatalog } from '../../lib/catalog-store';
import '../planner/planner.css';

export default function CatalogPage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  useEffect(() => setCatalog(loadCatalog()), []);
  return <main className="planner-page" style={{ minHeight: '100vh', padding: 28 }}>
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <div className="planner-header" style={{ border: '1px solid #e5e7eb', borderRadius: 14, marginBottom: 18 }}>
        <div className="planner-brand"><div className="planner-logo">P</div><div><strong>Potolok Planner</strong><span>Каталог материалов и работ</span></div></div>
      </div>
      <CatalogEditor catalog={catalog} onChange={setCatalog} />
    </div>
  </main>;
}
