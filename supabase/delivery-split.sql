-- =============================================================================
-- Mixed carts: same-day items + next-day items (Groceries & Essentials, The Local Market,
-- or any product/category whose delivery time says "next day").
-- At checkout the customer chooses:
--   together: everything tomorrow, one fee (the highest of all items)
--   split:    same-day items today + next-day items tomorrow, two fees added together
-- orders.delivery_plan records the choice; order_items.delivery_day says which run each item is on.
-- =============================================================================

alter table public.orders add column if not exists delivery_plan text check (delivery_plan is null or delivery_plan in ('together', 'split'));
alter table public.order_items add column if not exists delivery_day text check (delivery_day is null or delivery_day in ('today', 'tomorrow'));

-- Each product's delivery fee (its own, else its category's standard) and whether it's next-day.
create or replace function public.product_delivery(p_menu_ids uuid[])
returns table (menu_id uuid, fee numeric, next_day boolean)
language sql stable set search_path to '' as $$
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
                         then 5000::numeric else 2000::numeric end),
           coalesce(nullif(i.delivery_note, ''),
                    (select up.delivery_note from up where up.item_id = i.id and up.parent_id is null limit 1), '') ilike '%next%'
      from items i;
$$;
grant execute on function public.product_delivery(uuid[]) to anon, authenticated;

-- One fee per order: the highest (same answer as before for every cart).
create or replace function public.delivery_fee_for(p_menu_ids uuid[])
returns numeric language sql stable set search_path to '' as $$
    select coalesce(max(fee), 2000::numeric) from public.product_delivery(p_menu_ids);
$$;

-- What checkout shows: { together, today, tomorrow, split, has_both }.
create or replace function public.delivery_quote(p_menu_ids uuid[])
returns jsonb language sql stable set search_path to '' as $$
    with pd as (select * from public.product_delivery(p_menu_ids))
    select jsonb_build_object(
        'together', coalesce((select max(fee) from pd), 2000),
        'today',    coalesce((select max(fee) from pd where not next_day), 0),
        'tomorrow', coalesce((select max(fee) from pd where next_day), 0),
        'split',    coalesce((select max(fee) from pd where not next_day), 0) + coalesce((select max(fee) from pd where next_day), 0),
        'has_both', exists (select 1 from pd where next_day) and exists (select 1 from pd where not next_day)
    );
$$;
grant execute on function public.delivery_quote(uuid[]) to anon, authenticated;

drop function if exists public.place_order(jsonb, text, text, text, text, text, text);
CREATE OR REPLACE FUNCTION public.place_order(p_items jsonb, p_address text, p_city text, p_state text, p_phone text, p_payment_method text DEFAULT 'paystack'::text, p_note text DEFAULT NULL::text, p_delivery_plan text DEFAULT 'together'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

        -- Choice options (size, flavour, Ã¢ÂÂ¦): must belong to this product, one per group
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

        -- Text options (message on the cake, notes for the baker)
        v_texts := '[]'::jsonb;
        for v_txt in select value from jsonb_array_elements(coalesce(v_item -> 'texts', '[]'::jsonb)) loop
            select g.id, g.name, g.max_length into v_group
              from public.option_groups g
             where g.id = (v_txt ->> 'group_id')::uuid and g.menu_id = v_menu.id and g.kind = 'text';
            if not found then
                raise exception 'Invalid option selected for %', v_menu.name;
            end if;
            v_text := btrim(coalesce(v_txt ->> 'text', ''));
            continue when v_text = '';
            if length(v_text) > coalesce(v_group.max_length, 300) then
                raise exception '% for % is too long (max % characters)', v_group.name, v_menu.name, coalesce(v_group.max_length, 300);
            end if;
            if exists (select 1 from jsonb_array_elements(v_texts) t where t ->> 'id' = v_group.id::text) then
                raise exception 'Invalid option selected for %', v_menu.name;
            end if;
            v_texts := v_texts || jsonb_build_object('id', v_group.id, 'name', v_group.name || ': "' || v_text || '"',
                                                     'price', 0, 'type', 'text', 'text', v_text);
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

        v_unit := v_menu.price + v_cus_total + v_opt_total;

        insert into public.order_items (order_id, menu_id, name, image_url, unit_price, quantity, customizations, line_total)
        values (v_order, v_menu.id, v_menu.name, v_menu.image_url, v_unit, v_qty, v_opt || v_texts || v_cus, v_unit * v_qty);

        v_subtotal := v_subtotal + v_unit * v_qty;
    end loop;

    -- Ã¢ÂÂ¦5,000 if anything is from Groceries & Essentials / The Local Market, else Ã¢ÂÂ¦2,000.
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

grant execute on function public.place_order(jsonb, text, text, text, text, text, text, text) to authenticated;
