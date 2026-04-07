import React, { useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Dimensions
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { formatCurrency } from '@/lib/utils'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  total: number
  onConfirm: (method: 'cash' | 'card' | 'ewallet', cashReceived: number, change: number) => void
}

export function PaymentModal({ isOpen, onClose, total, onConfirm }: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'ewallet'>('cash')
  const [cashReceived, setCashReceived] = useState<string>('')
  const [change, setChange] = useState<number>(0)

  useEffect(() => {
    const received = parseFloat(cashReceived) || 0
    setChange(Math.max(0, received - total))
  }, [cashReceived, total])

  const handleNumberPress = (num: string) => {
    if (num === '.' && cashReceived.includes('.')) return
    setCashReceived(prev => prev + num)
  }

  const handleClear = () => setCashReceived('')
  const handleBackspace = () => setCashReceived(prev => prev.slice(0, -1))

  const handleQuickCash = (amount: number) => {
    setCashReceived(amount.toString())
  }

  const handleExactAmount = () => {
    setCashReceived(total.toFixed(2))
  }

  const canConfirm = paymentMethod !== 'cash' || (parseFloat(cashReceived) >= total)

  const handleFinalConfirm = () => {
    if (!canConfirm) return
    const received = paymentMethod === 'cash' ? parseFloat(cashReceived) : total
    const changeVal = paymentMethod === 'cash' ? change : 0
    onConfirm(paymentMethod, received, changeVal)
  }

  return (
    <Modal visible={isOpen} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#1f2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Total Display */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          </View>

          {/* Payment Method Toggle */}
          <View style={styles.methodContainer}>
            <TouchableOpacity 
              onPress={() => setPaymentMethod('cash')}
              style={[styles.methodButton, paymentMethod === 'cash' && styles.methodActive]}
            >
              <Ionicons name="cash-outline" size={24} color={paymentMethod === 'cash' ? '#fff' : '#64748b'} />
              <Text style={[styles.methodText, paymentMethod === 'cash' && styles.methodTextActive]}>Cash</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setPaymentMethod('card')}
              style={[styles.methodButton, paymentMethod === 'card' && styles.methodActive]}
            >
              <Ionicons name="card-outline" size={24} color={paymentMethod === 'card' ? '#fff' : '#64748b'} />
              <Text style={[styles.methodText, paymentMethod === 'card' && styles.methodTextActive]}>Card</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setPaymentMethod('ewallet')}
              style={[styles.methodButton, paymentMethod === 'ewallet' && styles.methodActive]}
            >
              <Ionicons name="wallet-outline" size={24} color={paymentMethod === 'ewallet' ? '#fff' : '#64748b'} />
              <Text style={[styles.methodText, paymentMethod === 'ewallet' && styles.methodTextActive]}>E-Wallet</Text>
            </TouchableOpacity>
          </View>

          {paymentMethod === 'cash' && (
            <View style={styles.cashSection}>
              <View style={styles.inputValuesContainer}>
                <View style={styles.inputValueBlock}>
                  <Text style={styles.inputValueLabel}>Cash Received</Text>
                  <Text style={[styles.inputValueText, !cashReceived && styles.placeholderText]}>
                    {cashReceived ? formatCurrency(parseFloat(cashReceived) || 0) : 'RM 0.00'}
                  </Text>
                </View>
                <View style={styles.inputValueBlock}>
                  <Text style={styles.inputValueLabel}>Change Due</Text>
                  <Text style={[styles.inputValueText, styles.changeText]}>{formatCurrency(change)}</Text>
                </View>
              </View>

              {/* Quick Cash Buttons */}
              <View style={styles.quickCashContainer}>
                <TouchableOpacity onPress={handleExactAmount} style={styles.quickCashButton}>
                  <Text style={styles.quickCashText}>Exact</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleQuickCash(10)} style={styles.quickCashButton}>
                  <Text style={styles.quickCashText}>RM 10</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleQuickCash(20)} style={styles.quickCashButton}>
                  <Text style={styles.quickCashText}>RM 20</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleQuickCash(50)} style={styles.quickCashButton}>
                  <Text style={styles.quickCashText}>RM 50</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleQuickCash(100)} style={styles.quickCashButton}>
                  <Text style={styles.quickCashText}>RM 100</Text>
                </TouchableOpacity>
              </View>

              {/* Numpad */}
              <View style={styles.numpad}>
                <View style={styles.numpadRow}>
                  {['1', '2', '3'].map(n => (
                    <TouchableOpacity key={n} onPress={() => handleNumberPress(n)} style={styles.numpadButton}>
                      <Text style={styles.numpadText}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.numpadRow}>
                  {['4', '5', '6'].map(n => (
                    <TouchableOpacity key={n} onPress={() => handleNumberPress(n)} style={styles.numpadButton}>
                      <Text style={styles.numpadText}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.numpadRow}>
                  {['7', '8', '9'].map(n => (
                    <TouchableOpacity key={n} onPress={() => handleNumberPress(n)} style={styles.numpadButton}>
                      <Text style={styles.numpadText}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.numpadRow}>
                  <TouchableOpacity onPress={() => handleNumberPress('.')} style={styles.numpadButton}>
                    <Text style={styles.numpadText}>.</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleNumberPress('0')} style={styles.numpadButton}>
                    <Text style={styles.numpadText}>0</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleBackspace} style={styles.numpadButton}>
                    <Ionicons name="backspace-outline" size={24} color="#1f2937" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {paymentMethod !== 'cash' && (
            <View style={styles.nonCashPlaceholder}>
              <Ionicons name={paymentMethod === 'card' ? 'card' : 'qr-code'} size={80} color="#e5e7eb" />
              <Text style={styles.nonCashText}>
                Please process payment via {paymentMethod === 'card' ? 'Terminal' : 'E-Wallet QR'}.
              </Text>
              <Text style={styles.nonCashSubtext}>Once payment is successful, click Confirm below.</Text>
            </View>
          )}
        </ScrollView>

        {/* Footer Action */}
        <View style={[styles.footer, { paddingBottom: Math.max(useSafeAreaInsets().bottom, 20) }]}>
          <TouchableOpacity 
            onPress={handleFinalConfirm}
            disabled={!canConfirm}
            style={[styles.confirmButton, !canConfirm && styles.confirmDisabled]}
          >
            <Text style={styles.confirmText}>Confirm & Finalize Sale</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  )
}

const { width } = Dimensions.get('window')
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  totalCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  totalValue: {
    fontSize: 42,
    fontWeight: '900',
    color: '#111827',
  },
  methodContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  methodButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodActive: {
    backgroundColor: '#2563eb',
    borderColor: '#3b82f6',
  },
  methodText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748b',
  },
  methodTextActive: {
    color: '#fff',
  },
  cashSection: {
    gap: 8,
  },
  inputValuesContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  inputValueBlock: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
  },
  inputValueLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  inputValueText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  placeholderText: {
    color: '#d1d5db',
  },
  changeText: {
    color: '#10b981',
  },
  quickCashContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  quickCashButton: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  quickCashText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  numpad: {
    gap: 8,
  },
  numpadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  numpadButton: {
    flex: 1,
    height: 60,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numpadText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1f2937',
  },
  nonCashPlaceholder: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  nonCashText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  nonCashSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  confirmButton: {
    backgroundColor: '#2563eb',
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmDisabled: {
    backgroundColor: '#e5e7eb',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
})
