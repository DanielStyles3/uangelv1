-- =============================================================================
-- Unpaid checkouts
-- The app now keeps the cart until the payment succeeds, so a customer can leave the payment
-- page, change their cart and check out again. Each checkout creates an 'awaiting_payment'
-- order; when a new one is created, the same customer's older unpaid ones are cancelled so
-- they don't pile up. Safe for money: if Paystack later confirms a payment for one of them,
-- mark_order_paid() still marks it paid and moves it from 'cancelled' back to 'pending'.
-- =============================================================================

create or replace function public.drop_older_unpaid_orders()
returns trigger language plpgsql security definer set search_path to '' as $$
begin
    update public.orders
       set status = 'cancelled'
     where user_id = new.user_id
       and id <> new.id
       and status = 'awaiting_payment'
       and payment_status <> 'paid';
    return new;
end;
$$;

drop trigger if exists orders_drop_older_unpaid on public.orders;
create trigger orders_drop_older_unpaid after insert on public.orders
    for each row when (new.status = 'awaiting_payment' and new.user_id is not null)
    execute function public.drop_older_unpaid_orders();
