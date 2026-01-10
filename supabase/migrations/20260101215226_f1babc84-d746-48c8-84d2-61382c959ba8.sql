-- Add category_type column to categories table
ALTER TABLE public.categories 
ADD COLUMN category_type text NOT NULL DEFAULT 'products';

-- Add check constraint for valid values
ALTER TABLE public.categories
ADD CONSTRAINT categories_category_type_check 
CHECK (category_type IN ('products', 'combos'));

-- Add comment for documentation
COMMENT ON COLUMN public.categories.category_type IS 'Type of category: products for regular products, combos for combo categories';