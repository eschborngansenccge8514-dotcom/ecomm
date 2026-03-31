export function validateGoogleProduct(product: any): string[] {
  const errors: string[] = [];

  if (!product.name?.trim()) errors.push("name is required");
  if (product.name?.length > 150) errors.push("name must be 150 characters or fewer");
  if (!product.description?.trim()) errors.push("description is required");
  if (!product.images?.length) errors.push("at least one image is required");
  if (!product.images?.[0]?.startsWith("https://"))
    errors.push("image link must use HTTPS");
  if (!product.price) errors.push("price is required");
  if (product.price <= 0) errors.push("price must be greater than zero");
  if (!product.sku) errors.push("SKU is required for product URL and offerId");

  // Branded products need GTIN or MPN
  if (product.metadata?.brand && !product.metadata?.gtin && !product.metadata?.mpn)
    errors.push("branded products require gtin or mpn in metadata");

  return errors;
}
