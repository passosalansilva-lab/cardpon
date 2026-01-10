-- Permitir super admins deletarem empresas
CREATE POLICY "Super admins can delete companies"
ON public.companies
FOR DELETE
USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Atualizar foreign keys para CASCADE DELETE em todas as tabelas relacionadas

-- categories
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_company_id_fkey;
ALTER TABLE public.categories ADD CONSTRAINT categories_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- products
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_company_id_fkey;
ALTER TABLE public.products ADD CONSTRAINT products_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- orders
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_company_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- order_reviews  
ALTER TABLE public.order_reviews DROP CONSTRAINT IF EXISTS order_reviews_company_id_fkey;
ALTER TABLE public.order_reviews ADD CONSTRAINT order_reviews_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- order_offers
ALTER TABLE public.order_offers DROP CONSTRAINT IF EXISTS order_offers_company_id_fkey;
ALTER TABLE public.order_offers ADD CONSTRAINT order_offers_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- combos
ALTER TABLE public.combos DROP CONSTRAINT IF EXISTS combos_company_id_fkey;
ALTER TABLE public.combos ADD CONSTRAINT combos_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- coupons
ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_company_id_fkey;
ALTER TABLE public.coupons ADD CONSTRAINT coupons_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- promotions
ALTER TABLE public.promotions DROP CONSTRAINT IF EXISTS promotions_company_id_fkey;
ALTER TABLE public.promotions ADD CONSTRAINT promotions_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- delivery_drivers
ALTER TABLE public.delivery_drivers DROP CONSTRAINT IF EXISTS delivery_drivers_company_id_fkey;
ALTER TABLE public.delivery_drivers ADD CONSTRAINT delivery_drivers_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- company_staff
ALTER TABLE public.company_staff DROP CONSTRAINT IF EXISTS company_staff_company_id_fkey;
ALTER TABLE public.company_staff ADD CONSTRAINT company_staff_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- staff_permissions
ALTER TABLE public.staff_permissions DROP CONSTRAINT IF EXISTS staff_permissions_company_id_fkey;
ALTER TABLE public.staff_permissions ADD CONSTRAINT staff_permissions_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- company_payment_settings
ALTER TABLE public.company_payment_settings DROP CONSTRAINT IF EXISTS company_payment_settings_company_id_fkey;
ALTER TABLE public.company_payment_settings ADD CONSTRAINT company_payment_settings_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- day_periods
ALTER TABLE public.day_periods DROP CONSTRAINT IF EXISTS day_periods_company_id_fkey;
ALTER TABLE public.day_periods ADD CONSTRAINT day_periods_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- activity_logs
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_company_id_fkey;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- inventory_ingredients
ALTER TABLE public.inventory_ingredients DROP CONSTRAINT IF EXISTS inventory_ingredients_company_id_fkey;
ALTER TABLE public.inventory_ingredients ADD CONSTRAINT inventory_ingredients_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- inventory_movements
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_company_id_fkey;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- inventory_purchases
ALTER TABLE public.inventory_purchases DROP CONSTRAINT IF EXISTS inventory_purchases_company_id_fkey;
ALTER TABLE public.inventory_purchases ADD CONSTRAINT inventory_purchases_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- inventory_product_ingredients
ALTER TABLE public.inventory_product_ingredients DROP CONSTRAINT IF EXISTS inventory_product_ingredients_company_id_fkey;
ALTER TABLE public.inventory_product_ingredients ADD CONSTRAINT inventory_product_ingredients_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- inventory_ingredient_units
ALTER TABLE public.inventory_ingredient_units DROP CONSTRAINT IF EXISTS inventory_ingredient_units_company_id_fkey;
ALTER TABLE public.inventory_ingredient_units ADD CONSTRAINT inventory_ingredient_units_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- pizza_settings
ALTER TABLE public.pizza_settings DROP CONSTRAINT IF EXISTS pizza_settings_company_id_fkey;
ALTER TABLE public.pizza_settings ADD CONSTRAINT pizza_settings_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- pizza_categories
ALTER TABLE public.pizza_categories DROP CONSTRAINT IF EXISTS pizza_categories_company_id_fkey;
ALTER TABLE public.pizza_categories ADD CONSTRAINT pizza_categories_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- push_subscriptions
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_company_id_fkey;
ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- nfe_company_settings
ALTER TABLE public.nfe_company_settings DROP CONSTRAINT IF EXISTS nfe_company_settings_company_id_fkey;
ALTER TABLE public.nfe_company_settings ADD CONSTRAINT nfe_company_settings_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- nfe_invoices
ALTER TABLE public.nfe_invoices DROP CONSTRAINT IF EXISTS nfe_invoices_company_id_fkey;
ALTER TABLE public.nfe_invoices ADD CONSTRAINT nfe_invoices_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- pending_order_payments
ALTER TABLE public.pending_order_payments DROP CONSTRAINT IF EXISTS pending_order_payments_company_id_fkey;
ALTER TABLE public.pending_order_payments ADD CONSTRAINT pending_order_payments_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- referrals (duas colunas)
ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_referrer_company_id_fkey;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_referrer_company_id_fkey 
  FOREIGN KEY (referrer_company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS referrals_referred_company_id_fkey;
ALTER TABLE public.referrals ADD CONSTRAINT referrals_referred_company_id_fkey 
  FOREIGN KEY (referred_company_id) REFERENCES public.companies(id) ON DELETE CASCADE;