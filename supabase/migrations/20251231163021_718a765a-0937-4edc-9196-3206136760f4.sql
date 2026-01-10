-- Função que verifica e bloqueia empresas que atingiram o limite de faturamento
CREATE OR REPLACE FUNCTION public.check_and_block_revenue_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  revenue_limit NUMERIC;
BEGIN
  -- Só verifica quando monthly_revenue é atualizado
  IF NEW.monthly_revenue IS DISTINCT FROM OLD.monthly_revenue THEN
    -- Buscar limite do plano atual
    SELECT COALESCE(sp.revenue_limit, 2000)
    INTO revenue_limit
    FROM subscription_plans sp
    WHERE sp.key = COALESCE(NEW.subscription_plan, 'free')
    LIMIT 1;
    
    -- Se não encontrar plano, usar limite padrão do gratuito
    IF revenue_limit IS NULL THEN
      revenue_limit := 2000;
    END IF;
    
    -- Se limite não é ilimitado (-1) e faturamento excedeu limite
    IF revenue_limit != -1 AND NEW.monthly_revenue >= revenue_limit THEN
      -- Despublicar cardápio automaticamente
      NEW.menu_published := false;
      
      -- Criar notificação para o dono
      INSERT INTO public.notifications (user_id, title, message, type, data)
      VALUES (
        NEW.owner_id,
        'Cardápio bloqueado - Limite atingido!',
        'Seu cardápio foi despublicado automaticamente pois você atingiu o limite de R$ ' || revenue_limit || ' em vendas do plano ' || 
        CASE 
          WHEN NEW.subscription_plan = 'starter' THEN 'Inicial'
          WHEN NEW.subscription_plan = 'basic' THEN 'Básico'
          WHEN NEW.subscription_plan = 'growth' THEN 'Crescimento'
          WHEN NEW.subscription_plan = 'pro' THEN 'Pro'
          ELSE 'Gratuito'
        END || '. Faça upgrade para continuar recebendo pedidos.',
        'error',
        jsonb_build_object(
          'type', 'revenue_limit_blocked',
          'monthly_revenue', NEW.monthly_revenue,
          'revenue_limit', revenue_limit,
          'plan', COALESCE(NEW.subscription_plan, 'free')
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para verificar limite de faturamento
DROP TRIGGER IF EXISTS check_revenue_limit_trigger ON companies;
CREATE TRIGGER check_revenue_limit_trigger
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION public.check_and_block_revenue_limit();

-- Atualizar empresas que já estão acima do limite para despublicar o cardápio
UPDATE companies c
SET menu_published = false
WHERE c.menu_published = true
  AND EXISTS (
    SELECT 1 FROM subscription_plans sp 
    WHERE sp.key = COALESCE(c.subscription_plan, 'free')
      AND sp.revenue_limit != -1
      AND c.monthly_revenue >= sp.revenue_limit
  );

-- Também atualizar empresas sem plano definido (plano gratuito com limite 2000)
UPDATE companies 
SET menu_published = false
WHERE menu_published = true
  AND (subscription_plan IS NULL OR subscription_plan = 'free')
  AND monthly_revenue >= 2000;