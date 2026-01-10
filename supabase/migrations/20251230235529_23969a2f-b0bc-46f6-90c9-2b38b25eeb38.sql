-- Add WhatsApp notification setting to companies table
ALTER TABLE public.companies 
ADD COLUMN whatsapp_notifications_enabled BOOLEAN DEFAULT true;