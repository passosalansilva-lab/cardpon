-- Add INSERT policy for nfe_invoices so company owners can create invoices
CREATE POLICY "Company owners can insert invoices"
ON public.nfe_invoices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = nfe_invoices.company_id
    AND c.owner_id = auth.uid()
  )
);

-- Add UPDATE policy so the system can update invoice status
CREATE POLICY "Company owners can update their invoices"
ON public.nfe_invoices
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = nfe_invoices.company_id
    AND c.owner_id = auth.uid()
  )
);