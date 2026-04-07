import {
  View, Text, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
  TextInput,
} from 'react-native'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import * as ImagePicker from 'expo-image-picker'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { uploadService } from '@/services/upload.service'
import { productsService } from '@/services/products.service'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import Toast from 'react-native-toast-message'
import type { ProductWithVariants } from '@/types/app.types'

// ─── Schema ────────────────────────────────────────────────────────────────────
const variantSchema = z.object({
  name:           z.string().min(1, 'Variant name required'),
  price_modifier: z.coerce.number().default(0),
  stock_quantity: z.coerce.number().int().min(0).default(0),
})

const schema = z.object({
  name:             z.string().min(2, 'Product name required'),
  description:      z.string().optional(),
  price:            z.coerce.number().min(0.01, 'Price must be greater than 0'),
  compare_at_price: z.coerce.number().optional().or(z.literal('')),
  category_id:      z.string().optional(),
  stock_quantity:   z.coerce.number().int().min(0).default(0),
  track_inventory:  z.boolean().default(true),
  is_featured:      z.boolean().default(false),
  weight_grams:     z.coerce.number().int().min(0).optional(),
  variants:         z.array(variantSchema).default([]),
})

type FormData = z.infer<typeof schema>

interface Props {
  editing?:  ProductWithVariants | null
  onSaved:   () => void
}

export function ProductForm({ editing, onSaved }: Props) {
  const { merchant } = useAuthStore()
  const [isSaving, setIsSaving]   = useState(false)
  const [images, setImages]       = useState<string[]>(editing?.images ?? [])
  const [newImages, setNewImages] = useState<string[]>([]) // local URIs pending upload

  // Fetch categories for this merchant
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', merchant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .eq('merchant_id', merchant!.id)
        .order('sort_order')
      return data ?? []
    },
    enabled: !!merchant?.id,
  })

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      name:             editing?.name            ?? '',
      description:      editing?.description     ?? '',
      price:            editing?.price           ?? 0,
      compare_at_price: editing?.compare_at_price ?? '',
      category_id:      editing?.category_id     ?? '',
      stock_quantity:   editing?.stock_quantity  ?? 0,
      track_inventory:  editing?.track_inventory ?? true,
      is_featured:      editing?.is_featured     ?? false,
      weight_grams:     editing?.weight_grams    ?? 0,
      variants: editing?.variants?.map(v => ({
        name:           v.name,
        price_modifier: v.price_modifier ?? 0,
        stock_quantity: v.stock_quantity ?? 0,
      })) ?? [],
    },
  })

  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
    control,
    name: 'variants',
  })

  const trackInventory = watch('track_inventory')
  const selectedCategoryId = watch('category_id')

  // ─── Image picker ────────────────────────────────────────────────────────────
  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo access to upload product images.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 5,
    })
    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri)
      setNewImages(prev => [...prev, ...uris].slice(0, 5))
    }
  }

  const removeImage = (uri: string, isNew: boolean) => {
    if (isNew) setNewImages(prev => prev.filter(u => u !== uri))
    else       setImages(prev => prev.filter(u => u !== uri))
  }

  // ─── Save handler ─────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    setIsSaving(true)
    try {
      // Upload new images
      const uploadedUrls = await Promise.all(
        newImages.map((uri, idx) =>
          uploadService.uploadImage(
            'product-images',
            merchant!.id,
            uri,
            `${Date.now()}-${idx}.jpg`
          )
        )
      )
      const allImages = [...images, ...uploadedUrls]

      const payload = {
        merchant_id:      merchant!.id,
        name:             data.name,
        description:      data.description || null,
        price:            data.price,
        compare_at_price: data.compare_at_price ? Number(data.compare_at_price) : null,
        category_id:      data.category_id || null,
        stock_quantity:   data.track_inventory ? data.stock_quantity : 9999,
        track_inventory:  data.track_inventory,
        is_featured:      data.is_featured,
        weight_grams:     data.weight_grams || null,
        images:           allImages,
        status:           'active' as const,
      }

      if (editing) {
        await productsService.update(editing.id, payload)

        // Delete existing variants and re-insert
        await supabase.from('product_variants').delete().eq('product_id', editing.id)
        if (data.variants.length > 0) {
          await supabase.from('product_variants').insert(
            data.variants.map(v => ({ ...v, product_id: editing.id }))
          )
        }
        Toast.show({ type: 'success', text1: 'Product updated!' })
      } else {
        const newProduct = await productsService.create(payload)
        if (data.variants.length > 0) {
          await supabase.from('product_variants').insert(
            data.variants.map(v => ({ ...v, product_id: newProduct.id }))
          )
        }
        Toast.show({ type: 'success', text1: 'Product added!' })
      }

      onSaved()
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Save failed', text2: err.message })
    }
    setIsSaving(false)
  }

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* ── Images ── */}
        <View className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <Text className="font-bold text-gray-900 mb-3">📷  Product Images</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {/* Existing uploaded images */}
            {images.map(uri => (
              <View key={uri} style={{ position: 'relative' }}>
                <Image source={{ uri }} style={{ width: 90, height: 90, borderRadius: 12 }} contentFit="cover" />
                <TouchableOpacity
                  onPress={() => removeImage(uri, false)}
                  className="absolute top-1 right-1 bg-black/60 w-6 h-6 rounded-full items-center justify-center"
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {/* New local images */}
            {newImages.map(uri => (
              <View key={uri} style={{ position: 'relative' }}>
                <Image source={{ uri }} style={{ width: 90, height: 90, borderRadius: 12 }} contentFit="cover" />
                <View className="absolute top-1 left-1 bg-yellow-400 rounded-full px-1.5 py-0.5">
                  <Text className="text-white text-[9px] font-bold">NEW</Text>
                </View>
                <TouchableOpacity
                  onPress={() => removeImage(uri, true)}
                  className="absolute top-1 right-1 bg-black/60 w-6 h-6 rounded-full items-center justify-center"
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {/* Add button */}
            {(images.length + newImages.length) < 5 && (
              <TouchableOpacity
                onPress={pickImages}
                className="w-[90px] h-[90px] rounded-xl border-2 border-dashed border-gray-200 items-center justify-center gap-1"
              >
                <Ionicons name="add" size={24} color="#9ca3af" />
                <Text className="text-gray-400 text-xs">Add photo</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
          <Text className="text-gray-400 text-xs mt-2">First image is shown as the thumbnail. Max 5 photos.</Text>
        </View>

        {/* ── Basic info ── */}
        <View className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <Text className="font-bold text-gray-900 mb-3">📝  Basic Info</Text>
          <Controller control={control} name="name"
            render={({ field: { onChange, value } }) => (
              <Input label="Product Name *" placeholder="e.g. Nasi Lemak Special" value={value} onChangeText={onChange} error={errors.name?.message} />
            )}
          />
          <Controller control={control} name="description"
            render={({ field: { onChange, value } }) => (
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-1">Description</Text>
                <View className="border border-gray-200 rounded-xl px-4 py-3 bg-white">
                  <TextInput
                    onChangeText={onChange}
                    value={value ?? ''}
                    style={{ minHeight: 72, textAlignVertical: 'top', color: '#111827' }}
                    multiline
                    numberOfLines={4}
                    placeholder="Describe your product..."
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>
            )}
          />

          {/* Category */}
          {categories.length > 0 && (
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setValue('category_id', '')}
                  className={`px-3 py-2 rounded-xl border ${!selectedCategoryId ? 'bg-primary-500 border-primary-500' : 'border-gray-200'}`}
                >
                  <Text className={`text-sm font-medium ${!selectedCategoryId ? 'text-white' : 'text-gray-600'}`}>None</Text>
                </TouchableOpacity>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setValue('category_id', cat.id)}
                    className={`px-3 py-2 rounded-xl border ${selectedCategoryId === cat.id ? 'bg-primary-500 border-primary-500' : 'border-gray-200'}`}
                  >
                    <Text className={`text-sm font-medium ${selectedCategoryId === cat.id ? 'text-white' : 'text-gray-600'}`}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* ── Pricing ── */}
        <View className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <Text className="font-bold text-gray-900 mb-3">💰  Pricing</Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Controller control={control} name="price"
                render={({ field: { onChange, value } }) => (
                  <Input label="Selling Price (RM) *" placeholder="0.00" keyboardType="decimal-pad"
                    value={value ? String(value) : ''} onChangeText={onChange} error={errors.price?.message} />
                )}
              />
            </View>
            <View className="flex-1">
              <Controller control={control} name="compare_at_price"
                render={({ field: { onChange, value } }) => (
                  <Input label="Original Price (RM)" placeholder="0.00 (optional)" keyboardType="decimal-pad"
                    value={value ? String(value) : ''} onChangeText={onChange}
                    hint="Shows strikethrough 'was RM X'" />
                )}
              />
            </View>
          </View>
        </View>

        {/* ── Inventory ── */}
        <View className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <Text className="font-bold text-gray-900 mb-3">📦  Inventory</Text>

          {/* Track inventory toggle */}
          <TouchableOpacity
            onPress={() => setValue('track_inventory', !trackInventory)}
            className="flex-row items-center justify-between mb-4"
          >
            <View>
              <Text className="text-sm font-semibold text-gray-800">Track stock quantity</Text>
              <Text className="text-xs text-gray-400 mt-0.5">Auto mark out-of-stock when qty reaches 0</Text>
            </View>
            <View className={`w-12 h-6 rounded-full ${trackInventory ? 'bg-primary-500' : 'bg-gray-300'}`}>
              <View className={`w-5 h-5 rounded-full bg-white shadow m-0.5 ${trackInventory ? 'ml-6' : 'ml-0.5'}`} />
            </View>
          </TouchableOpacity>

          {trackInventory && (
            <Controller control={control} name="stock_quantity"
              render={({ field: { onChange, value } }) => (
                <Input label="Stock Quantity" placeholder="0" keyboardType="numeric"
                  value={value ? String(value) : '0'} onChangeText={onChange} />
              )}
            />
          )}

          <Controller control={control} name="weight_grams"
            render={({ field: { onChange, value } }) => (
              <Input label="Weight (grams)" placeholder="e.g. 500" keyboardType="numeric"
                value={value ? String(value) : ''} onChangeText={onChange}
                hint="Used for EasyParcel shipping rate calculation" />
            )}
          />

          {/* Featured toggle */}
          <TouchableOpacity
            onPress={() => setValue('is_featured', !watch('is_featured'))}
            className="flex-row items-center justify-between"
          >
            <View>
              <Text className="text-sm font-semibold text-gray-800">Featured product</Text>
              <Text className="text-xs text-gray-400 mt-0.5">Shown at the top of your store</Text>
            </View>
            <View className={`w-12 h-6 rounded-full ${watch('is_featured') ? 'bg-primary-500' : 'bg-gray-300'}`}>
              <View className={`w-5 h-5 rounded-full bg-white shadow m-0.5 ${watch('is_featured') ? 'ml-6' : 'ml-0.5'}`} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Variants ── */}
        <View className="bg-white rounded-2xl p-4 mb-3"
          style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 }}>
          <View className="flex-row items-center justify-between mb-1">
            <View>
              <Text className="font-bold text-gray-900">🔀  Variants</Text>
              <Text className="text-xs text-gray-400 mt-0.5">e.g. sizes, flavours, colours</Text>
            </View>
            <TouchableOpacity
              onPress={() => appendVariant({ name: '', price_modifier: 0, stock_quantity: 0 })}
              className="flex-row items-center gap-1 bg-primary-50 rounded-xl px-3 py-2"
            >
              <Ionicons name="add" size={14} color="#2563eb" />
              <Text className="text-primary-600 text-sm font-semibold">Add</Text>
            </TouchableOpacity>
          </View>

          {variantFields.length === 0 && (
            <Text className="text-gray-400 text-sm text-center py-3">
              No variants. Add one if this product comes in different sizes or options.
            </Text>
          )}

          {variantFields.map((field, idx) => (
            <View key={field.id} className="border border-gray-100 rounded-xl p-3 mt-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-xs font-bold text-gray-500 uppercase">Variant {idx + 1}</Text>
                <TouchableOpacity onPress={() => removeVariant(idx)}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
              <View className="flex-row gap-2">
                <View className="flex-[2]">
                  <Controller control={control} name={`variants.${idx}.name`}
                    render={({ field: { onChange, value } }) => (
                      <Input label="Name" placeholder="e.g. Large" value={value} onChangeText={onChange}
                        error={errors.variants?.[idx]?.name?.message} />
                    )}
                  />
                </View>
                <View className="flex-1">
                  <Controller control={control} name={`variants.${idx}.price_modifier`}
                    render={({ field: { onChange, value } }) => (
                      <Input label="+/- Price (RM)" placeholder="0" keyboardType="decimal-pad"
                        value={value ? String(value) : '0'} onChangeText={onChange} />
                    )}
                  />
                </View>
                <View className="flex-1">
                  <Controller control={control} name={`variants.${idx}.stock_quantity`}
                    render={({ field: { onChange, value } }) => (
                      <Input label="Stock" placeholder="0" keyboardType="numeric"
                        value={value ? String(value) : '0'} onChangeText={onChange} />
                    )}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        <Button onPress={handleSubmit(onSubmit)} loading={isSaving} className="mt-2">
          {editing ? 'Save Changes' : 'Add Product'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
