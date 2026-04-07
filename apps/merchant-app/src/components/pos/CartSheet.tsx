import React from 'react'
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { usePosCartStore } from '@/stores/posCartStore'
import { formatCurrency } from '@/lib/utils'
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context'

export function CartSheet({ onCheckout, onAddDiscount, onSelectCustomer, onClose }: any) {
  const insets = useSafeAreaInsets()
  const { items, updateQty, removeItem, getTotals, customerName, clearCart } = usePosCartStore()
  const totals = getTotals()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View className="px-5 py-4 border-b border-gray-50 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity onPress={onClose} className="p-1 -ml-1">
              <Ionicons name="chevron-back" size={24} color="#374151" />
            </TouchableOpacity>
            <View className="flex-row items-center gap-2">
              <Text className="text-xl font-bold text-gray-900">Current Cart</Text>
              <View className="bg-primary-50 px-2 py-0.5 rounded-full">
                <Text className="text-primary-600 font-bold text-xs">
                  {items.reduce((s, i) => s + i.qty, 0)}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={clearCart} className="p-2">
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Customer Strip */}
        <TouchableOpacity 
          onPress={onSelectCustomer}
          className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-3">
            <View className="w-8 h-8 rounded-full bg-white items-center justify-center border border-gray-200">
              <Ionicons name="person-outline" size={16} color="#64748b" />
            </View>
            <View>
              <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Customer</Text>
              <Text className="text-sm font-semibold text-gray-900">{customerName || 'Walk-in Customer'}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
        </TouchableOpacity>

        {/* Items List */}
        <ScrollView className="flex-1 px-5 pt-4">
          {items.length === 0 ? (
            <View className="items-center justify-center py-20 opacity-20">
              <Ionicons name="receipt-outline" size={64} color="#64748b" />
              <Text className="text-gray-900 font-medium mt-4">Cart is empty</Text>
            </View>
          ) : (
            items.map((item) => (
              <View key={`${item.productId}-${item.variantId || ''}`} className="flex-row items-center mb-6 gap-4">
                <View className="flex-1">
                  <Text className="text-sm font-bold text-gray-900 mb-1" numberOfLines={1}>{item.name}</Text>
                  <Text className="text-[10px] text-gray-400 font-mono uppercase tracking-tight mb-2">{item.sku}</Text>
                  <View className="flex-row items-center gap-3">
                    <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                      <TouchableOpacity 
                        onPress={() => updateQty(item.productId, item.variantId, item.qty - 1)}
                        className="p-1 px-2 border-r border-gray-200"
                      >
                        <Ionicons name="remove" size={16} color="#64748b" />
                      </TouchableOpacity>
                      <Text className="px-3 py-1 font-bold text-gray-900 min-w-[30px] text-center">{item.qty}</Text>
                      <TouchableOpacity 
                        onPress={() => updateQty(item.productId, item.variantId, item.qty + 1)}
                        className="p-1 px-2 border-l border-gray-200"
                      >
                        <Ionicons name="add" size={16} color="#64748b" />
                      </TouchableOpacity>
                    </View>
                    <Text className="text-sm font-bold text-primary-600">{formatCurrency(item.lineTotal)}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => removeItem(item.productId, item.variantId)} className="p-2">
                  <Ionicons name="close-circle-outline" size={24} color="#cbd5e1" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        {/* Summary Footer */}
        <View 
          className="bg-white border-t border-gray-100 shadow-2xl pt-5 px-5"
          style={{ paddingBottom: Math.max(insets.bottom, 20) }}
        >
          <View className="space-y-2 mb-6">
            <View className="flex-row justify-between">
              <Text className="text-gray-500 font-medium">Subtotal</Text>
              <Text className="text-gray-900 font-bold">{formatCurrency(totals.subtotal)}</Text>
            </View>
            
            {(totals.lineDiscounts > 0 || totals.globalDiscount > 0) && (
              <TouchableOpacity 
                onPress={onAddDiscount}
                className="flex-row justify-between bg-amber-50 px-3 py-2 rounded-xl border border-amber-100 items-center"
              >
                <View className="flex-row items-center gap-2">
                  <Ionicons name="pricetag-outline" size={16} color="#d97706" />
                  <Text className="text-amber-700 font-bold text-sm">Total Discount</Text>
                </View>
                <Text className="text-amber-700 font-black">- {formatCurrency(totals.lineDiscounts + totals.globalDiscount)}</Text>
              </TouchableOpacity>
            )}

            <View className="flex-row justify-between">
              <Text className="text-gray-500 font-medium">Tax (8% SST)</Text>
              <Text className="text-gray-900 font-bold">{formatCurrency(totals.tax)}</Text>
            </View>
            
            <TouchableOpacity onPress={onAddDiscount} className="flex-row items-center gap-1 mt-1">
              <Ionicons name="add-circle-outline" size={14} color="#f59e0b" />
              <Text className="text-[10px] text-amber-600 font-black uppercase tracking-widest">Apply Global Discount</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-end justify-between border-t border-gray-100 border-dashed pt-4 mb-6">
            <Text className="text-lg font-bold text-gray-900">Grand Total</Text>
            <Text className="text-4xl font-black text-primary-600 tracking-tighter">
              {formatCurrency(totals.total)}
            </Text>
          </View>

          <TouchableOpacity 
            onPress={onCheckout}
            disabled={items.length === 0}
            className={`flex-row items-center justify-center gap-3 h-16 rounded-2xl shadow-lg transition-all ${
              items.length > 0 ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <Ionicons name="wallet-outline" size={24} color="#fff" />
            <Text className="text-white font-black text-xl">Review & Pay</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  )
}
