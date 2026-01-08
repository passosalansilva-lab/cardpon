-- Drop the existing unique constraint
ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_company_id_table_number_key;

-- Create a partial unique index that only applies to active tables
CREATE UNIQUE INDEX tables_company_id_table_number_active_key 
ON public.tables (company_id, table_number) 
WHERE is_active = true;