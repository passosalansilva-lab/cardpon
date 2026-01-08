-- Add tags column to products table for visual badges
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Add sales_count column for smart ordering by popularity
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS sales_count integer DEFAULT 0;

-- Create index for faster ordering by sales
CREATE INDEX IF NOT EXISTS idx_products_sales_count ON public.products(sales_count DESC);

-- Create a function to update sales count when an order is completed
CREATE OR REPLACE FUNCTION public.update_product_sales_count()
RETURNS TRIGGER AS $$
BEGIN
  -- When order status changes to 'delivered' or 'ready', update sales count
  IF NEW.status IN ('delivered', 'ready') AND OLD.status NOT IN ('delivered', 'ready') THEN
    UPDATE public.products p
    SET sales_count = sales_count + oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
    AND p.id = oi.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-update sales count
DROP TRIGGER IF EXISTS trigger_update_product_sales_count ON public.orders;
CREATE TRIGGER trigger_update_product_sales_count
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_product_sales_count();