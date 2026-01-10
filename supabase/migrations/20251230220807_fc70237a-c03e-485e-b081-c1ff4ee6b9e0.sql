-- Enable realtime for nfe_invoices table
ALTER TABLE public.nfe_invoices REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.nfe_invoices;