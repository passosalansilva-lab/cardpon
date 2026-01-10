-- Função que verifica e desativa produtos sem estoque suficiente
-- Chamada quando o estoque de um ingrediente muda
CREATE OR REPLACE FUNCTION public.check_and_deactivate_products_no_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
  product_can_be_made boolean;
  ingredient_stock numeric;
  required_qty numeric;
BEGIN
  -- Para cada produto que usa este ingrediente
  FOR rec IN
    SELECT DISTINCT ipi.product_id, p.name as product_name, p.is_active
    FROM public.inventory_product_ingredients ipi
    JOIN public.products p ON p.id = ipi.product_id
    WHERE ipi.ingredient_id = NEW.id
      AND p.is_active = true
  LOOP
    -- Verificar se o produto pode ser feito (todos os ingredientes disponíveis)
    product_can_be_made := true;
    
    FOR required_qty, ingredient_stock IN
      SELECT 
        ipi2.quantity_per_unit,
        COALESCE(ii.current_stock, 0)
      FROM public.inventory_product_ingredients ipi2
      JOIN public.inventory_ingredients ii ON ii.id = ipi2.ingredient_id
      WHERE ipi2.product_id = rec.product_id
    LOOP
      IF ingredient_stock < required_qty THEN
        product_can_be_made := false;
        EXIT;
      END IF;
    END LOOP;
    
    -- Se não pode ser feito, desativar o produto
    IF NOT product_can_be_made THEN
      UPDATE public.products
      SET is_active = false
      WHERE id = rec.product_id;
      
      -- Notificar o dono
      INSERT INTO public.notifications (user_id, title, message, type, data)
      SELECT 
        c.owner_id,
        'Produto desativado: ' || rec.product_name,
        'O produto "' || rec.product_name || '" foi desativado automaticamente por falta de estoque.',
        'warning',
        jsonb_build_object(
          'type', 'product_deactivated_no_stock',
          'product_id', rec.product_id,
          'product_name', rec.product_name,
          'company_id', NEW.company_id
        )
      FROM public.products prod
      JOIN public.companies c ON c.id = prod.company_id
      WHERE prod.id = rec.product_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Trigger que dispara quando o estoque muda
DROP TRIGGER IF EXISTS trigger_check_product_stock ON public.inventory_ingredients;
CREATE TRIGGER trigger_check_product_stock
  AFTER UPDATE OF current_stock ON public.inventory_ingredients
  FOR EACH ROW
  WHEN (NEW.current_stock < OLD.current_stock)
  EXECUTE FUNCTION public.check_and_deactivate_products_no_stock();