-- Public stats RPC to bypass RLS for aggregated landing page numbers
-- Returns only aggregate counts (no PII).

CREATE OR REPLACE FUNCTION public.get_landing_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_orders', (
      SELECT count(*)::bigint
      FROM public.orders
      WHERE public.orders.status <> ALL (ARRAY['cancelled'::public.order_status, 'pending'::public.order_status])
    ),
    'total_companies', (
      SELECT count(*)::bigint
      FROM public.companies
      WHERE public.companies.status = 'approved'::public.company_status
    ),
    'avg_rating', (
      SELECT COALESCE(round(avg(public.order_reviews.rating), 1), 5.0)
      FROM public.order_reviews
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_landing_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_landing_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.get_landing_stats() TO authenticated;
