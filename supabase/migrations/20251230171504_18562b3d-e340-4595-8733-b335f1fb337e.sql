-- Add CNPJ and fiscal fields to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS cnpj text,
ADD COLUMN IF NOT EXISTS razao_social text,
ADD COLUMN IF NOT EXISTS inscricao_estadual text;

-- Add comment for clarity
COMMENT ON COLUMN public.companies.cnpj IS 'CNPJ da empresa para emissão de NFe';
COMMENT ON COLUMN public.companies.razao_social IS 'Razão Social para NFe';
COMMENT ON COLUMN public.companies.inscricao_estadual IS 'Inscrição Estadual para NFe';