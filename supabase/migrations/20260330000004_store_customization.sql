-- ── Extend merchants table ────────────────────────────────────────────────
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS store_type   text         NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS appearance   jsonb        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS store_config jsonb        NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS store_slug   text         UNIQUE,  -- e.g. "mamas-kitchen"
  ADD COLUMN IF NOT EXISTS is_published boolean      DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_slug ON merchants(store_slug) WHERE store_slug IS NOT NULL;

-- ── Product custom attributes (store-type fields per product) ─────────────
CREATE TABLE IF NOT EXISTS product_custom_attributes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  merchant_id   uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  key           text NOT NULL,
  value         text,
  display_label text,
  sort_order    int  DEFAULT 0,
  UNIQUE (product_id, key)
);
CREATE INDEX IF NOT EXISTS idx_pca_product  ON product_custom_attributes(product_id);
CREATE INDEX IF NOT EXISTS idx_pca_merchant ON product_custom_attributes(merchant_id);
ALTER TABLE product_custom_attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant manages own product attributes"
  ON product_custom_attributes FOR ALL TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE owner_id = auth.uid()));

-- ── Operating hours ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS merchant_operating_hours (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  day_of_week int  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun
  open_time   time,
  close_time  time,
  is_closed   boolean DEFAULT false,
  UNIQUE (merchant_id, day_of_week)
);
ALTER TABLE merchant_operating_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant manages own hours"
  ON merchant_operating_hours FOR ALL TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE owner_id = auth.uid()));

-- ── Store announcements (scheduled banners) ───────────────────────────────
CREATE TABLE IF NOT EXISTS store_announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  message     text NOT NULL,
  type        text NOT NULL DEFAULT 'info',   -- info|promo|warning|holiday
  bg_color    text DEFAULT '#2563eb',
  text_color  text DEFAULT '#ffffff',
  link_url    text,
  link_text   text,
  is_active   boolean DEFAULT true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  sort_order  int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE store_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant manages own announcements"
  ON store_announcements FOR ALL TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE owner_id = auth.uid()));

-- ── Delivery zones ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_zones (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id          uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  zone_name            text NOT NULL,
  states               text[]    DEFAULT '{}',    -- ['Selangor','Kuala Lumpur']
  postcodes            text[]    DEFAULT '{}',    -- specific postcodes override
  delivery_fee         numeric   NOT NULL DEFAULT 0,
  free_delivery_above  numeric,                   -- NULL = never free
  min_order_amount     numeric   DEFAULT 0,
  estimated_days       text,                      -- '1-2 days', 'Same day'
  is_active            boolean   DEFAULT true,
  sort_order           int       DEFAULT 0
);
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchant manages own zones"
  ON delivery_zones FOR ALL TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE owner_id = auth.uid()));

-- ── Seed default operating hours when merchant is created ─────────────────
CREATE OR REPLACE FUNCTION seed_default_hours()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO merchant_operating_hours (merchant_id, day_of_week, open_time, close_time, is_closed)
  SELECT NEW.id, gs, '09:00', '22:00', (gs = 0) -- Sunday closed by default
  FROM generate_series(0, 6) gs
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_seed_hours ON merchants;
CREATE TRIGGER trg_seed_hours AFTER INSERT ON merchants
  FOR EACH ROW EXECUTE FUNCTION seed_default_hours();

-- ── RPC: get_store_config (customer-facing, public) ──────────────────
CREATE OR REPLACE FUNCTION get_store_config(p_slug text)
RETURNS TABLE (
  merchant_id   uuid,
  store_name    text,
  store_type    text,
  appearance    jsonb,
  store_config  jsonb,
  is_published  boolean,
  operating_hours jsonb,
  active_announcement jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    m.id,
    m.store_name,
    m.store_type,
    m.appearance,
    m.store_config,
    m.is_published,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'day', h.day_of_week, 'open', h.open_time::text,
        'close', h.close_time::text, 'is_closed', h.is_closed
      ) ORDER BY h.day_of_week)
      FROM merchant_operating_hours h WHERE h.merchant_id = m.id
    ), '[]'::jsonb) AS operating_hours,
    (
      SELECT jsonb_build_object(
        'message', a.message, 'type', a.type,
        'bg_color', a.bg_color, 'text_color', a.text_color,
        'link_url', a.link_url, 'link_text', a.link_text
      )
      FROM store_announcements a
      WHERE a.merchant_id = m.id AND a.is_active = true
        AND (a.starts_at IS NULL OR a.starts_at <= NOW())
        AND (a.ends_at   IS NULL OR a.ends_at   >= NOW())
      ORDER BY a.sort_order LIMIT 1
    ) AS active_announcement
  FROM merchants m
  WHERE m.store_slug = p_slug AND m.is_published = true;
$$;
