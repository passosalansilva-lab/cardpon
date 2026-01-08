-- Add 'pay_at_counter' to payment_method enum for table orders
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'pay_at_counter';