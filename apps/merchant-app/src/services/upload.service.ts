import { supabase } from '@/lib/supabase'
import * as FileSystem from 'expo-file-system'
import { Platform } from 'react-native'
import { decode } from 'base64-arraybuffer'

const WORKER_URL = process.env.EXPO_PUBLIC_WORKER_URL!

export const uploadService = {
  async uploadImage(
    bucket: string,
    folder: string,
    localUri: string,
    fileName?: string
  ): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')

    const name = fileName ?? `${Date.now()}.jpg`
    const path = `${bucket}/${folder}/${name}`

    const formData = new FormData()
    
    if (Platform.OS === 'web') {
      const response = await fetch(localUri)
      const blob = await response.blob()
      formData.append('file', blob, name)
    } else {
      // Native read as base64 and convert to blob-like object for FormData
      const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: 'base64',
      })
      // In React Native, we can use an object with uri, type, and name
      // @ts-ignore
      formData.append('file', {
        uri: localUri,
        type: 'image/jpeg',
        name: name,
      })
    }
    
    formData.append('path', path)

    const response = await fetch(`${WORKER_URL}/storage/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json() as any
      throw new Error(error.error || 'Upload failed')
    }

    const { url } = await response.json() as any
    return url
  },

  getPublicUrl(bucket: string, path: string): string {
    // For R2, the public URL is served via the worker
    return `${WORKER_URL}/storage/${bucket}/${path}`
  },
}
