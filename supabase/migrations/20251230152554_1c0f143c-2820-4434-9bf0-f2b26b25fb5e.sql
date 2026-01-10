-- Add columns to configure which online payment methods are enabled
ALTER TABLE public.company_payment_settings 
ADD COLUMN IF NOT EXISTS pix_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS card_enabled boolean DEFAULT true;

-- Set defaults for existing records
UPDATE public.company_payment_settings 
SET pix_enabled = true, card_enabled = true 
WHERE pix_enabled IS NULL OR card_enabled IS NULL;