
-- Add source column to orders table to track where the order came from
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'online';

-- Add a comment explaining the values
COMMENT ON COLUMN public.orders.source IS 'Order source: online (from public menu), pos (from manual POS), etc.';
