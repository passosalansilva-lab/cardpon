-- Tabela para configurações de pagamento por empresa
CREATE TABLE public.company_payment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  mercadopago_access_token TEXT,
  mercadopago_enabled BOOLEAN DEFAULT false,
  mercadopago_verified BOOLEAN DEFAULT false,
  mercadopago_verified_at TIMESTAMP WITH TIME ZONE,
  mercadopago_account_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.company_payment_settings ENABLE ROW LEVEL SECURITY;

-- Policies: Only store owner can manage their payment settings
CREATE POLICY "Store owners can view their payment settings"
ON public.company_payment_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_id AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Store owners can insert their payment settings"
ON public.company_payment_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_id AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Store owners can update their payment settings"
ON public.company_payment_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_id AND c.owner_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_company_payment_settings_updated_at
BEFORE UPDATE ON public.company_payment_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for quick lookup
CREATE INDEX idx_company_payment_settings_company_id ON public.company_payment_settings(company_id);