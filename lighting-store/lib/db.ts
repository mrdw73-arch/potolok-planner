import { neon } from '@neondatabase/serverless';

export function getDb(){
  const url=process.env.DATABASE_URL;
  if(!url) return null;
  return neon(url);
}

export async function ensureCatalogSchema(){
  const sql=getDb();
  if(!sql) return false;
  await sql`
    CREATE TABLE IF NOT EXISTS import_runs (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      found INTEGER NOT NULL DEFAULT 0,
      saved INTEGER NOT NULL DEFAULT 0,
      updated INTEGER NOT NULL DEFAULT 0,
      errors INTEGER NOT NULL DEFAULT 0,
      error_message TEXT NOT NULL DEFAULT '',
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS import_runs_started_at_idx ON import_runs(started_at DESC)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      brand TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price NUMERIC,
      currency TEXT NOT NULL DEFAULT 'RUB',
      stock INTEGER NOT NULL DEFAULT 0,
      stock_text TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      images JSONB NOT NULL DEFAULT '[]'::jsonb,
      specs JSONB NOT NULL DEFAULT '[]'::jsonb,
      attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
      description TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL,
      source_provider TEXT NOT NULL DEFAULT 'Maytoni',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  return true;
}

export async function startImportRun(provider:string,source:string,found:number){
  const sql=getDb();
  if(!sql) return null;
  await ensureCatalogSchema();
  const id=`${provider.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  await sql`INSERT INTO import_runs (id,provider,source,found) VALUES (${id},${provider},${source},${found})`;
  return id;
}

export async function finishImportRun(id:string,data:{status:string,saved:number,updated:number,errors:number,errorMessage?:string}){
  const sql=getDb();
  if(!sql) return false;
  await sql`UPDATE import_runs SET status=${data.status},saved=${data.saved},updated=${data.updated},errors=${data.errors},error_message=${data.errorMessage||''},finished_at=NOW() WHERE id=${id}`;
  return true;
}

export async function upsertProducts(items:any[]){
  const sql=getDb();
  if(!sql) return {saved:0,enabled:false};
  await ensureCatalogSchema();
  let saved=0;
  for(const p of items){
    await sql`
      INSERT INTO products
      (id,sku,brand,name,category,price,currency,stock,stock_text,image,images,specs,attributes,description,source_url,source_provider,updated_at)
      VALUES
      (${p.id},${p.sku},${p.brand||'Maytoni'},${p.name},${p.category||'Подвесные светильники'},${p.price},'RUB',${p.stock||0},${p.stockText||''},${p.image||''},${JSON.stringify(p.images||[])},${JSON.stringify(p.specs||[])},${JSON.stringify(p.attributes||{})},${p.description||''},${p.sourceUrl},${p.brand||'Maytoni'},NOW())
      ON CONFLICT (sku) DO UPDATE SET
        brand=EXCLUDED.brand,name=EXCLUDED.name,category=EXCLUDED.category,price=EXCLUDED.price,
        stock=EXCLUDED.stock,stock_text=EXCLUDED.stock_text,image=EXCLUDED.image,images=EXCLUDED.images,
        specs=EXCLUDED.specs,attributes=EXCLUDED.attributes,description=EXCLUDED.description,
        source_url=EXCLUDED.source_url,source_provider=EXCLUDED.source_provider,updated_at=NOW()
    `;
    saved++;
  }
  return {saved,enabled:true};
}
