/**
 * Maps a platform product to the TikTok Shop product format.
 */
export function mapProductToTikTok(product: any) {
  return {
    title: product.name,
    description: product.description,
    category_id: product.metadata?.tiktok_category_id, // Store TikTok category in product metadata
    brand_id: product.metadata?.tiktok_brand_id,
    images: product.images?.map((img: any) => ({
      id: img.external_id, // TikTok specific image ID after upload
    })),
    skus: product.variants?.map((variant: any) => ({
      seller_sku: variant.sku,
      original_price: variant.price,
      stock_infos: [
        {
          warehouse_id: product.metadata?.tiktok_warehouse_id,
          available_stock: variant.stock_quantity || 0,
        },
      ],
      sales_attributes: variant.attributes?.map((attr: any) => ({
        attribute_id: attr.tiktok_attr_id,
        attribute_name: attr.name,
        value_id: attr.tiktok_value_id,
        value_name: attr.value,
      })),
    })),
  };
}

/**
 * Basic validation for TikTok product requirements.
 */
export function validateTikTokProduct(product: any) {
  const errors: string[] = [];

  if (!product.name?.trim()) errors.push("Product name is required.");
  if (!product.description?.trim()) errors.push("Product description is required.");
  if (!product.metadata?.tiktok_category_id) errors.push("TikTok Category ID is required.");
  
  if (!product.variants || product.variants.length === 0) {
    errors.push("At least one variant is required.");
  } else {
    for (const v of product.variants) {
      if (!v.sku) errors.push("Variant SKU is required.");
      if (v.price === undefined || v.price === null) errors.push(`Price for variant ${v.sku} is required.`);
    }
  }

  return errors;
}
