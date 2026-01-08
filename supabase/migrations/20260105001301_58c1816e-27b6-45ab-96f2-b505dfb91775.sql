-- Add customer_phone to table_sessions for customer identification
ALTER TABLE public.table_sessions ADD COLUMN IF NOT EXISTS customer_phone text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_table_sessions_customer_phone ON public.table_sessions(customer_phone);