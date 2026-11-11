-- =============================================================================
-- Per-product delivery and affiliate commission (Admin › Products › edit a product)
--   menu.delivery_fee   ₦ fee for this product (null = its category's standard fee:
--                       ₦5,000 Groceries & Essentials / The Local Market, else ₦2,000)
--   menu.delivery_note  when it arrives, e.g. "Same day", "Next day", "Delivery varies"
--                       (null = the category's note)
--   menu.affiliate_rate what affiliates earn on this product, 0–0.5 (null = the affiliate's
--                       own rate, normally 5%)
-- An order's delivery fee = the highest fee among its products (unchanged for carts
-- without custom fees; Christmas giving packs are ₦0, so a pack-only cart is still free).
-- =============================================================================

alter table public.menu add column if not exists delivery_note text;
alter table public.menu add column if not exists affiliate_rate numeric;
alter table public.menu drop constraint if exists menu_affiliate_rate_check;
alter table public.menu add constraint menu_affiliate_rate_check check (affiliate_rate is null or (affiliate_rate >= 0 and affiliate_rate <= 0.5));
alter table public.menu drop constraint if exists menu_delivery_fee_check;
alter table public.menu add constraint menu_delivery_fee_check check (delivery_fee is null or delivery_fee >= 0);

create or replace function public.delivery_fee_for(p_menu_ids uuid[])
returns numeric language sql stable set search_path to '' as $$
    with recursive items as (
        select m.id, m.category_id, m.delivery_fee from public.menu m where m.id = any (coalesce(p_menu_ids, '{}'))
    ), up as (
        select m.id as item_id, c.id, c.parent_id, c.name, 1 as depth
          from items m join public.categories c on c.id = m.category_id
        union all
        select up.item_id, c.id, c.parent_id, c.name, up.depth + 1
          from up join public.categories c on c.id = up.parent_id
         where up.depth < 10
    ), fees as (
        select coalesce(i.delivery_fee,
                 case when exists (select 1 from up where up.item_id = i.id and up.parent_id is null
                                    and up.name in ('Groceries & Essentials', 'The Local Market'))
                      then 5000::numeric else 2000::numeric end) as fee
          from items i
    )
    select coalesce((select max(fee) from fees), 2000::numeric);
$$;

-- Commission: each product at its own rate (or the affiliate's), Christmas packs excluded.
create or replace function public.affiliate_on_order()
returns trigger language plpgsql security definer set search_path to '' as $$
declare r record; v_base numeric; v_amount numeric;
begin
    if new.payment_status = 'paid' and new.user_id is not null
       and (tg_op = 'INSERT' or old.payment_status is distinct from 'paid') then
        select rf.affiliate_id, a.rate, a.status into r
          from public.referrals rf join public.affiliates a on a.user_id = rf.affiliate_id
         where rf.customer_id = new.user_id and coalesce(new.paid_at, now()) < rf.expires_at;
        if found and r.status = 'active' then
            select coalesce(sum(oi.line_total), 0),
                   coalesce(sum(round(oi.line_total * coalesce(m.affiliate_rate, r.rate), 2)), 0)
              into v_base, v_amount
              from public.order_items oi left join public.menu m on m.id = oi.menu_id
             where oi.order_id = new.id and coalesce(m.is_campaign, false) = false;
            if v_base > 0 and v_amount > 0 then
                insert into public.commissions (affiliate_id, order_id, customer_id, base_amount, rate, amount)
                values (r.affiliate_id, new.id, new.user_id, v_base, round(v_amount / v_base, 4), v_amount)
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
