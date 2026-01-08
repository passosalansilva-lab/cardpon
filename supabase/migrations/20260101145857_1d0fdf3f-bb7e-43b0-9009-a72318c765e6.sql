-- Fix security definer view by recreating with SECURITY INVOKER (default)
DROP VIEW IF EXISTS public.landing_stats;

CREATE VIEW public.landing_stats 
WITH (security_invoker = true) AS
SELECT 
  (SELECT COUNT(*) FROM orders WHERE status NOT IN ('cancelled', 'pending')) as total_orders,
  (SELECT COUNT(*) FROM companies WHERE status = 'approved') as total_companies,
  (SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 5.0) FROM order_reviews) as avg_rating;

-- Grant public access to the view
GRANT SELECT ON public.landing_stats TO anon, authenticated;