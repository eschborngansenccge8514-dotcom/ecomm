ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Unique per merchant (different merchants can share manufacturer barcodes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_merchant 
  ON public.products (merchant_id, barcode) WHERE barcode IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_barcode_product 
  ON public.product_variants (product_id, barcode) WHERE barcode IS NOT NULL;

-- Fast lookup for POS scanner
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_variants_barcode ON public.product_variants (barcode) WHERE barcode IS NOT NULL;
