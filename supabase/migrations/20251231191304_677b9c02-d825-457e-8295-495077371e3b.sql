-- Allow company owners and staff to insert customers for manual orders
CREATE POLICY "Company owners can insert customers for manual orders" 
ON public.customers 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.owner_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM company_staff cs
    WHERE cs.user_id = auth.uid()
  )
);

-- Allow company owners and staff to update customers
CREATE POLICY "Company owners can update customers" 
ON public.customers 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.owner_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM company_staff cs
    WHERE cs.user_id = auth.uid()
  )
);