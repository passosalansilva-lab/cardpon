-- Trigger que notifica super admins quando nova empresa é criada com status pending
CREATE OR REPLACE FUNCTION public.notify_superadmin_new_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, data)
  SELECT 
    ur.user_id,
    'Nova empresa aguardando aprovação',
    'A empresa "' || NEW.name || '" foi cadastrada e aguarda sua aprovação.',
    'info',
    jsonb_build_object('type', 'new_company_pending', 'company_id', NEW.id, 'company_name', NEW.name)
  FROM public.user_roles ur
  WHERE ur.role = 'super_admin';
  
  RETURN NEW;
END;
$$;

-- Trigger para executar a função quando empresa é criada
DROP TRIGGER IF EXISTS on_company_created_notify_superadmin ON public.companies;
CREATE TRIGGER on_company_created_notify_superadmin
  AFTER INSERT ON public.companies
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.notify_superadmin_new_company();

-- Trigger que notifica o dono quando status da empresa muda
CREATE OR REPLACE FUNCTION public.notify_owner_company_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'approved' THEN
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        NEW.owner_id,
        'Sua empresa foi aprovada! 🎉',
        'Parabéns! A empresa "' || NEW.name || '" foi aprovada. Você já pode começar a receber pedidos!',
        'success',
        jsonb_build_object('type', 'company_approved', 'company_id', NEW.id)
      );
    ELSIF NEW.status = 'suspended' THEN
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        NEW.owner_id,
        'Sua empresa foi suspensa',
        'A empresa "' || NEW.name || '" foi suspensa. Entre em contato com o suporte para mais informações.',
        'warning',
        jsonb_build_object('type', 'company_suspended', 'company_id', NEW.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger para executar a função quando status muda
DROP TRIGGER IF EXISTS on_company_status_change_notify_owner ON public.companies;
CREATE TRIGGER on_company_status_change_notify_owner
  AFTER UPDATE OF status ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_owner_company_status_change();