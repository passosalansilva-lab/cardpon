-- Tabela para armazenar pedidos pendentes aguardando confirmação de pagamento
CREATE TABLE public.pending_order_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_data JSONB NOT NULL,
  mercadopago_preference_id TEXT,
  mercadopago_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  order_id UUID REFERENCES public.orders(id)
);

-- Enable RLS
ALTER TABLE public.pending_order_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything (for webhooks)
CREATE POLICY "Service role full access on pending_order_payments"
ON public.pending_order_payments
FOR ALL
USING (true)
WITH CHECK (true);

-- Index for quick lookup
CREATE INDEX idx_pending_order_payments_company_id ON public.pending_order_payments(company_id);
CREATE INDEX idx_pending_order_payments_status ON public.pending_order_payments(status);
CREATE INDEX idx_pending_order_payments_preference_id ON public.pending_order_payments(mercadopago_preference_id);