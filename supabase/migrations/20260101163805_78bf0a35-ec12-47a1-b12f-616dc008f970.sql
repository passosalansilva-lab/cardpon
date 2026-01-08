-- Tabela para armazenar códigos de verificação de email
CREATE TABLE public.email_verification_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índice para busca rápida por email
CREATE INDEX idx_email_verification_codes_email ON public.email_verification_codes(email);

-- Índice para limpeza de códigos expirados
CREATE INDEX idx_email_verification_codes_expires_at ON public.email_verification_codes(expires_at);

-- RLS desabilitado - gerenciado por edge functions com service role
ALTER TABLE public.email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Função para limpar códigos expirados automaticamente
CREATE OR REPLACE FUNCTION public.cleanup_expired_verification_codes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.email_verification_codes
  WHERE expires_at < now();
  RETURN NEW;
END;
$$;

-- Trigger para limpar códigos expirados a cada novo insert
CREATE TRIGGER cleanup_expired_codes_trigger
  AFTER INSERT ON public.email_verification_codes
  EXECUTE FUNCTION public.cleanup_expired_verification_codes();