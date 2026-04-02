import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 1. Protection: All paths starting with / except /login, /register, and /apply (public steps)
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register')
  const isApplyPage = request.nextUrl.pathname.startsWith('/apply')
  const isPublicFile = request.nextUrl.pathname.includes('.') || request.nextUrl.pathname.startsWith('/_next')

  if (!user && !isAuthPage && !isPublicFile) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    // Get user profile first to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role === 'admin'

    // Get merchant status
    const { data: merchant } = await supabase
      .from('merchants')
      .select('status, onboarding_completed')
      .eq('owner_id', user.id)
      .single()

    const { data: application } = await supabase
      .from('merchant_applications')
      .select('status')
      .eq('user_id', user.id)
      .single()

    const path = request.nextUrl.pathname

    // Admin handling: Admins can bypass merchant onboarding/application checks
    if (isAdmin) {
       return response
    }

    // Case A: Pending Review
    if (merchant?.status === 'pending_review' && !path.startsWith('/apply/pending')) {
      return NextResponse.redirect(new URL('/apply/pending', request.url))
    }

    if (!merchant && application?.status === 'pending' && !path.startsWith('/apply/pending')) {
      return NextResponse.redirect(new URL('/apply/pending', request.url))
    }

    // Case B: Rejected
    if (application?.status === 'rejected' && !path.startsWith('/apply/rejected')) {
       // Currently handled by the status check if we want to add a page later
    }



    // Case D: No merchant record and not on apply page
    if (!merchant && !application && !isApplyPage && !isAuthPage && !isPublicFile) {
      return NextResponse.redirect(new URL('/apply', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
