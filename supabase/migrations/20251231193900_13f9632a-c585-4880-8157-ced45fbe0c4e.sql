-- Fix customers INSERT RLS by using a single SECURITY DEFINER helper

create or replace function public.can_create_customers(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    exists (select 1 from public.companies c where c.owner_id = _user_id)
    or exists (select 1 from public.company_staff cs where cs.user_id = _user_id)
  );
$$;

-- Replace INSERT policy to rely on the helper only
DROP POLICY IF EXISTS "Allow customer insert" ON public.customers;

CREATE POLICY "Allow customer insert"
ON public.customers
FOR INSERT
TO public
WITH CHECK (
  (
    auth.uid() is not null
    and (
      user_id = auth.uid()
      or (user_id is null and public.can_create_customers(auth.uid()))
    )
  )
  OR (
    auth.uid() is null
    and user_id is null
  )
);
