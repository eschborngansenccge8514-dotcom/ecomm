import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: application_id } = await params
  const { action, reason } = await req.json()

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  // 1. Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  // 2. Fetch the application
  const { data: application, error: fetchErr } = await supabase
    .from('merchant_applications')
    .select('*')
    .eq('id', application_id)
    .single()

  if (fetchErr || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  if (action === 'approve') {
    // 3. Approve logic
    const { error: appUpdateErr } = await supabase
      .from('merchant_applications')
      .update({ 
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', application_id)

    if (appUpdateErr) return NextResponse.json({ error: appUpdateErr.message }, { status: 400 })

    // 4. Update or Create merchant status to active
    // The application route should have created it, but if it failed partially, we upsert here.
    const slug = application.store_name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
    const { error: merchantErr } = await supabase
      .from('merchants')
      .upsert({ 
        owner_id: application.user_id,
        store_name: application.store_name,
        store_slug: slug,
        industry: application.store_type || 'General Retail',
        postcode: application.postcode || '00000',
        country: 'MY',
        status: 'active',
        onboarding_completed: true,
        updated_at: new Date().toISOString()
      }, { onConflict: 'owner_id' })

    if (merchantErr) return NextResponse.json({ error: merchantErr.message }, { status: 400 })

    // 5. Upgrade user role to merchant
    const { error: roleErr } = await supabase
      .from('profiles')
      .update({ role: 'merchant' })
      .eq('id', application.user_id)

    if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } else if (action === 'reject') {
    // 6. Reject logic
    const { error: appUpdateErr } = await supabase
      .from('merchant_applications')
      .update({ 
        status: 'rejected',
        rejection_reason: reason,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', application_id)

    if (appUpdateErr) return NextResponse.json({ error: appUpdateErr.message }, { status: 400 })

     // Optionally we could deactivate the merchant if one was created
     await supabase
      .from('merchants')
      .update({ 
        status: 'deactivated',
        updated_at: new Date().toISOString()
      })
      .eq('owner_id', application.user_id)

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
