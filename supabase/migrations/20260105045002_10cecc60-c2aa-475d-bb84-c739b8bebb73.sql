
-- Add column to store winner's ticket count
ALTER TABLE public.lottery_draws 
ADD COLUMN IF NOT EXISTS winner_tickets_count integer DEFAULT 0;

-- Update existing records to set winner_tickets_count to 1 as fallback
UPDATE public.lottery_draws SET winner_tickets_count = 1 WHERE winner_tickets_count = 0 OR winner_tickets_count IS NULL;
