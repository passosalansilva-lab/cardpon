-- Update the trigger to also handle order cancellation (remove tickets)
CREATE OR REPLACE FUNCTION public.generate_lottery_tickets()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_settings RECORD;
  v_tickets_to_add INTEGER;
  v_existing_ticket UUID;
  v_should_generate BOOLEAN := false;
  v_user_id UUID;
BEGIN
  -- SCENARIO: Order was cancelled - remove any tickets for this order
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    DELETE FROM public.lottery_tickets
    WHERE order_id = NEW.id
    AND is_used = false;
    
    RETURN NEW;
  END IF;

  -- Check if we should generate tickets based on the trigger scenario:
  -- Scenario 1: Status changed to confirmed and customer_id is set
  IF NEW.status = 'confirmed' AND NEW.customer_id IS NOT NULL AND (OLD IS NULL OR OLD.status != 'confirmed') THEN
    v_should_generate := true;
  -- Scenario 2: Customer ID was just set/changed on a confirmed order
  ELSIF NEW.status = 'confirmed' AND NEW.customer_id IS NOT NULL AND (OLD.customer_id IS NULL OR OLD.customer_id != NEW.customer_id) THEN
    v_should_generate := true;
  END IF;

  IF NOT v_should_generate THEN
    RETURN NEW;
  END IF;

  -- Check if ticket already exists for this order
  SELECT id INTO v_existing_ticket
  FROM public.lottery_tickets
  WHERE order_id = NEW.id
  LIMIT 1;

  IF v_existing_ticket IS NOT NULL THEN
    -- Ticket already exists, don't duplicate
    RETURN NEW;
  END IF;

  -- Get lottery settings for this company
  SELECT * INTO v_settings
  FROM public.lottery_settings
  WHERE company_id = NEW.company_id
  AND is_enabled = true;
  
  -- If lottery is not enabled, do nothing
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Get user_id from the customer record
  SELECT user_id INTO v_user_id
  FROM public.customers
  WHERE id = NEW.customer_id;
  
  -- Calculate tickets to add
  IF v_settings.tickets_per_amount IS NOT NULL AND v_settings.tickets_per_amount > 0 THEN
    -- Tickets based on order amount (no minimum guarantee)
    v_tickets_to_add := FLOOR(NEW.total / v_settings.tickets_per_amount);
  ELSE
    -- Fixed tickets per order
    v_tickets_to_add := COALESCE(v_settings.tickets_per_order, 1);
  END IF;
  
  -- Only insert if there are tickets to add
  IF v_tickets_to_add > 0 THEN
    INSERT INTO public.lottery_tickets (
      company_id,
      customer_id,
      user_id,
      order_id,
      quantity,
      is_used
    ) VALUES (
      NEW.company_id,
      NEW.customer_id,
      v_user_id,
      NEW.id,
      v_tickets_to_add,
      false
    );
  END IF;
  
  RETURN NEW;
END;
$function$;