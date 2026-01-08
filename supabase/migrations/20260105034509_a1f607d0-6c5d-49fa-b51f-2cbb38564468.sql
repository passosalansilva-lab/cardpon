-- Configurações do sorteio por empresa
CREATE TABLE public.lottery_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  tickets_per_order INTEGER DEFAULT 1,
  tickets_per_amount NUMERIC(10,2) DEFAULT NULL,
  prize_description TEXT,
  draw_frequency TEXT DEFAULT 'monthly',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Tickets dos clientes
CREATE TABLE public.lottery_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Histórico de sorteios
CREATE TABLE public.lottery_draws (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  winner_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  winner_name TEXT,
  winner_phone TEXT,
  prize_description TEXT NOT NULL,
  total_tickets_in_draw INTEGER DEFAULT 0,
  drawn_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lottery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_draws ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lottery_settings
CREATE POLICY "Company owners can manage lottery settings"
ON public.lottery_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = lottery_settings.company_id
    AND companies.owner_id = auth.uid()
  )
);

CREATE POLICY "Staff can view lottery settings"
ON public.lottery_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_staff
    WHERE company_staff.company_id = lottery_settings.company_id
    AND company_staff.user_id = auth.uid()
  )
);

CREATE POLICY "Public can view enabled lottery settings"
ON public.lottery_settings
FOR SELECT
USING (is_enabled = true);

-- RLS Policies for lottery_tickets
CREATE POLICY "Company owners can manage tickets"
ON public.lottery_tickets
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = lottery_tickets.company_id
    AND companies.owner_id = auth.uid()
  )
);

CREATE POLICY "Staff can view tickets"
ON public.lottery_tickets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_staff
    WHERE company_staff.company_id = lottery_tickets.company_id
    AND company_staff.user_id = auth.uid()
  )
);

CREATE POLICY "Customers can view their own tickets"
ON public.lottery_tickets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.customers
    WHERE customers.id = lottery_tickets.customer_id
    AND customers.user_id = auth.uid()
  )
);

CREATE POLICY "Public can insert tickets"
ON public.lottery_tickets
FOR INSERT
WITH CHECK (true);

-- RLS Policies for lottery_draws
CREATE POLICY "Company owners can manage draws"
ON public.lottery_draws
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = lottery_draws.company_id
    AND companies.owner_id = auth.uid()
  )
);

CREATE POLICY "Staff can view draws"
ON public.lottery_draws
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_staff
    WHERE company_staff.company_id = lottery_draws.company_id
    AND company_staff.user_id = auth.uid()
  )
);

CREATE POLICY "Public can view draws"
ON public.lottery_draws
FOR SELECT
USING (true);

-- Indexes for performance
CREATE INDEX idx_lottery_tickets_company ON public.lottery_tickets(company_id);
CREATE INDEX idx_lottery_tickets_customer ON public.lottery_tickets(customer_id);
CREATE INDEX idx_lottery_tickets_unused ON public.lottery_tickets(company_id, is_used) WHERE is_used = false;
CREATE INDEX idx_lottery_draws_company ON public.lottery_draws(company_id);

-- Trigger for updated_at on lottery_settings
CREATE TRIGGER update_lottery_settings_updated_at
BEFORE UPDATE ON public.lottery_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();