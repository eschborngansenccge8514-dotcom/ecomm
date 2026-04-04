import { createClient } from './supabase/client'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787'

export async function uploadToR2(file: File, path: string): Promise<string> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const formData = new FormData()
  formData.append('file', file)
  formData.append('path', path)

  const res = await fetch(`${WORKER_URL}/storage/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    },
    body: formData
  })

  if (!res.ok) {
    const errData = await res.json() as any
    throw new Error(errData.error || 'Upload failed')
  }

  const { url } = await res.json() as any
  return url
}

export function getR2PublicUrl(key: string): string {
  return `${WORKER_URL}/storage/${key}`
}
