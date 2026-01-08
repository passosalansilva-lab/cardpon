-- Add requires_preparation field to products table
ALTER TABLE public.products 
ADD COLUMN requires_preparation boolean NOT NULL DEFAULT true;

-- Add requires_preparation field to order_items to store at order time
ALTER TABLE public.order_items 
ADD COLUMN requires_preparation boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.products.requires_preparation IS 'Se o produto precisa ser preparado na cozinha (ex: false para bebidas prontas)';
COMMENT ON COLUMN public.order_items.requires_preparation IS 'Se o item precisa ser preparado na cozinha';