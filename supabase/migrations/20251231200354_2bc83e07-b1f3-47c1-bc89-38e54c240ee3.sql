-- Create tables table for table management
CREATE TABLE public.tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  table_number INTEGER NOT NULL,
  name TEXT, -- Optional custom name like "Mesa da Varanda"
  capacity INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'available', -- available, occupied, reserved, cleaning
  position_x INTEGER DEFAULT 0, -- For visual layout
  position_y INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, table_number)
);

-- Create table sessions to track open tabs/sessions on tables
CREATE TABLE public.table_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_count INTEGER DEFAULT 1,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'open', -- open, closed, transferred
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add table_session_id to orders for linking orders to table sessions
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS table_session_id UUID REFERENCES public.table_sessions(id);

-- Enable RLS
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for tables
CREATE POLICY "Company owners can manage tables"
ON public.tables FOR ALL
USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = tables.company_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM companies c WHERE c.id = tables.company_id AND c.owner_id = auth.uid()));

CREATE POLICY "Store staff can manage tables"
ON public.tables FOR ALL
USING (has_role(auth.uid(), 'store_staff'::app_role) AND EXISTS (
  SELECT 1 FROM company_staff cs WHERE cs.user_id = auth.uid() AND cs.company_id = tables.company_id
))
WITH CHECK (has_role(auth.uid(), 'store_staff'::app_role) AND EXISTS (
  SELECT 1 FROM company_staff cs WHERE cs.user_id = auth.uid() AND cs.company_id = tables.company_id
));

-- RLS policies for table_sessions
CREATE POLICY "Company owners can manage table sessions"
ON public.table_sessions FOR ALL
USING (EXISTS (SELECT 1 FROM companies c WHERE c.id = table_sessions.company_id AND c.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM companies c WHERE c.id = table_sessions.company_id AND c.owner_id = auth.uid()));

CREATE POLICY "Store staff can manage table sessions"
ON public.table_sessions FOR ALL
USING (has_role(auth.uid(), 'store_staff'::app_role) AND EXISTS (
  SELECT 1 FROM company_staff cs WHERE cs.user_id = auth.uid() AND cs.company_id = table_sessions.company_id
))
WITH CHECK (has_role(auth.uid(), 'store_staff'::app_role) AND EXISTS (
  SELECT 1 FROM company_staff cs WHERE cs.user_id = auth.uid() AND cs.company_id = table_sessions.company_id
));

-- Create triggers for updated_at
CREATE TRIGGER update_tables_updated_at
BEFORE UPDATE ON public.tables
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_table_sessions_updated_at
BEFORE UPDATE ON public.table_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to automatically update table status based on sessions
CREATE OR REPLACE FUNCTION public.sync_table_status_from_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'open' THEN
    UPDATE public.tables SET status = 'occupied', updated_at = now() WHERE id = NEW.table_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status = 'open' THEN
    -- Check if there are other open sessions for this table
    IF NOT EXISTS (
      SELECT 1 FROM public.table_sessions 
      WHERE table_id = NEW.table_id AND status = 'open' AND id != NEW.id
    ) THEN
      UPDATE public.tables SET status = 'available', updated_at = now() WHERE id = NEW.table_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_table_status_trigger
AFTER INSERT OR UPDATE ON public.table_sessions
FOR EACH ROW
EXECUTE FUNCTION public.sync_table_status_from_session();

-- Add index for faster queries
CREATE INDEX idx_tables_company_id ON public.tables(company_id);
CREATE INDEX idx_table_sessions_table_id ON public.table_sessions(table_id);
CREATE INDEX idx_table_sessions_status ON public.table_sessions(status);
CREATE INDEX idx_orders_table_session_id ON public.orders(table_session_id);