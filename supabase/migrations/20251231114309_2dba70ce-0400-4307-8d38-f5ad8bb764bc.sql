-- Fix: Set companies_public view to SECURITY INVOKER
-- This ensures the view respects the querying user's permissions and RLS policies

-- Drop and recreate the view with SECURITY INVOKER
DROP VIEW IF EXISTS public.companies_public;

CREATE VIEW public.companies_public
WITH (security_invoker = true)
AS
SELECT 
    id,
    name,
    slug,
    description,
    logo_url,
    cover_url,
    address,
    city,
    state,
    zip_code,
    niche,
    primary_color,
    secondary_color,
    is_open,
    opening_hours,
    delivery_fee,
    min_order_value,
    max_delivery_radius_km,
    menu_published,
    status,
    created_at,
    updated_at
FROM public.companies
WHERE status = 'approved'::company_status;

-- Grant appropriate permissions on the view
GRANT SELECT ON public.companies_public TO anon, authenticated;