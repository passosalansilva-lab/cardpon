
-- Drop the incorrect foreign key that points to auth.users
ALTER TABLE public.orders DROP CONSTRAINT orders_customer_id_fkey;

-- Add the correct foreign key that points to customers table
ALTER TABLE public.orders 
ADD CONSTRAINT orders_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;
