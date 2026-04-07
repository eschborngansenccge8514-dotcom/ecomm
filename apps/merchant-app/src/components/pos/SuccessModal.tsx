import React from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Dimensions
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { formatCurrency } from '@/lib/utils'

interface SuccessModalProps {
  isOpen: boolean
  onClose: () => void
  transaction: {
    receiptNumber: string
    total: number
    paymentMethod: string
    cashReceived: number
    change: number
    items: any[]
  }
}

export function SuccessModal({ isOpen, onClose, transaction }: SuccessModalProps) {
  const handlePrint = () => {
    // Placeholder for future thermal printer integration
    alert('Connecting to printer... (Placeholder)')
  }

  return (
    <Modal visible={isOpen} animationType="fade" transparent={true}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {/* Success Icon */}
            <View style={styles.iconContainer}>
              <View style={styles.iconBg}>
                <Ionicons name="checkmark-circle" size={80} color="#10b981" />
              </View>
              <Text style={styles.title}>Sale Complete!</Text>
              <Text style={styles.receiptNo}>Receipt: {transaction.receiptNumber}</Text>
            </View>

            {/* Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.row}>
                <Text style={styles.label}>Total Amount</Text>
                <Text style={styles.value}>{formatCurrency(transaction.total)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.label}>Payment Method</Text>
                <Text style={[styles.value, styles.capitalize]}>{transaction.paymentMethod}</Text>
              </View>
              
              {transaction.paymentMethod === 'cash' && (
                <>
                  <View style={styles.row}>
                    <Text style={styles.label}>Cash Received</Text>
                    <Text style={styles.value}>{formatCurrency(transaction.cashReceived)}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Change Due</Text>
                    <Text style={[styles.value, styles.highlight]}>{formatCurrency(transaction.change)}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity onPress={handlePrint} style={styles.printButton}>
                <Ionicons name="print-outline" size={20} color="#374151" />
                <Text style={styles.printText}>Print Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={styles.doneButton}>
                <Text style={styles.doneText}>Next Sale</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.footerText}>Points Earned: {Math.floor(transaction.total)} pts</Text>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 32,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconBg: {
    width: 120,
    height: 120,
    backgroundColor: '#ecfdf5',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 4,
  },
  receiptNo: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'System',
    fontWeight: '500',
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    padding: 20,
    gap: 12,
    marginBottom: 32,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  capitalize: {
    textTransform: 'capitalize',
  },
  highlight: {
    color: '#10b981',
    fontSize: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
  actions: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  printButton: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  printText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  doneButton: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: '#2563eb',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  doneText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
    fontStyle: 'italic',
  }
})
