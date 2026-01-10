-- Create table for system settings
CREATE TABLE public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage system settings
CREATE POLICY "Super admins can manage system settings"
ON public.system_settings
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Anyone can view system settings (for public logo etc)
CREATE POLICY "Anyone can view system settings"
ON public.system_settings
FOR SELECT
USING (true);

-- Insert default logo setting
INSERT INTO public.system_settings (key, value) 
VALUES ('system_logo', null);

-- Create trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();