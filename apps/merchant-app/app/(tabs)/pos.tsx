import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { posService } from '@/services/pos.service'
import { usePosCartStore } from '@/stores/posCartStore'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import { PosProduct } from '@project1/domain'
import { useQuery } from '@tanstack/react-query'
import { BarcodeScannerOverlay } from '@/components/pos/BarcodeScannerOverlay'
import { CartSheet } from '@/components/pos/CartSheet'
import { DiscountModal } from '@/components/pos/DiscountModal'
import { CustomerSearch } from '@/components/pos/CustomerSearch'
import { PaymentModal } from '@/components/pos/PaymentModal'
import { SuccessModal } from '@/components/pos/SuccessModal'
import { Camera } from 'expo-camera'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export default function PosScreen() {
  const insets = useSafeAreaInsets()
  const { merchant } = useAuthStore()
  const { items, addItem, setSession, setTaxRate, clearCart, getTotals } = usePosCartStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [isCartVisible, setIsCartVisible] = useState(false)
  const [isScannerVisible, setIsScannerVisible] = useState(false)
  const [isDiscountVisible, setIsDiscountVisible] = useState(false)
  const [isCustomerVisible, setIsCustomerVisible] = useState(false)
  const [isPaymentVisible, setIsPaymentVisible] = useState(false)
  const [isSuccessVisible, setIsSuccessVisible] = useState(false)
  const [lastTransaction, setLastTransaction] = useState<any>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isProcessing, setIsProcessing] = useState(false)

  // Initialize session and permissions
  useEffect(() => {
    async function init() {
      try {
        const info = await posService.getOrInitializeSession()
        setSession(info.outletId, info.sessionId)
        setTaxRate(info.taxRate)
      } catch (err) {
        console.error('Failed to init POS session:', err)
      }
    }
    
    async function getCameraPermission() {
      const { status } = await Camera.requestCameraPermissionsAsync()
      setHasPermission(status === 'granted')
    }

    init()
    getCameraPermission()
  }, [])

  // Fetch products
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['pos-products', merchant?.id],
    queryFn: () => posService.fetchPosProducts(merchant!.id),
    enabled: !!merchant?.id
  })

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean))
    return ['All', ...Array.from(cats)].sort()
  }, [products])

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.barcode?.includes(searchQuery) ||
                          p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const totals = getTotals()

  const onBarcodeScan = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode)
    if (product) {
      addItem(product)
      setIsScannerVisible(false)
    } else {
      Alert.alert("Not Found", `No product with barcode ${barcode}`)
    }
  }

  const openDiscountModal = () => {
    setIsCartVisible(false)
    setTimeout(() => setIsDiscountVisible(true), 150)
  }

  const openCustomerSearch = () => {
    setIsCartVisible(false)
    setTimeout(() => setIsCustomerVisible(true), 150)
  }

  const handleCheckout = async (method: 'cash' | 'card' | 'ewallet', cashReceived: number, change: number) => {
    if (items.length === 0 || isProcessing) return
    
    setIsProcessing(true)
    try {
      const { outletId, sessionId, customerId } = usePosCartStore.getState()
      
      const result = await posService.submitTransaction({
        items: items,
        totals: totals,
        paymentMethod: method,
        outletId,
        sessionId,
        customerId,
        cashReceived,
        change,
        notes: 'Mobile POS Sale'
      })

      if (result.success) {
        setLastTransaction({
          receiptNumber: result.receiptNumber,
          total: totals.total,
          paymentMethod: method,
          cashReceived,
          change,
          items: [...items]
        })
        
        setIsPaymentVisible(false)
        setIsCartVisible(false)
        setIsSuccessVisible(true)
        clearCart()
      }
    } catch (err) {
      console.error(err)
      Alert.alert("Error", "Failed to submit transaction. Please check your connection and try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  const openPaymentSelection = () => {
    if (items.length === 0) return
    setIsCartVisible(false) // Close cart first to avoid modal stacking issues
    setTimeout(() => {
      setIsPaymentVisible(true)
    }, 100)
  }

  const renderProduct = ({ item }: { item: PosProduct }) => {
    if (viewMode === 'list') {
      return (
        <TouchableOpacity 
          onPress={() => addItem(item)}
          className="bg-white rounded-2xl p-3 mb-3 border border-gray-100 shadow-sm flex-row items-center gap-4 mx-4"
        >
          <View className="w-16 h-16 bg-gray-50 rounded-xl items-center justify-center overflow-hidden">
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <Text className="text-gray-300 font-bold text-lg">{item.name.charAt(0)}</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-gray-900 mb-0.5" numberOfLines={1}>{item.name}</Text>
            <Text className="text-[10px] text-gray-400 font-mono uppercase tracking-tight mb-1">{item.sku}</Text>
            <Text className="text-sm text-primary-600 font-bold">{formatCurrency(item.unitPrice)}</Text>
          </View>
          <View className="bg-primary-50 w-8 h-8 rounded-full items-center justify-center">
            <Ionicons name="add" size={20} color="#2563eb" />
          </View>
        </TouchableOpacity>
      )
    }

    return (
      <View style={{ width: '50%', padding: 6 }}>
        <TouchableOpacity 
          onPress={() => addItem(item)}
          className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm h-full"
        >
          <View className="aspect-square bg-gray-50 rounded-xl mb-2 items-center justify-center overflow-hidden">
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <Text className="text-gray-300 font-bold text-xl">{item.name.charAt(0)}</Text>
            )}
          </View>
          <Text className="text-sm font-semibold text-gray-900 mb-1" numberOfLines={2}>{item.name}</Text>
          <Text className="text-xs text-primary-600 font-bold">{formatCurrency(item.unitPrice)}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View className="px-5 py-4 bg-white border-b border-gray-100">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-2xl font-bold text-gray-900">Digital POS</Text>
              <View className="flex-row items-center gap-3">
                <TouchableOpacity 
                  onPress={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
                  className="w-12 h-12 bg-gray-50 rounded-full items-center justify-center"
                >
                  <Ionicons name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'} size={24} color="#64748b" />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setIsCartVisible(true)}
                  className="w-12 h-12 bg-primary-50 rounded-full items-center justify-center relative"
                >
                  <Ionicons name="cart-outline" size={24} color="#2563eb" />
                  {items.length > 0 && (
                    <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                      <Text className="text-white text-[10px] font-bold">{items.reduce((sum, i) => sum + i.qty, 0)}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View className="flex-row items-center gap-3">
              <View className="flex-1 flex-row items-center bg-gray-100 rounded-2xl px-4 py-3">
                <Ionicons name="search-outline" size={20} color="#64748b" />
                <TextInput
                  placeholder="Search products..."
                  className="flex-1 ml-2 text-sm font-medium"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <TouchableOpacity 
                onPress={() => setIsScannerVisible(true)}
                className="w-12 h-12 bg-gray-900 rounded-2xl items-center justify-center"
              >
                <Ionicons name="scan-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={categories}
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-4"
              renderItem={({ item }) => (
                <TouchableOpacity 
                  onPress={() => setSelectedCategory(item)}
                  className={`px-4 py-2 rounded-full mr-2 ${selectedCategory === item ? 'bg-primary-600' : 'bg-gray-100'}`}
                >
                  <Text className={`text-xs font-bold ${selectedCategory === item ? 'text-white' : 'text-gray-600'}`}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
              keyExtractor={item => item}
            />
          </View>

          {/* Product Grid */}
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : (
            <FlatList
              key={viewMode}
              data={filteredProducts}
              numColumns={viewMode === 'grid' ? 2 : 1}
              columnWrapperStyle={viewMode === 'grid' ? { paddingHorizontal: 6 } : null}
              contentContainerStyle={{ 
                padding: viewMode === 'grid' ? 6 : 0, 
                paddingTop: 12,
                paddingBottom: items.length > 0 ? 100 : 20 
              }}
              renderItem={renderProduct}
              keyExtractor={item => `${item.id}-${item.variantId || ''}`}
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center py-20">
                  <Ionicons name="cube-outline" size={64} color="#e2e8f0" />
                  <Text className="text-gray-400 mt-4 font-medium">No products match</Text>
                </View>
              }
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Anchored Bottom Bar */}
      {items.length > 0 && (
        <View 
          className="bg-white border-t border-gray-100 shadow-2xl"
          style={{ paddingBottom: Math.max(insets.bottom, 24), paddingTop: 12, paddingHorizontal: 20 }}
        >
          <TouchableOpacity 
            onPress={() => setIsCartVisible(true)}
            activeOpacity={0.9}
            className="bg-primary-600 h-16 rounded-2xl flex-row items-center justify-between px-6 shadow-blue-200 shadow-lg"
          >
            <View>
              <Text className="text-primary-100 text-[10px] font-bold uppercase tracking-widest mb-0.5">Total Amount</Text>
              <Text className="text-white text-xl font-black tracking-tight">{formatCurrency(totals.total)}</Text>
            </View>
            <View className="flex-row items-center gap-2 bg-white/20 px-4 py-2 rounded-xl">
              <Text className="text-white font-bold">Review & Pay</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Modals */}
      <Modal visible={isCartVisible} animationType="slide">
        <CartSheet 
          onCheckout={openPaymentSelection}
          onAddDiscount={openDiscountModal}
          onSelectCustomer={openCustomerSearch}
          onClose={() => setIsCartVisible(false)}
        />
      </Modal>

      <DiscountModal isOpen={isDiscountVisible} onClose={() => setIsDiscountVisible(false)} />
      <CustomerSearch isOpen={isCustomerVisible} onClose={() => setIsCustomerVisible(false)} />
      
      <PaymentModal 
        isOpen={isPaymentVisible} 
        onClose={() => setIsPaymentVisible(false)} 
        total={totals.total}
        onConfirm={handleCheckout}
      />

      {lastTransaction && (
        <SuccessModal
          isOpen={isSuccessVisible}
          onClose={() => setIsSuccessVisible(false)}
          transaction={lastTransaction}
        />
      )}
      
      {isScannerVisible && (
        <BarcodeScannerOverlay onScan={onBarcodeScan} onClose={() => setIsScannerVisible(false)} />
      )}
    </View>
  )
}
