-- Add mercadopago_public_key column to store the public key separately
ALTER TABLE public.company_payment_settings 
ADD COLUMN IF NOT EXISTS mercadopago_public_key TEXT;