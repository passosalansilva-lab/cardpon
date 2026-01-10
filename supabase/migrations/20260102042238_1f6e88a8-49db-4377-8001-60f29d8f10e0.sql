-- Add payment configuration fields to delivery_drivers
ALTER TABLE public.delivery_drivers
ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'per_delivery',
ADD COLUMN IF NOT EXISTS fixed_salary numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS per_delivery_fee numeric DEFAULT 5,
ADD COLUMN IF NOT EXISTS pending_earnings numeric DEFAULT 0;

-- Create driver_deliveries table to track each delivery and earnings
CREATE TABLE IF NOT EXISTS public.driver_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  delivery_fee_earned numeric NOT NULL DEFAULT 0,
  delivered_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'paid'
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(driver_id, order_id)
);

-- Create driver_payments table to track payment history
CREATE TABLE IF NOT EXISTS public.driver_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_type text NOT NULL, -- 'salary', 'deliveries', 'bonus', 'adjustment'
  description text,
  reference_period_start date,
  reference_period_end date,
  delivery_count integer DEFAULT 0,
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.driver_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies for driver_deliveries
CREATE POLICY "Owners manage driver deliveries"
ON public.driver_deliveries
FOR ALL
USING (EXISTS (
  SELECT 1 FROM companies c
  WHERE c.id = driver_deliveries.company_id
  AND c.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM companies c
  WHERE c.id = driver_deliveries.company_id
  AND c.owner_id = auth.uid()
));

CREATE POLICY "Drivers view own deliveries"
ON public.driver_deliveries
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM delivery_drivers d
  WHERE d.id = driver_deliveries.driver_id
  AND d.user_id = auth.uid()
));

CREATE POLICY "Staff manage driver deliveries"
ON public.driver_deliveries
FOR ALL
USING (
  has_role(auth.uid(), 'store_staff'::app_role) AND
  EXISTS (
    SELECT 1 FROM company_staff cs
    WHERE cs.user_id = auth.uid()
    AND cs.company_id = driver_deliveries.company_id
  )
)
WITH CHECK (
  has_role(auth.uid(), 'store_staff'::app_role) AND
  EXISTS (
    SELECT 1 FROM company_staff cs
    WHERE cs.user_id = auth.uid()
    AND cs.company_id = driver_deliveries.company_id
  )
);

-- RLS policies for driver_payments
CREATE POLICY "Owners manage driver payments"
ON public.driver_payments
FOR ALL
USING (EXISTS (
  SELECT 1 FROM companies c
  WHERE c.id = driver_payments.company_id
  AND c.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM companies c
  WHERE c.id = driver_payments.company_id
  AND c.owner_id = auth.uid()
));

CREATE POLICY "Drivers view own payments"
ON public.driver_payments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM delivery_drivers d
  WHERE d.id = driver_payments.driver_id
  AND d.user_id = auth.uid()
));

CREATE POLICY "Staff manage driver payments"
ON public.driver_payments
FOR ALL
USING (
  has_role(auth.uid(), 'store_staff'::app_role) AND
  EXISTS (
    SELECT 1 FROM company_staff cs
    WHERE cs.user_id = auth.uid()
    AND cs.company_id = driver_payments.company_id
  )
)
WITH CHECK (
  has_role(auth.uid(), 'store_staff'::app_role) AND
  EXISTS (
    SELECT 1 FROM company_staff cs
    WHERE cs.user_id = auth.uid()
    AND cs.company_id = driver_payments.company_id
  )
);

-- Function to create delivery record when order is delivered
CREATE OR REPLACE FUNCTION public.record_driver_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_driver record;
  v_fee numeric;
BEGIN
  -- Only trigger when status changes to 'delivered' and has a driver
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' AND NEW.delivery_driver_id IS NOT NULL THEN
    -- Get driver payment config
    SELECT payment_type, per_delivery_fee, pending_earnings
    INTO v_driver
    FROM delivery_drivers
    WHERE id = NEW.delivery_driver_id;
    
    -- Calculate fee based on payment type
    IF v_driver.payment_type IN ('per_delivery', 'fixed_plus_delivery') THEN
      v_fee := COALESCE(v_driver.per_delivery_fee, 5);
    ELSE
      v_fee := 0;
    END IF;
    
    -- Insert delivery record
    INSERT INTO driver_deliveries (driver_id, order_id, company_id, delivery_fee_earned, delivered_at)
    VALUES (NEW.delivery_driver_id, NEW.id, NEW.company_id, v_fee, now())
    ON CONFLICT (driver_id, order_id) DO NOTHING;
    
    -- Update pending earnings
    UPDATE delivery_drivers
    SET pending_earnings = COALESCE(pending_earnings, 0) + v_fee,
        updated_at = now()
    WHERE id = NEW.delivery_driver_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for recording deliveries
DROP TRIGGER IF EXISTS on_order_delivered_record_delivery ON public.orders;
CREATE TRIGGER on_order_delivered_record_delivery
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.record_driver_delivery();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_driver_deliveries_driver_id ON public.driver_deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_deliveries_status ON public.driver_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_driver_payments_driver_id ON public.driver_payments(driver_id);

-- Enable realtime for driver_deliveries
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_deliveries;