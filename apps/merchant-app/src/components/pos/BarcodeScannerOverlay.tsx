import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native'
import { CameraView } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'

const { width, height } = Dimensions.get('window')
const scanAreaSize = 250

export function BarcodeScannerOverlay({ onScan, onClose }: any) {
  return (
    <View style={StyleSheet.absoluteFill} className="bg-black">
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={({ data }) => onScan(data)}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'ean13', 'ean8', 'code128'],
        }}
      >
        <View className="flex-1 bg-black/60 items-center justify-center">
          {/* Top Info */}
          <View className="absolute top-16 px-10 items-center">
            <Text className="text-white text-lg font-bold text-center">Scan Product Barcode</Text>
            <Text className="text-white/60 text-sm text-center mt-2">Align the barcode within the frame</Text>
          </View>

          {/* Viewfinder */}
          <View 
            style={{ width: scanAreaSize, height: scanAreaSize }} 
            className="border-2 border-primary-500 rounded-3xl"
          >
            {/* Corner animations or static indicators could go here */}
            <View className="flex-1 items-center justify-center">
              <View className="w-full h-[2px] bg-primary-500/50 shadow-lg shadow-primary-500" />
            </View>
          </View>

          {/* Bottom Actions */}
          <View className="absolute bottom-16 w-full px-10 flex-row items-center justify-center">
            <TouchableOpacity 
              onPress={onClose}
              className="bg-white/20 px-8 py-4 rounded-2xl flex-row items-center gap-2"
            >
              <Ionicons name="close" size={24} color="#fff" />
              <Text className="text-white font-bold">Cancel Scanning</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  )
}
