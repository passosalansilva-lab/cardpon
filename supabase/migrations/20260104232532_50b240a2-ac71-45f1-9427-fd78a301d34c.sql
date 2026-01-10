-- Create waiter_calls table for call waiter functionality
CREATE TABLE public.waiter_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  table_session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL DEFAULT 'waiter' CHECK (call_type IN ('waiter', 'bill', 'help', 'water')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;

-- Policy for company staff to view and manage calls
CREATE POLICY "Company staff can view calls" 
ON public.waiter_calls 
FOR SELECT 
USING (
  company_id IN (
    SELECT id FROM public.companies WHERE owner_id = auth.uid()
    UNION
    SELECT company_id FROM public.company_staff WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Company staff can update calls" 
ON public.waiter_calls 
FOR UPDATE 
USING (
  company_id IN (
    SELECT id FROM public.companies WHERE owner_id = auth.uid()
    UNION
    SELECT company_id FROM public.company_staff WHERE user_id = auth.uid()
  )
);

-- Policy for anyone to create calls (customers via public menu)
CREATE POLICY "Anyone can create calls" 
ON public.waiter_calls 
FOR INSERT 
WITH CHECK (true);

-- Enable realtime for waiter calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_calls;

-- Create index for faster queries
CREATE INDEX idx_waiter_calls_company_status ON public.waiter_calls(company_id, status);
CREATE INDEX idx_waiter_calls_table_session ON public.waiter_calls(table_session_id);