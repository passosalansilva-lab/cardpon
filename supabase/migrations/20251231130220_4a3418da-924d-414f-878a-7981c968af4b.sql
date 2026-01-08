-- Adicionar campo para escolher o gateway de pagamento ativo
ALTER TABLE public.company_payment_settings
ADD COLUMN IF NOT EXISTS active_payment_gateway text DEFAULT 'mercadopago';

-- Comentário descritivo
COMMENT ON COLUMN public.company_payment_settings.active_payment_gateway IS 'Gateway ativo para pagamentos online: mercadopago ou picpay';