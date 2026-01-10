-- Allow all authenticated users to read NFe global settings
CREATE POLICY "Authenticated users can read nfe settings" 
ON public.nfe_global_settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);