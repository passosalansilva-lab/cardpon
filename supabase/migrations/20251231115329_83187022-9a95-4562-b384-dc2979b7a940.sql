-- Create table for day periods (e.g., Lunch, Dinner)
CREATE TABLE public.day_periods (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for category-period associations
CREATE TABLE public.category_day_periods (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    day_period_id UUID NOT NULL REFERENCES public.day_periods(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(category_id, day_period_id)
);

-- Enable RLS
ALTER TABLE public.day_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_day_periods ENABLE ROW LEVEL SECURITY;

-- RLS policies for day_periods
CREATE POLICY "Anyone can view day periods of approved companies"
ON public.day_periods FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM companies c
        WHERE c.id = day_periods.company_id
        AND c.status = 'approved'::company_status
    )
);

CREATE POLICY "Owners can manage their day periods"
ON public.day_periods FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM companies c
        WHERE c.id = day_periods.company_id
        AND c.owner_id = auth.uid()
    )
);

CREATE POLICY "Store staff manage day periods"
ON public.day_periods FOR ALL
USING (
    has_role(auth.uid(), 'store_staff'::app_role) AND
    EXISTS (
        SELECT 1 FROM company_staff cs
        WHERE cs.user_id = auth.uid()
        AND cs.company_id = day_periods.company_id
    )
)
WITH CHECK (
    has_role(auth.uid(), 'store_staff'::app_role) AND
    EXISTS (
        SELECT 1 FROM company_staff cs
        WHERE cs.user_id = auth.uid()
        AND cs.company_id = day_periods.company_id
    )
);

-- RLS policies for category_day_periods
CREATE POLICY "Anyone can view category periods of approved companies"
ON public.category_day_periods FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM categories cat
        JOIN companies c ON c.id = cat.company_id
        WHERE cat.id = category_day_periods.category_id
        AND c.status = 'approved'::company_status
    )
);

CREATE POLICY "Owners can manage their category periods"
ON public.category_day_periods FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM categories cat
        JOIN companies c ON c.id = cat.company_id
        WHERE cat.id = category_day_periods.category_id
        AND c.owner_id = auth.uid()
    )
);

CREATE POLICY "Store staff manage category periods"
ON public.category_day_periods FOR ALL
USING (
    has_role(auth.uid(), 'store_staff'::app_role) AND
    EXISTS (
        SELECT 1 FROM categories cat
        JOIN company_staff cs ON cs.company_id = cat.company_id
        WHERE cat.id = category_day_periods.category_id
        AND cs.user_id = auth.uid()
    )
)
WITH CHECK (
    has_role(auth.uid(), 'store_staff'::app_role) AND
    EXISTS (
        SELECT 1 FROM categories cat
        JOIN company_staff cs ON cs.company_id = cat.company_id
        WHERE cat.id = category_day_periods.category_id
        AND cs.user_id = auth.uid()
    )
);

-- Trigger for updated_at
CREATE TRIGGER update_day_periods_updated_at
BEFORE UPDATE ON public.day_periods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();