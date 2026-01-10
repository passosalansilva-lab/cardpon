-- Add KDS token column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS kds_token TEXT UNIQUE;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_companies_kds_token ON public.companies(kds_token) WHERE kds_token IS NOT NULL;