-- Function to generate lottery tickets when order is delivered
CREATE OR REPLACE FUNCTION public.generate_lottery_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_settings RECORD;
  v_tickets_to_add INTEGER;
BEGIN
  -- Only trigger when status changes to delivered
  IF NEW.status = 'delivered' AND (OLD IS NULL OR OLD.status != 'delivered') THEN
    -- Get lottery settings for this company
    SELECT * INTO v_settings
    FROM public.lottery_settings
    WHERE company_id = NEW.company_id
    AND is_enabled = true;
    
    -- If lottery is not enabled, do nothing
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;
    
    -- Skip if no customer_id (shouldn't happen, but safety check)
    IF NEW.customer_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Calculate tickets to add
    IF v_settings.tickets_per_amount IS NOT NULL AND v_settings.tickets_per_amount > 0 THEN
      -- Tickets based on order amount
      v_tickets_to_add := FLOOR(NEW.total / v_settings.tickets_per_amount);
    ELSE
      -- Fixed tickets per order
      v_tickets_to_add := COALESCE(v_settings.tickets_per_order, 1);
    END IF;
    
    -- Ensure at least 1 ticket
    IF v_tickets_to_add < 1 THEN
      v_tickets_to_add := 1;
    END IF;
    
    -- Insert lottery tickets
    INSERT INTO public.lottery_tickets (
      company_id,
      customer_id,
      order_id,
      quantity,
      is_used
    ) VALUES (
      NEW.company_id,
      NEW.customer_id,
      NEW.id,
      v_tickets_to_add,
      false
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for generating lottery tickets
DROP TRIGGER IF EXISTS generate_lottery_tickets_on_delivery ON public.orders;
CREATE TRIGGER generate_lottery_tickets_on_delivery
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_lottery_tickets();