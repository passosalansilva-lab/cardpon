-- Create table for review settings per company
CREATE TABLE public.company_review_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  reviews_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_review_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Company owners can view their review settings"
ON public.company_review_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = company_review_settings.company_id
    AND companies.owner_id = auth.uid()
  )
);

CREATE POLICY "Company owners can update their review settings"
ON public.company_review_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = company_review_settings.company_id
    AND companies.owner_id = auth.uid()
  )
);

CREATE POLICY "Company owners can insert their review settings"
ON public.company_review_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = company_review_settings.company_id
    AND companies.owner_id = auth.uid()
  )
);

-- Staff can also manage
CREATE POLICY "Staff can view review settings"
ON public.company_review_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_staff
    WHERE company_staff.company_id = company_review_settings.company_id
    AND company_staff.user_id = auth.uid()
  )
);

CREATE POLICY "Staff can update review settings"
ON public.company_review_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.company_staff
    WHERE company_staff.company_id = company_review_settings.company_id
    AND company_staff.user_id = auth.uid()
  )
);

-- Public read for checking if reviews are enabled (for customers)
CREATE POLICY "Anyone can check if reviews are enabled"
ON public.company_review_settings
FOR SELECT
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_company_review_settings_updated_at
BEFORE UPDATE ON public.company_review_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();