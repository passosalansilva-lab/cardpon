-- Tabela de unidades de conversão para ingredientes
CREATE TABLE public.inventory_ingredient_units (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_id uuid NOT NULL REFERENCES public.inventory_ingredients(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL, -- ex: "Fardo", "Unidade", "Litro"
  abbreviation text NOT NULL, -- ex: "frd", "un", "L"
  conversion_factor numeric NOT NULL DEFAULT 1, -- quantas unidades base equivalem a 1 dessa unidade
  is_base_unit boolean NOT NULL DEFAULT false, -- unidade base (menor unidade - ex: 1 unidade de refrigerante)
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_unit_per_ingredient UNIQUE(ingredient_id, name)
);

-- Índices
CREATE INDEX idx_ingredient_units_ingredient ON public.inventory_ingredient_units(ingredient_id);
CREATE INDEX idx_ingredient_units_company ON public.inventory_ingredient_units(company_id);

-- RLS
ALTER TABLE public.inventory_ingredient_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage ingredient units"
ON public.inventory_ingredient_units
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = inventory_ingredient_units.company_id
    AND c.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = inventory_ingredient_units.company_id
    AND c.owner_id = auth.uid()
  )
);

-- Adicionar coluna para especificar a unidade usada nas compras
ALTER TABLE public.inventory_purchases 
ADD COLUMN unit_id uuid REFERENCES public.inventory_ingredient_units(id) ON DELETE SET NULL;

-- Adicionar coluna para especificar a unidade usada nos movimentos
ALTER TABLE public.inventory_movements
ADD COLUMN unit_id uuid REFERENCES public.inventory_ingredient_units(id) ON DELETE SET NULL;

-- Comentários para documentação
COMMENT ON TABLE public.inventory_ingredient_units IS 'Unidades de medida com fator de conversão para cada ingrediente. Ex: 1 Fardo = 6 Unidades';
COMMENT ON COLUMN public.inventory_ingredient_units.conversion_factor IS 'Quantas unidades BASE equivalem a 1 dessa unidade. Ex: Se a base é "unidade" e 1 fardo = 6 unidades, então conversion_factor = 6';
COMMENT ON COLUMN public.inventory_ingredient_units.is_base_unit IS 'Indica a unidade base (menor). Sempre tem conversion_factor = 1';