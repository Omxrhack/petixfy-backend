-- Store MVP: authenticated orders without payment provider.

DO $$
BEGIN
  CREATE TYPE public.store_order_status AS ENUM (
    'pending_confirmation',
    'confirmed',
    'cancelled',
    'fulfilled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.store_fulfillment_method AS ENUM (
    'delivery',
    'pickup_contact'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.store_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status public.store_order_status NOT NULL DEFAULT 'pending_confirmation',
  fulfillment_method public.store_fulfillment_method NOT NULL,
  delivery_address_text text,
  contact_name text,
  contact_phone text,
  notes text,
  subtotal_mxn numeric(12, 2) NOT NULL DEFAULT 0,
  total_mxn numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.store_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.store_orders (id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_category text,
  unit_price_mxn numeric(12, 2) NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total_mxn numeric(12, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_orders_owner_created_idx
  ON public.store_orders (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS store_order_items_order_idx
  ON public.store_order_items (order_id);

DROP TRIGGER IF EXISTS store_orders_set_updated_at ON public.store_orders;
CREATE TRIGGER store_orders_set_updated_at
  BEFORE UPDATE ON public.store_orders
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_orders_select_own ON public.store_orders;
CREATE POLICY store_orders_select_own
  ON public.store_orders
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS store_order_items_select_own ON public.store_order_items;
CREATE POLICY store_order_items_select_own
  ON public.store_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.store_orders o
      WHERE o.id = store_order_items.order_id
        AND o.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.create_store_order(
  p_fulfillment_method public.store_fulfillment_method,
  p_items jsonb,
  p_delivery_address_text text DEFAULT NULL,
  p_contact_name text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_order_id uuid;
  v_item jsonb;
  v_product record;
  v_product_id uuid;
  v_quantity integer;
  v_subtotal numeric(12, 2) := 0;
  v_line_total numeric(12, 2);
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order must include at least one item';
  END IF;

  IF p_fulfillment_method = 'delivery'
     AND COALESCE(NULLIF(trim(p_delivery_address_text), ''), '') = '' THEN
    RAISE EXCEPTION 'delivery_address_text is required for delivery orders';
  END IF;

  IF p_fulfillment_method = 'pickup_contact'
     AND COALESCE(NULLIF(trim(p_contact_phone), ''), '') = '' THEN
    RAISE EXCEPTION 'contact_phone is required for pickup/contact orders';
  END IF;

  INSERT INTO public.store_orders (
    owner_id,
    fulfillment_method,
    delivery_address_text,
    contact_name,
    contact_phone,
    notes
  )
  VALUES (
    v_owner,
    p_fulfillment_method,
    NULLIF(trim(COALESCE(p_delivery_address_text, '')), ''),
    NULLIF(trim(COALESCE(p_contact_name, '')), ''),
    NULLIF(trim(COALESCE(p_contact_phone, '')), ''),
    NULLIF(trim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := COALESCE((v_item->>'quantity')::integer, 0);

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for product %', v_product_id;
    END IF;

    SELECT id, name, category, price, stock
      INTO v_product
      FROM public.products
      WHERE id = v_product_id
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_product_id;
    END IF;

    IF v_product.stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for %', v_product.name;
    END IF;

    UPDATE public.products
      SET stock = stock - v_quantity
      WHERE id = v_product_id;

    v_line_total := ROUND((v_product.price * v_quantity)::numeric, 2);
    v_subtotal := v_subtotal + v_line_total;

    INSERT INTO public.store_order_items (
      order_id,
      product_id,
      product_name,
      product_category,
      unit_price_mxn,
      quantity,
      line_total_mxn
    )
    VALUES (
      v_order_id,
      v_product_id,
      v_product.name,
      v_product.category,
      v_product.price,
      v_quantity,
      v_line_total
    );

    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product_id,
        'product_name', v_product.name,
        'product_category', v_product.category,
        'unit_price_mxn', v_product.price,
        'quantity', v_quantity,
        'line_total_mxn', v_line_total
      )
    );
  END LOOP;

  UPDATE public.store_orders
    SET subtotal_mxn = v_subtotal,
        total_mxn = v_subtotal
    WHERE id = v_order_id;

  RETURN (
    SELECT jsonb_build_object(
      'id', o.id,
      'owner_id', o.owner_id,
      'status', o.status,
      'fulfillment_method', o.fulfillment_method,
      'delivery_address_text', o.delivery_address_text,
      'contact_name', o.contact_name,
      'contact_phone', o.contact_phone,
      'notes', o.notes,
      'subtotal_mxn', o.subtotal_mxn,
      'total_mxn', o.total_mxn,
      'created_at', o.created_at,
      'items', v_items
    )
    FROM public.store_orders o
    WHERE o.id = v_order_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_store_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid := auth.uid();
  v_order public.store_orders%ROWTYPE;
  v_item record;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT *
    INTO v_order
    FROM public.store_orders
    WHERE id = p_order_id
      AND owner_id = v_owner
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status <> 'pending_confirmation' THEN
    RAISE EXCEPTION 'Only pending orders can be cancelled';
  END IF;

  FOR v_item IN
    SELECT product_id, quantity
    FROM public.store_order_items
    WHERE order_id = p_order_id
      AND product_id IS NOT NULL
  LOOP
    UPDATE public.products
      SET stock = stock + v_item.quantity
      WHERE id = v_item.product_id;
  END LOOP;

  UPDATE public.store_orders
    SET status = 'cancelled',
        cancelled_at = now()
    WHERE id = p_order_id
    RETURNING * INTO v_order;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'status', v_order.status,
    'cancelled_at', v_order.cancelled_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_store_order(
  public.store_fulfillment_method,
  jsonb,
  text,
  text,
  text,
  text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.cancel_store_order(uuid) TO authenticated;
