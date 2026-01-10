-- Tabela de funcionalidades do sistema
CREATE TABLE public.system_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  category text DEFAULT 'general',
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabela de preços das funcionalidades (permite venda avulsa)
CREATE TABLE public.feature_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id uuid REFERENCES public.system_features(id) ON DELETE CASCADE NOT NULL,
  price_type text NOT NULL CHECK (price_type IN ('one_time', 'monthly')),
  price numeric NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(feature_id, price_type)
);

-- Tabela que liga funcionalidades aos planos
CREATE TABLE public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE CASCADE NOT NULL,
  feature_id uuid REFERENCES public.system_features(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(plan_id, feature_id)
);

-- Tabela de funcionalidades compradas avulsas por empresa
CREATE TABLE public.company_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  feature_id uuid REFERENCES public.system_features(id) ON DELETE CASCADE NOT NULL,
  price_type text NOT NULL CHECK (price_type IN ('one_time', 'monthly')),
  price_paid numeric NOT NULL DEFAULT 0,
  purchased_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  payment_reference text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(company_id, feature_id)
);

-- Enable RLS
ALTER TABLE public.system_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_features ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_features (public read, admin write)
CREATE POLICY "Anyone can view active features"
  ON public.system_features FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admins manage features"
  ON public.system_features FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies for feature_pricing
CREATE POLICY "Anyone can view active pricing"
  ON public.feature_pricing FOR SELECT
  USING (is_active = true);

CREATE POLICY "Super admins manage pricing"
  ON public.feature_pricing FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies for plan_features
CREATE POLICY "Anyone can view plan features"
  ON public.plan_features FOR SELECT
  USING (true);

CREATE POLICY "Super admins manage plan features"
  ON public.plan_features FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS Policies for company_features
CREATE POLICY "Company owners view their features"
  ON public.company_features FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id = company_features.company_id 
    AND c.owner_id = auth.uid()
  ));

CREATE POLICY "Super admins manage company features"
  ON public.company_features FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Trigger para updated_at
CREATE TRIGGER update_system_features_updated_at
  BEFORE UPDATE ON public.system_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feature_pricing_updated_at
  BEFORE UPDATE ON public.feature_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();