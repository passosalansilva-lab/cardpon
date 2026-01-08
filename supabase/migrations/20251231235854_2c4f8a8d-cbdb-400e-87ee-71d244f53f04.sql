-- Adicionar política para permitir que owners e staff possam inserir endereços
-- quando estão convertendo pedidos de pickup para delivery

CREATE POLICY "Store owners and staff can insert addresses for orders"
ON public.customer_addresses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM companies c
    LEFT JOIN company_staff cs ON cs.company_id = c.id
    WHERE (c.owner_id = auth.uid() OR cs.user_id = auth.uid())
  )
);