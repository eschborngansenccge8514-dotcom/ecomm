<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Since there are multiple merchant selling different products, we need the stores to be able to fit what they selling.

Here is the complete Store Customization system — SQL, settings dashboard, type-specific product fields, and a runtime CSS variable engine for the customer-facing storefront.[^1][^2][^3]

***

## Step 1 — `src/lib/store-types.ts`

```typescript
// ─── Store type registry ─────────────────────────────────────────────────────
export const STORE_TYPES = {
  general:     { label: 'General Retail',      icon: '🛍️', color: '#2563eb', desc: 'Everyday products, gifts, multi-category'       },
  food:        { label: 'Food & Beverage',      icon: '🍜', color: '#dc2626', desc: 'Restaurant, café, bakery, cloud kitchen'          },
  fashion:     { label: 'Fashion & Apparel',    icon: '👗', color: '#7c3aed', desc: 'Clothing, shoes, accessories, jewelry'            },
  electronics: { label: 'Electronics & Gadgets',icon: '📱', color: '#0891b2', desc: 'Phones, laptops, accessories, appliances'         },
  beauty:      { label: 'Beauty & Health',      icon: '💄', color: '#be185d', desc: 'Skincare, makeup, wellness, supplements'          },
  home:        { label: 'Home & Living',        icon: '🏠', color: '#059669', desc: 'Furniture, décor, kitchen, garden'               },
  groceries:   { label: 'Groceries & Fresh',    icon: '🥦', color: '#65a30d', desc: 'Supermarket, wet market, organic produce'        },
  services:    { label: 'Services',             icon: '🛠️', color: '#d97706', desc: 'Appointments, consultations, bookings'           },
} as const

export type StoreType = keyof typeof STORE_TYPES

// ─── Type-specific product fields ────────────────────────────────────────────
export const TYPE_PRODUCT_FIELDS: Record<StoreType, {
  key: string; label: string; type: 'text'|'number'|'select'|'toggle'|'tags'; options?: string[]
}[]> = {
  general: [],
  food: [
    { key: 'prep_time_mins',  label: 'Prep Time (mins)',  type: 'number'                                               },
    { key: 'calories',        label: 'Calories (kcal)',   type: 'number'                                               },
    { key: 'spice_level',     label: 'Spice Level',       type: 'select', options: ['None','Mild','Medium','Hot','Extra Hot'] },
    { key: 'dietary_tags',    label: 'Dietary Tags',      type: 'tags'                                                 },
    { key: 'allergens',       label: 'Allergens',         type: 'tags'                                                 },
    { key: 'is_halal',        label: 'Halal Certified',   type: 'toggle'                                               },
    { key: 'is_vegetarian',   label: 'Vegetarian',        type: 'toggle'                                               },
  ],
  fashion: [
    { key: 'material',        label: 'Material',          type: 'text'                                                 },
    { key: 'fit_type',        label: 'Fit Type',          type: 'select', options: ['Slim','Regular','Relaxed','Oversized'] },
    { key: 'size_system',     label: 'Size System',       type: 'select', options: ['MY','US','UK','EU','Free Size']   },
    { key: 'gender',          label: 'Gender',            type: 'select', options: ['Unisex','Men','Women','Boys','Girls','Kids'] },
    { key: 'care_instructions',label: 'Care Instructions',type: 'text'                                                 },
    { key: 'country_of_origin',label: 'Country of Origin',type: 'text'                                                 },
  ],
  electronics: [
    { key: 'brand',           label: 'Brand',             type: 'text'                                                 },
    { key: 'model_number',    label: 'Model Number',      type: 'text'                                                 },
    { key: 'warranty_months', label: 'Warranty (months)', type: 'number'                                               },
    { key: 'compatibility',   label: 'Compatibility',     type: 'text'                                                 },
    { key: 'in_box',          label: 'In The Box',        type: 'tags'                                                 },
    { key: 'specifications',  label: 'Key Specifications',type: 'text'                                                 },
    { key: 'is_original',     label: 'Original Product',  type: 'toggle'                                               },
  ],
  beauty: [
    { key: 'skin_type',       label: 'Skin Type',         type: 'tags'                                                 },
    { key: 'ingredients',     label: 'Key Ingredients',   type: 'text'                                                 },
    { key: 'spf',             label: 'SPF',               type: 'number'                                               },
    { key: 'volume_ml',       label: 'Volume (ml)',        type: 'number'                                               },
    { key: 'expiry_months',   label: 'Shelf Life (months)',type: 'number'                                               },
    { key: 'usage_steps',     label: 'How to Use',        type: 'text'                                                 },
    { key: 'is_cruelty_free', label: 'Cruelty-Free',      type: 'toggle'                                               },
  ],
  home: [
    { key: 'dimensions',      label: 'Dimensions (L×W×H cm)', type: 'text'                                            },
    { key: 'weight_kg',       label: 'Weight (kg)',        type: 'number'                                               },
    { key: 'material',        label: 'Material',           type: 'text'                                                 },
    { key: 'room_type',       label: 'Room Type',          type: 'tags'                                                 },
    { key: 'assembly_required',label: 'Assembly Required', type: 'toggle'                                               },
    { key: 'colour_options',  label: 'Colour Options',     type: 'tags'                                                 },
  ],
  groceries: [
    { key: 'weight_g',        label: 'Net Weight (g)',     type: 'number'                                               },
    { key: 'expiry_days',     label: 'Shelf Life (days)',  type: 'number'                                               },
    { key: 'storage_type',    label: 'Storage',            type: 'select', options: ['Ambient','Refrigerated','Frozen'] },
    { key: 'allergens',       label: 'Allergens',          type: 'tags'                                                 },
    { key: 'is_organic',      label: 'Organic',            type: 'toggle'                                               },
    { key: 'is_halal',        label: 'Halal Certified',    type: 'toggle'                                               },
  ],
  services: [
    { key: 'duration_mins',   label: 'Duration (mins)',    type: 'number'                                               },
    { key: 'location_type',   label: 'Location',           type: 'select', options: ['In-Store','Home Visit','Online','On-Site'] },
    { key: 'max_capacity',    label: 'Max Capacity (pax)', type: 'number'                                               },
    { key: 'requirements',    label: 'Requirements',       type: 'text'                                                 },
    { key: 'cancellation_hrs',label: 'Free Cancellation (hrs before)', type: 'number'                                   },
  ],
}

// ─── Feature flags per store type ────────────────────────────────────────────
export const TYPE_FEATURES: Record<StoreType, {
  showAddons: boolean; showBooking: boolean; showSizeChart: boolean
  showPrepTime: boolean; showSpecs: boolean; showIngredients: boolean
  showDimensions: boolean; cartLabel: string; productLabel: string
}> = {
  general:     { showAddons:false, showBooking:false, showSizeChart:false, showPrepTime:false, showSpecs:false, showIngredients:false, showDimensions:false, cartLabel:'Cart',   productLabel:'Product'  },
  food:        { showAddons:true,  showBooking:false, showSizeChart:false, showPrepTime:true,  showSpecs:false, showIngredients:false, showDimensions:false, cartLabel:'Order',  productLabel:'Item'     },
  fashion:     { showAddons:false, showBooking:false, showSizeChart:true,  showPrepTime:false, showSpecs:false, showIngredients:false, showDimensions:false, cartLabel:'Bag',    productLabel:'Item'     },
  electronics: { showAddons:false, showBooking:false, showSizeChart:false, showPrepTime:false, showSpecs:true,  showIngredients:false, showDimensions:false, cartLabel:'Cart',   productLabel:'Product'  },
  beauty:      { showAddons:false, showBooking:false, showSizeChart:false, showPrepTime:false, showSpecs:false, showIngredients:true,  showDimensions:false, cartLabel:'Bag',    productLabel:'Product'  },
  home:        { showAddons:false, showBooking:false, showSizeChart:false, showPrepTime:false, showSpecs:false, showIngredients:false, showDimensions:true,  cartLabel:'Cart',   productLabel:'Item'     },
  groceries:   { showAddons:false, showBooking:false, showSizeChart:false, showPrepTime:false, showSpecs:false, showIngredients:false, showDimensions:false, cartLabel:'Basket', productLabel:'Item'     },
  services:    { showAddons:false, showBooking:true,  showSizeChart:false, showPrepTime:true,  showSpecs:false, showIngredients:false, showDimensions:false, cartLabel:'Booking',productLabel:'Service'  },
}

// ─── Default appearance per store type ───────────────────────────────────────
export const TYPE_DEFAULT_APPEARANCE: Record<StoreType, Partial<StoreAppearance>> = {
  general:     { primaryColor:'#2563eb', accentColor:'#7c3aed', layout:'grid',     cardStyle:'standard'  },
  food:        { primaryColor:'#dc2626', accentColor:'#d97706', layout:'grid',     cardStyle:'food'      },
  fashion:     { primaryColor:'#111827', accentColor:'#7c3aed', layout:'masonry',  cardStyle:'minimal'   },
  electronics: { primaryColor:'#0891b2', accentColor:'#2563eb', layout:'list',     cardStyle:'specs'     },
  beauty:      { primaryColor:'#be185d', accentColor:'#ec4899', layout:'masonry',  cardStyle:'minimal'   },
  home:        { primaryColor:'#059669', accentColor:'#d97706', layout:'grid',     cardStyle:'standard'  },
  groceries:   { primaryColor:'#65a30d', accentColor:'#059669', layout:'grid',     cardStyle:'compact'   },
  services:    { primaryColor:'#d97706', accentColor:'#2563eb', layout:'list',     cardStyle:'service'   },
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface StoreAppearance {
  primaryColor:    string
  accentColor:     string
  bgColor:         string
  textColor:       string
  fontFamily:      string
  borderRadius:    'sharp'|'rounded'|'pill'
  layout:          'grid'|'masonry'|'list'
  cardStyle:       'standard'|'minimal'|'food'|'specs'|'compact'|'service'
  logoUrl:         string
  bannerUrl:       string
  bannerMobileUrl: string
  favicon:         string
  tagline:         string
}

export interface StoreConfig {
  // Business
  phone:            string
  whatsapp:         string
  email:            string
  address:          string
  city:             string
  state:            string
  postcode:         string
  country:          string
  // Social
  instagram:        string
  facebook:         string
  tiktok:           string
  twitter:          string
  website:          string
  // Policies
  returnPolicy:     string
  shippingPolicy:   string
  privacyPolicy:    string
  // Type-specific
  enableAddons:     boolean
  enableBooking:    boolean
  showCalories:     boolean
  showSizeGuide:    boolean
  sizeGuideUrl:     string
  minOrderAmount:   number
  freeDeliveryAbove: number
  // SEO
  metaTitle:        string
  metaDescription:  string
  metaKeywords:     string
}

export const DEFAULT_APPEARANCE: StoreAppearance = {
  primaryColor: '#2563eb', accentColor: '#7c3aed', bgColor: '#ffffff',
  textColor: '#111827', fontFamily: 'Inter', borderRadius: 'rounded',
  layout: 'grid', cardStyle: 'standard', logoUrl: '', bannerUrl: '',
  bannerMobileUrl: '', favicon: '', tagline: '',
}

export const DEFAULT_CONFIG: StoreConfig = {
  phone: '', whatsapp: '', email: '', address: '', city: '', state: '',
  postcode: '', country: 'Malaysia', instagram: '', facebook: '',
  tiktok: '', twitter: '', website: '', returnPolicy: '', shippingPolicy: '',
  privacyPolicy: '', enableAddons: false, enableBooking: false,
  showCalories: false, showSizeGuide: false, sizeGuideUrl: '',
  minOrderAmount: 0, freeDeliveryAbove: 0, metaTitle: '', metaDescription: '', metaKeywords: '',
}

export function cssVarsFromAppearance(a: StoreAppearance): Record<string,string> {
  return {
    '--color-primary':       a.primaryColor,
    '--color-accent':        a.accentColor,
    '--color-bg':            a.bgColor,
    '--color-text':          a.textColor,
    '--font-body':           a.fontFamily,
    '--radius-card':         a.borderRadius === 'sharp' ? '4px' : a.borderRadius === 'pill' ? '24px' : '12px',
  }
}
```


***

## Step 2 — Database Migration

```sql
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
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

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
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

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
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

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
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

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

-- ── RPC: get_full_store_config (customer-facing, public) ──────────────────
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
```


***

## Step 3 — `src/app/(dashboard)/settings/store/page.tsx`

```typescript
import { getMerchant } from '@/lib/utils.server'
import { StoreSettingsClient } from '@/components/dashboard/StoreSettingsClient'

export default async function StoreSettingsPage() {
  const { supabase, merchant } = await getMerchant()

  const [{ data: hours }, { data: announcements }, { data: zones }] = await Promise.all([
    supabase.from('merchant_operating_hours')
      .select('*').eq('merchant_id', merchant.id).order('day_of_week'),
    supabase.from('store_announcements')
      .select('*').eq('merchant_id', merchant.id).order('sort_order'),
    supabase.from('delivery_zones')
      .select('*').eq('merchant_id', merchant.id).order('sort_order'),
  ])

  return (
    <StoreSettingsClient
      merchant={merchant}
      hours={(hours    as any[]) ?? []}
      announcements={(announcements as any[]) ?? []}
      zones={(zones    as any[]) ?? []}
    />
  )
}
```


***

## Step 4 — `src/components/dashboard/StoreSettingsClient.tsx`

```typescript
'use client'
import { useState, useCallback } from 'react'
import { useRouter }   from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button }   from '@/components/ui/button'
import { Input }    from '@/components/ui/input'
import { cn }       from '@/lib/utils'
import toast        from 'react-hot-toast'
import {
  STORE_TYPES, TYPE_DEFAULT_APPEARANCE, DEFAULT_APPEARANCE,
  DEFAULT_CONFIG, cssVarsFromAppearance,
  type StoreType, type StoreAppearance, type StoreConfig,
} from '@/lib/store-types'
import { Save, Globe, Palette, Clock, Truck, Megaphone, FileText, Eye, Loader2, Plus, Trash2, GripVertical } from 'lucide-react'

// ─── Days ─────────────────────────────────────────────────────────────────────
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const FONTS = ['Inter','Plus Jakarta Sans','Poppins','Nunito','DM Sans','Lato','Roboto','Montserrat','Playfair Display']
const MY_STATES = ['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis',
  'Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','Kuala Lumpur','Putrajaya','Labuan']
const ANNOUNCEMENT_TYPES = [
  { value:'info',    label:'ℹ️ Info',     bg:'#2563eb' },
  { value:'promo',   label:'🎉 Promo',    bg:'#7c3aed' },
  { value:'warning', label:'⚠️ Warning',  bg:'#d97706' },
  { value:'holiday', label:'🎊 Holiday',  bg:'#059669' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <div>
        <h3 className="font-bold text-gray-900">{title}</h3>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── Color swatch picker ──────────────────────────────────────────────────────
const PALETTE = [
  '#2563eb','#7c3aed','#059669','#dc2626','#d97706','#0891b2',
  '#be185d','#111827','#65a30d','#ea580c','#ec4899','#8b5cf6',
]
function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PALETTE.map(c => (
        <button key={c} onClick={() => onChange(c)} title={c}
          className={cn('w-7 h-7 rounded-full border-2 transition-transform hover:scale-110',
            value === c ? 'border-gray-900 scale-110' : 'border-transparent')}>
          <div className="w-full h-full rounded-full" style={{ backgroundColor: c }} />
        </button>
      ))}
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        className="w-8 h-8 rounded-full border-2 border-gray-200 cursor-pointer overflow-hidden p-0.5"
        title="Custom colour" />
      <span className="text-xs font-mono text-gray-400">{value}</span>
    </div>
  )
}

// ─── Store preview pill ───────────────────────────────────────────────────────
function StorePreview({ appearance, storeName, storeType }: {
  appearance: StoreAppearance; storeName: string; storeType: StoreType
}) {
  const meta = STORE_TYPES[storeType]
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm max-w-xs">
      {/* Banner */}
      <div className="h-16 flex items-center justify-center text-2xl"
        style={{ backgroundColor: appearance.primaryColor + '22' }}>
        {appearance.bannerUrl
          ? <img src={appearance.bannerUrl} className="w-full h-full object-cover" alt="" />
          : <span>{meta.icon}</span>}
      </div>
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
          style={{ backgroundColor: appearance.primaryColor }}>
          {appearance.logoUrl
            ? <img src={appearance.logoUrl} className="w-full h-full object-cover rounded-xl" alt="" />
            : storeName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm" style={{ fontFamily: appearance.fontFamily }}>{storeName}</p>
          <p className="text-xs text-gray-400">{appearance.tagline || meta.desc}</p>
        </div>
      </div>
      {/* Sample product cards */}
      <div className="p-3 bg-gray-50">
        <div className="grid grid-cols-2 gap-2">
          {[1,2].map(i => (
            <div key={i} className="bg-white rounded-xl overflow-hidden border border-gray-100">
              <div className="h-14 flex items-center justify-center text-xl"
                style={{ backgroundColor: appearance.accentColor + '15' }}>
                {meta.icon}
              </div>
              <div className="p-2">
                <div className="h-2 bg-gray-200 rounded-full w-3/4 mb-1" />
                <div className="h-2 rounded-full w-1/2"
                  style={{ backgroundColor: appearance.primaryColor + '40' }} />
              </div>
            </div>
          ))}
        </div>
        <button className="w-full mt-2 py-1.5 rounded-xl text-white text-xs font-bold transition-colors"
          style={{ backgroundColor: appearance.primaryColor }}>
          Add to {storeType === 'food' ? 'Order' : storeType === 'services' ? 'Booking' : 'Cart'}
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StoreSettingsClient({ merchant, hours: initHours, announcements: initAnn, zones: initZones }: {
  merchant: any; hours: any[]; announcements: any[]; zones: any[]
}) {
  const router   = useRouter()
  const supabase = createClient()

  // ── State ──────────────────────────────────────────────────────────────────
  const [saving,      setSaving]      = useState(false)
  const [tab,         setTab]         = useState<'store'|'appearance'|'business'|'delivery'|'announcements'|'policies'>('store')
  const [storeType,   setStoreType]   = useState<StoreType>((merchant.store_type as StoreType) ?? 'general')
  const [storeName,   setStoreName]   = useState(merchant.store_name ?? '')
  const [slug,        setSlug]        = useState(merchant.store_slug ?? '')
  const [appearance,  setAppearance]  = useState<StoreAppearance>({ ...DEFAULT_APPEARANCE, ...(merchant.appearance ?? {}) })
  const [config,      setConfig]      = useState<StoreConfig>({ ...DEFAULT_CONFIG, ...(merchant.store_config ?? {}) })
  const [hours,       setHours]       = useState(
    DAYS.map((_, d) => initHours.find((h: any) => h.day_of_week === d) ?? { day_of_week: d, open_time: '09:00', close_time: '22:00', is_closed: d === 0 })
  )
  const [announcements, setAnnouncements] = useState(initAnn)
  const [zones,        setZones]      = useState(initZones)
  const [newAnn,       setNewAnn]     = useState({ message:'', type:'info', bg_color:'#2563eb', text_color:'#ffffff', link_url:'', link_text:'' })
  const [newZone,      setNewZone]    = useState({ zone_name:'', states:[] as string[], delivery_fee:'', free_delivery_above:'', min_order_amount:'', estimated_days:'' })

  const setApp  = (k: keyof StoreAppearance, v: any) => setAppearance(p => ({ ...p, [k]: v }))
  const setCfg  = (k: keyof StoreConfig,     v: any) => setConfig(p => ({ ...p, [k]: v }))

  // ── Slug auto-generate ────────────────────────────────────────────────────
  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')

  const handleTypeChange = (t: StoreType) => {
    setStoreType(t)
    const defaults = TYPE_DEFAULT_APPEARANCE[t]
    setAppearance(p => ({ ...p, ...defaults }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      // Save merchant branding
      const { error: merr } = await supabase.from('merchants')
        .update({
          store_type:   storeType,
          store_name:   storeName,
          store_slug:   slug || autoSlug(storeName),
          appearance:   appearance,
          store_config: config,
        })
        .eq('id', merchant.id)
      if (merr) throw merr

      // Save operating hours (upsert)
      const { error: herr } = await supabase.from('merchant_operating_hours')
        .upsert(hours.map(h => ({ ...h, merchant_id: merchant.id })),
          { onConflict: 'merchant_id,day_of_week' })
      if (herr) throw herr

      toast.success('Store settings saved!')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Announcement actions ──────────────────────────────────────────────────
  const addAnnouncement = async () => {
    if (!newAnn.message.trim()) { toast.error('Message is required'); return }
    const { data, error } = await supabase.from('store_announcements')
      .insert({ ...newAnn, merchant_id: merchant.id, is_active: true })
      .select().single()
    if (error) { toast.error(error.message); return }
    setAnnouncements(p => [...p, data])
    setNewAnn({ message:'', type:'info', bg_color:'#2563eb', text_color:'#ffffff', link_url:'', link_text:'' })
    toast.success('Announcement added')
  }

  const deleteAnnouncement = async (id: string) => {
    await supabase.from('store_announcements').delete().eq('id', id)
    setAnnouncements(p => p.filter(a => a.id !== id))
    toast.success('Deleted')
  }

  const toggleAnnouncement = async (id: string, current: boolean) => {
    await supabase.from('store_announcements').update({ is_active: !current }).eq('id', id)
    setAnnouncements(p => p.map(a => a.id === id ? { ...a, is_active: !current } : a))
  }

  // ── Zone actions ──────────────────────────────────────────────────────────
  const addZone = async () => {
    if (!newZone.zone_name.trim()) { toast.error('Zone name is required'); return }
    const { data, error } = await supabase.from('delivery_zones')
      .insert({
        merchant_id:         merchant.id,
        zone_name:           newZone.zone_name,
        states:              newZone.states,
        delivery_fee:        Number(newZone.delivery_fee) || 0,
        free_delivery_above: newZone.free_delivery_above ? Number(newZone.free_delivery_above) : null,
        min_order_amount:    Number(newZone.min_order_amount) || 0,
        estimated_days:      newZone.estimated_days,
        is_active:           true,
      })
      .select().single()
    if (error) { toast.error(error.message); return }
    setZones(p => [...p, data])
    setNewZone({ zone_name:'', states:[], delivery_fee:'', free_delivery_above:'', min_order_amount:'', estimated_days:'' })
    toast.success('Zone added')
  }

  const deleteZone = async (id: string) => {
    await supabase.from('delivery_zones').delete().eq('id', id)
    setZones(p => p.filter(z => z.id !== id))
    toast.success('Zone removed')
  }

  const rm = (v: number) => `RM ${Number(v ?? 0).toFixed(2)}`

  return (
    <div className="space-y-5">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">Store Settings</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Customise your storefront for {STORE_TYPES[storeType].label} {STORE_TYPES[storeType].icon}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {slug && (
            <a href={`/store/${slug}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Eye size={13} /> Preview Store
              </Button>
            </a>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}
            className="flex items-center gap-2">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save All Changes
          </Button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit flex-wrap">
        {[
          { key:'store',         icon:<Globe size={13}     />, label:'Store'         },
          { key:'appearance',    icon:<Palette size={13}   />, label:'Appearance'    },
          { key:'business',      icon:<Clock size={13}     />, label:'Business'      },
          { key:'delivery',      icon:<Truck size={13}     />, label:'Delivery'      },
          { key:'announcements', icon:<Megaphone size={13} />, label:'Announcements' },
          { key:'policies',      icon:<FileText size={13}  />, label:'Policies'      },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn('px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5',
              tab === t.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ════ STORE TAB ════════════════════════════════════════════════════ */}
      {tab === 'store' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 space-y-5">

            {/* Identity */}
            <Section title="Store Identity" desc="Your store name and URL slug appear publicly">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Store Name *">
                  <Input value={storeName}
                    onChange={e => { setStoreName(e.target.value); if (!slug) setSlug(autoSlug(e.target.value)) }}
                    placeholder="e.g. Mama's Kitchen" />
                </Field>
                <Field label="Store URL Slug" hint={`yourdomain.com/store/${slug || '...'}`}>
                  <Input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}
                    placeholder="mamas-kitchen" />
                </Field>
              </div>
              <Field label="Tagline" hint="A short sentence shown under your store name">
                <Input value={appearance.tagline} onChange={e => setApp('tagline', e.target.value)}
                  placeholder="e.g. Fresh homemade food, delivered daily" />
              </Field>
            </Section>

            {/* Store type */}
            <Section title="Store Type" desc="This changes the product fields, layout defaults, and feature set for your storefront">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.entries(STORE_TYPES) as [StoreType, typeof STORE_TYPES[StoreType]][]).map(([key, meta]) => (
                  <button key={key} onClick={() => handleTypeChange(key)}
                    className={cn('flex flex-col items-center gap-2 p-3 rounded-2xl border-2 text-center transition-all',
                      storeType === key
                        ? 'border-blue-600 bg-blue-50'
                        : 'border-gray-100 hover:border-gray-300 bg-white')}>
                    <span className="text-2xl">{meta.icon}</span>
                    <span className="text-xs font-semibold text-gray-800 leading-tight">{meta.label}</span>
                    <span className="text-xs text-gray-400 leading-tight hidden sm:block">{meta.desc}</span>
                  </button>
                ))}
              </div>

              {/* Features active for this type */}
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-800 mb-2">
                  Active features for {STORE_TYPES[storeType].label}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries({
                    'Add-ons / Modifiers':  'showAddons',
                    'Booking System':       'showBooking',
                    'Size Chart':           'showSizeChart',
                    'Prep Time Badge':      'showPrepTime',
                    'Specs Table':          'showSpecs',
                    'Ingredients List':     'showIngredients',
                    'Dimensions Display':   'showDimensions',
                  }).map(([label, key]) => {
                    const { TYPE_FEATURES } = require('@/lib/store-types')
                    const active = TYPE_FEATURES[storeType][key as keyof typeof TYPE_FEATURES.general]
                    return (
                      <span key={label} className={cn('text-xs px-2.5 py-1 rounded-full font-medium',
                        active ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-400 line-through')}>
                        {label}
                      </span>
                    )
                  })}
                </div>
              </div>
            </Section>

            {/* SEO */}
            <Section title="SEO & Discovery">
              <Field label="Meta Title" hint="Shown in browser tab and Google results (60 chars max)">
                <Input value={config.metaTitle} onChange={e => setCfg('metaTitle', e.target.value)}
                  maxLength={60} placeholder={`${storeName} — ${STORE_TYPES[storeType].label}`} />
              </Field>
              <Field label="Meta Description" hint="Shown in Google results (160 chars max)">
                <Input value={config.metaDescription} onChange={e => setCfg('metaDescription', e.target.value)}
                  maxLength={160} placeholder={appearance.tagline || STORE_TYPES[storeType].desc} />
              </Field>
              <Field label="Keywords">
                <Input value={config.metaKeywords} onChange={e => setCfg('metaKeywords', e.target.value)}
                  placeholder="halal food delivery, kuala lumpur, home cooked" />
              </Field>
            </Section>
          </div>

          {/* Preview panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-500 mb-3">LIVE PREVIEW</p>
              <StorePreview appearance={appearance} storeName={storeName || 'Your Store'} storeType={storeType} />
            </div>
          </div>
        </div>
      )}

      {/* ════ APPEARANCE TAB ═══════════════════════════════════════════════ */}
      {tab === 'appearance' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 space-y-5">

            {/* Branding */}
            <Section title="Brand Assets">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Logo URL" hint="Square image, min 200×200px">
                  <Input value={appearance.logoUrl} onChange={e => setApp('logoUrl', e.target.value)} placeholder="https://..." />
                </Field>
                <Field label="Banner URL" hint="16:5 ratio recommended (1600×500px)">
                  <Input value={appearance.bannerUrl} onChange={e => setApp('bannerUrl', e.target.value)} placeholder="https://..." />
                </Field>
                <Field label="Mobile Banner URL" hint="Optional, 4:3 ratio works well">
                  <Input value={appearance.bannerMobileUrl} onChange={e => setApp('bannerMobileUrl', e.target.value)} placeholder="https://..." />
                </Field>
                <Field label="Favicon URL">
                  <Input value={appearance.favicon} onChange={e => setApp('favicon', e.target.value)} placeholder="https://..." />
                </Field>
              </div>
            </Section>

            {/* Colours */}
            <Section title="Colours">
              <Field label="Primary Colour" hint="Used for buttons, badges, highlights">
                <ColorPicker value={appearance.primaryColor} onChange={v => setApp('primaryColor', v)} />
              </Field>
              <Field label="Accent Colour" hint="Used for secondary highlights">
                <ColorPicker value={appearance.accentColor} onChange={v => setApp('accentColor', v)} />
              </Field>
            </Section>

            {/* Typography */}
            <Section title="Typography">
              <Field label="Body Font">
                <select value={appearance.fontFamily} onChange={e => setApp('fontFamily', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  {FONTS.map(f => (
                    <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                  ))}
                </select>
              </Field>
            </Section>

            {/* Layout */}
            <Section title="Layout & Card Style">
              <Field label="Product Grid Layout">
                <div className="flex gap-3">
                  {([
                    { v:'grid',    icon:'⊞', label:'Grid'    },
                    { v:'masonry', icon:'⬚', label:'Masonry' },
                    { v:'list',    icon:'☰', label:'List'    },
                  ] as const).map(({ v, icon, label }) => (
                    <button key={v} onClick={() => setApp('layout', v)}
                      className={cn('flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                        appearance.layout === v ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 hover:border-gray-300')}>
                      <div className="text-xl mb-1">{icon}</div>
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Border Radius Style">
                <div className="flex gap-3">
                  {([
                    { v:'sharp',   label:'Sharp',   cls:'rounded-none' },
                    { v:'rounded', label:'Rounded', cls:'rounded-xl'   },
                    { v:'pill',    label:'Pill',    cls:'rounded-full' },
                  ] as const).map(({ v, label, cls }) => (
                    <button key={v} onClick={() => setApp('borderRadius', v)}
                      className={cn('flex-1 py-2.5 border-2 text-sm font-medium transition-all', cls,
                        appearance.borderRadius === v ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-100 hover:border-gray-300')}>
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
            </Section>
          </div>

          {/* Live preview */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sticky top-4">
              <p className="text-xs font-bold text-gray-500 mb-3">LIVE PREVIEW</p>
              <StorePreview appearance={appearance} storeName={storeName || 'Your Store'} storeType={storeType} />
              <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                <p className="text-xs font-bold text-gray-500 mb-2">CSS Variables generated:</p>
                {Object.entries(cssVarsFromAppearance(appearance)).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-xs py-0.5">
                    <span className="font-mono text-gray-500">{k}</span>
                    <span className="font-mono text-blue-600">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ BUSINESS TAB ═════════════════════════════════════════════════ */}
      {tab === 'business' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* Contact info */}
          <Section title="Contact Information">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone"><Input value={config.phone} onChange={e => setCfg('phone', e.target.value)} placeholder="+60 1X-XXXXXXXX" /></Field>
              <Field label="WhatsApp"><Input value={config.whatsapp} onChange={e => setCfg('whatsapp', e.target.value)} placeholder="+60 1X-XXXXXXXX" /></Field>
              <Field label="Email" ><Input value={config.email} onChange={e => setCfg('email', e.target.value)} placeholder="hello@store.com" /></Field>
              <Field label="Website"><Input value={config.website} onChange={e => setCfg('website', e.target.value)} placeholder="https://..." /></Field>
            </div>
          </Section>

          {/* Address */}
          <Section title="Business Address">
            <Field label="Street Address">
              <Input value={config.address} onChange={e => setCfg('address', e.target.value)} placeholder="No. 12, Jalan..." />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="City"><Input value={config.city} onChange={e => setCfg('city', e.target.value)} placeholder="Petaling Jaya" /></Field>
              <Field label="State">
                <select value={config.state} onChange={e => setCfg('state', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="">Select state</option>
                  {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Postcode"><Input value={config.postcode} onChange={e => setCfg('postcode', e.target.value)} placeholder="47500" /></Field>
            </div>
          </Section>

          {/* Social links */}
          <Section title="Social Media">
            <div className="space-y-3">
              {[
                { key:'instagram', label:'Instagram', placeholder:'@yourstore' },
                { key:'facebook',  label:'Facebook',  placeholder:'facebook.com/yourstore' },
                { key:'tiktok',    label:'TikTok',    placeholder:'@yourstore' },
                { key:'twitter',   label:'X / Twitter', placeholder:'@yourstore' },
              ].map(s => (
                <Field key={s.key} label={s.label}>
                  <Input value={(config as any)[s.key]} onChange={e => setCfg(s.key as any, e.target.value)}
                    placeholder={s.placeholder} />
                </Field>
              ))}
            </div>
          </Section>

          {/* Operating hours */}
          <Section title="Operating Hours" desc="Customers see these on your storefront and in the app">
            <div className="space-y-2">
              {DAYS.map((day, d) => {
                const h = hours[d]
                return (
                  <div key={d} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="w-24 text-sm font-medium text-gray-700 shrink-0">{day}</div>
                    <button
                      onClick={() => setHours(prev => prev.map((x,i) => i === d ? { ...x, is_closed: !x.is_closed } : x))}
                      className={cn('text-xs px-2.5 py-1 rounded-full font-bold shrink-0 transition-colors',
                        h.is_closed ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700')}>
                      {h.is_closed ? 'Closed' : 'Open'}
                    </button>
                    {!h.is_closed && (
                      <>
                        <Input type="time" value={h.open_time ?? '09:00'}
                          onChange={e => setHours(prev => prev.map((x,i) => i === d ? { ...x, open_time: e.target.value } : x))}
                          className="h-8 text-xs w-24" />
                        <span className="text-gray-400 text-xs">–</span>
                        <Input type="time" value={h.close_time ?? '22:00'}
                          onChange={e => setHours(prev => prev.map((x,i) => i === d ? { ...x, close_time: e.target.value } : x))}
                          className="h-8 text-xs w-24" />
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </Section>
        </div>
      )}

      {/* ════ DELIVERY TAB ═════════════════════════════════════════════════ */}
      {tab === 'delivery' && (
        <div className="space-y-5">

          {/* Global delivery settings */}
          <Section title="Global Delivery Settings">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Min Order Amount (RM)">
                <Input type="number" min="0" step="0.01" value={config.minOrderAmount}
                  onChange={e => setCfg('minOrderAmount', Number(e.target.value))} placeholder="0.00" />
              </Field>
              <Field label="Free Delivery Above (RM)" hint="Leave 0 to disable">
                <Input type="number" min="0" step="0.01" value={config.freeDeliveryAbove}
                  onChange={e => setCfg('freeDeliveryAbove', Number(e.target.value))} placeholder="0.00" />
              </Field>
            </div>
          </Section>

          {/* Delivery zones */}
          <Section title="Delivery Zones" desc="Set different fees and minimum orders by state or postcode">
            {/* Zone list */}
            {zones.length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-50">
                    {['Zone','States','Delivery Fee','Free Above','Min Order','ETA',''].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-gray-400 pb-2 pr-3">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {zones.map(z => (
                      <tr key={z.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5 pr-3 font-semibold text-gray-800">{z.zone_name}</td>
                        <td className="py-2.5 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {(z.states ?? []).slice(0,3).map((s: string) => (
                              <span key={s} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">{s}</span>
                            ))}
                            {(z.states ?? []).length > 3 && (
                              <span className="text-xs text-gray-400">+{z.states.length-3}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 font-bold text-gray-900">{rm(z.delivery_fee)}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{z.free_delivery_above ? rm(z.free_delivery_above) : '—'}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{z.min_order_amount ? rm(z.min_order_amount) : '—'}</td>
                        <td className="py-2.5 pr-3 text-gray-600">{z.estimated_days || '—'}</td>
                        <td className="py-2.5">
                          <button onClick={() => deleteZone(z.id)} className="text-red-400 hover:text-red-600 p-1">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add zone form */}
            <div className="border border-dashed border-gray-200 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Add New Zone</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Zone Name">
                  <Input value={newZone.zone_name} onChange={e => setNewZone(p => ({...p, zone_name: e.target.value}))}
                    placeholder="e.g. Klang Valley" />
                </Field>
                <Field label="Delivery Fee (RM)">
                  <Input type="number" value={newZone.delivery_fee} onChange={e => setNewZone(p => ({...p, delivery_fee: e.target.value}))}
                    placeholder="5.00" />
                </Field>
                <Field label="Free Delivery Above (RM)">
                  <Input type="number" value={newZone.free_delivery_above} onChange={e => setNewZone(p => ({...p, free_delivery_above: e.target.value}))}
                    placeholder="50.00" />
                </Field>
                <Field label="Min Order (RM)">
                  <Input type="number" value={newZone.min_order_amount} onChange={e => setNewZone(p => ({...p, min_order_amount: e.target.value}))}
                    placeholder="15.00" />
                </Field>
                <Field label="Estimated Delivery">
                  <Input value={newZone.estimated_days} onChange={e => setNewZone(p => ({...p, estimated_days: e.target.value}))}
                    placeholder="Same day / 1-2 days" />
                </Field>
              </div>
              <Field label="States Covered">
                <div className="flex flex-wrap gap-2">
                  {MY_STATES.map(s => (
                    <button key={s} onClick={() =>
                      setNewZone(p => ({
                        ...p, states: p.states.includes(s)
                          ? p.states.filter(x => x !== s)
                          : [...p.states, s]
                      }))}
                      className={cn('text-xs px-2.5 py-1 rounded-full border transition-colors font-medium',
                        newZone.states.includes(s)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400')}>
                      {s}
                    </button>
                  ))}
                </div>
              </Field>
              <Button size="sm" onClick={addZone} className="flex items-center gap-2">
                <Plus size={13} /> Add Zone
              </Button>
            </div>
          </Section>
        </div>
      )}

      {/* ════ ANNOUNCEMENTS TAB ════════════════════════════════════════════ */}
      {tab === 'announcements' && (
        <div className="space-y-5">
          <Section title="Store Banners & Announcements" desc="Shown at the top of your storefront. Schedule promo banners in advance.">
            {/* Active announcements */}
            {announcements.length > 0 && (
              <div className="space-y-2">
                {announcements.map(a => (
                  <div key={a.id}
                    style={{ backgroundColor: a.bg_color + '18', borderColor: a.bg_color + '44' }}
                    className="flex items-center justify-between p-3 rounded-xl border">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <GripVertical size={14} className="text-gray-300 shrink-0" />
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white shrink-0"
                        style={{ backgroundColor: a.bg_color }}>
                        {ANNOUNCEMENT_TYPES.find(t => t.value === a.type)?.label ?? a.type}
                      </span>
                      <p className="text-sm text-gray-800 truncate">{a.message}</p>
                      {a.link_url && <span className="text-xs text-blue-500 truncate shrink-0">{a.link_text || a.link_url}</span>}
                    </div>
                    <div className="flex items-center gap-2 ml-3 shrink-0">
                      <button onClick={() => toggleAnnouncement(a.id, a.is_active)}
                        className={cn('text-xs font-bold px-2.5 py-1 rounded-full transition-colors',
                          a.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400')}>
                        {a.is_active ? 'Live' : 'Hidden'}
                      </button>
                      <button onClick={() => deleteAnnouncement(a.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add announcement form */}
            <div className="border border-dashed border-gray-200 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">New Announcement</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select value={newAnn.type}
                    onChange={e => {
                      const t = ANNOUNCEMENT_TYPES.find(x => x.value === e.target.value)
                      setNewAnn(p => ({ ...p, type: e.target.value, bg_color: t?.bg ?? p.bg_color }))
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    {ANNOUNCEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Background Colour">
                  <ColorPicker value={newAnn.bg_color} onChange={v => setNewAnn(p => ({...p, bg_color: v}))} />
                </Field>
              </div>
              <Field label="Message *">
                <Input value={newAnn.message} onChange={e => setNewAnn(p => ({...p, message: e.target.value}))}
                  placeholder="e.g. 🎉 Free delivery this weekend! Use code FREEDEL" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Link URL">
                  <Input value={newAnn.link_url} onChange={e => setNewAnn(p => ({...p, link_url: e.target.value}))}
                    placeholder="https://..." />
                </Field>
                <Field label="Link Text">
                  <Input value={newAnn.link_text} onChange={e => setNewAnn(p => ({...p, link_text: e.target.value}))}
                    placeholder="Shop Now" />
                </Field>
              </div>
              {/* Live preview */}
              {newAnn.message && (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-medium"
                  style={{ backgroundColor: newAnn.bg_color, color: newAnn.text_color }}>
                  <span>{newAnn.message}</span>
                  {newAnn.link_text && (
                    <span className="underline text-xs ml-3 shrink-0">{newAnn.link_text}</span>
                  )}
                </div>
              )}
              <Button size="sm" onClick={addAnnouncement} className="flex items-center gap-2">
                <Plus size={13} /> Add Announcement
              </Button>
            </div>
          </Section>
        </div>
      )}

      {/* ════ POLICIES TAB ═════════════════════════════════════════════════ */}
      {tab === 'policies' && (
        <div className="space-y-5">
          {[
            { key:'returnPolicy',   label:'Return & Refund Policy',     placeholder:'e.g. Returns accepted within 7 days of delivery...' },
            { key:'shippingPolicy', label:'Shipping & Delivery Policy', placeholder:'e.g. We ship to all states in Malaysia...' },
            { key:'privacyPolicy',  label:'Privacy Policy',             placeholder:'e.g. We collect your information to process orders...' },
          ].map(p => (
            <Section key={p.key} title={p.label}>
              <textarea
                value={(config as any)[p.key]}
                onChange={e => setCfg(p.key as any, e.target.value)}
                rows={6}
                placeholder={p.placeholder}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-y focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </Section>
          ))}

          {/* Type-specific extra config */}
          {storeType === 'fashion' && (
            <Section title="Fashion Settings">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Show Size Guide on Products">
                  <div className="flex items-center gap-2 mt-1">
                    <button onClick={() => setCfg('showSizeGuide', !config.showSizeGuide)}
                      className={cn('w-10 h-5 rounded-full transition-colors', config.showSizeGuide ? 'bg-blue-600' : 'bg-gray-200')}>
                      <div className={cn('w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-transform', config.showSizeGuide ? 'translate-x-5' : 'translate-x-0')} />
                    </button>
                    <span className="text-sm text-gray-600">{config.showSizeGuide ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </Field>
                <Field label="Size Guide URL">
                  <Input value={config.sizeGuideUrl} onChange={e => setCfg('sizeGuideUrl', e.target.value)}
                    placeholder="https://..." disabled={!config.showSizeGuide} />
                </Field>
              </div>
            </Section>
          )}

          {storeType === 'food' && (
            <Section title="Food & Beverage Settings">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key:'showCalories',  label:'Show Calorie Count' },
                  { key:'enableAddons',  label:'Enable Add-ons / Modifiers' },
                ].map(opt => (
                  <Field key={opt.key} label={opt.label}>
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => setCfg(opt.key as any, !(config as any)[opt.key])}
                        className={cn('w-10 h-5 rounded-full transition-colors', (config as any)[opt.key] ? 'bg-blue-600' : 'bg-gray-200')}>
                        <div className={cn('w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-transform', (config as any)[opt.key] ? 'translate-x-5' : 'translate-x-0')} />
                      </button>
                      <span className="text-sm text-gray-600">{(config as any)[opt.key] ? 'On' : 'Off'}</span>
                    </div>
                  </Field>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Sticky save on mobile */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-20">
        <Button className="w-full flex items-center justify-center gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save All Changes
        </Button>
      </div>
      <div className="h-20 xl:hidden" />
    </div>
  )
}
```


***

## Step 5 — `src/components/dashboard/ProductTypeFields.tsx`

Inject this into your existing Add/Edit Product form:

```typescript
'use client'
import { TYPE_PRODUCT_FIELDS, type StoreType } from '@/lib/store-types'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  storeType:  StoreType
  values:     Record<string, string>
  onChange:   (key: string, value: string) => void
}

export function ProductTypeFields({ storeType, values, onChange }: Props) {
  const fields = TYPE_PRODUCT_FIELDS[storeType]
  if (!fields.length) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <h3 className="font-bold text-gray-900 mb-4">
        {['🍜','👗','📱','💄','🏠','🥦','🛠️','🛍️'][
          ['food','fashion','electronics','beauty','home','groceries','services','general'].indexOf(storeType)
        ]} {storeType.charAt(0).toUpperCase() + storeType.slice(1)} Details
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {fields.map(field => (
          <div key={field.key}>
            <label className="text-sm font-medium text-gray-700 block mb-1">{field.label}</label>

            {field.type === 'text' || field.type === 'number' ? (
              <Input type={field.type} value={values[field.key] ?? ''}
                onChange={e => onChange(field.key, e.target.value)} />
            ) : field.type === 'select' ? (
              <select value={values[field.key] ?? ''}
                onChange={e => onChange(field.key, e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">Select…</option>
                {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : field.type === 'toggle' ? (
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => onChange(field.key, values[field.key] === 'true' ? 'false' : 'true')}
                  className={cn('w-10 h-5 rounded-full transition-colors',
                    values[field.key] === 'true' ? 'bg-blue-600' : 'bg-gray-200')}>
                  <div className={cn('w-4 h-4 rounded-full bg-white shadow mx-0.5 transition-transform',
                    values[field.key] === 'true' ? 'translate-x-5' : 'translate-x-0')} />
                </button>
                <span className="text-sm text-gray-600">
                  {values[field.key] === 'true' ? 'Yes' : 'No'}
                </span>
              </div>
            ) : field.type === 'tags' ? (
              <TagInput
                value={values[field.key] ? values[field.key].split(',').filter(Boolean) : []}
                onChange={tags => onChange(field.key, tags.join(','))}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Inline tag input ──────────────────────────────────────────────────────────
function TagInput({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('')

  const add = () => {
    const t = input.trim()
    if (t && !value.includes(t)) { onChange([...value, t]); setInput('') }
  }

  return (
    <div className="flex flex-wrap gap-1.5 border border-gray-200 rounded-xl p-2 min-h-[40px]">
      {value.map(tag => (
        <span key={tag} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
          {tag}
          <button type="button" onClick={() => onChange(value.filter(t => t !== tag))}
            className="text-blue-400 hover:text-blue-700">×</button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
        placeholder="Type and press Enter…"
        className="flex-1 min-w-[80px] text-xs outline-none bg-transparent" />
    </div>
  )
}

import { useState } from 'react'
```


***

## Step 6 — Customer Storefront Theme Injection

In your public store layout, inject the CSS variables at the root:[^2]

```typescript
// src/app/store/[slug]/layout.tsx
import { createClient } from '@/lib/supabase/server'
import { cssVarsFromAppearance, DEFAULT_APPEARANCE } from '@/lib/store-types'

export default async function StoreLayout({
  params, children,
}: { params: { slug: string }; children: React.ReactNode }) {
  const supabase = createClient()
  const { data } = await supabase.rpc('get_store_config', { p_slug: params.slug })
  const config   = data?.[^0]

  if (!config || !config.is_published) notFound()

  const appearance = { ...DEFAULT_APPEARANCE, ...(config.appearance ?? {}) }
  const cssVars    = cssVarsFromAppearance(appearance)

  // Load Google Font dynamically
  const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(appearance.fontFamily)}:wght@400;500;600;700&display=swap`

  return (
    <html>
      <head>
        <link rel="stylesheet" href={fontUrl} />
        {appearance.favicon && <link rel="icon" href={appearance.favicon} />}
        {config.store_config?.metaTitle && <title>{config.store_config.metaTitle}</title>}
        {config.store_config?.metaDescription && (
          <meta name="description" content={config.store_config.metaDescription} />
        )}
      </head>
      <body style={cssVars as any}>
        {/* Announcement banner */}
        {config.active_announcement && (
          <div className="w-full px-4 py-2.5 text-center text-sm font-medium flex items-center justify-center gap-2"
            style={{
              backgroundColor: config.active_announcement.bg_color,
              color:           config.active_announcement.text_color,
            }}>
            {config.active_announcement.message}
            {config.active_announcement.link_url && (
              <a href={config.active_announcement.link_url}
                className="underline font-bold ml-2 text-xs">
                {config.active_announcement.link_text ?? 'Learn more'}
              </a>
            )}
          </div>
        )}
        {children}
      </body>
    </html>
  )
}
```


***

## How Everything Connects

| Merchant type | Product extra fields | Layout default | Cart label | Features enabled |
| :-- | :-- | :-- | :-- | :-- |
| Food \& Beverage | Prep time, calories, spice, halal, dietary | Grid / Food card | "Order" | Add-ons, prep time badge |
| Fashion \& Apparel | Material, fit, size system, care | Masonry / Minimal | "Bag" | Size chart, colour swatches |
| Electronics | Brand, model, warranty, specs | List / Specs | "Cart" | Specs table, compatibility |
| Beauty \& Health | Skin type, ingredients, SPF, volume | Masonry / Minimal | "Bag" | Ingredients list |
| Home \& Living | Dimensions, weight, material, assembly | Grid / Standard | "Cart" | Dimensions display |
| Groceries | Weight, expiry, storage, organic | Grid / Compact | "Basket" | Halal, allergens |
| Services | Duration, location type, capacity | List / Service | "Booking" | Booking system |

CSS variables (`--color-primary`, `--color-accent`, `--font-body`, `--radius-card`) are injected at the `<body>` level at runtime so every Tailwind component that reads `var(--color-primary)` inherits the merchant's exact brand automatically — one codebase, every store.[^3]
<span style="display:none">[^10][^11][^12][^13][^14][^15][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.cs-cart.com/blog/how-to-create-a-multi-store-ecommerce-platform/

[^2]: https://www.context.dev/use-cases/programmatic-theming

[^3]: https://www.wildnetedge.com/blogs/how-to-build-a-white-label-saas-product-for-multi-branding-success

[^4]: https://www.youtube.com/watch?v=AOaBeFhhV0o

[^5]: https://www.iflair.com/magento-ecommerce-multi-store-tactics-setup-and-management-tips/

[^6]: https://www.scayle.com/library/blog/multi-site-ecommerce/

[^7]: https://www.capitalnumbers.com/blog/multi-store-ecommerce-with-magento/

[^8]: https://www.bigcommerce.com/articles/ecommerce/multi-store-ecommerce/

[^9]: https://spreecommerce.org/white-label-multi-tenant-ecommerce-with-spree-fast-launch-for-saas-like-solutions/

[^10]: https://www.reddit.com/r/SideProject/comments/1m66n92/building_a_custom_multiproduct_type_ecommerce/

[^11]: https://spreecommerce.org/the-ultimate-guide-to-multi‑tenant-white‑label-ecommerce/

[^12]: https://workdo.io/ecommercego-saas-ecommerce-store-with-multi-theme-and-multi-store/

[^13]: https://docs.magento.com/user-guide/v2.3/catalog/inventory-merchant-type.html

[^14]: https://www.merveilleux.design/en/blog/article/saas-interface-customization

[^15]: https://simtechdev.com/blog/multi-store-ecommerce/

