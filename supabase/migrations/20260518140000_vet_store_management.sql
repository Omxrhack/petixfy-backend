-- Vet store management fields.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.store_orders
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz;

CREATE INDEX IF NOT EXISTS products_active_category_idx
  ON public.products (active, category);

CREATE INDEX IF NOT EXISTS store_orders_status_created_idx
  ON public.store_orders (status, created_at DESC);
