-- Add referral_code_id column to orders table to track referral discounts
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS referral_code_id UUID REFERENCES public.customer_referral_codes(id);

-- Add index for referral lookups
CREATE INDEX IF NOT EXISTS idx_orders_referral_code_id ON public.orders(referral_code_id);

-- Comment explaining the column
COMMENT ON COLUMN public.orders.referral_code_id IS 'References the referral code used for this order discount (if any)';