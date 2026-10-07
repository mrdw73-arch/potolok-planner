"use client";

import { useEffect, useMemo, useState } from "react";
import { products, categories, Product } from "../lib/catalog";

const money = (value: number, currency = "RUB") =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

function ProductCard({ product, add }: { product: Product; add: () => void }) {
  return (
    <article className="product">
      <div className="photo">
        <img src={product.image} alt={product.name} />
        <span>{product.stock > 0 ? "В наличии" : "Под заказ"}</span>
      </div>
      <div className="product-body">
        <small>{product.brand} · {product.sku}</small>
        <h3>{product.name}</h3>
        <div className="specs">
          {product.specs.map((spec) => <span key={spec}>{spec}</span>)}
        </div>
        <div className="price-row">
          <strong>{money(product.price, (product as Product & { currency?: string }).currency || "RUB")}</strong>
          <button onClick={add}>В корзину</button>
        </div>
      </div>
    </article>
  );
}

function Imports() {
  const [url, setUrl] = useState("https://maytoni.ru/catalog/decorative/");
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const refreshRuns = async () => {
    const response = await fetch("/api/import/runs", { cache: "no-store" });
    const data = await response.json();
    setRuns(data.runs || []);
    const current = (data.runs || []).find((run: Record<string, unknown>) => String(run.id) === activeRunId);
    if (current && ["completed", "failed", "cancelled"].includes(String(current.status))) {
      setActiveRunId(null);
      setMessage("Импорт завершён: " + String(current.status));
    }
  };

  useEffect(() => {
    void refreshRuns();
  }, []);

  useEffect(() => {
    if (!activeRunId) return;
    const timer = window.setInterval(() => {
      void refreshRuns();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [activeRunId]);

  const runTestImport = async () => {
    setSyncing(true);
    setMessage("Синхронизируем тестовые товары Maytoni…");
    try {
      const slugs = [
        "mod514pl-l15w3k", "mod491pl-l17b3k", "mod520pl-01bs",
        "mod520pl-10bs", "mod516pl-l5bs3k", "mod516pl-l5pt3k",
        "mod538pl-05mg", "mod538pl-09mg", "mod539pl-01mg", "mod539pl-03mg",
      ];
      const urls = slugs.map((slug) =>
        "https://maytoni.ru/catalog/decorative/podvesy/" + slug + "/"
      );
      const response = await fetch("/api/import/maytoni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Ошибка синхронизации");
      setMessage("✓ Получено товаров: " + Number(data.imported || 0) + " из 10.");
      await refreshRuns();
      window.dispatchEvent(new CustomEvent("lumihub-import"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка синхронизации");
    } finally {
      setSyncing(false);
    }
  };

  const startFullImport = async () => {
    setSyncing(true);
    setMessage("Запускаем фоновый импорт Maytoni…");
    try {
      const response = await fetch("/api/import/maytoni/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Не удалось запустить импорт");
      setActiveRunId(String(data.runId || ""));
      setMessage("✓ Workflow запущен: " + Number(data.found || 0) + " товаров. Статус обновляется автоматически.");
      await refreshRuns();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка запуска импорта");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="imports">
      <div className="import-head">
        <div>
          <span className="pill">MAYTONI · АВТОМАТИЧЕСКИЙ ИМПОРТ</span>
          <h2>Синхронизация каталога</h2>
          <p>Импорт выполняется сервером и сохраняется в PostgreSQL.</p>
        </div>
      </div>

      <div className="sync-box">
        <div>
          <strong>Проверка 10 товаров</strong>
          <span>Фото, характеристики, цена и наличие.</span>
        </div>
        <button className="dark" disabled={syncing} onClick={runTestImport}>
          {syncing ? "Загрузка…" : "Синхронизировать 10 товаров"}
        </button>
      </div>

      <div className="sync-box full-sync">
        <div>
          <strong>Полный импорт раздела</strong>
          <span>Durable Workflow обрабатывает каталог пакетами.</span>
        </div>
        <button className="dark" disabled={syncing} onClick={startFullImport}>
          Импортировать весь раздел
        </button>
      </div>

      <div className="url-import">
        <input value={url} onChange={(event) => setUrl(event.target.value)} />
      </div>

      {message && <div className="import-success">{message}</div>}

      <div className="sync-box">
        <div>
          <strong>Журнал импорта</strong>
          <span>Последние операции из PostgreSQL.</span>
        </div>
        <button className="outline" onClick={() => void refreshRuns()}>Обновить</button>
      </div>

      <div className="preview">
        <div className="preview-table">
          <table>
            <thead>
              <tr>
                <th>Источник</th>
                <th>Найдено</th>
                <th>Обработано</th>
                <th>Сохранено</th>
                <th>Обновлено</th>
                <th>Ошибки</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 10).map((run) => (
                <tr key={String(run.id)}>
                  <td>{String(run.provider || "")}</td>
                  <td>{String(run.found || 0)}</td>
                  <td>{String(run.processed || 0)}</td>
                  <td>{String(run.saved || 0)}</td>
                  <td>{String(run.updated || 0)}</td>
                  <td>{String(run.errors || 0)}</td>
                  <td>{String(run.status || "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [tab, setTab] = useState<"catalog" | "imports">("catalog");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Все категории");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [dbEnabled, setDbEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/products", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!data.enabled) return;
        setDbEnabled(true);
        setDbProducts((data.products || []).map((item: Record<string, unknown>) => ({
          id: String(item.id || ""),
          sku: String(item.sku || ""),
          name: String(item.name || ""),
          brand: String(item.brand || ""),
          category: String(item.category || ""),
          price: Number(item.price || 0),
          currency: String(item.currency || "RUB"),
          stock: Number(item.stock || 0),
          image: String(item.image || ""),
          specs: Array.isArray(item.specs) ? item.specs.map(String) : [],
          sourceUrl: String(item.source_url || ""),
        })));
      })
      .catch(() => undefined);
  }, []);

  const allProducts = useMemo(() => {
    const source = dbProducts.length ? dbProducts : products;
    return source.filter((item, index, list) =>
      list.findIndex((candidate) => candidate.sku === item.sku) === index
    );
  }, [dbProducts]);

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase();
    return allProducts.filter((item) =>
      (category === "Все категории" || item.category === category) &&
      (item.name + " " + item.brand + " " + item.sku).toLowerCase().includes(normalized)
    );
  }, [allProducts, category, query]);

  const count = Object.values(cart).reduce((sum, value) => sum + value, 0);

  return (
    <div className="shell">
      <aside>
        <div className="logo">
          <span>LH</span>
          <div><b>LumiHub</b><small>освещение</small></div>
        </div>
        <nav>
          <button className={tab === "catalog" ? "active" : ""} onClick={() => setTab("catalog")}>◈ Каталог</button>
          <button className={tab === "imports" ? "active" : ""} onClick={() => setTab("imports")}>↥ Импорт товаров</button>
          <button>▦ Бренды</button>
          <button>◇ Заказы</button>
          <button>⚙ Настройки</button>
        </nav>
        <div className="aside-note">
          <b>Автоматический каталог</b>
          <span>Цены, наличие и характеристики можно обновлять из источников поставщиков.</span>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <p className="eyebrow">ПАНЕЛЬ УПРАВЛЕНИЯ</p>
            <h1>{tab === "catalog" ? "Каталог освещения" : "Импорт и поставщики"}</h1>
          </div>
          <div className="header-actions">
            <button className="outline">Заказы <i>{count}</i></button>
          </div>
        </header>

        {tab === "imports" ? (
          <Imports />
        ) : (
          <>
            <section className="hero">
              <div>
                <span className="pill">MVP · ЕДИНЫЙ КАТАЛОГ</span>
                <h2>Тысячи товаров.<br /><em>Один магазин.</em></h2>
                <p>Единая витрина для товаров разных производителей.</p>
              </div>
              <div className="hero-stat">
                <strong>{allProducts.length.toLocaleString("ru-RU")}</strong>
                <span>товаров в каталоге</span>
                <small>{dbEnabled ? "✓ данные из PostgreSQL" : "локальный каталог"}</small>
              </div>
            </section>

            <section className="toolbar">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию, артикулу или бренду…" />
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option>Все категории</option>
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </section>

            <section className="grid">
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  add={() => setCart((current) => ({
                    ...current,
                    [product.id]: (current[product.id] || 0) + 1,
                  }))}
                />
              ))}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
