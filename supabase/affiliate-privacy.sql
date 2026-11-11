-- =============================================================================
-- Affiliate privacy (11 Nov 2026): affiliates see how much each referred person spent and
-- what they earned on it, never WHAT was ordered.
--   * commissions.items (the per-product breakdown) is admin-only: affiliates can no longer
--     select that column; the admin reads it through admin_commissions().
--   * affiliate_customer_orders(): per order only date, status, amount spent and commission.
--     (items / commission.items are returned as empty arrays so older app versions don't break.)
--   * affiliate_referrals(): adds each person's total spend.
-- =============================================================================

-- Column-level privacy for commissions (row-level policies still apply as before).
revoke select on public.commissions from authenticated;
grant select (id, affiliate_id, order_id, customer_id, base_amount, rate, amount, status, available_at,
              created_at, reviewed_at, admin_note) on public.commissions to authenticated;

-- Admin: full commission rows, including the per-item breakdown.
create or replace function public.admin_commissions(p_affiliate uuid default null, p_unreviewed boolean default false)
returns setof public.commissions language plpgsql stable security definer set search_path to '' as $$
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    if p_unreviewed then
        return query select * from public.commissions c
         where c.reviewed_at is null and c.status <> 'cancelled'
           and (p_affiliate is null or c.affiliate_id = p_affiliate)
         order by c.created_at asc limit 500;
    else
        return query select * from public.commissions c
         where (p_affiliate is null or c.affiliate_id = p_affiliate)
         order by c.created_at desc limit 500;
    end if;
end;
$$;
grant execute on function public.admin_commissions(uuid, boolean) to authenticated;

-- Referred people: first name + initial, orders, total spent and total earned.
drop function if exists public.affiliate_referrals();
create or replace function public.affiliate_referrals()
returns table (customer_id uuid, customer text, joined_at timestamptz, expires_at timestamptz, orders bigint, spent numeric, earned numeric)
language sql stable security definer set search_path to '' as $$
    select r.customer_id,
        coalesce(nullif(split_part(p.name, ' ', 1), ''), 'Customer')
          || coalesce(' ' || nullif(left(split_part(p.name, ' ', 2), 1), '') || '.', ''),
        r.created_at, r.expires_at,
        (select count(*) from public.orders o where o.user_id = r.customer_id and o.payment_status = 'paid' and o.created_at >= r.created_at),
        (select coalesce(sum(o.subtotal), 0) from public.orders o where o.user_id = r.customer_id and o.payment_status = 'paid' and o.created_at >= r.created_at),
        (select coalesce(sum(c.amount), 0) from public.commissions c where c.affiliate_id = r.affiliate_id and c.customer_id = r.customer_id and c.status <> 'cancelled')
      from public.referrals r left join public.profiles p on p.id = r.customer_id
     where r.affiliate_id = auth.uid()
     order by r.created_at desc;
$$;
grant execute on function public.affiliate_referrals() to authenticated;

-- One referred person's paid orders: amounts only.
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
                   'spent', o.subtotal, 'items_total', o.subtotal, 'items', '[]'::jsonb,
                   'commission', (select jsonb_build_object('status', c.status, 'amount', c.amount, 'base_amount', c.base_amount,
                                                            'items', '[]'::jsonb, 'reviewed_at', c.reviewed_at,
                                                            'available_at', c.available_at, 'note', c.admin_note)
                                    from public.commissions c where c.order_id = o.id and c.affiliate_id = auth.uid())
               ) order by o.created_at desc)
          from public.orders o
         where o.user_id = p_customer and o.payment_status = 'paid' and o.created_at >= v_since
    ), '[]'::jsonb);
end;
$$;
grant execute on function public.affiliate_customer_orders(uuid) to authenticated;
