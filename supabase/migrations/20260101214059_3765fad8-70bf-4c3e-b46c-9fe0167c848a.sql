-- Add promotional price field to products
ALTER TABLE public.products 
ADD COLUMN promotional_price numeric NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.products.promotional_price IS 'Optional promotional price. When set, displays as "de X por Y" on the menu.';