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
);

CREATE INDEX IF NOT EXISTS products_brand_idx ON products(brand);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
CREATE INDEX IF NOT EXISTS products_updated_at_idx ON products(updated_at);


CREATE TABLE IF NOT EXISTS import_runs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  found INTEGER NOT NULL DEFAULT 0,
  saved INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NOT NULL DEFAULT '',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS import_runs_started_at_idx ON import_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS import_run_items (
  run_id TEXT NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NOT NULL DEFAULT '',
  processed_at TIMESTAMPTZ,
  PRIMARY KEY (run_id, position)
);
CREATE INDEX IF NOT EXISTS import_run_items_status_idx ON import_run_items(run_id,status,position);
