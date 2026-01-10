-- Drop the conflicting policy and create a more permissive one
DROP POLICY IF EXISTS "Public insert customers for orders" ON public.customers;

-- Create new policy that allows:
-- 1. Authenticated users to insert their own customer record
-- 2. Company owners/staff to insert customers for manual orders (without user_id)
CREATE POLICY "Allow customer insert" 
ON public.customers 
FOR INSERT 
WITH CHECK (
  -- Authenticated user inserting their own record
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR
  -- Company owner or staff can insert customers (user_id can be null for manual orders)
  (
    auth.uid() IS NOT NULL 
    AND user_id IS NULL
    AND (
      EXISTS (SELECT 1 FROM companies c WHERE c.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM company_staff cs WHERE cs.user_id = auth.uid())
    )
  )
);

-- Drop the old manual orders policy since it's now covered
DROP POLICY IF EXISTS "Company owners can insert customers for manual orders" ON public.customers;