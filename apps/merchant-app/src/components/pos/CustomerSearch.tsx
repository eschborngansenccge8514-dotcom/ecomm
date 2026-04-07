import React, { useState } from 'react'
import { View, Text, Modal, TouchableOpacity, TextInput, FlatList, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { usePosCartStore } from '@/stores/posCartStore'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export function CustomerSearch({ isOpen, onClose }: any) {
  const insets = useSafeAreaInsets()
  const { setCustomer } = usePosCartStore()
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])

  // Search with debounce
  React.useEffect(() => {
    if (search.length < 2) {
      setCustomers([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
        .eq('role', 'customer')
        .limit(5)

      setLoading(false)
      if (!error && data) {
        setCustomers(data)
      }
    }, 400) // 400ms debounce

    return () => clearTimeout(timer)
  }, [search])

  const handleSelect = (customer: any) => {
    setCustomer(customer.id, customer.full_name, customer.phone)
    onClose()
  }

  return (
    <Modal visible={isOpen} transparent animationType="slide">
      <View className="flex-1 bg-black/60 justify-end">
        <View 
          className="bg-white rounded-t-3xl h-[80%] p-6"
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-xl font-bold text-gray-900">Select Customer</Text>
            <TouchableOpacity onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View className="mb-6 flex-row items-center bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
            <Ionicons name="search-outline" size={20} color="#64748b" />
            <TextInput
              placeholder="Search by name or phone..."
              className="flex-1 ml-3 text-lg"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {loading && <ActivityIndicator size="small" color="#2563eb" />}
          </View>

          <FlatList
            data={customers}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View className="py-20 items-center opacity-30">
                <Ionicons name="people-outline" size={64} color="#64748b" />
                <Text className="text-gray-900 font-medium mt-4">
                  {search.length < 3 ? 'Enter at least 3 chars' : 'No customers found'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity 
                onPress={() => handleSelect(item)}
                className="py-4 border-b border-gray-50 flex-row items-center justify-between"
              >
                <View>
                  <Text className="text-lg font-bold text-gray-900">{item.full_name}</Text>
                  <Text className="text-xs text-gray-400 font-medium">{item.phone || 'No phone number'}</Text>
                </View>
                <View className="w-10 h-10 rounded-full bg-primary-50 items-center justify-center">
                  <Ionicons name="chevron-forward" size={20} color="#2563eb" />
                </View>
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity 
            onPress={() => {
              setCustomer('', 'Walk-in Customer')
              onClose()
            }}
            className="mt-6 h-14 bg-gray-900 rounded-2xl items-center justify-center"
          >
            <Text className="text-white font-bold">Default to Walk-in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}
