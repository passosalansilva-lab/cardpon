
-- Add user_id column to lottery_tickets
ALTER TABLE public.lottery_tickets
ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_lottery_tickets_user_id ON public.lottery_tickets(user_id);

-- Update the generate_lottery_tickets function to also store user_id
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
  -- Check if we should generate tickets based on the trigger scenario:
  -- Scenario 1: Status changed to delivered and customer_id is set
  IF NEW.status = 'delivered' AND NEW.customer_id IS NOT NULL AND (OLD IS NULL OR OLD.status != 'delivered') THEN
    v_should_generate := true;
  -- Scenario 2: Customer ID was just set/changed on a delivered order
  ELSIF NEW.status = 'delivered' AND NEW.customer_id IS NOT NULL AND (OLD.customer_id IS NULL OR OLD.customer_id != NEW.customer_id) THEN
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
