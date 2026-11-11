-- =============================================================================
-- Affiliates, round 3 (11 Nov 2026)
-- 1) Referral codes only at sign-up (or via the invite link that pre-fills sign-up).
--    apply_referral_code() (adding a code later from Profile) is switched off.
-- 2) A referral only counts once the new customer has CONFIRMED their email.
-- 3) Commission is reviewed by U Angel Foods before it can be withdrawn:
--      paid → 'pending' (estimate, per-product rates) → delivered → 'earned' but NOT
--      reviewed ("Being reviewed") → admin confirms (can change each item's %) →
--      withdrawable after the 7-day hold.
--    commissions.items keeps the per-item breakdown the affiliate sees in the app.
-- 4) Affiliates can see their referred customers' paid orders (items + amounts only;
--    no address or phone) with the commission breakdown.
-- =============================================================================

-- ---------- 1) No adding a referral code after sign-up ----------
create or replace function public.apply_referral_code(p_code text)
returns text language plpgsql security definer set search_path to '' as $$
begin
    raise exception 'Referral codes can only be added when you sign up. Ask whoever invited you to share their link before you create your account.';
end;
$$;

-- ---------- 2) Referrals count only after the email is confirmed ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    insert into public.profiles (id, name, email)
    values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)), new.email)
    on conflict (id) do nothing;
    -- Already confirmed (e.g. email confirmation switched off): link the referral now.
    -- Otherwise it's linked when they confirm (on_auth_user_confirmed below).
    if new.email_confirmed_at is not null then
        begin
            perform public._attach_referral(new.id, new.raw_user_meta_data ->> 'referral_code');
        exception when others then null;  -- a bad code never stops someone signing up
        end;
    end if;
    return new;
end;
$$;

create or replace function public.on_auth_user_confirmed()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    if old.email_confirmed_at is null and new.email_confirmed_at is not null
       and coalesce(new.raw_user_meta_data ->> 'referral_code', '') <> '' then
        begin
            perform public._attach_referral(new.id, new.raw_user_meta_data ->> 'referral_code');
        exception when others then null;
        end;
    end if;
    return new;
end;
$$;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
    for each row execute function public.on_auth_user_confirmed();

-- Unconfirmed accounts already linked: unlink (they're re-linked if they confirm).
delete from public.referrals r using auth.users u
 where u.id = r.customer_id and u.email_confirmed_at is null;

-- ---------- 3) Commission review ----------
alter table public.commissions add column if not exists items jsonb not null default '[]'::jsonb;
alter table public.commissions add column if not exists reviewed_at timestamptz;
alter table public.commissions add column if not exists admin_note text;

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
            -- Estimate per item at the product's own rate (Admin › Products), else the affiliate's.
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
                insert into public.commissions (affiliate_id, order_id, customer_id, base_amount, rate, amount, items)
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

-- Only reviewed commission becomes withdrawable. Unreviewed earned commission counts as on hold.
create or replace function public.affiliate_balance(p_affiliate uuid)
returns table (pending numeric, on_hold numeric, available numeric, withdrawn numeric, total_earned numeric)
language sql stable security definer set search_path to '' as $$
    with c as (
        select
            coalesce(sum(amount) filter (where status = 'pending'), 0) as pending,
            coalesce(sum(amount) filter (where status = 'earned' and (reviewed_at is null or available_at > now())), 0) as on_hold,
            coalesce(sum(amount) filter (where status = 'earned' and reviewed_at is not null and available_at <= now()), 0) as released,
            coalesce(sum(amount) filter (where status = 'earned' and reviewed_at is not null), 0) as earned
          from public.commissions where affiliate_id = p_affiliate
    ), w as (
        select coalesce(sum(amount) filter (where status in ('requested', 'paid')), 0) as out,
               coalesce(sum(amount) filter (where status = 'paid'), 0) as paid
          from public.withdrawals where affiliate_id = p_affiliate
    )
    select c.pending, c.on_hold, greatest(c.released - w.out, 0), w.paid, c.earned from c, w;
$$;
revoke all on function public.affiliate_balance(uuid) from public, anon, authenticated;

-- Admin: confirm a commission, optionally with new rates per item (fractions, same order as items).
create or replace function public.admin_review_commission(p_id uuid, p_rates jsonb default null, p_note text default null)
returns public.commissions language plpgsql security definer set search_path to '' as $$
declare v public.commissions; v_items jsonb := '[]'::jsonb; it jsonb; i int := 0; v_rate numeric; v_total numeric := 0;
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    select * into v from public.commissions where id = p_id for update;
    if not found then raise exception 'Commission not found'; end if;
    if v.status = 'cancelled' then raise exception 'This order was cancelled; there is no commission to confirm'; end if;
    for it in select value from jsonb_array_elements(v.items) loop
        v_rate := coalesce((p_rates ->> i)::numeric, (it ->> 'rate')::numeric, 0);
        if v_rate < 0 or v_rate > 0.5 then raise exception 'Rates must be between 0%% and 50%%'; end if;
        v_items := v_items || jsonb_set(jsonb_set(it, '{rate}', to_jsonb(v_rate)), '{amount}', to_jsonb(round((it ->> 'line_total')::numeric * v_rate, 2)));
        v_total := v_total + round((it ->> 'line_total')::numeric * v_rate, 2);
        i := i + 1;
    end loop;
    update public.commissions
       set items = v_items, amount = v_total,
           rate = case when base_amount > 0 then round(v_total / base_amount, 4) else 0 end,
           reviewed_at = now(), admin_note = nullif(btrim(coalesce(p_note, '')), '')
     where id = p_id returning * into v;
    return v;
end;
$$;
grant execute on function public.admin_review_commission(uuid, jsonb, text) to authenticated;

-- ---------- 4) Affiliate: referred people (with id) and their orders ----------
drop function if exists public.affiliate_referrals();
create or replace function public.affiliate_referrals()
returns table (customer_id uuid, customer text, joined_at timestamptz, expires_at timestamptz, orders bigint, earned numeric)
language sql stable security definer set search_path to '' as $$
    select r.customer_id,
        coalesce(nullif(split_part(p.name, ' ', 1), ''), 'Customer')
          || coalesce(' ' || nullif(left(split_part(p.name, ' ', 2), 1), '') || '.', ''),
        r.created_at, r.expires_at,
        (select count(*) from public.orders o where o.user_id = r.customer_id and o.payment_status = 'paid' and o.created_at >= r.created_at),
        (select coalesce(sum(c.amount), 0) from public.commissions c where c.affiliate_id = r.affiliate_id and c.customer_id = r.customer_id and c.status <> 'cancelled')
      from public.referrals r left join public.profiles p on p.id = r.customer_id
     where r.affiliate_id = auth.uid()
     order by r.created_at desc;
$$;
grant execute on function public.affiliate_referrals() to authenticated;

-- Paid orders of one of MY referred customers: what they bought and what I earn on it.
create or replace function public.affiliate_customer_orders(p_customer uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_since timestamptz;
begin
    select r.created_at into v_since from public.referrals r where r.customer_id = p_customer and r.affiliate_id = auth.uid();
    if not found then raise exception 'This person isn’t one of your referrals'; end if;
    return coalesce((
        select jsonb_agg(jsonb_build_object(
                   'order_id', o.id, 'ref', upper(left(o.id::text, 8)),
                   'created_at', o.created_at, 'paid_at', o.paid_at, 'status', o.status,
                   'items_total', o.subtotal,
                   'items', (select coalesce(jsonb_agg(jsonb_build_object('name', oi.name, 'quantity', oi.quantity, 'line_total', oi.line_total) order by oi.name), '[]'::jsonb)
                               from public.order_items oi where oi.order_id = o.id),
                   'commission', (select jsonb_build_object('status', c.status, 'amount', c.amount, 'base_amount', c.base_amount,
                                                            'items', c.items, 'reviewed_at', c.reviewed_at,
                                                            'available_at', c.available_at, 'note', c.admin_note)
                                    from public.commissions c where c.order_id = o.id and c.affiliate_id = auth.uid())
               ) order by o.created_at desc)
          from public.orders o
         where o.user_id = p_customer and o.payment_status = 'paid' and o.created_at >= v_since
    ), '[]'::jsonb);
end;
$$;
grant execute on function public.affiliate_customer_orders(uuid) to authenticated;
