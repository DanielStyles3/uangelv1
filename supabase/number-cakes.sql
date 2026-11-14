-- Number Birthday Cake (2026-11-14)
-- A new kind of product question: 'number'. The customer types a number (e.g. 5 or 25) and the
-- price depends on how many digits it has (one number-shaped cake per digit). The admin sets the
-- price for each digit count as the question's choices, named "1 digit", "2 digits", ...
-- (the leading number in the name is the digit count).
-- Run in the Supabase SQL editor; safe to run more than once.

alter table public.option_groups drop constraint if exists option_groups_kind_check;
alter table public.option_groups add constraint option_groups_kind_check check (kind in ('single', 'text', 'number'));

-- Longer questions, e.g. "What number would you like on your cake?"
alter table public.option_groups drop constraint if exists option_groups_name_check;
alter table public.option_groups add constraint option_groups_name_check check (length(btrim(name)) between 1 and 60);

create or replace function public.place_order(p_items jsonb, p_address text, p_city text, p_state text, p_phone text,
                                              p_payment_method text default 'paystack', p_note text default null,
                                              p_delivery_plan text default 'together')
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
    v_user      uuid := auth.uid();
    v_order     uuid;
    v_item      jsonb;
    v_menu      record;
    v_qty       integer;
    v_cus_ids   uuid[];
    v_cus       jsonb;
    v_cus_total numeric;
    v_cus_count integer;
    v_opt_ids   uuid[];
    v_opt       jsonb;
    v_opt_total numeric;
    v_opt_count integer;
    v_opt_groups integer;
    v_txt       jsonb;
    v_texts     jsonb;
    v_group     record;
    v_tier      record;
    v_num_total numeric;
    v_max_digits integer;
    v_text      text;
    v_missing   text;
    v_unit      numeric;
    v_subtotal  numeric := 0;
    v_fee       numeric;
    v_quote     jsonb;
    v_menu_ids  uuid[] := '{}';
    v_giving    boolean;
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

        -- Add-ons / extras
        v_cus_ids := array(
            select distinct x::uuid
              from jsonb_array_elements_text(coalesce(v_item -> 'customization_ids', '[]'::jsonb)) as x
        );
        select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'price', c.price, 'type', c.type)
                                  order by c.name), '[]'::jsonb),
               coalesce(sum(c.price), 0),
               count(*)
          into v_cus, v_cus_total, v_cus_count
          from public.customizations c
          join public.menu_customizations mc
            on mc.customization_id = c.id and mc.menu_id = v_menu.id
         where c.id = any (v_cus_ids);
        if v_cus_count <> coalesce(array_length(v_cus_ids, 1), 0) then
            raise exception 'Invalid customization selected for %', v_menu.name;
        end if;

        -- Choice options (size, flavour...): must belong to this product, one per group
        v_opt_ids := array(
            select distinct x::uuid
              from jsonb_array_elements_text(coalesce(v_item -> 'option_ids', '[]'::jsonb)) as x
        );
        select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'name', g.name || ': ' || v.name, 'price', v.price, 'type', 'option')
                                  order by g.sort_order, g.name), '[]'::jsonb),
               coalesce(sum(v.price), 0),
               count(*),
               count(distinct g.id)
          into v_opt, v_opt_total, v_opt_count, v_opt_groups
          from public.option_values v
          join public.option_groups g on g.id = v.group_id and g.kind = 'single' and g.menu_id = v_menu.id
         where v.id = any (v_opt_ids);
        if v_opt_count <> coalesce(array_length(v_opt_ids, 1), 0) or v_opt_groups <> v_opt_count then
            raise exception 'Invalid option selected for %', v_menu.name;
        end if;

        -- Typed answers: text (message on the cake, notes for the baker) and numbers
        -- (number cakes: priced by how many digits the number has).
        v_texts := '[]'::jsonb;
        v_num_total := 0;
        for v_txt in select value from jsonb_array_elements(coalesce(v_item -> 'texts', '[]'::jsonb)) loop
            select g.id, g.name, g.max_length, g.kind into v_group
              from public.option_groups g
             where g.id = (v_txt ->> 'group_id')::uuid and g.menu_id = v_menu.id and g.kind in ('text', 'number');
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
            else
                if length(v_text) > coalesce(v_group.max_length, 300) then
                    raise exception '% for % is too long (max % characters)', v_group.name, v_menu.name, coalesce(v_group.max_length, 300);
                end if;
                v_texts := v_texts || jsonb_build_object('id', v_group.id, 'name', v_group.name || ': "' || v_text || '"',
                                                         'price', 0, 'type', 'text', 'text', v_text);
            end if;
        end loop;

        -- Every required group must be answered
        select string_agg(g.name, ', ' order by g.sort_order) into v_missing
          from public.option_groups g
         where g.menu_id = v_menu.id and g.required
           and not exists (select 1 from public.option_values v where v.group_id = g.id and v.id = any (v_opt_ids))
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
