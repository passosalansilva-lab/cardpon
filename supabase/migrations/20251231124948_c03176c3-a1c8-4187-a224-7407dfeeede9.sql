-- Add PicPay columns to company_payment_settings
ALTER TABLE public.company_payment_settings
ADD COLUMN IF NOT EXISTS picpay_client_id text,
ADD COLUMN IF NOT EXISTS picpay_client_secret text,
ADD COLUMN IF NOT EXISTS picpay_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS picpay_verified boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS picpay_verified_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS picpay_account_email text;