-- Enforce company approval workflow

-- 1) Ensure non-superadmins can ONLY create companies as 'pending'
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND (
    (has_role(auth.uid(), 'super_admin'::app_role))
    OR (status = 'pending'::company_status)
  )
);

-- 2) Block owners from updating company settings until approved
DROP POLICY IF EXISTS "Owners can update their companies" ON public.companies;
CREATE POLICY "Owners can update their companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (
  owner_id = auth.uid()
  AND status = 'approved'::company_status
)
WITH CHECK (
  owner_id = auth.uid()
  AND status = 'approved'::company_status
);

-- 3) Trigger to force status='pending' on insert for non-superadmins and
--    prevent non-superadmins from changing status after creation.
CREATE OR REPLACE FUNCTION public.enforce_company_approval_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Force status to pending for anyone who is not super_admin
  IF TG_OP = 'INSERT' THEN
    IF NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
      NEW.status := 'pending'::company_status;
    END IF;
    RETURN NEW;
  END IF;

  -- Prevent non-superadmins from changing status
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT has_role(auth.uid(), 'super_admin'::app_role) THEN
      RAISE EXCEPTION 'Apenas super admins podem alterar o status da empresa.';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_company_approval_rules ON public.companies;
CREATE TRIGGER trg_enforce_company_approval_rules
BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.enforce_company_approval_rules();
