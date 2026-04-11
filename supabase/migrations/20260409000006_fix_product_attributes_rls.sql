-- Allow anyone (anon + authenticated customers) to read product custom attributes.
-- Previously only the merchant owner could SELECT, so industry-specific details
-- were invisible to customers browsing the store.
CREATE POLICY "public can read product attributes"
  ON product_custom_attributes
  FOR SELECT
  USING (true);
