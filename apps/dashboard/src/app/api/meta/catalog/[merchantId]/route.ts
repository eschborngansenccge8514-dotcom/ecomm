import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> }
) {
  const { merchantId } = await params;

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
  }

  // Fetch products and merchant details
  const [{ data: products, error: productsError }, { data: merchant, error: merchantError }] = await Promise.all([
    supabaseAdmin
      .from('products')
      .select('id, name, description, price, stock_quantity, images, status')
      .eq('merchant_id', merchantId)
      .eq('status', 'active'),
    supabaseAdmin
      .from('merchants')
      .select('store_name')
      .eq('id', merchantId)
      .single()
  ]);

  if (productsError || merchantError) {
    console.error('Meta Catalog Error:', productsError || merchantError);
    return NextResponse.json({ error: 'Failed to fetch catalog data' }, { status: 500 });
  }

  // Map to Facebook Catalog JSON structure
  const feed = {
    data: (products || []).map((p) => {
      // Assuming images is an array of strings (URLs)
      const imageUrl = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : '';

      return {
        id:               p.id,
        title:            p.name,
        description:      p.description || p.name,
        availability:     (p.stock_quantity || 0) > 0 ? 'in stock' : 'out of stock',
        condition:        'new',
        price:            `${Number(p.price || 0).toFixed(2)} MYR`,
        link:             `https://hyperlocal.app/products/${p.id}`, // FIXME: use dynamic store link
        image_link:       imageUrl,
        brand:            merchant?.store_name || 'My Store',
        retailer_id:      p.id,
      };
    }),
  };

  return NextResponse.json(feed, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
