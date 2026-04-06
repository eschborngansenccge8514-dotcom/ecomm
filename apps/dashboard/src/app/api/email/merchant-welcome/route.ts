import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, FROM_ADDRESSES } from '@repo/email';
import { OrderConfirmationEmail } from '@repo/email/templates/order-confirmation';

// Note: In the actual implementation, we might want a specific MerchantWelcome template.
// For now, I'll use the OrderConfirmation placeholder or similar if available, 
// as per the resend.md Phase 4.2 request.
// Wait, resend.md 4.2 says and I quote:
// import { MerchantWelcomeEmail } from '@repo/email/templates/merchant-welcome';
// But Phase 1.1 doesn't create it. I should probably use a generic one or create it.

export async function POST(req: NextRequest) {
  try {
    const { merchantEmail, merchantName, dashboardUrl } = await req.json();

    // Using sendEmail from our shared package
    const result = await sendEmail({
      from: FROM_ADDRESSES.merchant,
      to: merchantEmail,
      subject: `Welcome to Hyperlocal, ${merchantName}!`,
      // Fallback to text if template isn't ready or use a placeholder
      html: `<h1>Welcome ${merchantName}</h1><p>Get started at <a href="${dashboardUrl}">${dashboardUrl}</a></p>`,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ id: result.id });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
