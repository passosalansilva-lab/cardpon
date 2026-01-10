-- Create testimonials table for real testimonials managed by admin
CREATE TABLE public.testimonials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_role TEXT, -- e.g. "Dono" or business type
  content TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  is_featured BOOLEAN NOT NULL DEFAULT false, -- admin selects which to show
  is_approved BOOLEAN NOT NULL DEFAULT false, -- admin approval
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Public can view approved and featured testimonials
CREATE POLICY "Public view featured testimonials"
  ON public.testimonials
  FOR SELECT
  USING (is_featured = true AND is_approved = true);

-- Store owners can create testimonials for their company
CREATE POLICY "Owners create testimonials"
  ON public.testimonials
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id = testimonials.company_id 
    AND c.owner_id = auth.uid()
  ));

-- Store owners can view their own testimonials
CREATE POLICY "Owners view own testimonials"
  ON public.testimonials
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id = testimonials.company_id 
    AND c.owner_id = auth.uid()
  ));

-- Super admins manage all testimonials
CREATE POLICY "Super admins manage testimonials"
  ON public.testimonials
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_testimonials_updated_at
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create a view for landing page stats (public accessible)
CREATE OR REPLACE VIEW public.landing_stats AS
SELECT 
  (SELECT COUNT(*) FROM orders WHERE status NOT IN ('cancelled', 'pending')) as total_orders,
  (SELECT COUNT(*) FROM companies WHERE status = 'approved') as total_companies,
  (SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 5.0) FROM order_reviews) as avg_rating;