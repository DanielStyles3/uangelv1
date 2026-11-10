-- Christmas 2026 giving: the Christmas Food Pack (menu.is_campaign), no address/delivery for
-- pack-only orders, online payment only, and campaign_progress() counting packs until 25 Dec.
-- Applied to production on 9 Nov 2026.

-- ===== Christmas giving pack =====
alter table public.menu add column if not exists is_campaign boolean not null default false;
comment on column public.menu.is_campaign is 'Christmas giving pack: hidden from normal lists, no delivery, counts toward the pre-order goal.';

insert into public.menu (name, description, price, delivery_fee, category_id, is_available, is_campaign, rating, image_url)
select 'Christmas Food Pack: Feed Someone in Need',
       'Your pre-order feeds the less privileged this Christmas: cooked food for the homeless and handicapped, and uncooked food for orphans and widows. Nothing is delivered to you; U Angel Foods gives it out on your behalf.',
       5000, 0, null, true, true, 0, 'https://uangelfoods.com/assets/campaign/xmas-10000-preorders-25dec.jpg'
where not exists (select 1 from public.menu where is_campaign);

CREATE OR REPLACE FUNCTION public.place_order(p_items jsonb, p_address text, p_city text, p_state text, p_phone text, p_payment_method text DEFAULT 'paystack'::text, p_note text DEFAULT NULL::text)
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

        -- Choice options (size, flavour, â¦): must belong to this product, one per group
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

    -- â¦5,000 if anything is from Groceries & Essentials / The Local Market, else â¦2,000.
    v_fee := public.delivery_fee_for(v_menu_ids);

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

-- Pre-orders = Christmas packs bought (paid), 1 Nov – 25 Dec 2026.
create or replace function public.campaign_progress()
returns integer language sql stable security definer set search_path to '' as $$
    select coalesce(sum(oi.quantity), 0)::integer
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      join public.menu m on m.id = oi.menu_id
     where m.is_campaign
       and o.payment_status = 'paid'
       and coalesce(o.paid_at, o.created_at) >= timestamptz '2026-11-01 00:00:00+01'
       and coalesce(o.paid_at, o.created_at) <  timestamptz '2026-12-26 00:00:00+01';
$$;

select id, name, price, delivery_fee, is_campaign, public.delivery_fee_for(array[id]) fee, public.campaign_progress() progress
  from public.menu where is_campaign;
