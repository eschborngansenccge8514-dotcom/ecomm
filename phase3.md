<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# You are a senior full-stack architect. Generate a complete, exhaustive implementation plan for phase 3. The plan must be detailed enough that a developer (or another AI) can execute each step without ambiguity. Every feature must be broken down to its smallest unit of work.

This is the exhaustive architect-level specification for **Phase 3: Supabase Database Design \& Backend Infrastructure**. Every unit of work is broken down to its smallest executable step.

***

## Scope \& Deliverables

Phase 3 produces a fully configured Supabase backend with zero application code required yet. Deliverables: complete relational schema, all RLS policies, storage buckets, database triggers \& functions, Auth config, Edge Function scaffolding, and environment variable setup.

***

## Step 3.0 — Create the Supabase Project

1. Go to **app.supabase.com** → click **New project**
2. Set **Project name**: `hyperlocal-app`
3. Set **Database password**: generate a strong one and save it in your secrets file
4. Select **Region**: `Southeast Asia (Singapore)` — closest to Malaysia
5. Select plan: **Free** (upgrade later when you go live)
6. Wait ~2 minutes for provisioning to complete
7. Go to **Settings → API** and copy these four values into your secrets file:
    - `Project URL` → save as `SUPABASE_URL`
    - `anon public` key → save as `SUPABASE_ANON_KEY`
    - `service_role` key → save as `SUPABASE_SERVICE_ROLE_KEY`
    - `Project Reference ID` (the slug in your URL) → save as `SUPABASE_PROJECT_REF`

***

## Step 3.1 — Enable Required Extensions

Open **SQL Editor** in the Supabase dashboard. Create a new query, paste and run the following:

```sql
-- UUID generation (usually pre-enabled, but force it)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- For fuzzy search on product names / store names
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- For geolocation / distance-based store discovery
CREATE EXTENSION IF NOT EXISTS "postgis";
```


***

## Step 3.2 — Create ENUM Types

Run this block in SQL Editor. Enums enforce valid values at the database level, removing the need to validate them in application code.

```sql
CREATE TYPE user_role AS ENUM ('customer', 'merchant', 'admin');

CREATE TYPE order_status AS ENUM (
  'pending',         -- order placed, awaiting payment
  'paid',            -- payment confirmed
  'confirmed',       -- merchant accepted the order
  'preparing',       -- merchant is preparing the order
  'ready_for_pickup',-- ready for delivery partner pickup
  'out_for_delivery',-- courier picked up
  'delivered',       -- successfully delivered
  'cancelled',       -- cancelled by customer or merchant
  'refunded'         -- payment refunded
);

CREATE TYPE payment_status AS ENUM (
  'unpaid',
  'pending_verification',
  'paid',
  'failed',
  'refunded'
);

CREATE TYPE payment_method AS ENUM (
  'razorpay',
  'billplz',
  'cod'   -- cash on delivery
);

CREATE TYPE delivery_provider AS ENUM (
  'lalamove',
  'grab_express',
  'easyparcel',
  'self_pickup',
  'merchant_delivery'
);

CREATE TYPE delivery_status AS ENUM (
  'not_requested',
  'pending',
  'finding_driver',
  'driver_assigned',
  'picked_up',
  'in_transit',
  'delivered',
  'failed',
  'returned'
);

CREATE TYPE merchant_status AS ENUM (
  'pending_review', -- just signed up
  'active',         -- approved and live
  'suspended',      -- temporarily disabled by admin
  'deactivated'     -- permanently closed
);

CREATE TYPE product_status AS ENUM (
  'active',
  'inactive',
  'out_of_stock',
  'deleted'
);
```


***

## Step 3.3 — Create the Full Schema

Run each `CREATE TABLE` block individually. Do not run them all at once — if one fails, it's easier to debug.

### Block 3.3.1 — `profiles` (extends Supabase Auth)

```sql
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  phone           TEXT UNIQUE,
  avatar_url      TEXT,
  role            user_role NOT NULL DEFAULT 'customer',
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  device_token    TEXT,           -- for push notifications
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast role lookups
CREATE INDEX idx_profiles_role ON profiles(role);
```


### Block 3.3.2 — `merchants`

```sql
CREATE TABLE merchants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  store_name      TEXT NOT NULL,
  store_slug      TEXT NOT NULL UNIQUE,  -- used in URLs e.g. /stores/my-bakery
  industry        TEXT NOT NULL,         -- 'Food & Beverage', 'Retail', 'Pharmacy', etc.
  description     TEXT,
  logo_url        TEXT,
  banner_url      TEXT,
  phone           TEXT,
  email           TEXT,
  address_line1   TEXT,
  address_line2   TEXT,
  city            TEXT,
  state           TEXT,
  postcode        TEXT NOT NULL,
  country         TEXT NOT NULL DEFAULT 'MY',
  location        GEOGRAPHY(POINT, 4326),  -- PostGIS point: longitude, latitude
  operating_hours JSONB,  -- { "mon": {"open":"09:00","close":"22:00"}, ... }
  min_order_amount NUMERIC(10,2) DEFAULT 0,
  delivery_radius_km NUMERIC(5,2) DEFAULT 10,
  status          merchant_status NOT NULL DEFAULT 'pending_review',
  stripe_account_id TEXT,         -- reserved for future use
  razorpay_account_id TEXT,
  billplz_collection_id TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_merchants_owner ON merchants(owner_id);
CREATE INDEX idx_merchants_status ON merchants(status);
CREATE INDEX idx_merchants_postcode ON merchants(postcode);
CREATE INDEX idx_merchants_location ON merchants USING GIST(location);
CREATE INDEX idx_merchants_store_name_trgm ON merchants USING GIN(store_name gin_trgm_ops);
```


### Block 3.3.3 — `categories`

```sql
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_merchant ON categories(merchant_id);
```


### Block 3.3.4 — `products`

```sql
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id     UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  sku             TEXT,
  price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  compare_at_price NUMERIC(10,2),           -- original price for "was RM X" display
  cost_price      NUMERIC(10,2),            -- merchant's cost, hidden from customers
  images          TEXT[] DEFAULT '{}',      -- array of storage URLs
  stock_quantity  INT NOT NULL DEFAULT 0,
  low_stock_alert INT DEFAULT 5,            -- alert merchant when stock <= this
  track_inventory BOOLEAN DEFAULT TRUE,
  weight_grams    INT,                      -- for EasyParcel shipping calc
  status          product_status NOT NULL DEFAULT 'active',
  is_featured     BOOLEAN DEFAULT FALSE,
  metadata        JSONB DEFAULT '{}',       -- custom fields per industry
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_merchant ON products(merchant_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);
```


### Block 3.3.5 — `product_variants`

```sql
-- Handles sizes, colors, flavors etc.
CREATE TABLE product_variants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,              -- e.g. "Large / Red"
  options       JSONB NOT NULL DEFAULT '{}',-- { "size": "Large", "color": "Red" }
  price_modifier NUMERIC(10,2) DEFAULT 0,   -- added to base product price
  stock_quantity INT NOT NULL DEFAULT 0,
  sku           TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
```


### Block 3.3.6 — `addresses`

```sql
CREATE TABLE addresses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label         TEXT NOT NULL DEFAULT 'Home', -- 'Home', 'Office', 'Other'
  recipient_name TEXT NOT NULL,
  phone         TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  postcode      TEXT NOT NULL,
  country       TEXT NOT NULL DEFAULT 'MY',
  location      GEOGRAPHY(POINT, 4326),
  is_default    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_addresses_user ON addresses(user_id);
```


### Block 3.3.7 — `carts`

```sql
CREATE TABLE carts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  -- Note: one cart per user per merchant
  UNIQUE(user_id, merchant_id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE cart_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id     UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id  UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity    INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  UNIQUE(cart_id, product_id, variant_id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
```


### Block 3.3.8 — `orders`

```sql
CREATE TABLE orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number        TEXT NOT NULL UNIQUE,  -- human-readable e.g. "ORD-2026-00001"
  merchant_id         UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  customer_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status              order_status NOT NULL DEFAULT 'pending',

  -- Pricing breakdown (store snapshot at time of order)
  subtotal            NUMERIC(10,2) NOT NULL,
  delivery_fee        NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount        NUMERIC(10,2) NOT NULL,

  -- Payment
  payment_method      payment_method,
  payment_status      payment_status NOT NULL DEFAULT 'unpaid',
  payment_reference   TEXT,   -- Razorpay/Billplz transaction ID
  paid_at             TIMESTAMPTZ,

  -- Delivery
  delivery_provider   delivery_provider,
  delivery_status     delivery_status NOT NULL DEFAULT 'not_requested',
  delivery_tracking_id TEXT,
  delivery_tracking_url TEXT,
  estimated_delivery  TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,

  -- Addresses snapshot (store the full address in case user changes it later)
  pickup_address      JSONB,    -- merchant's address at time of order
  delivery_address    JSONB,    -- customer's address at time of order

  -- Notes
  customer_note       TEXT,
  merchant_note       TEXT,

  -- Timestamps
  confirmed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_merchant ON orders(merchant_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```


### Block 3.3.9 — `order_items`

```sql
CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id    UUID REFERENCES product_variants(id) ON DELETE SET NULL,

  -- Snapshot fields — critical: store name/price AT TIME OF ORDER
  product_name  TEXT NOT NULL,
  variant_name  TEXT,
  unit_price    NUMERIC(10,2) NOT NULL,
  quantity      INT NOT NULL CHECK (quantity > 0),
  line_total    NUMERIC(10,2) NOT NULL,  -- unit_price * quantity

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
```


### Block 3.3.10 — `delivery_quotes`

```sql
-- Stores delivery quotes fetched during checkout for audit/reference
CREATE TABLE delivery_quotes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  provider        delivery_provider NOT NULL,
  service_type    TEXT,               -- e.g. 'MOTORCYCLE', 'CAR', 'VAN'
  quoted_price    NUMERIC(10,2) NOT NULL,
  currency        TEXT DEFAULT 'MYR',
  distance_km     NUMERIC(8,2),
  estimated_mins  INT,
  raw_response    JSONB,              -- full API response for debugging
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_quotes_order ON delivery_quotes(order_id);
```


### Block 3.3.11 — `payment_logs`

```sql
-- Immutable audit log of every payment event
CREATE TABLE payment_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider      payment_method NOT NULL,
  event_type    TEXT NOT NULL,   -- 'initiated', 'webhook_received', 'confirmed', 'failed'
  amount        NUMERIC(10,2),
  currency      TEXT DEFAULT 'MYR',
  reference     TEXT,
  raw_payload   JSONB,          -- full webhook/callback payload
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_logs_order ON payment_logs(order_id);
```


### Block 3.3.12 — `reviews`

```sql
CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  images      TEXT[] DEFAULT '{}',
  is_visible  BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_merchant ON reviews(merchant_id);
CREATE INDEX idx_reviews_customer ON reviews(customer_id);
```


### Block 3.3.13 — `notifications`

```sql
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL,   -- 'order_update', 'payment', 'delivery', 'promo'
  data        JSONB DEFAULT '{}',
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
```


### Block 3.3.14 — `promo_codes`

```sql
CREATE TABLE promo_codes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id     UUID REFERENCES merchants(id) ON DELETE CASCADE,  -- NULL = platform-wide
  code            TEXT NOT NULL UNIQUE,
  discount_type   TEXT NOT NULL,      -- 'percentage' or 'fixed'
  discount_value  NUMERIC(10,2) NOT NULL,
  min_order       NUMERIC(10,2) DEFAULT 0,
  max_discount    NUMERIC(10,2),      -- cap for percentage discounts
  max_uses        INT,                -- NULL = unlimited
  used_count      INT DEFAULT 0,
  valid_from      TIMESTAMPTZ,
  valid_until     TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```


***

## Step 3.4 — Database Functions \& Triggers

Run these one block at a time.

### Block 3.4.1 — Auto-create profile on Auth signup

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```


### Block 3.4.2 — Auto-update `updated_at` on any row change

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Apply to all tables that have updated_at
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_merchants
  BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_carts
  BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```


### Block 3.4.3 — Auto-generate human-readable order number

```sql
CREATE SEQUENCE order_number_seq START 1000;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                      LPAD(NEXTVAL('order_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION generate_order_number();
```


### Block 3.4.4 — Decrease stock on order confirmed

```sql
CREATE OR REPLACE FUNCTION decrement_stock_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only deduct when order moves to 'confirmed'
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    UPDATE products p
    SET stock_quantity = p.stock_quantity - oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id
      AND p.track_inventory = TRUE;
  END IF;

  -- Restore stock on cancellation
  IF NEW.status = 'cancelled' AND OLD.status = 'confirmed' THEN
    UPDATE products p
    SET stock_quantity = p.stock_quantity + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id
      AND p.track_inventory = TRUE;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER manage_stock_on_order_status
  AFTER UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION decrement_stock_on_order();
```


### Block 3.4.5 — Enforce one default address per user

```sql
CREATE OR REPLACE FUNCTION enforce_single_default_address()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE addresses
    SET is_default = FALSE
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER single_default_address
  BEFORE INSERT OR UPDATE ON addresses
  FOR EACH ROW
  WHEN (NEW.is_default = TRUE)
  EXECUTE FUNCTION enforce_single_default_address();
```


### Block 3.4.6 — Auto-update merchant average rating

```sql
CREATE OR REPLACE FUNCTION refresh_merchant_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add a rating column to merchants first (run this once):
  -- ALTER TABLE merchants ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0;
  -- ALTER TABLE merchants ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 0;

  UPDATE merchants
  SET
    average_rating = (
      SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM reviews
      WHERE merchant_id = NEW.merchant_id AND is_visible = TRUE
    ),
    review_count = (
      SELECT COUNT(*) FROM reviews
      WHERE merchant_id = NEW.merchant_id AND is_visible = TRUE
    )
  WHERE id = NEW.merchant_id;

  RETURN NEW;
END;
$$;

-- First run this ALTER before the trigger:
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS average_rating NUMERIC(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count INT DEFAULT 0;

CREATE TRIGGER update_merchant_rating
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION refresh_merchant_rating();
```


***

## Step 3.5 — Enable Row Level Security (RLS)

### Block 3.5.1 — Enable RLS on all tables

```sql
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories        ENABLE ROW LEVEL SECURITY;
ALTER TABLE products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders            ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_quotes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes       ENABLE ROW LEVEL SECURITY;
```


### Block 3.5.2 — Helper function (avoids repeated joins in every policy)[^1]

```sql
-- Returns the role of the currently authenticated user
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Returns the merchant.id owned by the current user (NULL if none)
CREATE OR REPLACE FUNCTION auth_merchant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM merchants WHERE owner_id = auth.uid() LIMIT 1
$$;
```


### Block 3.5.3 — `profiles` policies

```sql
-- Anyone can read public profile info
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Users can only update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Admins can see all profiles
CREATE POLICY "profiles_admin_all" ON profiles
  USING (auth_user_role() = 'admin');
```


### Block 3.5.4 — `merchants` policies

```sql
-- Public can read active merchants (for browsing)
CREATE POLICY "merchants_public_read" ON merchants
  FOR SELECT USING (status = 'active');

-- Merchant owner can read their own store regardless of status
CREATE POLICY "merchants_owner_read" ON merchants
  FOR SELECT USING (owner_id = auth.uid());

-- Merchant owner can update their own store
CREATE POLICY "merchants_owner_update" ON merchants
  FOR UPDATE USING (owner_id = auth.uid());

-- Any authenticated user can create a merchant (sign up as merchant)
CREATE POLICY "merchants_authenticated_insert" ON merchants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

-- Admins can do everything
CREATE POLICY "merchants_admin_all" ON merchants
  USING (auth_user_role() = 'admin');
```


### Block 3.5.5 — `products` \& `categories` policies

```sql
-- Public can read active products from active merchants
CREATE POLICY "products_public_read" ON products
  FOR SELECT USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM merchants m
      WHERE m.id = merchant_id AND m.status = 'active'
    )
  );

-- Merchant can CRUD their own products
CREATE POLICY "products_merchant_all" ON products
  USING (merchant_id = auth_merchant_id());

CREATE POLICY "products_merchant_insert" ON products
  FOR INSERT WITH CHECK (merchant_id = auth_merchant_id());

-- Same pattern for categories
CREATE POLICY "categories_public_read" ON categories
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM merchants m
      WHERE m.id = merchant_id AND m.status = 'active'
    )
  );

CREATE POLICY "categories_merchant_all" ON categories
  USING (merchant_id = auth_merchant_id());

CREATE POLICY "categories_merchant_insert" ON categories
  FOR INSERT WITH CHECK (merchant_id = auth_merchant_id());
```


### Block 3.5.6 — `orders` policies

```sql
-- Customer can see their own orders
CREATE POLICY "orders_customer_read" ON orders
  FOR SELECT USING (customer_id = auth.uid());

-- Merchant can see orders belonging to their store
CREATE POLICY "orders_merchant_read" ON orders
  FOR SELECT USING (merchant_id = auth_merchant_id());

-- Merchant can update order status
CREATE POLICY "orders_merchant_update" ON orders
  FOR UPDATE USING (merchant_id = auth_merchant_id());

-- Customer can create orders
CREATE POLICY "orders_customer_insert" ON orders
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Order items: visible to customer and the merchant
CREATE POLICY "order_items_customer_read" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
  );

CREATE POLICY "order_items_merchant_read" ON order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.merchant_id = auth_merchant_id())
  );

CREATE POLICY "order_items_customer_insert" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
  );
```


### Block 3.5.7 — `carts`, `addresses`, `notifications` policies

```sql
-- Carts: strict user isolation
CREATE POLICY "carts_owner_all" ON carts USING (user_id = auth.uid());
CREATE POLICY "carts_owner_insert" ON carts FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "cart_items_owner_all" ON cart_items
  USING (EXISTS (SELECT 1 FROM carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));
CREATE POLICY "cart_items_owner_insert" ON cart_items
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM carts c WHERE c.id = cart_id AND c.user_id = auth.uid()));

-- Addresses
CREATE POLICY "addresses_owner_all" ON addresses USING (user_id = auth.uid());
CREATE POLICY "addresses_owner_insert" ON addresses FOR INSERT WITH CHECK (user_id = auth.uid());

-- Notifications
CREATE POLICY "notifications_owner_read" ON notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_owner_update" ON notifications
  FOR UPDATE USING (user_id = auth.uid());
```


### Block 3.5.8 — `payment_logs` \& `delivery_quotes` policies

```sql
-- Payment logs: customer and merchant can read, no one can insert/update (Edge Functions use service_role)
CREATE POLICY "payment_logs_customer_read" ON payment_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
  );

CREATE POLICY "payment_logs_merchant_read" ON payment_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.merchant_id = auth_merchant_id())
  );

-- Delivery quotes: customer reads their own
CREATE POLICY "delivery_quotes_customer_read" ON delivery_quotes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
  );
```


### Block 3.5.9 — `reviews` policies

```sql
-- Public can read visible reviews
CREATE POLICY "reviews_public_read" ON reviews
  FOR SELECT USING (is_visible = TRUE);

-- Customer can insert review for their own delivered order (one review per order enforced by UNIQUE)
CREATE POLICY "reviews_customer_insert" ON reviews
  FOR INSERT WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_id
        AND o.customer_id = auth.uid()
        AND o.status = 'delivered'
    )
  );

-- Customer can update their own review
CREATE POLICY "reviews_customer_update" ON reviews
  FOR UPDATE USING (customer_id = auth.uid());
```


***

## Step 3.6 — Storage Buckets

Go to **Storage → New Bucket** in the Supabase dashboard, or run the following SQL.[^2]

### Block 3.6.1 — Create buckets via SQL

```sql
-- Run via SQL Editor using service role context or Supabase dashboard UI
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars',          'avatars',          TRUE),   -- user profile photos
  ('merchant-assets',  'merchant-assets',  TRUE),   -- logos & banners
  ('product-images',   'product-images',   TRUE),   -- product photos (public)
  ('review-images',    'review-images',    TRUE),   -- customer review photos
  ('private-docs',     'private-docs',     FALSE);  -- KYC docs, invoices (private)
```


### Block 3.6.2 — Storage RLS policies

```sql
-- AVATARS: user uploads/reads only their own folder
CREATE POLICY "avatars_user_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[^1] = auth.uid()::TEXT
  );

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_user_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[^1] = auth.uid()::TEXT
  );

-- MERCHANT ASSETS: merchant uploads to their own merchant_id folder
CREATE POLICY "merchant_assets_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'merchant-assets' AND
    (storage.foldername(name))[^1] = auth_merchant_id()::TEXT
  );

CREATE POLICY "merchant_assets_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'merchant-assets');

CREATE POLICY "merchant_assets_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'merchant-assets' AND
    (storage.foldername(name))[^1] = auth_merchant_id()::TEXT
  );

-- PRODUCT IMAGES: merchant uploads, public reads
CREATE POLICY "product_images_merchant_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-images' AND
    (storage.foldername(name))[^1] = auth_merchant_id()::TEXT
  );

CREATE POLICY "product_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

-- REVIEW IMAGES: customer uploads
CREATE POLICY "review_images_user_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'review-images' AND
    (storage.foldername(name))[^1] = auth.uid()::TEXT
  );

CREATE POLICY "review_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'review-images');
```


***

## Step 3.7 — Configure Supabase Auth

Go to **Authentication → Settings** in the Supabase dashboard and configure:

1. **Site URL**: set to `http://localhost:3000` (change to production URL later)
2. **Redirect URLs**: add `exp://localhost:8081` (Expo dev), `hyperlocal://` (deep link scheme), `https://yourdomain.com`
3. **JWT Expiry**: set to `3600` (1 hour); enable **Refresh Token Rotation**
4. **Email Confirmation**: set to **Required** (prevents fake signups)
5. Go to **Email Templates** and customize the confirm email and password reset templates with your brand name
6. Under **Providers**, enable:
    - **Email** (already on by default)
    - **Phone/OTP** via Twilio (optional but recommended for Malaysia)
    - **Google** OAuth (merchants benefit from this) — requires Google Cloud Console credentials

***

## Step 3.8 — Scaffold Edge Functions

Install the Supabase CLI on your machine:

```bash
npm install -g supabase
supabase login   # opens browser, authenticate
supabase init    # run inside your project root
supabase link --project-ref YOUR_PROJECT_REF
```

Create the function scaffold for all 8 Edge Functions needed:

```bash
supabase functions new payment-razorpay-create
supabase functions new payment-razorpay-webhook
supabase functions new payment-billplz-create
supabase functions new payment-billplz-callback
supabase functions new delivery-lalamove-quote
supabase functions new delivery-lalamove-order
supabase functions new delivery-grabexpress-order
supabase functions new delivery-easyparcel-rates
```

This creates a `supabase/functions/` folder with one `index.ts` per function. Each will be implemented in Phase 5 and 6.

***

## Step 3.9 — Set All Environment Variable Secrets[^3]

Run these in your terminal, replacing placeholder values with real ones from your secrets file:

```bash
supabase secrets set \
  RAZORPAY_KEY_ID=rzp_test_XXXX \
  RAZORPAY_KEY_SECRET=XXXX \
  BILLPLZ_API_KEY=XXXX \
  BILLPLZ_X_SIGNATURE=XXXX \
  BILLPLZ_COLLECTION_ID=XXXX \
  LALAMOVE_API_KEY=XXXX \
  LALAMOVE_API_SECRET=XXXX \
  LALAMOVE_MARKET=MY \
  GRAB_CLIENT_ID=XXXX \
  GRAB_CLIENT_SECRET=XXXX \
  EASYPARCEL_API_KEY=XXXX \
  APP_URL=http://localhost:3000 \
  --project-ref YOUR_PROJECT_REF
```

Verify they are saved:

```bash
supabase secrets list --project-ref YOUR_PROJECT_REF
```


***

## Step 3.10 — Enable Realtime

Go to **Database → Replication** in the dashboard and enable Realtime for these tables only (enabling all tables is wasteful):

- ✅ `orders` — customer and merchant both need live status updates
- ✅ `order_items` — merchant kitchen display
- ✅ `notifications` — live notification bell
- ✅ `delivery_quotes` — show delivery price updates in realtime

Leave all other tables with Realtime off.

***

## Step 3.11 — Verification Checklist

Run each query in the SQL Editor to verify the schema is correct before moving to Phase 4:

```sql
-- 1. Verify all tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
-- Expected: 15 tables

-- 2. Verify all ENUM types exist
SELECT typname FROM pg_type WHERE typtype = 'e';
-- Expected: 8 enums

-- 3. Verify triggers are registered
SELECT trigger_name, event_object_table FROM information_schema.triggers
WHERE trigger_schema = 'public' ORDER BY event_object_table;

-- 4. Test profile auto-creation trigger by inserting a test auth user
-- (Do this via Authentication → Users → Add user in dashboard)
-- Then check:
SELECT * FROM profiles;
-- Should show the new user automatically

-- 5. Verify RLS is enabled on all tables
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = FALSE;
-- This should return ZERO rows (all tables must have RLS ON)

-- 6. Verify helper functions work
SELECT auth_user_role();  -- Will return NULL if not authenticated, that's correct
```


***

## Phase 3 Completion Criteria

Phase 3 is **complete and ready for Phase 4** when ALL of the following are true:

- [ ] SQL Editor shows 15 tables in the `public` schema
- [ ] `pg_tables` query returns **zero** rows with `rowsecurity = FALSE`
- [ ] Creating a test user in Auth dashboard creates a corresponding `profiles` row automatically
- [ ] Inserting a test order triggers the `ORD-YYYY-NNNNN` format order number
- [ ] All 3 storage buckets are visible in the Storage tab
- [ ] `supabase secrets list` shows all 12 secrets
- [ ] All 8 Edge Function folders exist under `supabase/functions/`
- [ ] Realtime is enabled for `orders`, `order_items`, `notifications`, `delivery_quotes`

***

Phase 4 will consume this schema directly — every table, column name, and RLS policy written here is the exact contract the application code will depend on. Do not rename anything after Phase 3 is locked.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://makerkit.dev/blog/tutorials/supabase-rls-best-practices

[^2]: https://supabase.com/docs/guides/storage/security/access-control

[^3]: https://supabase.com/docs/guides/functions/secrets

[^4]: https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/

[^5]: https://github.com/orgs/community/discussions/149922

[^6]: https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2

[^7]: https://www.stacksync.com/blog/supabase-multi-tenancy-crm-integration

[^8]: https://www.iloveblogs.blog/guides/nextjs-supabase-multi-tenant-saas-architecture

[^9]: https://www.reddit.com/r/Supabase/comments/16e3hxi/how_to_create_rls_policy_for_storage_based_on/

[^10]: https://www.youtube.com/watch?v=4CYVy4hlVV0

[^11]: https://supabase.com/docs/guides/database/postgres/row-level-security

[^12]: https://dev.to/asheeshh/mastering-supabase-rls-row-level-security-as-a-beginner-5175

[^13]: https://supabase.com/docs/guides/troubleshooting/inspecting-edge-function-environment-variables-wg5qOQ

[^14]: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv

[^15]: https://vault.nimc.gov.ng/blog/mastering-rls-for-supabase-storage-1764804542

