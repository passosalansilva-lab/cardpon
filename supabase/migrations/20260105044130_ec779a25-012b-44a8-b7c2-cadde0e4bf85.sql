
-- Create trigger to update lottery_tickets when customer gets linked to a user
CREATE OR REPLACE FUNCTION public.link_lottery_tickets_to_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- When user_id is set/changed on a customer, update their lottery tickets
  IF NEW.user_id IS NOT NULL AND (OLD.user_id IS NULL OR OLD.user_id != NEW.user_id) THEN
    UPDATE public.lottery_tickets
    SET user_id = NEW.user_id
    WHERE customer_id = NEW.id
      AND (user_id IS NULL OR user_id != NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on customers table
DROP TRIGGER IF EXISTS on_customer_user_linked ON public.customers;
CREATE TRIGGER on_customer_user_linked
  AFTER UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.link_lottery_tickets_to_user();
