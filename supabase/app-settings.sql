-- Admin › App settings (2026-11-14). The app's contact details, delivery fees, pay-on-delivery
-- switch, campaign, wording, form lists, checkout questions and FAQ live in
-- site_settings (key 'app'). The server reads the money parts from there too, so what the
-- admin sets is what customers are charged. Safe to run more than once.

-- A number from the 'app' settings, e.g. public.app_setting_num('{delivery,standardFee}', 2000).
create or replace function public.app_setting_num(p_path text[], p_default numeric)
returns numeric
language sql
stable
set search_path = ''
as $$
    select coalesce(
        (select case when (s.value #>> p_path) ~ '^[0-9]+(\.[0-9]+)?$' then (s.value #>> p_path)::numeric end
           from public.site_settings s where s.key = 'app'),
        p_default)
$$;

-- Delivery fee per product: its own fee, else the market fee (Groceries & Essentials,
-- The Local Market) or the standard fee from App settings. Works at any category depth.
create or replace function public.product_delivery(p_menu_ids uuid[])
returns table(menu_id uuid, fee numeric, next_day boolean)
language sql
stable
set search_path = ''
as $function$
    with recursive items as (
        select m.id, m.category_id, m.delivery_fee, m.delivery_note from public.menu m where m.id = any (coalesce(p_menu_ids, '{}'))
    ), up as (
        select i.id as item_id, c.id, c.parent_id, c.name, c.delivery_note, 1 as depth
          from items i join public.categories c on c.id = i.category_id
        union all
        select up.item_id, c.id, c.parent_id, c.name, c.delivery_note, up.depth + 1
          from up join public.categories c on c.id = up.parent_id
         where up.depth < 10
    )
    select i.id,
           coalesce(i.delivery_fee,
                    case when exists (select 1 from up where up.item_id = i.id and up.parent_id is null
                                       and up.name in ('Groceries & Essentials', 'The Local Market'))
                         then public.app_setting_num('{delivery,marketFee}', 5000)
                         else public.app_setting_num('{delivery,standardFee}', 2000) end),
           coalesce(nullif(i.delivery_note, ''),
                    (select up.delivery_note from up where up.item_id = i.id and up.parent_id is null limit 1), '') ilike '%next%'
      from items i;
$function$;

create or replace function public.delivery_fee_for(p_menu_ids uuid[])
returns numeric
language sql
stable
set search_path = ''
as $function$
    select coalesce(max(fee), public.app_setting_num('{delivery,standardFee}', 2000)) from public.product_delivery(p_menu_ids);
$function$;

create or replace function public.delivery_quote(p_menu_ids uuid[])
returns jsonb
language sql
stable
set search_path = ''
as $function$
    with pd as (select * from public.product_delivery(p_menu_ids))
    select jsonb_build_object(
        'together', coalesce((select max(fee) from pd), public.app_setting_num('{delivery,standardFee}', 2000)),
        'today',    coalesce((select max(fee) from pd where not next_day), 0),
        'tomorrow', coalesce((select max(fee) from pd where next_day), 0),
        'split',    coalesce((select max(fee) from pd where not next_day), 0) + coalesce((select max(fee) from pd where next_day), 0),
        'has_both', exists (select 1 from pd where next_day) and exists (select 1 from pd where not next_day)
    );
$function$;

-- Answers to the admin's extra checkout questions ("How did you hear about us?"…).
alter table public.orders add column if not exists answers jsonb not null default '[]'::jsonb;

-- The customer saves them on their own order right after placing it (before paying).
create or replace function public.set_order_answers(p_order uuid, p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then raise exception 'You must be signed in'; end if;
    if p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) > 30
       or length(p_answers::text) > 20000 then
        raise exception 'Invalid answers';
    end if;
    update public.orders set answers = p_answers
     where id = p_order and user_id = auth.uid() and payment_status <> 'paid';
    if not found then raise exception 'Order not found'; end if;
end $$;
revoke all on function public.set_order_answers(uuid, jsonb) from public, anon;
grant execute on function public.set_order_answers(uuid, jsonb) to authenticated;

-- Live updates in the app when the admin saves App settings or service questions.
do $$
begin
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'site_settings') then
        alter publication supabase_realtime add table public.site_settings;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'request_questions') then
        alter publication supabase_realtime add table public.request_questions;
    end if;
end $$;
