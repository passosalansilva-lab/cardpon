-- Allow guest (unauthenticated) customer creation while keeping user-linked customers protected

DROP POLICY IF EXISTS "Allow customer insert" ON public.customers;

CREATE POLICY "Allow customer insert"
ON public.customers
FOR INSERT
TO public
WITH CHECK (
  (
    auth.uid() is not null
    AND (
      (user_id = auth.uid())
      OR (
        user_id is null
        AND (
          public.get_user_company_id(auth.uid()) is not null
          OR public.is_store_staff(auth.uid())
        )
      )
    )
  )
  OR (
    auth.uid() is null
    AND user_id is null
  )
);
