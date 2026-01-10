-- Criar tabela de ingredientes por produto
CREATE TABLE public.product_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_removable BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view ingredients of products from approved companies
CREATE POLICY "Public view product ingredients"
ON public.product_ingredients
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM products p
    JOIN categories c ON c.id = p.category_id
    JOIN companies co ON co.id = c.company_id
    WHERE p.id = product_ingredients.product_id
    AND co.status = 'approved'
  )
);

-- Policy: Company owners can manage ingredients
CREATE POLICY "Owners manage product ingredients"
ON public.product_ingredients
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM products p
    JOIN categories c ON c.id = p.category_id
    JOIN companies co ON co.id = c.company_id
    WHERE p.id = product_ingredients.product_id
    AND co.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM products p
    JOIN categories c ON c.id = p.category_id
    JOIN companies co ON co.id = c.company_id
    WHERE p.id = product_ingredients.product_id
    AND co.owner_id = auth.uid()
  )
);

-- Policy: Store staff can manage ingredients
CREATE POLICY "Staff manage product ingredients"
ON public.product_ingredients
FOR ALL
USING (
  has_role(auth.uid(), 'store_staff'::app_role) AND
  EXISTS (
    SELECT 1 FROM products p
    JOIN categories c ON c.id = p.category_id
    JOIN company_staff cs ON cs.company_id = c.company_id
    WHERE p.id = product_ingredients.product_id
    AND cs.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'store_staff'::app_role) AND
  EXISTS (
    SELECT 1 FROM products p
    JOIN categories c ON c.id = p.category_id
    JOIN company_staff cs ON cs.company_id = c.company_id
    WHERE p.id = product_ingredients.product_id
    AND cs.user_id = auth.uid()
  )
);

-- Index for performance
CREATE INDEX idx_product_ingredients_product_id ON public.product_ingredients(product_id);