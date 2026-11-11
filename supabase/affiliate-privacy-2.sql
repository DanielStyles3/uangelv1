-- =============================================================================
-- Affiliate privacy, part 2: keep older Affiliates app versions working.
-- They select commissions.items, so instead of blocking that column we move the
-- per-product breakdown into a new admin-only column (breakdown) and leave items always
-- empty. Affiliates can read every column except breakdown.
-- =============================================================================

alter table public.commissions add column if not exists breakdown jsonb not null default '[]'::jsonb;
update public.commissions set breakdown = items where breakdown = '[]'::jsonb and items <> '[]'::jsonb;
update public.commissions set items = '[]'::jsonb where items <> '[]'::jsonb;

revoke select on public.commissions from authenticated;
grant select (id, affiliate_id, order_id, customer_id, base_amount, rate, amount, status, available_at,
              created_at, items, reviewed_at, admin_note) on public.commissions to authenticated;

-- Commission engine: the breakdown goes to the admin-only column.
create or replace function public.affiliate_on_order()
returns trigger language plpgsql security definer set search_path to '' as $$
declare r record; v_items jsonb; v_base numeric; v_amount numeric;
begin
    if new.payment_status = 'paid' and new.user_id is not null
       and (tg_op = 'INSERT' or old.payment_status is distinct from 'paid') then
        select rf.affiliate_id, a.rate, a.status into r
          from public.referrals rf join public.affiliates a on a.user_id = rf.affiliate_id
         where rf.customer_id = new.user_id and coalesce(new.paid_at, now()) < rf.expires_at;
        if found and r.status = 'active' then
            select coalesce(jsonb_agg(jsonb_build_object(
                       'name', oi.name, 'quantity', oi.quantity, 'line_total', oi.line_total,
                       'rate', coalesce(m.affiliate_rate, r.rate),
                       'amount', round(oi.line_total * coalesce(m.affiliate_rate, r.rate), 2)) order by oi.name), '[]'::jsonb),
                   coalesce(sum(oi.line_total), 0),
                   coalesce(sum(round(oi.line_total * coalesce(m.affiliate_rate, r.rate), 2)), 0)
              into v_items, v_base, v_amount
              from public.order_items oi left join public.menu m on m.id = oi.menu_id
             where oi.order_id = new.id and coalesce(m.is_campaign, false) = false;
            if v_base > 0 then
                insert into public.commissions (affiliate_id, order_id, customer_id, base_amount, rate, amount, breakdown)
                values (r.affiliate_id, new.id, new.user_id, v_base, round(v_amount / v_base, 4), v_amount, v_items)
                on conflict (order_id) do nothing;
            end if;
        end if;
    end if;
    if new.status = 'delivered' and (tg_op = 'INSERT' or old.status is distinct from 'delivered') then
        update public.commissions set status = 'earned', available_at = now() + interval '7 days'
         where order_id = new.id and status = 'pending';
    end if;
    if new.status = 'cancelled' or new.payment_status = 'refunded' then
        update public.commissions set status = 'cancelled' where order_id = new.id and status <> 'cancelled';
    end if;
    return new;
end;
$$;

create or replace function public.admin_review_commission(p_id uuid, p_rates jsonb default null, p_note text default null)
returns public.commissions language plpgsql security definer set search_path to '' as $$
declare v public.commissions; v_items jsonb := '[]'::jsonb; it jsonb; i int := 0; v_rate numeric; v_total numeric := 0;
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    select * into v from public.commissions where id = p_id for update;
    if not found then raise exception 'Commission not found'; end if;
    if v.status = 'cancelled' then raise exception 'This order was cancelled; there is no commission to confirm'; end if;
    for it in select value from jsonb_array_elements(v.breakdown) loop
        v_rate := coalesce((p_rates ->> i)::numeric, (it ->> 'rate')::numeric, 0);
        if v_rate < 0 or v_rate > 0.5 then raise exception 'Rates must be between 0%% and 50%%'; end if;
        v_items := v_items || jsonb_set(jsonb_set(it, '{rate}', to_jsonb(v_rate)), '{amount}', to_jsonb(round((it ->> 'line_total')::numeric * v_rate, 2)));
        v_total := v_total + round((it ->> 'line_total')::numeric * v_rate, 2);
        i := i + 1;
    end loop;
    update public.commissions
       set breakdown = v_items, items = '[]'::jsonb,
           amount = case when jsonb_array_length(v_items) > 0 then v_total else amount end,
           rate = case when base_amount > 0 and jsonb_array_length(v_items) > 0 then round(v_total / base_amount, 4) else rate end,
           reviewed_at = now(), admin_note = nullif(btrim(coalesce(p_note, '')), '')
     where id = p_id returning * into v;
    return v;
end;
$$;

-- Admin list: rows as JSON with the breakdown in "items" (what the admin page reads).
drop function if exists public.admin_commissions(uuid, boolean);
create or replace function public.admin_commissions(p_affiliate uuid default null, p_unreviewed boolean default false)
returns setof jsonb language plpgsql stable security definer set search_path to '' as $$
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    return query
    select (to_jsonb(c) - 'breakdown') || jsonb_build_object('items', c.breakdown)
      from public.commissions c
     where (p_affiliate is null or c.affiliate_id = p_affiliate)
       and (not p_unreviewed or (c.reviewed_at is null and c.status <> 'cancelled'))
     order by case when p_unreviewed then c.created_at end asc, c.created_at desc
     limit 500;
end;
$$;
grant execute on function public.admin_commissions(uuid, boolean) to authenticated;
