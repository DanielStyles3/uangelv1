-- =============================================================================
-- U Angel Affiliates
-- An affiliate shares a code/link. A NEW customer who signs up with it is linked to
-- the affiliate for 12 months. The affiliate earns 5% of the items total (not delivery,
-- not Christmas giving packs) of every order that customer pays for:
--   paid → commission 'pending'; delivered → 'earned' (withdrawable 7 days later);
--   cancelled / refunded → 'cancelled'.
-- Withdrawals: minimum ₦2,000, one open request at a time, the admin pays and marks it paid.
-- Same accounts as the shopping app (auth.users / public.profiles).
-- =============================================================================

create table if not exists public.affiliates (
    user_id        uuid primary key references auth.users (id) on delete cascade,
    code           text not null unique check (code ~ '^[A-Z0-9]{4,12}$'),
    status         text not null default 'active' check (status in ('active', 'blocked')),
    rate           numeric not null default 0.05 check (rate >= 0 and rate <= 0.5),
    bank_name      text,
    account_number text check (account_number is null or account_number ~ '^[0-9]{10}$'),
    account_name   text,
    created_at     timestamptz not null default now()
);

create table if not exists public.referrals (
    customer_id  uuid primary key references auth.users (id) on delete cascade,
    affiliate_id uuid not null references public.affiliates (user_id) on delete cascade,
    code         text not null,
    created_at   timestamptz not null default now(),
    expires_at   timestamptz not null default (now() + interval '12 months'),
    check (customer_id <> affiliate_id)
);
create index if not exists referrals_affiliate_idx on public.referrals (affiliate_id);

create table if not exists public.commissions (
    id           uuid primary key default gen_random_uuid(),
    affiliate_id uuid not null references public.affiliates (user_id) on delete cascade,
    order_id     uuid not null unique references public.orders (id) on delete cascade,
    customer_id  uuid,
    base_amount  numeric not null check (base_amount >= 0),
    rate         numeric not null,
    amount       numeric not null check (amount >= 0),
    status       text not null default 'pending' check (status in ('pending', 'earned', 'cancelled')),
    available_at timestamptz,
    created_at   timestamptz not null default now()
);
create index if not exists commissions_affiliate_idx on public.commissions (affiliate_id, created_at desc);

create table if not exists public.withdrawals (
    id             uuid primary key default gen_random_uuid(),
    affiliate_id   uuid not null references public.affiliates (user_id) on delete cascade,
    amount         numeric not null check (amount > 0),
    status         text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
    bank_name      text,
    account_number text,
    account_name   text,
    admin_note     text,
    created_at     timestamptz not null default now(),
    processed_at   timestamptz
);
create index if not exists withdrawals_affiliate_idx on public.withdrawals (affiliate_id, created_at desc);

-- ---------- Row level security: read your own; admins read everything; writes go through functions ----------
alter table public.affiliates  enable row level security;
alter table public.referrals   enable row level security;
alter table public.commissions enable row level security;
alter table public.withdrawals enable row level security;

drop policy if exists "Affiliates read own"   on public.affiliates;
create policy "Affiliates read own"   on public.affiliates  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "Admins manage affiliates" on public.affiliates;
create policy "Admins manage affiliates" on public.affiliates for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Referrals read own"    on public.referrals;
create policy "Referrals read own"    on public.referrals   for select to authenticated using (customer_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "Commissions read own"  on public.commissions;
create policy "Commissions read own"  on public.commissions for select to authenticated using (affiliate_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "Withdrawals read own"  on public.withdrawals;
create policy "Withdrawals read own"  on public.withdrawals for select to authenticated using (affiliate_id = (select auth.uid()) or (select public.is_admin()));

grant select on public.affiliates, public.referrals, public.commissions, public.withdrawals to authenticated;
grant update on public.affiliates to authenticated;

-- ---------- Balance helper ----------
create or replace function public.affiliate_balance(p_affiliate uuid)
returns table (pending numeric, on_hold numeric, available numeric, withdrawn numeric, total_earned numeric)
language sql stable security definer set search_path to '' as $$
    with c as (
        select
            coalesce(sum(amount) filter (where status = 'pending'), 0) as pending,
            coalesce(sum(amount) filter (where status = 'earned' and available_at > now()), 0) as on_hold,
            coalesce(sum(amount) filter (where status = 'earned' and available_at <= now()), 0) as released,
            coalesce(sum(amount) filter (where status = 'earned'), 0) as earned
          from public.commissions where affiliate_id = p_affiliate
    ), w as (
        select coalesce(sum(amount) filter (where status in ('requested', 'paid')), 0) as out,
               coalesce(sum(amount) filter (where status = 'paid'), 0) as paid
          from public.withdrawals where affiliate_id = p_affiliate
    )
    select c.pending, c.on_hold, greatest(c.released - w.out, 0), w.paid, c.earned from c, w;
$$;
revoke all on function public.affiliate_balance(uuid) from public, anon, authenticated;

-- ---------- Attach a referral (used at sign-up and from the app) ----------
create or replace function public._attach_referral(p_customer uuid, p_code text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
    v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
    v_aff  public.affiliates;
begin
    if v_code = '' then return null; end if;
    select * into v_aff from public.affiliates where code = v_code;
    if not found or v_aff.status <> 'active' then raise exception 'That referral code doesn’t exist'; end if;
    if v_aff.user_id = p_customer then raise exception 'You can’t use your own referral code'; end if;
    if exists (select 1 from public.referrals where customer_id = p_customer) then raise exception 'A referral code is already linked to your account'; end if;
    if exists (select 1 from public.orders where user_id = p_customer and payment_status = 'paid') then
        raise exception 'Referral codes are for new customers, before their first order';
    end if;
    insert into public.referrals (customer_id, affiliate_id, code) values (p_customer, v_aff.user_id, v_code);
    return v_aff.user_id;
end;
$$;
revoke all on function public._attach_referral(uuid, text) from public, anon, authenticated;

-- Shopping app: "Have a referral code?" (new customers only: no paid order, account under 30 days old).
create or replace function public.apply_referral_code(p_code text)
returns text language plpgsql security definer set search_path to '' as $$
declare v_aff uuid; v_name text;
begin
    if auth.uid() is null then raise exception 'Please sign in first'; end if;
    if (select created_at from auth.users where id = auth.uid()) < now() - interval '30 days' then
        raise exception 'Referral codes can only be added within 30 days of joining';
    end if;
    v_aff := public._attach_referral(auth.uid(), p_code);
    select split_part(coalesce(name, ''), ' ', 1) into v_name from public.profiles where id = v_aff;
    return coalesce(nullif(v_name, ''), 'your friend');
end;
$$;
grant execute on function public.apply_referral_code(text) to authenticated;

-- Website referral page: is this code real? (first name only)
create or replace function public.referral_code_info(p_code text)
returns table (valid boolean, first_name text)
language sql stable security definer set search_path to '' as $$
    select true, nullif(split_part(coalesce(p.name, ''), ' ', 1), '')
      from public.affiliates a left join public.profiles p on p.id = a.user_id
     where a.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) and a.status = 'active'
    union all
    select false, null::text
     where not exists (select 1 from public.affiliates a where a.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) and a.status = 'active')
    limit 1;
$$;
grant execute on function public.referral_code_info(text) to anon, authenticated;

-- Sign-up: a referral code passed in the sign-up metadata is attached straight away (never blocks sign-up).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    insert into public.profiles (id, name, email)
    values (
        new.id,
        coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
        new.email
    )
    on conflict (id) do nothing;
    begin
        perform public._attach_referral(new.id, new.raw_user_meta_data ->> 'referral_code');
    exception when others then null;  -- a bad code never stops someone signing up
    end;
    return new;
end;
$$;

-- ---------- Becoming an affiliate (anyone, instantly) ----------
create or replace function public.become_affiliate()
returns public.affiliates language plpgsql security definer set search_path to '' as $$
declare
    v_user uuid := auth.uid();
    v_row  public.affiliates;
    v_base text;
    v_code text;
    i      int := 0;
begin
    if v_user is null then raise exception 'Please sign in first'; end if;
    select * into v_row from public.affiliates where user_id = v_user;
    if found then return v_row; end if;
    select left(upper(regexp_replace(split_part(coalesce(name, ''), ' ', 1), '[^A-Za-z]', '', 'g')), 6) into v_base
      from public.profiles where id = v_user;
    if coalesce(length(v_base), 0) < 2 then v_base := 'UANGEL'; end if;
    loop
        v_code := v_base || (10 + floor(random() * 90))::int;
        exit when not exists (select 1 from public.affiliates where code = v_code);
        i := i + 1;
        if i > 20 then v_code := v_base || (100 + floor(random() * 900))::int; exit when not exists (select 1 from public.affiliates where code = v_code); end if;
        if i > 60 then raise exception 'Couldn’t create a code, please try again'; end if;
    end loop;
    insert into public.affiliates (user_id, code) values (v_user, v_code) returning * into v_row;
    return v_row;
end;
$$;
grant execute on function public.become_affiliate() to authenticated;

-- ---------- Affiliate app data ----------
create or replace function public.affiliate_summary()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_aff public.affiliates; b record;
begin
    select * into v_aff from public.affiliates where user_id = auth.uid();
    if not found then return null; end if;
    select * into b from public.affiliate_balance(v_aff.user_id);
    return jsonb_build_object(
        'code', v_aff.code, 'status', v_aff.status, 'rate', v_aff.rate,
        'bank_name', v_aff.bank_name, 'account_number', v_aff.account_number, 'account_name', v_aff.account_name,
        'pending', b.pending, 'on_hold', b.on_hold, 'available', b.available, 'withdrawn', b.withdrawn, 'total_earned', b.total_earned,
        'referrals', (select count(*) from public.referrals where affiliate_id = v_aff.user_id),
        'active_referrals', (select count(*) from public.referrals where affiliate_id = v_aff.user_id and expires_at > now()),
        'open_withdrawal', (select to_jsonb(w) from public.withdrawals w where w.affiliate_id = v_aff.user_id and w.status = 'requested' order by created_at desc limit 1),
        'min_withdrawal', 2000
    );
end;
$$;
grant execute on function public.affiliate_summary() to authenticated;

-- Referred customers: first name + initial only (privacy).
create or replace function public.affiliate_referrals()
returns table (customer text, joined_at timestamptz, expires_at timestamptz, orders bigint, earned numeric)
language sql stable security definer set search_path to '' as $$
    select
        coalesce(nullif(split_part(p.name, ' ', 1), ''), 'Customer')
          || coalesce(' ' || nullif(left(split_part(p.name, ' ', 2), 1), '') || '.', ''),
        r.created_at, r.expires_at,
        (select count(*) from public.commissions c where c.affiliate_id = r.affiliate_id and c.customer_id = r.customer_id and c.status <> 'cancelled'),
        (select coalesce(sum(c.amount), 0) from public.commissions c where c.affiliate_id = r.affiliate_id and c.customer_id = r.customer_id and c.status <> 'cancelled')
      from public.referrals r left join public.profiles p on p.id = r.customer_id
     where r.affiliate_id = auth.uid()
     order by r.created_at desc;
$$;
grant execute on function public.affiliate_referrals() to authenticated;

create or replace function public.set_affiliate_bank(p_bank_name text, p_account_number text, p_account_name text)
returns void language plpgsql security definer set search_path to '' as $$
begin
    if not exists (select 1 from public.affiliates where user_id = auth.uid()) then raise exception 'Join the affiliate programme first'; end if;
    if coalesce(btrim(p_bank_name), '') = '' or coalesce(btrim(p_account_name), '') = '' then raise exception 'Enter your bank and account name'; end if;
    if coalesce(p_account_number, '') !~ '^[0-9]{10}$' then raise exception 'Account number must be 10 digits'; end if;
    update public.affiliates set bank_name = btrim(p_bank_name), account_number = p_account_number, account_name = btrim(p_account_name)
     where user_id = auth.uid();
end;
$$;
grant execute on function public.set_affiliate_bank(text, text, text) to authenticated;

create or replace function public.request_withdrawal(p_amount numeric)
returns uuid language plpgsql security definer set search_path to '' as $$
declare v_aff public.affiliates; v_avail numeric; v_id uuid;
begin
    select * into v_aff from public.affiliates where user_id = auth.uid() for update;
    if not found then raise exception 'Join the affiliate programme first'; end if;
    if v_aff.status <> 'active' then raise exception 'Your affiliate account is on hold. Please contact us.'; end if;
    if v_aff.account_number is null then raise exception 'Add your bank account first'; end if;
    if exists (select 1 from public.withdrawals where affiliate_id = v_aff.user_id and status = 'requested') then
        raise exception 'You already have a withdrawal waiting to be paid';
    end if;
    select available into v_avail from public.affiliate_balance(v_aff.user_id);
    if p_amount is null or p_amount < 2000 then raise exception 'The minimum withdrawal is ₦2,000'; end if;
    if p_amount > v_avail then raise exception 'You can withdraw up to ₦%', to_char(v_avail, 'FM999,999,990'); end if;
    insert into public.withdrawals (affiliate_id, amount, bank_name, account_number, account_name)
    values (v_aff.user_id, round(p_amount, 2), v_aff.bank_name, v_aff.account_number, v_aff.account_name)
    returning id into v_id;
    return v_id;
end;
$$;
grant execute on function public.request_withdrawal(numeric) to authenticated;

-- ---------- Admin ----------
create or replace function public.admin_affiliates()
returns table (user_id uuid, name text, email text, phone text, code text, status text, rate numeric, created_at timestamptz,
               referrals bigint, pending numeric, on_hold numeric, available numeric, withdrawn numeric, total_earned numeric,
               bank_name text, account_number text, account_name text)
language plpgsql stable security definer set search_path to '' as $$
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    return query
    select a.user_id, p.name, p.email, p.phone, a.code, a.status, a.rate, a.created_at,
           (select count(*) from public.referrals r where r.affiliate_id = a.user_id),
           b.pending, b.on_hold, b.available, b.withdrawn, b.total_earned,
           a.bank_name, a.account_number, a.account_name
      from public.affiliates a
      left join public.profiles p on p.id = a.user_id
      cross join lateral public.affiliate_balance(a.user_id) b
     order by b.total_earned desc, a.created_at desc;
end;
$$;
grant execute on function public.admin_affiliates() to authenticated;

create or replace function public.admin_set_withdrawal(p_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path to '' as $$
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    if p_status not in ('paid', 'rejected') then raise exception 'Invalid status'; end if;
    update public.withdrawals set status = p_status, admin_note = nullif(btrim(coalesce(p_note, '')), ''), processed_at = now()
     where id = p_id and status = 'requested';
    if not found then raise exception 'This withdrawal was already handled'; end if;
end;
$$;
grant execute on function public.admin_set_withdrawal(uuid, text, text) to authenticated;

-- ---------- Commission engine (runs on every order change) ----------
create or replace function public.affiliate_on_order()
returns trigger language plpgsql security definer set search_path to '' as $$
declare r record; v_base numeric;
begin
    -- Paid: create the pending commission (once per order).
    if new.payment_status = 'paid' and new.user_id is not null
       and (tg_op = 'INSERT' or old.payment_status is distinct from 'paid') then
        select rf.affiliate_id, a.rate, a.status into r
          from public.referrals rf join public.affiliates a on a.user_id = rf.affiliate_id
         where rf.customer_id = new.user_id and coalesce(new.paid_at, now()) < rf.expires_at;
        if found and r.status = 'active' then
            select coalesce(sum(oi.line_total), 0) into v_base
              from public.order_items oi left join public.menu m on m.id = oi.menu_id
             where oi.order_id = new.id and coalesce(m.is_campaign, false) = false;
            if v_base > 0 then
                insert into public.commissions (affiliate_id, order_id, customer_id, base_amount, rate, amount)
                values (r.affiliate_id, new.id, new.user_id, v_base, r.rate, round(v_base * r.rate, 2))
                on conflict (order_id) do nothing;
            end if;
        end if;
    end if;
    -- Delivered: earned, withdrawable after a 7-day hold (time for problems/refunds).
    if new.status = 'delivered' and (tg_op = 'INSERT' or old.status is distinct from 'delivered') then
        update public.commissions set status = 'earned', available_at = now() + interval '7 days'
         where order_id = new.id and status = 'pending';
    end if;
    -- Cancelled or refunded: no commission.
    if new.status = 'cancelled' or new.payment_status = 'refunded' then
        update public.commissions set status = 'cancelled' where order_id = new.id and status <> 'cancelled';
    end if;
    return new;
end;
$$;
drop trigger if exists orders_affiliate on public.orders;
create trigger orders_affiliate after insert or update of payment_status, status on public.orders
    for each row execute function public.affiliate_on_order();
