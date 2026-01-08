-- Create table to mark categories as açaí categories
CREATE TABLE public.acai_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  category_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.acai_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Company owners manage acai categories"
ON public.acai_categories
FOR ALL
USING (EXISTS (
  SELECT 1 FROM companies c
  WHERE c.id = acai_categories.company_id AND c.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM companies c
  WHERE c.id = acai_categories.company_id AND c.owner_id = auth.uid()
));

CREATE POLICY "Public view acai categories"
ON public.acai_categories
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM companies c
  WHERE c.id = acai_categories.company_id AND c.status = 'approved'
));

CREATE POLICY "Store staff manage acai categories"
ON public.acai_categories
FOR ALL
USING (
  has_role(auth.uid(), 'store_staff') AND 
  EXISTS (
    SELECT 1 FROM company_staff cs
    WHERE cs.user_id = auth.uid() AND cs.company_id = acai_categories.company_id
  )
)
WITH CHECK (
  has_role(auth.uid(), 'store_staff') AND 
  EXISTS (
    SELECT 1 FROM company_staff cs
    WHERE cs.user_id = auth.uid() AND cs.company_id = acai_categories.company_id
  )
);

-- Create table for açaí sizes with custom names and prices
CREATE TABLE public.acai_category_sizes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_price numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.acai_category_sizes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "acai_category_sizes_manage"
ON public.acai_category_sizes
FOR ALL
USING (EXISTS (
  SELECT 1 FROM categories c
  JOIN companies co ON co.id = c.company_id
  LEFT JOIN company_staff cs ON cs.company_id = co.id AND cs.user_id = auth.uid()
  WHERE c.id = acai_category_sizes.category_id
  AND (co.owner_id = auth.uid() OR cs.user_id IS NOT NULL)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM categories c
  JOIN companies co ON co.id = c.company_id
  LEFT JOIN company_staff cs ON cs.company_id = co.id AND cs.user_id = auth.uid()
  WHERE c.id = acai_category_sizes.category_id
  AND (co.owner_id = auth.uid() OR cs.user_id IS NOT NULL)
));

CREATE POLICY "acai_category_sizes_public_view"
ON public.acai_category_sizes
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM categories c
  JOIN companies co ON co.id = c.company_id
  WHERE c.id = acai_category_sizes.category_id
  AND co.status = 'approved'
));

-- Create table for option groups per size (e.g., which addons are available for each size)
CREATE TABLE public.acai_size_option_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  size_id uuid NOT NULL REFERENCES public.acai_category_sizes(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  min_selections integer NOT NULL DEFAULT 0,
  max_selections integer NOT NULL DEFAULT 1,
  free_quantity integer NOT NULL DEFAULT 0,
  extra_price_per_item numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.acai_size_option_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "acai_size_option_groups_manage"
ON public.acai_size_option_groups
FOR ALL
USING (EXISTS (
  SELECT 1 FROM acai_category_sizes acs
  JOIN categories c ON c.id = acs.category_id
  JOIN companies co ON co.id = c.company_id
  LEFT JOIN company_staff cs ON cs.company_id = co.id AND cs.user_id = auth.uid()
  WHERE acs.id = acai_size_option_groups.size_id
  AND (co.owner_id = auth.uid() OR cs.user_id IS NOT NULL)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM acai_category_sizes acs
  JOIN categories c ON c.id = acs.category_id
  JOIN companies co ON co.id = c.company_id
  LEFT JOIN company_staff cs ON cs.company_id = co.id AND cs.user_id = auth.uid()
  WHERE acs.id = acai_size_option_groups.size_id
  AND (co.owner_id = auth.uid() OR cs.user_id IS NOT NULL)
));

CREATE POLICY "acai_size_option_groups_public_view"
ON public.acai_size_option_groups
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM acai_category_sizes acs
  JOIN categories c ON c.id = acs.category_id
  JOIN companies co ON co.id = c.company_id
  WHERE acs.id = acai_size_option_groups.size_id
  AND co.status = 'approved'
));

-- Create table for options within each group
CREATE TABLE public.acai_size_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.acai_size_option_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_modifier numeric NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.acai_size_options ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "acai_size_options_manage"
ON public.acai_size_options
FOR ALL
USING (EXISTS (
  SELECT 1 FROM acai_size_option_groups asog
  JOIN acai_category_sizes acs ON acs.id = asog.size_id
  JOIN categories c ON c.id = acs.category_id
  JOIN companies co ON co.id = c.company_id
  LEFT JOIN company_staff cs ON cs.company_id = co.id AND cs.user_id = auth.uid()
  WHERE asog.id = acai_size_options.group_id
  AND (co.owner_id = auth.uid() OR cs.user_id IS NOT NULL)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM acai_size_option_groups asog
  JOIN acai_category_sizes acs ON acs.id = asog.size_id
  JOIN categories c ON c.id = acs.category_id
  JOIN companies co ON co.id = c.company_id
  LEFT JOIN company_staff cs ON cs.company_id = co.id AND cs.user_id = auth.uid()
  WHERE asog.id = acai_size_options.group_id
  AND (co.owner_id = auth.uid() OR cs.user_id IS NOT NULL)
));

CREATE POLICY "acai_size_options_public_view"
ON public.acai_size_options
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM acai_size_option_groups asog
  JOIN acai_category_sizes acs ON acs.id = asog.size_id
  JOIN categories c ON c.id = acs.category_id
  JOIN companies co ON co.id = c.company_id
  WHERE asog.id = acai_size_options.group_id
  AND co.status = 'approved'
));

-- Add indexes for better performance
CREATE INDEX idx_acai_categories_company ON public.acai_categories(company_id);
CREATE INDEX idx_acai_categories_category ON public.acai_categories(category_id);
CREATE INDEX idx_acai_category_sizes_category ON public.acai_category_sizes(category_id);
CREATE INDEX idx_acai_size_option_groups_size ON public.acai_size_option_groups(size_id);
CREATE INDEX idx_acai_size_options_group ON public.acai_size_options(group_id);