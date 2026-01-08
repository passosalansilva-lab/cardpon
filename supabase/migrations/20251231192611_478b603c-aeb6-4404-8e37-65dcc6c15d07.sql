-- Fix customers INSERT RLS to not depend on selecting from RLS-protected tables

-- 1) Helper function (bypasses RLS) to check if user is staff of any company
create or replace function public.is_store_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_staff cs
    where cs.user_id = _user_id
  );
$$;

-- 2) Replace INSERT policy with one that uses security definer helpers
DROP POLICY IF EXISTS "Allow customer insert" ON public.customers;

CREATE POLICY "Allow customer insert"
ON public.customers
FOR INSERT
TO public
WITH CHECK (
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
);
