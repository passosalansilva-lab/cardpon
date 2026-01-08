CREATE OR REPLACE FUNCTION public.has_feature_access(_user_id uuid, _feature_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    -- Verificar se a feature está incluída no plano da empresa (owner)
    SELECT 1
    FROM companies c
    JOIN subscription_plans sp ON sp.key = COALESCE(c.subscription_plan, 'free')
    JOIN plan_features pf ON pf.plan_id = sp.id
    JOIN system_features sf ON sf.id = pf.feature_id
    WHERE c.owner_id = _user_id
      AND sf.key = _feature_key
      AND sf.is_active = true
  )
  OR EXISTS (
    -- Verificar se a feature foi comprada/concedida individualmente (owner)
    SELECT 1
    FROM companies c
    JOIN company_features cf ON cf.company_id = c.id
    JOIN system_features sf ON sf.id = cf.feature_id
    WHERE c.owner_id = _user_id
      AND sf.key = _feature_key
      AND sf.is_active = true
      AND cf.is_active = true
      AND (cf.expires_at IS NULL OR cf.expires_at > now())
  )
  OR EXISTS (
    -- Verificar se é staff de uma empresa com acesso via plano
    SELECT 1
    FROM company_staff cs
    JOIN companies c ON c.id = cs.company_id
    JOIN subscription_plans sp ON sp.key = COALESCE(c.subscription_plan, 'free')
    JOIN plan_features pf ON pf.plan_id = sp.id
    JOIN system_features sf ON sf.id = pf.feature_id
    WHERE cs.user_id = _user_id
      AND sf.key = _feature_key
      AND sf.is_active = true
  )
  OR EXISTS (
    -- Staff com feature comprada pela empresa
    SELECT 1
    FROM company_staff cs
    JOIN company_features cf ON cf.company_id = cs.company_id
    JOIN system_features sf ON sf.id = cf.feature_id
    WHERE cs.user_id = _user_id
      AND sf.key = _feature_key
      AND sf.is_active = true
      AND cf.is_active = true
      AND (cf.expires_at IS NULL OR cf.expires_at > now())
  );
$function$;