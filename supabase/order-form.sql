-- Customise your order: a form the admin builds per product, and add-ons with a quantity.
--
--  * Add-ons (customizations) get max_qty: 1 = a tick box, 2+ = the customer taps + / − up to it.
--  * New question types on option_groups.kind:
--      'multi' choose several (up to max_select), 'qty' how many of each choice (+ / −, up to the
--      choice's max_qty), 'date' (at least min_days ahead), 'photo' (a picture the customer uploads),
--      'yesno'.
--  * Bucket order-photos: customers upload the picture for a 'photo' question (their own folder).
--  * place_order prices it all: an add-on or a 'how many' choice adds price × how many, per item.
--    Older apps keep working (they send customization_ids = one of each).
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.customizations add column if not exists max_qty integer not null default 1;
alter table public.customizations drop constraint if exists customizations_max_qty_check;
alter table public.customizations add constraint customizations_max_qty_check check (max_qty between 1 and 99);

alter table public.option_groups add column if not exists max_select integer;
alter table public.option_groups add column if not exists min_days integer;
alter table public.option_groups drop constraint if exists option_groups_kind_check;
alter table public.option_groups add constraint option_groups_kind_check
    check (kind in ('single', 'multi', 'qty', 'text', 'number', 'date', 'photo', 'yesno'));
alter table public.option_groups drop constraint if exists option_groups_max_select_check;
alter table public.option_groups add constraint option_groups_max_select_check check (max_select is null or max_select between 1 and 50);
alter table public.option_groups drop constraint if exists option_groups_min_days_check;
alter table public.option_groups add constraint option_groups_min_days_check check (min_days is null or min_days between 0 and 365);

alter table public.option_values add column if not exists max_qty integer not null default 10;
alter table public.option_values drop constraint if exists option_values_max_qty_check;
alter table public.option_values add constraint option_values_max_qty_check check (max_qty between 1 and 99);

-- First run only: paid add-ons (proteins, swallows, candles…) get + / − up to 10; free ones
-- (flavour picks such as noodle or pap types) and once-only services stay a tick box.
do $$
begin
    if not exists (select 1 from public.site_settings where key = 'order-form-migrated') then
        update public.customizations set max_qty = 10
         where price > 0 and name not in ('Chilled Delivery', 'Extra Ice', 'Chairs & Tables Setup');
        insert into public.site_settings (key, value) values ('order-form-migrated', 'true'::jsonb);
    end if;
end $$;

-- ---------------------------------------------------------------------------
-- Photos customers attach to a 'photo' question
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-photos', 'order-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set public = true, file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

drop policy if exists "Customers upload their order photos" on storage.objects;
create policy "Customers upload their order photos" on storage.objects for insert to authenticated
    with check (bucket_id = 'order-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Admins manage order photos" on storage.objects;
create policy "Admins manage order photos" on storage.objects for delete to authenticated
    using (bucket_id = 'order-photos' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- place_order
-- ---------------------------------------------------------------------------
create or replace function public.place_order(p_items jsonb, p_address text, p_city text, p_state text, p_phone text, p_payment_method text default 'paystack'::text, p_note text default null::text, p_delivery_plan text default 'together'::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
    v_user      uuid := auth.uid();
    v_order     uuid;
    v_item      jsonb;
    v_menu      record;
    v_qty       integer;
    v_addons    jsonb;
    v_add       jsonb;
    v_c         record;
    v_n         integer;
    v_cus       jsonb;
    v_cus_total numeric;
    v_opt_ids   uuid[];
    v_opt       jsonb;
    v_opt_total numeric;
    v_opt_count integer;
    v_oq        jsonb;
    v_ov        record;
    v_txt       jsonb;
    v_texts     jsonb;
    v_group     record;
    v_tier      record;
    v_num_total numeric;
    v_max_digits integer;
    v_text      text;
    v_day       date;
    v_missing   text;
    v_unit      numeric;
    v_subtotal  numeric := 0;
    v_fee       numeric;
    v_quote     jsonb;
    v_menu_ids  uuid[] := '{}';
    v_giving    boolean;
    v_photo_url constant text := 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/order-photos/';
    -- 'paystack' = pay everything now; 'pay_on_delivery' = pay only the delivery fee
    -- online now, the items (subtotal) to the rider on delivery.
    v_method    text := coalesce(nullif(btrim(p_payment_method), ''), 'paystack');
begin
    if v_user is null then
        raise exception 'You must be signed in to place an order';
    end if;
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'Your cart is empty';
    end if;
    if jsonb_array_length(p_items) > 50 then
        raise exception 'Too many items in one order';
    end if;
    -- Christmas giving: an order made ONLY of campaign packs isn't delivered to the buyer
    -- (the food goes to the less privileged), so no address and no delivery fee.
    v_giving := not exists (
        select 1 from jsonb_array_elements(p_items) e
          left join public.menu m on m.id = nullif(e.value ->> 'menu_id', '')::uuid
         where coalesce(m.is_campaign, false) = false
    );
    if not v_giving and (coalesce(btrim(p_address), '') = '' or coalesce(btrim(p_city), '') = '' or coalesce(btrim(p_state), '') = '') then
        raise exception 'Please enter your delivery address';
    end if;
    if v_giving and coalesce(nullif(btrim(p_payment_method), ''), 'paystack') = 'pay_on_delivery' then
        raise exception 'Please pay online for Christmas pre-orders';
    end if;
    if coalesce(btrim(p_phone), '') = '' then
        raise exception 'Please enter a phone number';
    end if;
    if v_method not in ('paystack', 'pay_on_delivery') then
        raise exception 'Invalid payment method';
    end if;
    -- Admin › App settings can switch Pay on delivery off.
    if v_method = 'pay_on_delivery'
       and coalesce((select s.value #>> '{delivery,payOnDelivery}' from public.site_settings s where s.key = 'app'), 'true') = 'false' then
        raise exception 'Pay on delivery isn''t available right now. Please pay online.';
    end if;

    -- Fee and amounts are filled in after the items are priced (below).
    insert into public.orders (user_id, status, payment_method, payment_status, subtotal, delivery_fee, total,
                               delivery_address, city, state, phone, note)
    values (v_user, 'awaiting_payment', v_method, 'unpaid', 0, 0, 0,
            case when v_giving then coalesce(nullif(btrim(p_address), ''), 'Christmas giving (no delivery)') else btrim(p_address) end,
            case when v_giving then coalesce(nullif(btrim(p_city), ''), '-') else btrim(p_city) end,
            case when v_giving then coalesce(nullif(btrim(p_state), ''), '-') else btrim(p_state) end,
            btrim(p_phone), nullif(btrim(p_note), ''))
    returning id into v_order;

    for v_item in select value from jsonb_array_elements(p_items) loop
        v_qty := (v_item ->> 'quantity')::integer;
        if v_qty is null or v_qty < 1 or v_qty > 50 then
            raise exception 'Invalid quantity';
        end if;

        select m.id, m.name, m.image_url, m.price, m.is_available into v_menu
          from public.menu m
         where m.id = (v_item ->> 'menu_id')::uuid;
        if not found then
            raise exception 'An item in your cart is no longer available';
        end if;
        if not v_menu.is_available then
            raise exception '% is sold out right now. Remove it from your cart to continue.', v_menu.name;
        end if;
        v_menu_ids := v_menu_ids || v_menu.id;

        -- Add-ons / extras and how many of each, per item ("addons": [{id, qty}]).
        -- Older apps send customization_ids: one of each.
        if jsonb_typeof(v_item -> 'addons') = 'array' then
            v_addons := v_item -> 'addons';
        else
            select coalesce(jsonb_agg(jsonb_build_object('id', x, 'qty', 1)), '[]'::jsonb) into v_addons
              from jsonb_array_elements_text(coalesce(v_item -> 'customization_ids', '[]'::jsonb)) as x;
        end if;
        v_cus := '[]'::jsonb;
        v_cus_total := 0;
        for v_add in select value from jsonb_array_elements(v_addons) loop
            select c.id, c.name, c.price, c.type, c.max_qty into v_c
              from public.customizations c
              join public.menu_customizations mc on mc.customization_id = c.id and mc.menu_id = v_menu.id
             where c.id = (v_add ->> 'id')::uuid;
            if not found then
                raise exception 'Invalid customization selected for %', v_menu.name;
            end if;
            v_n := coalesce((v_add ->> 'qty')::integer, 1);
            continue when v_n = 0;
            if v_n < 0 or v_n > v_c.max_qty then
                raise exception 'You can add up to % × % to %', v_c.max_qty, v_c.name, v_menu.name;
            end if;
            if exists (select 1 from jsonb_array_elements(v_cus) t where t ->> 'id' = v_c.id::text) then
                raise exception 'Invalid customization selected for %', v_menu.name;
            end if;
            -- price = the whole line (price × how many), so totals add up the same everywhere.
            v_cus := v_cus || jsonb_build_object('id', v_c.id, 'name', v_c.name, 'price', v_c.price * v_n,
                                                 'type', v_c.type, 'qty', v_n, 'unit_price', v_c.price);
            v_cus_total := v_cus_total + v_c.price * v_n;
        end loop;

        -- Choices (size, flavour, fillings…): must belong to this product; one per "choose one"
        -- question, up to the limit on a "choose several" one.
        v_opt_ids := array(
            select distinct x::uuid
              from jsonb_array_elements_text(coalesce(v_item -> 'option_ids', '[]'::jsonb)) as x
        );
        select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'name', g.name || ': ' || v.name, 'price', v.price, 'type', 'option')
                                  order by g.sort_order, g.name, v.sort_order), '[]'::jsonb),
               coalesce(sum(v.price), 0),
               count(*)
          into v_opt, v_opt_total, v_opt_count
          from public.option_values v
          join public.option_groups g on g.id = v.group_id and g.kind in ('single', 'multi') and g.menu_id = v_menu.id
         where v.id = any (v_opt_ids);
        if v_opt_count <> coalesce(array_length(v_opt_ids, 1), 0) then
            raise exception 'Invalid option selected for %', v_menu.name;
        end if;
        select g.name, case when g.kind = 'single' then 1 else coalesce(g.max_select, 50) end as lim into v_group
          from public.option_values v
          join public.option_groups g on g.id = v.group_id
         where v.id = any (v_opt_ids)
         group by g.id, g.name, g.kind, g.max_select
        having count(*) > case when g.kind = 'single' then 1 else coalesce(g.max_select, 50) end
         limit 1;
        if found then
            raise exception 'Please choose up to % for % (%)', v_group.lim, lower(v_group.name), v_menu.name;
        end if;

        -- "How many" choices: price × how many ("option_qty": [{id, qty}]).
        for v_oq in select value from jsonb_array_elements(coalesce(v_item -> 'option_qty', '[]'::jsonb)) loop
            select v.id, v.name, v.price, v.max_qty, g.id as group_id, g.name as group_name into v_ov
              from public.option_values v
              join public.option_groups g on g.id = v.group_id and g.kind = 'qty' and g.menu_id = v_menu.id
             where v.id = (v_oq ->> 'id')::uuid;
            if not found then
                raise exception 'Invalid option selected for %', v_menu.name;
            end if;
            v_n := coalesce((v_oq ->> 'qty')::integer, 0);
            continue when v_n = 0;
            if v_n < 0 or v_n > v_ov.max_qty then
                raise exception 'You can add up to % × % to %', v_ov.max_qty, v_ov.name, v_menu.name;
            end if;
            if exists (select 1 from jsonb_array_elements(v_opt) t where t ->> 'id' = v_ov.id::text) then
                raise exception 'Invalid option selected for %', v_menu.name;
            end if;
            v_opt := v_opt || jsonb_build_object('id', v_ov.id, 'name', v_ov.group_name || ': ' || v_ov.name,
                                                 'price', v_ov.price * v_n, 'type', 'optqty', 'qty', v_n,
                                                 'unit_price', v_ov.price, 'group_id', v_ov.group_id);
            v_opt_total := v_opt_total + v_ov.price * v_n;
        end loop;

        -- Typed answers: text, numbers (number cakes: priced by how many digits), dates,
        -- photos and yes / no.
        v_texts := '[]'::jsonb;
        v_num_total := 0;
        for v_txt in select value from jsonb_array_elements(coalesce(v_item -> 'texts', '[]'::jsonb)) loop
            select g.id, g.name, g.max_length, g.kind, g.min_days into v_group
              from public.option_groups g
             where g.id = (v_txt ->> 'group_id')::uuid and g.menu_id = v_menu.id
               and g.kind in ('text', 'number', 'date', 'photo', 'yesno');
            if not found then
                raise exception 'Invalid option selected for %', v_menu.name;
            end if;
            v_text := btrim(coalesce(v_txt ->> 'text', ''));
            continue when v_text = '';
            if exists (select 1 from jsonb_array_elements(v_texts) t where t ->> 'id' = v_group.id::text) then
                raise exception 'Invalid option selected for %', v_menu.name;
            end if;

            if v_group.kind = 'number' then
                if v_text !~ '^[0-9]{1,6}$' then
                    raise exception 'Please type the number for % using digits only, e.g. 5 or 25', v_menu.name;
                end if;
                v_text := coalesce(nullif(ltrim(v_text, '0'), ''), '0');
                select v.price into v_tier
                  from public.option_values v
                 where v.group_id = v_group.id
                   and substring(v.name from '^\s*([0-9]+)')::integer = length(v_text)
                 order by v.sort_order
                 limit 1;
                if not found then
                    select max(substring(v.name from '^\s*([0-9]+)')::integer) into v_max_digits
                      from public.option_values v where v.group_id = v_group.id;
                    raise exception '% can be made with numbers up to % digit(s)', v_menu.name, coalesce(v_max_digits, 0);
                end if;
                v_num_total := v_num_total + v_tier.price;
                v_texts := v_texts || jsonb_build_object(
                    'id', v_group.id,
                    'name', 'Number: ' || v_text || ' (' || length(v_text) || case when length(v_text) = 1 then ' number-shaped cake)' else ' number-shaped cakes)' end,
                    'price', v_tier.price, 'type', 'number', 'text', v_text);
            elsif v_group.kind = 'date' then
                if v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
                    raise exception 'Please pick a date for %', v_menu.name;
                end if;
                v_day := v_text::date;
                if v_day < (now() at time zone 'Africa/Lagos')::date + coalesce(v_group.min_days, 0) then
                    raise exception 'Please pick a later date for % (we need % day(s) notice)', v_menu.name, coalesce(v_group.min_days, 0);
                end if;
                v_texts := v_texts || jsonb_build_object('id', v_group.id, 'name', v_group.name || ': ' || to_char(v_day, 'Dy DD Mon YYYY'),
                                                         'price', 0, 'type', 'date', 'text', v_text);
            elsif v_group.kind = 'photo' then
                if left(v_text, length(v_photo_url)) <> v_photo_url or length(v_text) > 400 then
                    raise exception 'Please add the photo for % again', v_menu.name;
                end if;
                v_texts := v_texts || jsonb_build_object('id', v_group.id, 'name', v_group.name || ': photo added',
                                                         'price', 0, 'type', 'photo', 'text', v_text);
            elsif v_group.kind = 'yesno' then
                if v_text not in ('Yes', 'No') then
                    raise exception 'Invalid option selected for %', v_menu.name;
                end if;
                v_texts := v_texts || jsonb_build_object('id', v_group.id, 'name', v_group.name || ': ' || v_text,
                                                         'price', 0, 'type', 'yesno', 'text', v_text);
            else
                if length(v_text) > coalesce(v_group.max_length, 300) then
                    raise exception '% for % is too long (max % characters)', v_group.name, v_menu.name, coalesce(v_group.max_length, 300);
                end if;
                v_texts := v_texts || jsonb_build_object('id', v_group.id, 'name', v_group.name || ': "' || v_text || '"',
                                                         'price', 0, 'type', 'text', 'text', v_text);
            end if;
        end loop;

        -- Every required question must be answered
        select string_agg(g.name, ', ' order by g.sort_order) into v_missing
          from public.option_groups g
         where g.menu_id = v_menu.id and g.required
           and not exists (select 1 from public.option_values v where v.group_id = g.id and v.id = any (v_opt_ids))
           and not exists (select 1 from jsonb_array_elements(v_opt) t where t ->> 'group_id' = g.id::text)
           and not exists (select 1 from jsonb_array_elements(v_texts) t where t ->> 'id' = g.id::text);
        if v_missing is not null then
            raise exception 'Please choose % for %', lower(v_missing), v_menu.name;
        end if;

        v_unit := v_menu.price + v_cus_total + v_opt_total + v_num_total;

        insert into public.order_items (order_id, menu_id, name, image_url, unit_price, quantity, customizations, line_total)
        values (v_order, v_menu.id, v_menu.name, v_menu.image_url, v_unit, v_qty, v_opt || v_texts || v_cus, v_unit * v_qty);

        v_subtotal := v_subtotal + v_unit * v_qty;
    end loop;

    -- Delivery fee: NGN 5,000 if anything is from Groceries & Essentials / The Local Market, else NGN 2,000.
    -- Delivery plan: a cart with same-day AND next-day (groceries / Local Market) items can be
    -- delivered together tomorrow (one fee: the highest) or split (today's items now + the rest
    -- tomorrow: the highest same-day fee + the highest next-day fee).
    select q into v_quote from public.delivery_quote(v_menu_ids) q;
    if coalesce(p_delivery_plan, 'together') = 'split' and (v_quote ->> 'has_both')::boolean then
        v_fee := (v_quote ->> 'split')::numeric;
        update public.orders set delivery_plan = 'split' where id = v_order;
        update public.order_items oi
           set delivery_day = case when pd.next_day then 'tomorrow' else 'today' end
          from public.product_delivery(v_menu_ids) pd
         where oi.order_id = v_order and oi.menu_id = pd.menu_id;
    else
        v_fee := (v_quote ->> 'together')::numeric;
        if (v_quote ->> 'has_both')::boolean then
            update public.orders set delivery_plan = 'together' where id = v_order;
        end if;
    end if;

    update public.orders
       set subtotal      = v_subtotal,
           delivery_fee  = v_fee,
           total         = v_subtotal + v_fee,
           online_amount = case when v_method = 'pay_on_delivery' then v_fee else v_subtotal + v_fee end,
           balance_due   = case when v_method = 'pay_on_delivery' then v_subtotal else 0 end
     where id = v_order;

    return v_order;
end;
$function$;
