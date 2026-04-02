import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { geocodingService } from '@/services/geocoding.service'
import Toast from 'react-native-toast-message'
import type { Address } from '@/types/app.types'

// ─── Form schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  label:          z.string().min(1, 'Required'),
  recipient_name: z.string().min(2, 'Enter recipient name'),
  phone:          z.string().min(10, 'Enter valid phone number'),
  address_line1:  z.string().min(5, 'Enter street address'),
  address_line2:  z.string().optional(),
  city:           z.string().min(2, 'Enter city'),
  state:          z.string().min(2, 'Enter state'),
  postcode:       z.string().length(5, '5-digit postcode required'),
})
type FormData = z.infer<typeof schema>

const LABEL_PRESETS = ['Home', 'Office', 'Parent\'s House', 'Other']
const STATES = ['Johor','Kedah','Kelantan','Melaka','Negeri Sembilan','Pahang','Perak','Perlis','Pulau Pinang','Sabah','Sarawak','Selangor','Terengganu','W.P. Kuala Lumpur','W.P. Labuan','W.P. Putrajaya']

// ─── Add/Edit bottom sheet modal ──────────────────────────────────────────────
function AddressFormModal({
  visible,
  editing,
  onClose,
  onSaved,
  userId,
}: {
  visible:  boolean
  editing:  Address | null
  onClose:  () => void
  onSaved:  () => void
  userId:   string
}) {
  const [isSaving, setIsSaving] = useState(false)
  const qc = useQueryClient()

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      label:          editing?.label          ?? 'Home',
      recipient_name: editing?.recipient_name ?? '',
      phone:          editing?.phone          ?? '',
      address_line1:  editing?.address_line1  ?? '',
      address_line2:  editing?.address_line2  ?? '',
      city:           editing?.city           ?? '',
      state:          editing?.state          ?? 'Selangor',
      postcode:       editing?.postcode       ?? '',
    },
  })

  const selectedLabel = watch('label')

  const onSubmit = async (data: FormData) => {
    setIsSaving(true)
    try {
      if (editing) {
        const { error } = await supabase.from('addresses').update({ ...data }).eq('id', editing.id)
        if (error) throw error

        // ── Geocode and store lat/lng (non-blocking) ──────────────────────────
        geocodingService.geocodeAddress(editing.id, {
          address_line1: data.address_line1,
          address_line2: data.address_line2,
          city:          data.city,
          state:         data.state,
          postcode:      data.postcode,
        }).then(() => {
          // background refresh once geocoding is done
          qc.invalidateQueries({ queryKey: ['addresses'] })
        })

        Toast.show({ type: 'success', text1: 'Address updated' })
      } else {
        const { data: row, error } = await supabase
          .from('addresses')
          .insert({ ...data, user_id: userId, country: 'MY' })
          .select('id')
          .single()
        if (error) throw error

        // ── Geocode and store lat/lng (non-blocking) ──────────────────────────
        if (row?.id) {
          geocodingService.geocodeAddress(row.id, {
            address_line1: data.address_line1,
            address_line2: data.address_line2,
            city:          data.city,
            state:         data.state,
            postcode:      data.postcode,
          }).then(() => {
            // background refresh once geocoding is done
            qc.invalidateQueries({ queryKey: ['addresses'] })
          })
        }

        Toast.show({ type: 'success', text1: 'Address added' })
      }
      onSaved()
      onClose()
      reset()
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Error', text2: err.message })
    }
    setIsSaving(false)
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Modal header */}
        <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <Text className="text-xl font-bold text-gray-900">
            {editing ? 'Edit Address' : 'New Address'}
          </Text>
          <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
            <Ionicons name="close" size={18} color="#374151" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Label presets */}
          <Text className="text-sm font-semibold text-gray-700 mb-2">Label</Text>
          <View className="flex-row gap-2 mb-4">
            {LABEL_PRESETS.map((l) => (
              <TouchableOpacity
                key={l}
                onPress={() => setValue('label', l)}
                className={`px-3 py-2 rounded-xl border
                  ${selectedLabel === l ? 'bg-primary-500 border-primary-500' : 'border-gray-200'}`}
              >
                <Text className={`text-sm font-semibold ${selectedLabel === l ? 'text-white' : 'text-gray-600'}`}>
                  {l}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Controller control={control} name="recipient_name"
            render={({ field: { onChange, value } }) => (
              <Input label="Recipient Name" placeholder="Full name" value={value} onChangeText={onChange} error={errors.recipient_name?.message} />
            )}
          />
          <Controller control={control} name="phone"
            render={({ field: { onChange, value } }) => (
              <Input label="Phone Number" placeholder="0123456789" keyboardType="phone-pad" value={value} onChangeText={onChange} error={errors.phone?.message} />
            )}
          />
          <Controller control={control} name="address_line1"
            render={({ field: { onChange, value } }) => (
              <Input label="Address Line 1" placeholder="No. 1, Jalan Example" value={value} onChangeText={onChange} error={errors.address_line1?.message} />
            )}
          />
          <Controller control={control} name="address_line2"
            render={({ field: { onChange, value } }) => (
              <Input label="Address Line 2 (Optional)" placeholder="Unit, Floor, Block" value={value ?? ''} onChangeText={onChange} />
            )}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Controller control={control} name="city"
                render={({ field: { onChange, value } }) => (
                  <Input label="City" placeholder="Petaling Jaya" value={value} onChangeText={onChange} error={errors.city?.message} />
                )}
              />
            </View>
            <View className="flex-1">
              <Controller control={control} name="postcode"
                render={({ field: { onChange, value } }) => (
                  <Input label="Postcode" placeholder="47500" keyboardType="numeric" maxLength={5} value={value} onChangeText={onChange} error={errors.postcode?.message} />
                )}
              />
            </View>
          </View>

          {/* State picker */}
          <Text className="text-sm font-semibold text-gray-700 mb-2">State</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            <View className="flex-row gap-2">
              {STATES.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setValue('state', s)}
                  className={`px-3 py-2 rounded-xl border whitespace-nowrap
                    ${watch('state') === s ? 'bg-primary-500 border-primary-500' : 'border-gray-200'}`}
                >
                  <Text className={`text-xs font-medium ${watch('state') === s ? 'text-white' : 'text-gray-600'}`}>
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          {errors.state && <Text className="text-red-500 text-xs mb-3">{errors.state.message}</Text>}

          <Button onPress={handleSubmit(onSubmit)} loading={isSaving}>
            {editing ? 'Update Address' : 'Save Address'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Address card ──────────────────────────────────────────────────────────────
function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  onRegeocode,
}: {
  address:      Address
  onEdit:       () => void
  onDelete:     () => void
  onSetDefault: () => void
  onRegeocode:  () => void
}) {
  const isLocating = !address.lat || !address.lng

  return (
    <View
      className={`bg-white rounded-2xl p-4 mb-3
        ${address.is_default ? 'border-2 border-primary-400' : ''}`}
      style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <View className="bg-primary-50 rounded-lg px-2 py-1">
            <Text className="text-primary-700 text-xs font-bold">{address.label}</Text>
          </View>
          {address.is_default && (
            <View className="bg-primary-500 rounded-lg px-2 py-1">
              <Text className="text-white text-xs font-bold">Default</Text>
            </View>
          )}
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={onEdit}>
            <Ionicons name="pencil-outline" size={18} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="mt-2">
        <Text className="font-semibold text-gray-900 text-sm">{address.recipient_name}</Text>
        <Text className="text-gray-500 text-sm mt-0.5">{address.phone}</Text>
        <Text className="text-gray-500 text-sm mt-0.5" numberOfLines={2}>
          {address.address_line1}
          {address.address_line2 ? `, ${address.address_line2}` : ''},{' '}
          {address.city}, {address.state} {address.postcode}
        </Text>
      </View>

      <View className="mt-4 flex-row items-center justify-between">
        <View className="flex-row gap-4">
          {!address.is_default && (
            <TouchableOpacity onPress={onSetDefault}>
              <Text className="text-primary-600 text-xs font-semibold">Set default</Text>
            </TouchableOpacity>
          )}
          {isLocating && (
            <TouchableOpacity onPress={onRegeocode} className="flex-row items-center gap-1">
              <Ionicons name="refresh" size={12} color="#2563eb" />
              <Text className="text-primary-600 text-xs font-semibold">Retry lookup</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLocating && (
          <View className="flex-row items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-lg">
            <ActivityIndicator size="small" color="#b45309" />
            <Text className="text-amber-700 text-[10px] font-bold uppercase tracking-wider">Locating...</Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ─── Main screen ───────────────────────────────────────────────────────────────
export default function AddressesScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [modalVisible, setModalVisible] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)

  const { data: addresses = [], isLoading, isError, refetch, isFetching } = useQuery<Address[]>({
    queryKey: ['addresses', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user!.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!user?.id,
  })

  const handleRegeocode = async (addr: Address) => {
    Toast.show({ type: 'info', text1: 'Updating location...' })
    await geocodingService.geocodeAddress(addr.id, {
      address_line1: addr.address_line1,
      address_line2: addr.address_line2,
      city:          addr.city,
      state:         addr.state,
      postcode:      addr.postcode,
    })
    refetch()
  }

  const handleDelete = (id: string) => {
    Alert.alert('Delete address?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('addresses').delete().eq('id', id)
          refetch()
          Toast.show({ type: 'success', text1: 'Address deleted' })
        },
      },
    ])
  }

  const handleSetDefault = async (id: string) => {
    // Unset all defaults first, then set this one
    await supabase
      .from('addresses')
      .update({ is_default: false })
      .eq('user_id', user!.id)
    await supabase
      .from('addresses')
      .update({ is_default: true })
      .eq('id', id)
    refetch()
    Toast.show({ type: 'success', text1: 'Default address updated' })
  }

  const openAdd = () => {
    setEditingAddress(null)
    setModalVisible(true)
  }

  const openEdit = (addr: Address) => {
    setEditingAddress(addr)
    setModalVisible(true)
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-3 flex-row items-center justify-between border-b border-gray-100">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900">Saved Addresses</Text>
        </View>
        <TouchableOpacity onPress={openAdd} className="bg-primary-500 rounded-xl px-3 py-2 flex-row items-center gap-1">
          <Ionicons name="add" size={16} color="#fff" />
          <Text className="text-white text-sm font-bold">Add</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="p-4 gap-3">
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-offline-outline" size={48} color="#9ca3af" />
          <Text className="text-lg font-bold text-gray-700 mt-4">Failed to load addresses</Text>
          <TouchableOpacity onPress={() => refetch()} className="mt-4 bg-primary-500 rounded-2xl px-6 py-3">
            <Text className="text-white font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : addresses.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <View className="w-20 h-20 rounded-full bg-primary-50 items-center justify-center mb-4">
            <Ionicons name="location-outline" size={36} color="#2563eb" />
          </View>
          <Text className="text-lg font-bold text-gray-700 text-center">No addresses yet</Text>
          <Text className="text-gray-400 text-sm text-center mt-1">
            Add a delivery address to get started.
          </Text>
          <TouchableOpacity onPress={openAdd} className="mt-5 bg-primary-500 rounded-2xl px-6 py-3">
            <Text className="text-white font-semibold">Add Address</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshing={isFetching}
          onRefresh={refetch}
          renderItem={({ item }) => (
            <AddressCard
              address={item}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
              onSetDefault={() => handleSetDefault(item.id)}
              onRegeocode={() => handleRegeocode(item)}
            />
          )}
        />
      )}

      {/* Add/Edit modal */}
      {user?.id && (
        <AddressFormModal
          visible={modalVisible}
          editing={editingAddress}
          userId={user.id}
          onClose={() => setModalVisible(false)}
          onSaved={() => {
            refetch()
            qc.invalidateQueries({ queryKey: ['addresses'] })
          }}
        />
      )}
    </View>
  )
}
