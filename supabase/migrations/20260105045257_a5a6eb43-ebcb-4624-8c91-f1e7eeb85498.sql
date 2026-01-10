
-- Add column to track which draw used each ticket
ALTER TABLE public.lottery_tickets 
ADD COLUMN IF NOT EXISTS used_in_draw_id uuid REFERENCES public.lottery_draws(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_lottery_tickets_used_in_draw_id ON public.lottery_tickets(used_in_draw_id);
