drop extension if exists "pg_net";

create extension if not exists "pg_net" with schema "public";

drop index if exists "public"."idx_table_sessions_token";

CREATE UNIQUE INDEX table_sessions_session_token_key ON public.table_sessions USING btree (session_token);

CREATE INDEX idx_table_sessions_token ON public.table_sessions USING btree (session_token) WHERE (session_token IS NOT NULL);

alter table "public"."table_sessions" add constraint "table_sessions_session_token_key" UNIQUE using index "table_sessions_session_token_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.can_access_kds(company_uuid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1
    from companies
    where id = company_uuid
      and kds_token is not null
  );
$function$
;

create or replace view "public"."orders_public" as  SELECT o.id,
    o.company_id,
    o.customer_id,
    o.customer_name,
    o.customer_phone,
    o.customer_email,
    o.delivery_address_id,
    o.delivery_driver_id,
    o.status,
    o.payment_method,
    o.payment_status,
    o.stripe_payment_intent_id,
    o.subtotal,
    o.delivery_fee,
    o.total,
    o.notes,
    o.estimated_delivery_time,
    o.delivered_at,
    o.created_at,
    o.updated_at,
    o.coupon_id,
    o.discount_amount,
    o.needs_change,
    o.change_for,
    o.cancellation_reason,
    o.source,
    o.table_session_id,
    o.queue_position,
    o.referral_code_id
   FROM (public.orders o
     JOIN public.companies c ON ((c.id = o.company_id)))
  WHERE (c.kds_token = current_setting('kds.token'::text, true));


CREATE OR REPLACE FUNCTION public.generate_session_token()
 RETURNS text
 LANGUAGE sql
AS $function$
  SELECT encode(extensions.gen_random_bytes(12), 'base64')::text
$function$
;


  create policy "Public KDS can read items"
  on "public"."order_items"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.companies c ON ((c.id = o.company_id)))
  WHERE ((o.id = order_items.order_id) AND (c.kds_token IS NOT NULL)))));



  create policy "allow public select on orders"
  on "public"."orders"
  as permissive
  for select
  to public
using (true);



  create policy "allow public select orders"
  on "public"."orders"
  as permissive
  for select
  to public
using (true);



  create policy "allow select all orders"
  on "public"."orders"
  as permissive
  for select
  to public
using (true);



  create policy "allow update all orders"
  on "public"."orders"
  as permissive
  for update
  to public
using (true);



  create policy "public access to advance order"
  on "public"."orders"
  as permissive
  for update
  to public
using ((company_id = (current_setting('request.jwt.claims.company_id'::text))::uuid));



  create policy "Allow public read from images bucket"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'images'::text));



  create policy "Allow uploads to images bucket"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check ((bucket_id = 'images'::text));



