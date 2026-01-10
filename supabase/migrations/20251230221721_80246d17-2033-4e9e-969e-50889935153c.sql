-- Create storage bucket for A1 certificates
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for certificates bucket
CREATE POLICY "Company owners can upload certificates"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'certificates' AND
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.owner_id = auth.uid()
    AND (storage.foldername(name))[1] = c.id::text
  )
);

CREATE POLICY "Company owners can view their certificates"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'certificates' AND
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.owner_id = auth.uid()
    AND (storage.foldername(name))[1] = c.id::text
  )
);

CREATE POLICY "Company owners can delete their certificates"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'certificates' AND
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.owner_id = auth.uid()
    AND (storage.foldername(name))[1] = c.id::text
  )
);

-- Create table for company-specific NFe settings
CREATE TABLE public.nfe_company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  certificate_path text,
  certificate_password text,
  certificate_expires_at timestamp with time zone,
  csc_id text, -- Código de Segurança do Contribuinte (para NFCe)
  csc_token text,
  serie_nfce integer DEFAULT 1,
  numero_atual_nfce integer DEFAULT 1,
  ambiente text DEFAULT 'homologation', -- 'homologation' ou 'production'
  is_configured boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.nfe_company_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Company owners can manage their nfe settings"
ON public.nfe_company_settings FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = nfe_company_settings.company_id
    AND c.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = nfe_company_settings.company_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Super admins can view all nfe settings"
ON public.nfe_company_settings FOR SELECT
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_nfe_company_settings_updated_at
  BEFORE UPDATE ON public.nfe_company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();