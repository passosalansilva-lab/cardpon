-- Add column to show PIX key on public menu without online payment gateway
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS show_pix_key_on_menu boolean DEFAULT false;