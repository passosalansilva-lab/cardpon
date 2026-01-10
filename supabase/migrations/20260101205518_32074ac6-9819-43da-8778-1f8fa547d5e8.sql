-- Grant SELECT permission on landing_stats view to anon and authenticated roles
GRANT SELECT ON public.landing_stats TO anon;
GRANT SELECT ON public.landing_stats TO authenticated;