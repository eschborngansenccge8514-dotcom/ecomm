import { Hono } from 'hono'
import { Bindings, getSupabaseClient } from '../lib/supabase'

const storage = new Hono<{ Bindings: Bindings }>()

// GET /storage/:key - Get a file from R2
storage.get('/:key{.+}', async (c) => {
  const key = c.req.param('key')
  const object = await c.env.R2_BUCKET.get(key)

  if (!object) {
    return c.text('Object not found', 404)
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  
  // Cache for 1 hour
  headers.set('cache-control', 'public, max-age=3600')

  return new Response(object.body, {
    headers,
  })
})

// POST /storage/upload - Upload a file to R2
storage.post('/upload', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) {
    return c.json({ error: 'Missing Authorization header' }, 401)
  }

  const supabase = getSupabaseClient(c.env)
  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

  if (authError || !user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const formData = await c.req.formData()
  const file = formData.get('file') as File
  const customPath = formData.get('path') as string // optional path e.g. "products/id.jpg"

  if (!file) {
    return c.json({ error: 'No file uploaded' }, 400)
  }

  const ext = file.name.split('.').pop()
  const key = customPath || `uploads/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  await c.env.R2_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
  })

  // Return the full URL
  const url = new URL(c.req.url)
  const publicUrl = `${url.origin}/storage/${key}`

  return c.json({
    success: true,
    key,
    url: publicUrl,
  })
})

export default storage
