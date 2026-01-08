-- Ensure pgcrypto extension exists
create extension if not exists "pgcrypto";

-- Add session_token column
alter table public.table_sessions
add column if not exists session_token text;

-- Create unique index
create unique index if not exists idx_table_sessions_token
on public.table_sessions (session_token)
where session_token is not null;

-- Function to generate a random token
create or replace function public.generate_session_token()
returns text
language sql
stable
as $$
  select encode(extensions.gen_random_bytes(12), 'base64')
$$;
