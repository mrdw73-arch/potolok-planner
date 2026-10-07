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
  await sql`ALTER TABLE import_runs ADD COLUMN IF NOT EXISTS processed INTEGER NOT NULL DEFAULT 0`;
  await sql`CREATE TABLE IF NOT EXISTS import_run_items (run_id TEXT NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE, position INTEGER NOT NULL, url TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, error_message TEXT NOT NULL DEFAULT '', processed_at TIMESTAMPTZ, PRIMARY KEY (run_id, position))`;
  await sql`CREATE INDEX IF NOT EXISTS import_run_items_status_idx ON import_run_items(run_id,status,position)`;
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
  if(!sql) return {saved:0,updated:0,enabled:false};
  if(!items.length) return {saved:0,updated:0,enabled:true};
  await ensureCatalogSchema();
  const payload=items.map(p=>({
    id:String(p.id||''),
    sku:String(p.sku||''),
    brand:String(p.brand||'Maytoni'),
    name:String(p.name||'Без названия'),
    category:String(p.category||'Декоративный свет'),
    price:typeof p.price==='number'?p.price:null,
    currency:'RUB',
    stock:typeof p.stock==='number'?p.stock:0,
    stock_text:String(p.stockText||''),
    image:String(p.image||''),
    images:p.images||[],
    specs:p.specs||[],
    attributes:p.attributes||{},
    description:String(p.description||''),
    source_url:String(p.sourceUrl||''),
    source_provider:String(p.brand||'Maytoni')
  })).filter(p=>p.sku);

  const result=await sql`
    INSERT INTO products
      (id,sku,brand,name,category,price,currency,stock,stock_text,image,images,specs,attributes,description,source_url,source_provider,updated_at)
    SELECT
      x.id,x.sku,x.brand,x.name,x.category,x.price,x.currency,x.stock,x.stock_text,x.image,
      x.images,x.specs,x.attributes,x.description,x.source_url,x.source_provider,NOW()
    FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS x(
      id text,
      sku text,
      brand text,
      name text,
      category text,
      price numeric,
      currency text,
      stock integer,
      stock_text text,
      image text,
      images jsonb,
      specs jsonb,
      attributes jsonb,
      description text,
      source_url text,
      source_provider text
    )
    ON CONFLICT (sku) DO UPDATE SET
      brand=EXCLUDED.brand,
      name=EXCLUDED.name,
      category=EXCLUDED.category,
      price=EXCLUDED.price,
      stock=EXCLUDED.stock,
      stock_text=EXCLUDED.stock_text,
      image=EXCLUDED.image,
      images=EXCLUDED.images,
      specs=EXCLUDED.specs,
      attributes=EXCLUDED.attributes,
      description=EXCLUDED.description,
      source_url=EXCLUDED.source_url,
      source_provider=EXCLUDED.source_provider,
      updated_at=NOW()
    RETURNING (xmax = 0) AS inserted
  `;

  const updated=result.filter((row:any)=>!row.inserted).length;
  return {saved:result.length,updated,enabled:true};
}

\nexport async function getActiveImportRun(provider:string){\n  const sql=getDb(); if(!sql) return null; await ensureCatalogSchema();\n  const rows=await sql\`SELECT id,provider,source,status,found,saved,updated,errors,processed,error_message,started_at,finished_at FROM import_runs WHERE provider=\${provider} AND status IN ('queued','running') ORDER BY started_at DESC LIMIT 1\`;\n  return rows[0]||null;\n}\n\nexport async function createImportRunWithUrls(provider:string,source:string,urls:string[]){
  const sql=getDb(); if(!sql) return null; await ensureCatalogSchema();
  const id=provider.toLowerCase()+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);
  await sql`INSERT INTO import_runs (id,provider,source,status,found) VALUES (${id},${provider},${source},'queued',${urls.length})`;
  if(urls.length) await sql`INSERT INTO import_run_items (run_id,position,url) SELECT ${id}, (value-1)::int, url FROM jsonb_array_elements_text(${JSON.stringify(urls)}::jsonb) WITH ORDINALITY AS t(url,value)`;
  return id;
}

export async function getImportRun(id:string){
  const sql=getDb(); if(!sql) return null; await ensureCatalogSchema();
  const rows=await sql`SELECT id,provider,source,status,found,saved,updated,errors,processed,error_message,started_at,finished_at FROM import_runs WHERE id=${id} LIMIT 1`;
  return rows[0]||null;
}

export async function getImportBatch(id:string,limit=5){
  const sql=getDb(); if(!sql) return [];
  return await sql`SELECT position,url,attempts FROM import_run_items WHERE run_id=${id} AND status='pending' ORDER BY position LIMIT ${limit}`;
}

export async function markImportBatch(id:string,positions:number[],result:{saved:number;updated:number;errors:number;errorMessage?:string}){
  const sql=getDb(); if(!sql) return false;
  if(positions.length) await sql`UPDATE import_run_items SET status='done',attempts=attempts+1,processed_at=NOW() WHERE run_id=${id} AND position = ANY(${positions}::int[])`;
  await sql`UPDATE import_runs SET processed=processed+${positions.length},saved=saved+${result.saved},updated=updated+${result.updated},errors=errors+${result.errors},error_message=CASE WHEN ${result.errorMessage||''}='' THEN error_message ELSE ${result.errorMessage||''} END WHERE id=${id}`;
  return true;
}
