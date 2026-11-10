-- =============================================================================
-- Affiliate approval (run after affiliates.sql)
-- Joining is now an application: become_affiliate() creates a 'pending' row with NO code.
-- An admin approves (a code is created, status 'active') or rejects with a reason
-- (status 'rejected'; the person can apply again from the app).
-- Statuses: pending → active ⇄ blocked;  pending → rejected → pending (re-apply).
-- Codes only work for 'active' affiliates (unchanged checks in affiliates.sql), so nothing
-- unapproved can be shared or earn commission. Existing affiliates stay active.
-- =============================================================================

alter table public.affiliates alter column code drop not null;
alter table public.affiliates add column if not exists reviewed_at timestamptz;
alter table public.affiliates add column if not exists review_note text;

alter table public.affiliates drop constraint if exists affiliates_status_check;
alter table public.affiliates add constraint affiliates_status_check
    check (status in ('pending', 'active', 'blocked', 'rejected'));
alter table public.affiliates drop constraint if exists affiliates_code_when_approved;
alter table public.affiliates add constraint affiliates_code_when_approved
    check (status in ('pending', 'rejected') or code is not null);
alter table public.affiliates alter column status set default 'pending';

-- Admins may still block / unblock with a direct update, but never move someone in or
-- out of pending / rejected that way (that goes through admin_review_affiliate).
create or replace function public.affiliates_guard_status()
returns trigger language plpgsql set search_path to '' as $$
begin
    if new.status is distinct from old.status
       and current_setting('uangel.affiliate_review', true) is distinct from 'on'
       and not (old.status in ('active', 'blocked') and new.status in ('active', 'blocked')) then
        raise exception 'Approve or reject applications with the Approve / Reject buttons';
    end if;
    return new;
end;
$$;
drop trigger if exists affiliates_guard_status on public.affiliates;
create trigger affiliates_guard_status before update of status on public.affiliates
    for each row execute function public.affiliates_guard_status();

-- ---------- Unique code from the person's first name, e.g. DANIEL42 ----------
create or replace function public._new_affiliate_code(p_user uuid)
returns text language plpgsql security definer set search_path to '' as $$
declare v_base text; v_code text; i int := 0;
begin
    select left(upper(regexp_replace(split_part(coalesce(name, ''), ' ', 1), '[^A-Za-z]', '', 'g')), 6) into v_base
      from public.profiles where id = p_user;
    if coalesce(length(v_base), 0) < 2 then v_base := 'UANGEL'; end if;
    loop
        i := i + 1;
        v_code := v_base || case when i <= 20 then (10 + floor(random() * 90))::int else (100 + floor(random() * 900))::int end;
        exit when not exists (select 1 from public.affiliates where code = v_code);
        if i > 60 then raise exception 'Couldn’t create a code, please try again'; end if;
    end loop;
    return v_code;
end;
$$;
revoke all on function public._new_affiliate_code(uuid) from public, anon, authenticated;

-- ---------- Apply (both apps call this) ----------
create or replace function public.become_affiliate()
returns public.affiliates language plpgsql security definer set search_path to '' as $$
declare v_user uuid := auth.uid(); v_row public.affiliates;
begin
    if v_user is null then raise exception 'Please sign in first'; end if;
    select * into v_row from public.affiliates where user_id = v_user;
    if found then
        if v_row.status = 'rejected' then  -- apply again
            perform set_config('uangel.affiliate_review', 'on', true);
            update public.affiliates set status = 'pending', created_at = now(), reviewed_at = null
             where user_id = v_user returning * into v_row;
        end if;
        return v_row;
    end if;
    insert into public.affiliates (user_id, status) values (v_user, 'pending') returning * into v_row;
    return v_row;
end;
$$;
grant execute on function public.become_affiliate() to authenticated;

-- ---------- Admin: approve or reject ----------
create or replace function public.admin_review_affiliate(p_user uuid, p_approve boolean, p_note text default null)
returns public.affiliates language plpgsql security definer set search_path to '' as $$
declare v_row public.affiliates; v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    select * into v_row from public.affiliates where user_id = p_user for update;
    if not found then raise exception 'This application no longer exists'; end if;
    if v_row.status <> 'pending' then raise exception 'This application was already handled'; end if;
    if not p_approve and v_note is null then raise exception 'Add a short reason'; end if;
    perform set_config('uangel.affiliate_review', 'on', true);
    update public.affiliates
       set status = case when p_approve then 'active' else 'rejected' end,
           code = case when p_approve then coalesce(code, public._new_affiliate_code(p_user)) else code end,
           reviewed_at = now(),
           review_note = v_note
     where user_id = p_user
     returning * into v_row;
    return v_row;
end;
$$;
grant execute on function public.admin_review_affiliate(uuid, boolean, text) to authenticated;

-- ---------- App summary: now also tells pending / rejected people where they stand ----------
create or replace function public.affiliate_summary()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_aff public.affiliates; b record;
begin
    select * into v_aff from public.affiliates where user_id = auth.uid();
    if not found then return null; end if;
    select * into b from public.affiliate_balance(v_aff.user_id);
    return jsonb_build_object(
        'code', v_aff.code, 'status', v_aff.status, 'rate', v_aff.rate,
        'applied_at', v_aff.created_at, 'reviewed_at', v_aff.reviewed_at,
        'review_note', case when v_aff.status in ('rejected', 'blocked') then v_aff.review_note end,
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

-- ---------- Admin list: applications first ----------
drop function if exists public.admin_affiliates();
create or replace function public.admin_affiliates()
returns table (user_id uuid, name text, email text, phone text, code text, status text, rate numeric, created_at timestamptz,
               referrals bigint, pending numeric, on_hold numeric, available numeric, withdrawn numeric, total_earned numeric,
               bank_name text, account_number text, account_name text, reviewed_at timestamptz, review_note text,
               customer_since timestamptz, paid_orders bigint)
language plpgsql stable security definer set search_path to '' as $$
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    return query
    select a.user_id, p.name, p.email, p.phone, a.code, a.status, a.rate, a.created_at,
           (select count(*) from public.referrals r where r.affiliate_id = a.user_id),
           b.pending, b.on_hold, b.available, b.withdrawn, b.total_earned,
           a.bank_name, a.account_number, a.account_name, a.reviewed_at, a.review_note,
           (select u.created_at from auth.users u where u.id = a.user_id),
           (select count(*) from public.orders o where o.user_id = a.user_id and o.payment_status = 'paid')
      from public.affiliates a
      left join public.profiles p on p.id = a.user_id
      cross join lateral public.affiliate_balance(a.user_id) b
     order by (a.status = 'pending') desc, b.total_earned desc, a.created_at desc;
end;
$$;
grant execute on function public.admin_affiliates() to authenticated;

-- ---------- Sidebar badge: applications waiting ----------
create or replace function public.admin_stats()
returns jsonb language plpgsql stable security definer set search_path to '' as $$
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    return jsonb_build_object(
        'orders_total',        (select count(*) from public.orders),
        'orders_today',        (select count(*) from public.orders where created_at >= date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos'),
        'orders_to_fulfil',    (select count(*) from public.orders where payment_status = 'paid' and status in ('pending', 'confirmed', 'preparing', 'on_the_way')),
        'awaiting_payment',    (select count(*) from public.orders where status = 'awaiting_payment'),
        'revenue_paid_total',  (select coalesce(sum(public.order_amount_received(o)), 0) from public.orders o where o.payment_status = 'paid'),
        'revenue_paid_30d',    (select coalesce(sum(public.order_amount_received(o)), 0) from public.orders o where o.payment_status = 'paid' and o.paid_at >= now() - interval '30 days'),
        'requests_new',        (select count(*) from public.service_requests where status = 'new'),
        'requests_total',      (select count(*) from public.service_requests),
        'customers',           (select count(*) from public.profiles),
        'products',            (select count(*) from public.menu),
        'affiliates_pending',  (select count(*) from public.affiliates where status = 'pending'),
        'withdrawals_waiting', (select count(*) from public.withdrawals where status = 'requested')
    );
end;
$$;
