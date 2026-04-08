import { View, Text } from 'react-native'
import type { ProductAttribute } from '@/services/products.service'

// Label map mirrors dashboard's TYPE_PRODUCT_FIELDS
const FIELD_LABELS: Record<string, string> = {
  // food
  prep_time_mins:    'Prep Time',
  calories:          'Calories',
  spice_level:       'Spice Level',
  dietary_tags:      'Dietary Tags',
  allergens:         'Allergens',
  is_halal:          'Halal Certified',
  is_vegetarian:     'Vegetarian',
  // fashion
  material:          'Material',
  fit_type:          'Fit Type',
  size_system:       'Size System',
  gender:            'Gender',
  care_instructions: 'Care Instructions',
  country_of_origin: 'Country of Origin',
  // electronics
  brand:             'Brand',
  model_number:      'Model Number',
  warranty_months:   'Warranty',
  compatibility:     'Compatibility',
  in_box:            'In The Box',
  specifications:    'Key Specifications',
  is_original:       'Original Product',
  // beauty
  skin_type:         'Skin Type',
  ingredients:       'Key Ingredients',
  spf:               'SPF',
  volume_ml:         'Volume',
  expiry_months:     'Shelf Life',
  usage_steps:       'How to Use',
  is_cruelty_free:   'Cruelty-Free',
  // home
  dimensions:        'Dimensions',
  weight_kg:         'Weight',
  room_type:         'Room Type',
  assembly_required: 'Assembly Required',
  colour_options:    'Colour Options',
  // groceries
  weight_g:          'Net Weight',
  expiry_days:       'Shelf Life',
  storage_type:      'Storage',
  is_organic:        'Organic',
  // services
  duration_mins:     'Duration',
  location_type:     'Location',
  max_capacity:      'Max Capacity',
  requirements:      'Requirements',
  cancellation_hrs:  'Free Cancellation',
}

// Units to append to numeric fields
const FIELD_UNITS: Record<string, string> = {
  prep_time_mins:   ' mins',
  calories:         ' kcal',
  warranty_months:  ' months',
  spf:              '',
  volume_ml:        ' ml',
  expiry_months:    ' months',
  weight_kg:        ' kg',
  weight_g:         ' g',
  expiry_days:      ' days',
  duration_mins:    ' mins',
  max_capacity:     ' pax',
  cancellation_hrs: ' hrs before',
}

function formatValue(key: string, raw: string): string {
  if (raw === 'true')  return 'Yes'
  if (raw === 'false') return 'No'
  const unit = FIELD_UNITS[key]
  if (unit !== undefined) return `${raw}${unit}`
  // comma-separated tags — render as spaced list
  if (raw.includes(',')) return raw.split(',').filter(Boolean).join(' · ')
  return raw
}

interface Props {
  attributes: ProductAttribute[]
  sectionTitle?: string
}

export function ProductAttributes({ attributes, sectionTitle = 'Product Details' }: Props) {
  const visible = attributes.filter(a => a.value && a.value !== 'false')
  if (visible.length === 0) return null

  return (
    <View className="mt-8 pt-6 border-t border-gray-100">
      <Text className="text-gray-900 font-bold mb-4 uppercase tracking-widest text-xs">
        {sectionTitle}
      </Text>
      <View className="gap-3">
        {visible.map(attr => (
          <View key={attr.key} className="flex-row justify-between items-start gap-4">
            <Text className="text-gray-500 text-sm flex-shrink-0 w-36">
              {FIELD_LABELS[attr.key] ?? attr.key.replace(/_/g, ' ')}
            </Text>
            <Text className="text-gray-900 text-sm font-medium flex-1 text-right">
              {formatValue(attr.key, attr.value)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}
