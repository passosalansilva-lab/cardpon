-- Add queued status support for order queue
-- Orders can now be status 'queued' meaning they are waiting for a driver to finish current delivery

-- Add queue_position column to track order in queue per driver
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS queue_position integer DEFAULT NULL;

-- Index for efficient queue queries
CREATE INDEX IF NOT EXISTS idx_orders_driver_queue ON public.orders(delivery_driver_id, queue_position) WHERE queue_position IS NOT NULL;