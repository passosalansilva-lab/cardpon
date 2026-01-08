-- Table for customer referral settings per company
CREATE TABLE public.customer_referral_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  referrer_discount_percent NUMERIC(5,2) DEFAULT 10,
  referred_discount_percent NUMERIC(5,2) DEFAULT 10,
  max_uses_per_referrer INTEGER DEFAULT 10,
  max_uses_per_referred INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Table for customer referral codes
CREATE TABLE public.customer_referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  total_referrals INTEGER DEFAULT 0,
  total_discount_given NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, customer_id),
  UNIQUE(company_id, code)
);

-- Table for tracking referral usage
CREATE TABLE public.customer_referral_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  referral_code_id UUID NOT NULL REFERENCES public.customer_referral_codes(id) ON DELETE CASCADE,
  referred_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_applied NUMERIC(10,2) DEFAULT 0,
  referrer_discount_applied NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, referred_customer_id)
);

-- Table for referrer credits (discounts earned by referrers)
CREATE TABLE public.customer_referral_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  remaining_amount NUMERIC(10,2) NOT NULL,
  source_referral_id UUID REFERENCES public.customer_referral_usage(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_referral_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_referral_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_referral_credits ENABLE ROW LEVEL SECURITY;

-- RLS for customer_referral_settings (store owners can manage, public can read if enabled)
CREATE POLICY "Store owners can manage referral settings"
ON public.customer_referral_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = customer_referral_settings.company_id
    AND c.owner_id = auth.uid()
  )
);

CREATE POLICY "Staff can view referral settings"
ON public.customer_referral_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_staff cs
    WHERE cs.company_id = customer_referral_settings.company_id
    AND cs.user_id = auth.uid()
  )
);

CREATE POLICY "Public can read enabled referral settings"
ON public.customer_referral_settings
FOR SELECT
USING (is_enabled = true);

-- RLS for customer_referral_codes
CREATE POLICY "Anyone can read referral codes"
ON public.customer_referral_codes
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create their own referral codes"
ON public.customer_referral_codes
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Store owners can manage referral codes"
ON public.customer_referral_codes
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = customer_referral_codes.company_id
    AND c.owner_id = auth.uid()
  )
);

-- RLS for customer_referral_usage
CREATE POLICY "Anyone can read referral usage"
ON public.customer_referral_usage
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create referral usage"
ON public.customer_referral_usage
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Store owners can manage referral usage"
ON public.customer_referral_usage
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = customer_referral_usage.company_id
    AND c.owner_id = auth.uid()
  )
);

-- RLS for customer_referral_credits
CREATE POLICY "Customers can view their own credits"
ON public.customer_referral_credits
FOR SELECT
USING (true);

CREATE POLICY "Anyone can create credits"
ON public.customer_referral_credits
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update credits"
ON public.customer_referral_credits
FOR UPDATE
USING (true);

CREATE POLICY "Store owners can manage credits"
ON public.customer_referral_credits
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = customer_referral_credits.company_id
    AND c.owner_id = auth.uid()
  )
);

-- Trigger to update timestamps
CREATE TRIGGER update_customer_referral_settings_updated_at
BEFORE UPDATE ON public.customer_referral_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();