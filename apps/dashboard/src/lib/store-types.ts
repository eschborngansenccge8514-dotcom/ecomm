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
  delivery_radius_km: number
  lat:              number | null
  lng:              number | null
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
  minOrderAmount: 0, freeDeliveryAbove: 0, delivery_radius_km: 10, lat: null, lng: null, metaTitle: '', metaDescription: '', metaKeywords: '',
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
