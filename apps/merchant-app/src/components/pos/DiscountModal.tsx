import React, { useState } from 'react'
import { View, Text, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { usePosCartStore } from '@/stores/posCartStore'

export function DiscountModal({ isOpen, onClose }: any) {
  const { globalDiscountRm, setDiscount } = usePosCartStore()
  const [value, setValue] = useState(globalDiscountRm.toString())

  const handleApply = () => {
    const amount = parseFloat(value) || 0
    setDiscount(amount)
    onClose()
  }

  return (
    <Modal visible={isOpen} transparent animationType="fade">
      <View className="flex-1 bg-black/60 items-center justify-center p-6">
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="w-full max-w-sm"
        >
          <View className="bg-white rounded-3xl p-6 shadow-2xl">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-900">Add Discount</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View className="mb-8">
              <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Discount Amount (RM)</Text>
              <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                <Text className="text-gray-400 font-bold mr-2 text-lg">RM</Text>
                <TextInput
                  value={value}
                  onChangeText={setValue}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  className="flex-1 text-2xl font-black text-gray-900"
                  autoFocus
                />
              </View>
              <Text className="text-[10px] text-gray-400 mt-2 italic font-medium">Applied to the total bill amount.</Text>
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity 
                onPress={onClose}
                className="flex-1 h-12 rounded-xl items-center justify-center bg-gray-50 border border-gray-100"
              >
                <Text className="text-gray-600 font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleApply}
                className="flex-[2] h-12 rounded-xl items-center justify-center bg-primary-600 shadow-md shadow-primary-100"
              >
                <Text className="text-white font-bold">Apply Discount</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}
