import { supabase } from '@/lib/supabase'
import * as FileSystem from 'expo-file-system'
import { Platform } from 'react-native'
import { decode } from 'base64-arraybuffer'

type BucketName = 'avatars' | 'merchant-assets' | 'product-images' | 'review-images'

export const uploadService = {
  async uploadImage(
    bucket: BucketName,
    folder: string,
    localUri: string,
    fileName?: string
  ): Promise<string> {
    const name = fileName ?? `${Date.now()}.jpg`
    const path = `${folder}/${name}`

    let body: ArrayBuffer

    if (Platform.OS === 'web') {
      const response = await fetch(localUri)
      body = await response.arrayBuffer()
    } else {
      // Native read as base64
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: 'base64',
      })
      body = decode(base64)
    }

    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, body, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (error) throw error

    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  },

  getPublicUrl(bucket: BucketName, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  },
}
