import { NextRequest, NextResponse } from 'next/server';

type ImportedProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number | null;
  image: string;
  sourceUrl: string;
  brand: string;
  stock: number;
};

const allowedHost = 'maytoni.ru';

function decode(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/gi, '/')
    .trim();
}

function priceNumber(value: string | undefined) {
  if (!value) return null;
  const n = Number(value.replace(/[^0-9,.-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function parseProducts(html: string, baseUrl: URL): ImportedProduct[] {
  const seen = new Set<string>();
  const result: ImportedProduct[] = [];
  const linkRe = /href=["']([^"']*\/catalog\/[^"']+\/)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRe.exec(html))) {
    const raw = decode(match[1]);
    const url = new URL(raw, baseUrl);
    if (url.hostname !== allowedHost) continue;
    const sourceUrl = url.href.replace(/\/$/, '') + '/';
    if (seen.has(sourceUrl)) continue;

    const pos = match.index;
    const chunk = html.slice(Math.max(0, pos - 5000), Math.min(html.length, pos + 12000));
    const sku = (chunk.match(/Артикул:\s*([A-Z0-9-]{5,})/i)?.[1] || sourceUrl.split('/').filter(Boolean).pop() || '').toUpperCase();
    const title =
      decode(chunk.match(/alt=["']([^"']*(?:светильник|люстра|бра|лампа)[^"']*)["']/i)?.[1] || '') ||
      decode(chunk.match(/<h[1-4][^>]*>([^<]{5,180})<\/h[1-4]>/i)?.[1] || '');

    if (!sku || !title) continue;

    const priceMatch = chunk.match(/([0-9][0-9\s]{2,})\s*₽/);
    const image =
      decode(chunk.match(/(?:src|data-src)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i)?.[1] || '') ||
      decode(chunk.match(/(?:src|data-src)=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i)?.[1] || '');

    result.push({
      id: 'maytoni-' + sku.toLowerCase(),
      sku,
      name: title,
      category: 'Подвесные светильники',
      price: priceNumber(priceMatch?.[1]),
      image: image ? new URL(image, baseUrl).href : '',
      sourceUrl,
      brand: 'Maytoni',
      stock: 0,
    });
    seen.add(sourceUrl);
  }

  return result;
}

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get('url');
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') || '24'), 1), 100);

  if (!input) return NextResponse.json({ error: 'Передайте параметр url.' }, { status: 400 });

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return NextResponse.json({ error: 'Некорректная ссылка.' }, { status: 400 });
  }

  if (url.protocol !== 'https:' || url.hostname !== allowedHost || !url.pathname.startsWith('/catalog/')) {
    return NextResponse.json({ error: 'Для прототипа разрешены только HTTPS-ссылки на разделы Maytoni.ru.' }, { status: 400 });
  }

  try {
    const response = await fetch(url.href, {
      headers: { 'User-Agent': 'LumiHub Catalog Importer/1.0' },
      cache: 'no-store',
    });
    if (!response.ok) {
      return NextResponse.json({ error: `Maytoni вернул HTTP ${response.status}.` }, { status: 502 });
    }

    const html = await response.text();
    const products = parseProducts(html, url);

    return NextResponse.json({
      source: url.href,
      totalDetected: products.length,
      products: products.slice(0, limit),
      note: 'Это первый прототип импорта раздела. Для полного каталога без потерь следующий этап — подключение официального CSV/XML/API Maytoni.',
    });
  } catch {
    return NextResponse.json({ error: 'Не удалось получить страницу Maytoni. Попробуйте позже или используйте официальный CSV.' }, { status: 502 });
  }
}
