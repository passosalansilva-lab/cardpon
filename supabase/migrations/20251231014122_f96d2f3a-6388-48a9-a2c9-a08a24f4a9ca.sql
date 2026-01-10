-- Public, realtime-safe status mirror for customer tracking (no PII)
create table if not exists public.order_public_status (
  order_id uuid primary key references public.orders(id) on delete cascade,
  company_id uuid not null,
  status public.order_status not null,
  estimated_delivery_time timestamptz null,
  delivered_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.order_public_status enable row level security;

-- Anyone can read a status by order_id (UUID is hard to guess); contains no PII
do $$ begin
  create policy "Public can read order public status"
  on public.order_public_status
  for select
  using (true);
exception when duplicate_object then null; end $$;

-- Block direct client writes (keeps table safe). Trigger runs as table owner.
do $$ begin
  create policy "No direct inserts to order public status"
  on public.order_public_status
  for insert
  with check (false);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "No direct updates to order public status"
  on public.order_public_status
  for update
  using (false);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "No direct deletes to order public status"
  on public.order_public_status
  for delete
  using (false);
exception when duplicate_object then null; end $$;

-- Keep mirror in sync
create or replace function public.sync_order_public_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_public_status (
    order_id,
    company_id,
    status,
    estimated_delivery_time,
    delivered_at,
    updated_at
  ) values (
    new.id,
    new.company_id,
    new.status,
    new.estimated_delivery_time,
    new.delivered_at,
    now()
  )
  on conflict (order_id)
  do update set
    company_id = excluded.company_id,
    status = excluded.status,
    estimated_delivery_time = excluded.estimated_delivery_time,
    delivered_at = excluded.delivered_at,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_order_public_status on public.orders;
create trigger trg_sync_order_public_status
after insert or update of status, estimated_delivery_time, delivered_at
on public.orders
for each row
execute function public.sync_order_public_status();

-- Backfill existing orders
insert into public.order_public_status (order_id, company_id, status, estimated_delivery_time, delivered_at, updated_at)
select id, company_id, status, estimated_delivery_time, delivered_at, now()
from public.orders
on conflict (order_id) do update set
  company_id = excluded.company_id,
  status = excluded.status,
  estimated_delivery_time = excluded.estimated_delivery_time,
  delivered_at = excluded.delivered_at,
  updated_at = now();

-- Realtime
alter table public.order_public_status replica identity full;
alter publication supabase_realtime add table public.order_public_status;