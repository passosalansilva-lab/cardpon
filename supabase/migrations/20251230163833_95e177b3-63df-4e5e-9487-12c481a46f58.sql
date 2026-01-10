-- Create table for global NFe settings (managed by super admin)
CREATE TABLE public.nfe_global_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    focus_nfe_token text,
    environment text NOT NULL DEFAULT 'homologation', -- 'homologation' or 'production'
    is_enabled boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nfe_global_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage global NFe settings
CREATE POLICY "Super admins manage nfe settings"
ON public.nfe_global_settings
FOR ALL
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Create table for issued invoices
CREATE TABLE public.nfe_invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    focus_nfe_id text,
    status text NOT NULL DEFAULT 'pending', -- pending, processing, authorized, cancelled, error
    nfe_number text,
    access_key text,
    pdf_url text,
    xml_url text,
    error_message text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nfe_invoices ENABLE ROW LEVEL SECURITY;

-- Company owners can view their invoices
CREATE POLICY "Company owners view invoices"
ON public.nfe_invoices
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = nfe_invoices.company_id
    AND c.owner_id = auth.uid()
));

-- Super admins can view all invoices
CREATE POLICY "Super admins view all invoices"
ON public.nfe_invoices
FOR SELECT
USING (has_role(auth.uid(), 'super_admin'));

-- Insert initial settings row
INSERT INTO public.nfe_global_settings (id) VALUES (gen_random_uuid());