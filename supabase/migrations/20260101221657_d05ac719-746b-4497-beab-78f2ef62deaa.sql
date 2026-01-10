-- Add combo_mode field to combos table
-- 'fixed' = items are pre-defined, customer just adds to cart
-- 'selectable' = customer chooses items from slots

ALTER TABLE public.combos 
ADD COLUMN IF NOT EXISTS combo_mode text NOT NULL DEFAULT 'fixed';

-- Add comment for documentation
COMMENT ON COLUMN public.combos.combo_mode IS 'Defines if combo is fixed (pre-defined items) or selectable (customer chooses from slots)';