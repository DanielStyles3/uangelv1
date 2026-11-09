-- Food ordering app schema for Supabase.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Then run seed.sql to load the sample menu. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per signed-up user; created automatically by the trigger below.
create table if not exists public.profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    name        text not null,
    email       text not null,
    avatar      text,
    created_at  timestamptz not null default now()
);

-- Two levels: main categories (parent_id is null, shown on Home) and their
-- subcategories (parent_id = main category). Products belong to a subcategory.
create table if not exists public.categories (
    id            uuid primary key default gen_random_uuid(),
    name          text not null,
    description   text,
    parent_id     uuid references public.categories (id) on delete cascade,
    emoji         text,
    color         text,          -- card background, e.g. '#D33B0D'
    sort_order    integer not null default 0,
    delivery_note text,          -- e.g. 'Standard next-day delivery'
    created_at    timestamptz not null default now()
);

-- Upgrade an older single-level table in place.
alter table public.categories add column if not exists parent_id     uuid references public.categories (id) on delete cascade;
alter table public.categories add column if not exists emoji         text;
alter table public.categories add column if not exists color         text;
alter table public.categories add column if not exists sort_order    integer not null default 0;
alter table public.categories add column if not exists delivery_note text;
alter table public.categories add column if not exists image_url     text;  -- card/tile photo
-- 'products': browse & add to cart.  'service': no products; customers send a request
-- (Catering, Events & Celebrations) via the service_requests table below.
alter table public.categories add column if not exists kind text not null default 'products';
alter table public.categories drop constraint if exists categories_kind_check;
alter table public.categories add constraint categories_kind_check check (kind in ('products', 'service'));

-- Names only need to be unique within the same parent ("Wines" exists under two mains).
alter table public.categories drop constraint if exists categories_name_key;
alter table public.categories drop constraint if exists categories_parent_name_key;
alter table public.categories add constraint categories_parent_name_key unique nulls not distinct (parent_id, name);

create index if not exists categories_parent_id_idx on public.categories (parent_id, sort_order);

create table if not exists public.menu (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    description text,
    image_url   text,
    price       numeric(10, 2) not null check (price >= 0),
    rating      numeric(2, 1) check (rating between 0 and 5),
    calories    integer,
    protein     integer,
    category_id uuid references public.categories (id) on delete set null,
    created_at  timestamptz not null default now()
);

create index if not exists menu_category_id_idx on public.menu (category_id);

-- Placeholder shown when a product has no photo yet (e.g. '🧁').
alter table public.menu add column if not exists emoji text;
-- In stock / sold out (admin Products switch). Sold-out products stay visible in the app
-- but can't be added to the cart; place_order() rejects them.
alter table public.menu add column if not exists is_available boolean not null default true;
-- Not every product has nutrition info (cakes, catering packages, wine...).
alter table public.menu alter column calories drop not null;
alter table public.menu alter column protein drop not null;

create table if not exists public.customizations (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    price       numeric(10, 2) not null check (price >= 0),
    type        text not null check (type in ('topping', 'side')),
    created_at  timestamptz not null default now()
);

-- Which toppings/sides are offered for which menu item.
create table if not exists public.menu_customizations (
    menu_id          uuid not null references public.menu (id) on delete cascade,
    customization_id uuid not null references public.customizations (id) on delete cascade,
    primary key (menu_id, customization_id)
);

create index if not exists menu_customizations_customization_id_idx
    on public.menu_customizations (customization_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.menu                enable row level security;
alter table public.customizations      enable row level security;
alter table public.menu_customizations enable row level security;

-- The menu is public (read-only from the app; edit it from the dashboard / SQL).
drop policy if exists "Categories are viewable by everyone" on public.categories;
create policy "Categories are viewable by everyone"
    on public.categories for select to anon, authenticated using (true);

drop policy if exists "Menu is viewable by everyone" on public.menu;
create policy "Menu is viewable by everyone"
    on public.menu for select to anon, authenticated using (true);

drop policy if exists "Customizations are viewable by everyone" on public.customizations;
create policy "Customizations are viewable by everyone"
    on public.customizations for select to anon, authenticated using (true);

drop policy if exists "Menu customizations are viewable by everyone" on public.menu_customizations;
create policy "Menu customizations are viewable by everyone"
    on public.menu_customizations for select to anon, authenticated using (true);

-- Users can only see and edit their own profile.
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
    on public.profiles for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
    on public.profiles for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
    on public.profiles for update to authenticated
    using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Create a profile row automatically whenever someone signs up.
-- The app passes the user's name as sign-up metadata: options.data.name
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, name, email)
    values (
        new.id,
        coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
        new.email
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Delivery details on the profile (Nigeria: address, city, state, phone)
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists phone   text;
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists city    text;
alter table public.profiles add column if not exists state   text;

-- ---------------------------------------------------------------------------
-- Orders
-- Rows are only created through place_order() below, which recalculates every
-- price from the menu tables so the app can't submit its own prices.
-- ---------------------------------------------------------------------------

create table if not exists public.orders (
    id               uuid primary key default gen_random_uuid(),
    user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
    status           text not null default 'pending'
                     check (status in ('pending', 'confirmed', 'preparing', 'on_the_way', 'delivered', 'cancelled')),
    payment_method   text not null check (payment_method in ('cash', 'transfer')),
    subtotal         numeric(12, 2) not null check (subtotal >= 0),
    delivery_fee     numeric(12, 2) not null check (delivery_fee >= 0),
    total            numeric(12, 2) not null check (total >= 0),
    delivery_address text not null,
    city             text not null,
    state            text not null,
    phone            text not null,
    note             text,
    created_at       timestamptz not null default now()
);

create index if not exists orders_user_id_created_at_idx on public.orders (user_id, created_at desc);

create table if not exists public.order_items (
    id             uuid primary key default gen_random_uuid(),
    order_id       uuid not null references public.orders (id) on delete cascade,
    menu_id        uuid references public.menu (id) on delete set null,
    -- Snapshot of the item at order time, so history stays correct if the menu changes.
    name           text not null,
    image_url      text,
    unit_price     numeric(12, 2) not null check (unit_price >= 0),
    quantity       integer not null check (quantity > 0),
    customizations jsonb not null default '[]'::jsonb,
    line_total     numeric(12, 2) not null check (line_total >= 0)
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_menu_id_idx on public.order_items (menu_id);

alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Read-only from the app; inserts go through place_order(), status changes via dashboard/admin.
drop policy if exists "Users can view own orders" on public.orders;
create policy "Users can view own orders"
    on public.orders for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can view own order items" on public.order_items;
create policy "Users can view own order items"
    on public.order_items for select to authenticated
    using (exists (
        select 1 from public.orders o
        where o.id = order_items.order_id and o.user_id = (select auth.uid())
    ));

-- Standard delivery fee in naira (kept for older callers). The fee actually charged
-- depends on what's in the order: see public.delivery_fee_for() at the end of this file.
create or replace function public.delivery_fee()
returns numeric
language sql
immutable
as $$ select 2000::numeric $$;

-- p_items: [{ "menu_id": uuid, "quantity": int, "customization_ids": [uuid, ...] }, ...]
create or replace function public.place_order(
    p_items          jsonb,
    p_address        text,
    p_city           text,
    p_state          text,
    p_phone          text,
    p_payment_method text default 'paystack',  -- (signature must match the Paystack version below)
    p_note           text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
    v_unit      numeric;
    v_subtotal  numeric := 0;
    v_fee       numeric := public.delivery_fee();
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
    if coalesce(btrim(p_address), '') = '' or coalesce(btrim(p_city), '') = '' or coalesce(btrim(p_state), '') = '' then
        raise exception 'Please enter your delivery address';
    end if;
    if coalesce(btrim(p_phone), '') = '' then
        raise exception 'Please enter a phone number';
    end if;
    if p_payment_method is null or p_payment_method not in ('cash', 'transfer') then
        raise exception 'Invalid payment method';
    end if;

    insert into public.orders (user_id, payment_method, subtotal, delivery_fee, total,
                               delivery_address, city, state, phone, note)
    values (v_user, p_payment_method, 0, v_fee, 0,
            btrim(p_address), btrim(p_city), btrim(p_state), btrim(p_phone), nullif(btrim(p_note), ''))
    returning id into v_order;

    for v_item in select value from jsonb_array_elements(p_items) loop
        v_qty := (v_item ->> 'quantity')::integer;
        if v_qty is null or v_qty < 1 or v_qty > 50 then
            raise exception 'Invalid quantity';
        end if;

        select m.id, m.name, m.image_url, m.price into v_menu
          from public.menu m
         where m.id = (v_item ->> 'menu_id')::uuid;
        if not found then
            raise exception 'An item in your cart is no longer available';
        end if;

        v_cus_ids := array(
            select distinct x::uuid
              from jsonb_array_elements_text(coalesce(v_item -> 'customization_ids', '[]'::jsonb)) as x
        );

        -- Only customizations actually offered for this menu item are accepted.
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

        v_unit := v_menu.price + v_cus_total;

        insert into public.order_items (order_id, menu_id, name, image_url, unit_price, quantity, customizations, line_total)
        values (v_order, v_menu.id, v_menu.name, v_menu.image_url, v_unit, v_qty, v_cus, v_unit * v_qty);

        v_subtotal := v_subtotal + v_unit * v_qty;
    end loop;

    update public.orders
       set subtotal = v_subtotal, total = v_subtotal + v_fee
     where id = v_order;

    return v_order;
end;
$$;

revoke all on function public.place_order(jsonb, text, text, text, text, text, text) from public, anon;
grant execute on function public.place_order(jsonb, text, text, text, text, text, text) to authenticated;

-- Let a user cancel their own order while it is still pending.
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.orders
       set status = 'cancelled'
     where id = p_order_id
       and user_id = auth.uid()
       and status = 'pending';

    if not found then
        raise exception 'This order can no longer be cancelled';
    end if;
end;
$$;

revoke all on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Paystack: orders are paid ONLINE immediately (pay-on-delivery orders pay only the
-- delivery fee online; see "Delivery fee by category + Pay on delivery" at the end).
-- Flow: place_order() creates the order as 'awaiting_payment' → the paystack-init
-- Edge Function opens Paystack checkout → paystack-verify / paystack-webhook confirm
-- the payment with Paystack and call mark_order_paid() → status becomes 'pending'
-- (paid, waiting for the kitchen). Only Edge Functions (DB owner) can mark orders paid.
-- ---------------------------------------------------------------------------

alter table public.orders add column if not exists payment_status     text not null default 'unpaid';
alter table public.orders add column if not exists paystack_reference text;
alter table public.orders add column if not exists paid_at            timestamptz;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
    check (payment_status in ('unpaid', 'paid', 'failed', 'refunded'));

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
    check (status in ('awaiting_payment', 'pending', 'confirmed', 'preparing', 'on_the_way', 'delivered', 'cancelled'));

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
    check (payment_method in ('paystack', 'pay_on_delivery', 'cash', 'transfer'));   -- cash/transfer kept only for old rows

create unique index if not exists orders_paystack_reference_key on public.orders (paystack_reference);

-- Same as before, but every new order is a Paystack order awaiting payment.
-- (p_payment_method is kept for backwards compatibility and ignored.)
create or replace function public.place_order(
    p_items          jsonb,
    p_address        text,
    p_city           text,
    p_state          text,
    p_phone          text,
    p_payment_method text default 'paystack',
    p_note           text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
    v_unit      numeric;
    v_subtotal  numeric := 0;
    v_fee       numeric := public.delivery_fee();
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
    if coalesce(btrim(p_address), '') = '' or coalesce(btrim(p_city), '') = '' or coalesce(btrim(p_state), '') = '' then
        raise exception 'Please enter your delivery address';
    end if;
    if coalesce(btrim(p_phone), '') = '' then
        raise exception 'Please enter a phone number';
    end if;

    insert into public.orders (user_id, status, payment_method, payment_status, subtotal, delivery_fee, total,
                               delivery_address, city, state, phone, note)
    values (v_user, 'awaiting_payment', 'paystack', 'unpaid', 0, v_fee, 0,
            btrim(p_address), btrim(p_city), btrim(p_state), btrim(p_phone), nullif(btrim(p_note), ''))
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

        v_unit := v_menu.price + v_cus_total;

        insert into public.order_items (order_id, menu_id, name, image_url, unit_price, quantity, customizations, line_total)
        values (v_order, v_menu.id, v_menu.name, v_menu.image_url, v_unit, v_qty, v_cus, v_unit * v_qty);

        v_subtotal := v_subtotal + v_unit * v_qty;
    end loop;

    update public.orders
       set subtotal = v_subtotal, total = v_subtotal + v_fee
     where id = v_order;

    return v_order;
end;
$$;

revoke all on function public.place_order(jsonb, text, text, text, text, text, text) from public, anon;
grant execute on function public.place_order(jsonb, text, text, text, text, text, text) to authenticated;

-- Customers can only cancel orders they haven't paid for yet. Paid orders need
-- the business (refunds go through Paystack).
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.orders
       set status = 'cancelled'
     where id = p_order_id
       and user_id = auth.uid()
       and status = 'awaiting_payment'
       and payment_status <> 'paid';

    if not found then
        raise exception 'This order can no longer be cancelled';
    end if;
end;
$$;

revoke all on function public.cancel_order(uuid) from public, anon;
grant execute on function public.cancel_order(uuid) to authenticated;

-- Every Paystack reference ever issued for an order. paystack-init creates a NEW
-- reference each time the pay screen opens, so orders.paystack_reference only holds
-- the latest one; a slow payment (e.g. bank transfer) on an earlier reference must
-- still find its order. No RLS policies: only Edge Functions (DB owner) touch it.
create table if not exists public.payment_attempts (
    reference   text primary key,
    order_id    uuid not null references public.orders (id) on delete cascade,
    created_at  timestamptz not null default now()
);
create index if not exists payment_attempts_order_id_idx on public.payment_attempts (order_id);
alter table public.payment_attempts enable row level security;

-- Backfill references issued before this table existed.
insert into public.payment_attempts (reference, order_id)
select paystack_reference, id from public.orders where paystack_reference is not null
on conflict (reference) do nothing;

-- Called ONLY by the Paystack Edge Functions after Paystack confirms the payment.
-- Checks the amount (kobo) matches the order total; idempotent.
create or replace function public.mark_order_paid(p_reference text, p_amount_kobo bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_order record;
begin
    -- online_amount = what Paystack should charge (the total, or only the delivery fee for
    -- pay-on-delivery orders). Orders from before that column existed fall back to total.
    select o.id, coalesce(o.online_amount, o.total) as amount_due, o.payment_status, o.status into v_order
      from public.orders o
     where o.id = (select a.order_id from public.payment_attempts a where a.reference = p_reference)
        or o.paystack_reference = p_reference
     limit 1
     for update;

    if not found then
        raise exception 'Unknown payment reference';
    end if;
    if v_order.payment_status = 'paid' then
        return 'already_paid';
    end if;
    if p_amount_kobo <> round(v_order.amount_due * 100) then
        update public.orders set payment_status = 'failed' where id = v_order.id;
        raise exception 'Amount mismatch for %', p_reference;
    end if;

    update public.orders
       set payment_status = 'paid',
           paid_at = now(),
           paystack_reference = p_reference,   -- record the reference that actually paid
           status = case when status in ('awaiting_payment', 'cancelled') then 'pending' else status end
     where id = v_order.id;
    return 'paid';
end;
$$;

revoke all on function public.mark_order_paid(text, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Account deletion (delete-account Edge Function deletes the auth user):
-- profile + service requests are removed (cascade); ORDERS are kept for the
-- business's sales records but unlinked from the person (user_id -> null).
-- ---------------------------------------------------------------------------

alter table public.orders alter column user_id drop not null;
alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders add constraint orders_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Service requests (Catering, Events & Celebrations): customers describe their
-- event and budget; the business follows up with a quote. Status is updated
-- by the business from the dashboard/admin.
-- ---------------------------------------------------------------------------

create table if not exists public.service_requests (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
    category_id     uuid references public.categories (id) on delete set null,  -- main category (Catering / Events)
    subcategory_id  uuid references public.categories (id) on delete set null,  -- e.g. Wedding Parties
    -- Snapshots, so the request stays readable if categories are renamed/removed.
    service         text not null,                    -- e.g. 'Catering'
    event_type      text not null,                    -- e.g. 'Wedding Parties'
    full_name       text not null check (length(btrim(full_name)) > 0),
    phone           text not null check (length(btrim(phone)) > 0),
    email           text,
    event_date      date not null,
    guest_count     integer not null check (guest_count between 1 and 100000),
    budget          numeric(14, 2) not null check (budget >= 0),
    address         text not null check (length(btrim(address)) > 0),
    city            text not null check (length(btrim(city)) > 0),
    state           text not null check (length(btrim(state)) > 0),
    details         text,
    status          text not null default 'new'
                    check (status in ('new', 'contacted', 'quoted', 'confirmed', 'completed', 'cancelled')),
    created_at      timestamptz not null default now()
);

create index if not exists service_requests_user_id_created_at_idx on public.service_requests (user_id, created_at desc);
create index if not exists service_requests_category_id_idx on public.service_requests (category_id);
create index if not exists service_requests_subcategory_id_idx on public.service_requests (subcategory_id);

alter table public.service_requests enable row level security;

drop policy if exists "Users can create own service requests" on public.service_requests;
create policy "Users can create own service requests"
    on public.service_requests for insert to authenticated
    with check ((select auth.uid()) = user_id and status = 'new');

drop policy if exists "Users can view own service requests" on public.service_requests;
create policy "Users can view own service requests"
    on public.service_requests for select to authenticated using ((select auth.uid()) = user_id);

-- Customers may cancel their own request while it hasn't been confirmed yet.
create or replace function public.cancel_service_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.service_requests
       set status = 'cancelled'
     where id = p_request_id
       and user_id = auth.uid()
       and status in ('new', 'contacted', 'quoted');

    if not found then
        raise exception 'This request can no longer be cancelled';
    end if;
end;
$$;

revoke all on function public.cancel_service_request(uuid) from public, anon;
grant execute on function public.cancel_service_request(uuid) to authenticated;

-- The amount the business quoted (admin Requests page). The customer can see it on
-- their own request; only admins can set it (no customer update policy exists).
alter table public.service_requests add column if not exists quote_amount numeric(14, 2);
alter table public.service_requests drop constraint if exists service_requests_quote_amount_check;
alter table public.service_requests add constraint service_requests_quote_amount_check check (quote_amount is null or quote_amount >= 0);

-- Internal notes on a request ("Called, wants a tasting Saturday"). Admins only;
-- customers can never read them.
create table if not exists public.request_notes (
    id           uuid primary key default gen_random_uuid(),
    request_id   uuid not null references public.service_requests (id) on delete cascade,
    author_id    uuid default auth.uid() references auth.users (id) on delete set null,
    author_name  text,
    body         text not null check (length(btrim(body)) between 1 and 2000),
    created_at   timestamptz not null default now()
);
create index if not exists request_notes_request_id_idx on public.request_notes (request_id, created_at desc);
alter table public.request_notes enable row level security;

-- ---------------------------------------------------------------------------
-- Admin role (web admin dashboard: website/admin/)
-- Admins are profiles with is_admin = true. Customers can never set it on
-- themselves: column-level grants exclude is_admin from what they may write.
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Delivery address extras (Profile › Delivery address). delivery_phone is the number the
-- rider calls; when null, the personal phone is used.
alter table public.profiles add column if not exists landmark       text;
alter table public.profiles add column if not exists delivery_phone text;

-- id and email are NOT updatable by customers: profiles.email is only a display copy
-- of the login email, and must never be settable to someone else's address.
revoke insert, update on public.profiles from authenticated, anon;
grant insert (id, name, email, avatar, phone, address, city, state, landmark, delivery_phone) on public.profiles to authenticated;
grant update (name, avatar, phone, address, city, state, landmark, delivery_phone) on public.profiles to authenticated;

-- A profile's email always mirrors the auth email (on insert and if it ever changes).
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_table_name = 'profiles' then
        new.email := coalesce((select u.email from auth.users u where u.id = new.id), new.email);
        return new;
    end if;
    update public.profiles set email = new.email where id = new.id and email is distinct from new.email;
    return new;
end;
$$;

drop trigger if exists profiles_sync_email on public.profiles;
create trigger profiles_sync_email
    before insert or update of email on public.profiles
    for each row execute procedure public.sync_profile_email();

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
    after update of email on auth.users
    for each row execute procedure public.sync_profile_email();

-- Repair any profile email that was changed before this fix.
update public.profiles p set email = u.email
  from auth.users u where u.id = p.id and u.email is not null and p.email is distinct from u.email;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;
grant execute on function public.is_admin() to authenticated, anon;

-- Profiles: admins can see every customer.
drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
    on public.profiles for select to authenticated using ((select public.is_admin()));

-- Catalog: admins manage categories, products, add-ons and their links.
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories for all to authenticated
    using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Admins manage menu" on public.menu;
create policy "Admins manage menu" on public.menu for all to authenticated
    using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Admins manage customizations" on public.customizations;
create policy "Admins manage customizations" on public.customizations for all to authenticated
    using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Admins manage menu customizations" on public.menu_customizations;
create policy "Admins manage menu customizations" on public.menu_customizations for all to authenticated
    using ((select public.is_admin())) with check ((select public.is_admin()));

-- Orders: admins see all orders + items and update status.
drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders" on public.orders for select to authenticated
    using ((select public.is_admin()));
drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders" on public.orders for update to authenticated
    using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Admins can view all order items" on public.order_items;
create policy "Admins can view all order items" on public.order_items for select to authenticated
    using ((select public.is_admin()));

-- Service requests: admins see all and update status.
drop policy if exists "Admins can view all service requests" on public.service_requests;
create policy "Admins can view all service requests" on public.service_requests for select to authenticated
    using ((select public.is_admin()));
drop policy if exists "Admins can update service requests" on public.service_requests;
create policy "Admins can update service requests" on public.service_requests for update to authenticated
    using ((select public.is_admin())) with check ((select public.is_admin()));

-- Request notes: admins read, add and delete; nobody else sees them.
drop policy if exists "Admins read request notes" on public.request_notes;
create policy "Admins read request notes" on public.request_notes for select to authenticated
    using ((select public.is_admin()));
drop policy if exists "Admins add request notes" on public.request_notes;
create policy "Admins add request notes" on public.request_notes for insert to authenticated
    with check ((select public.is_admin()) and author_id = (select auth.uid()));
drop policy if exists "Admins delete request notes" on public.request_notes;
create policy "Admins delete request notes" on public.request_notes for delete to authenticated
    using ((select public.is_admin()));

-- Dashboard numbers in one call.
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    return jsonb_build_object(
        'orders_total',        (select count(*) from public.orders),
        'orders_today',        (select count(*) from public.orders where created_at >= date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos'),
        'orders_to_fulfil',    (select count(*) from public.orders where payment_status = 'paid' and status in ('pending', 'confirmed', 'preparing', 'on_the_way')),
        'awaiting_payment',    (select count(*) from public.orders where status = 'awaiting_payment'),
        'revenue_paid_total',  (select coalesce(sum(total), 0) from public.orders where payment_status = 'paid'),
        'revenue_paid_30d',    (select coalesce(sum(total), 0) from public.orders where payment_status = 'paid' and paid_at >= now() - interval '30 days'),
        'requests_new',        (select count(*) from public.service_requests where status = 'new'),
        'requests_total',      (select count(*) from public.service_requests),
        'customers',           (select count(*) from public.profiles),
        'products',            (select count(*) from public.menu)
    );
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- Customers with their paid order count, amount spent and last paid order.
-- (Return columns changed, so the old version is dropped first.)
drop function if exists public.admin_customers();
create or replace function public.admin_customers()
returns table (id uuid, name text, email text, phone text, city text, state text, is_admin boolean,
               created_at timestamptz, orders_count bigint, total_spent numeric, last_order_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    return query
        select p.id, p.name, coalesce(u.email, p.email)::text, p.phone, p.city, p.state, p.is_admin, p.created_at,
               count(o.id) filter (where o.payment_status = 'paid'),
               -- amount received (pay-on-delivery balances count once collected; defined at the end of this file)
               coalesce(sum(public.order_amount_received(o)) filter (where o.payment_status = 'paid'), 0),
               max(coalesce(o.paid_at, o.created_at)) filter (where o.payment_status = 'paid')
          from public.profiles p
          left join auth.users u on u.id = p.id
          left join public.orders o on o.user_id = p.id
         group by p.id, u.email
         order by p.created_at desc;
end;
$$;
revoke all on function public.admin_customers() from public, anon;
grant execute on function public.admin_customers() to authenticated;

-- Grant / remove admin rights by email (keeps at least one admin).
-- Looks the account up by its LOGIN email (auth.users), never by profiles.email,
-- and changes exactly one account.
create or replace function public.admin_set_admin(p_email text, p_make_admin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id uuid;
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    select u.id into v_id from auth.users u where lower(u.email) = lower(btrim(p_email));
    if v_id is null then raise exception 'No account with that email. They must sign up in the app first.'; end if;
    if not p_make_admin and (select count(*) from public.profiles where is_admin) <= 1
       and exists (select 1 from public.profiles where id = v_id and is_admin) then
        raise exception 'There must be at least one admin';
    end if;
    update public.profiles set is_admin = p_make_admin where id = v_id;
    if not found then raise exception 'That account has no profile yet. Ask them to open the app once.'; end if;
end;
$$;
revoke all on function public.admin_set_admin(text, boolean) from public, anon;
grant execute on function public.admin_set_admin(text, boolean) to authenticated;

-- Reorder categories (admin Categories page, drag & drop): p_ids lists siblings — all main
-- categories, or all subcategories of one main — in their new order; sort_order becomes 1..n.
-- One call, one transaction, so a reorder is never half-saved.
create or replace function public.admin_reorder_categories(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    if p_ids is null or array_length(p_ids, 1) is null then return; end if;
    if (select count(distinct coalesce(c.parent_id::text, 'main')) from public.categories c where c.id = any (p_ids)) > 1 then
        raise exception 'Only categories at the same level can be reordered together';
    end if;
    update public.categories c
       set sort_order = t.ord::integer
      from unnest(p_ids) with ordinality as t(id, ord)
     where c.id = t.id;
end;
$$;
revoke all on function public.admin_reorder_categories(uuid[]) from public, anon;
grant execute on function public.admin_reorder_categories(uuid[]) to authenticated;

-- Storage: admins can upload / replace / delete catalog photos (bucket is public to view).
drop policy if exists "Admins can upload catalog images" on storage.objects;
create policy "Admins can upload catalog images" on storage.objects for insert to authenticated
    with check (bucket_id = 'catalog' and (select public.is_admin()));
drop policy if exists "Admins can update catalog images" on storage.objects;
create policy "Admins can update catalog images" on storage.objects for update to authenticated
    using (bucket_id = 'catalog' and (select public.is_admin()));
drop policy if exists "Admins can delete catalog images" on storage.objects;
create policy "Admins can delete catalog images" on storage.objects for delete to authenticated
    using (bucket_id = 'catalog' and (select public.is_admin()));
drop policy if exists "Admins can list catalog images" on storage.objects;
create policy "Admins can list catalog images" on storage.objects for select to authenticated
    using (bucket_id = 'catalog' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Public bucket for U Angel Foods' own product/category photos
-- (originals kept in supabase/catalog-images/). Anyone can view; there is no
-- upload policy, so only the dashboard / service role can add or change files.
-- Public URL: https://<project-ref>.supabase.co/storage/v1/object/public/catalog/<file>
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog', 'catalog', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true;

-- ---------------------------------------------------------------------------
-- Promotions: the sliding banners at the top of the app's Home (admin Promotions page).
-- The app only ever sees banners that are switched on and inside their dates.
-- With no live banners, the app shows its two built-in banners.
-- ---------------------------------------------------------------------------

create table if not exists public.promotions (
    id          uuid primary key default gen_random_uuid(),
    eyebrow     text check (eyebrow is null or length(eyebrow) <= 40),           -- small heading, e.g. 'Fresh & chilled'
    title       text not null check (length(btrim(title)) between 1 and 80),
    cta         text not null default 'Shop now' check (length(btrim(cta)) between 1 and 30),
    image_url   text not null,
    color       text not null default '#FD652A' check (color ~* '^#[0-9a-f]{6}$'),
    link_type   text not null default 'none' check (link_type in ('none', 'category', 'product', 'service')),
    link_id     uuid,                                                             -- category / product id (no FK: the target may be deleted)
    starts_at   timestamptz,
    ends_at     timestamptz,
    is_active   boolean not null default true,
    sort_order  integer not null default 0,
    created_at  timestamptz not null default now(),
    check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists promotions_sort_idx on public.promotions (sort_order);
alter table public.promotions enable row level security;

drop policy if exists "Live promotions are viewable by everyone" on public.promotions;
create policy "Live promotions are viewable by everyone" on public.promotions for select to anon, authenticated
    using (is_active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
drop policy if exists "Admins manage promotions" on public.promotions;
create policy "Admins manage promotions" on public.promotions for all to authenticated
    using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Product options: "Customise your cake" (size, shape, flavour, colour, message,
-- notes for the baker). Set per product in Admin › Products › Customer options.
--   kind 'single' = pick one value (price added to the item); values may carry a colour swatch
--   kind 'text'   = free text up to max_length (no price)
-- Prices are always worked out by place_order() below; the app's numbers are never trusted.
-- ---------------------------------------------------------------------------

create table if not exists public.option_groups (
    id          uuid primary key default gen_random_uuid(),
    menu_id     uuid not null references public.menu (id) on delete cascade,
    name        text not null check (length(btrim(name)) between 1 and 40),
    kind        text not null default 'single' check (kind in ('single', 'text')),
    required    boolean not null default false,
    max_length  integer check (max_length is null or max_length between 1 and 500),
    placeholder text,
    sort_order  integer not null default 0,
    created_at  timestamptz not null default now()
);
create index if not exists option_groups_menu_idx on public.option_groups (menu_id, sort_order);

create table if not exists public.option_values (
    id          uuid primary key default gen_random_uuid(),
    group_id    uuid not null references public.option_groups (id) on delete cascade,
    name        text not null check (length(btrim(name)) between 1 and 60),
    price       numeric(12, 2) not null default 0 check (price >= 0),
    hint        text,                       -- e.g. 'serves 15–20'
    swatch      text,                       -- optional colour, e.g. '#F9A8C8'
    sort_order  integer not null default 0
);
create index if not exists option_values_group_idx on public.option_values (group_id, sort_order);

alter table public.option_groups enable row level security;
alter table public.option_values enable row level security;
drop policy if exists "Options are viewable by everyone" on public.option_groups;
create policy "Options are viewable by everyone" on public.option_groups for select to anon, authenticated using (true);
drop policy if exists "Option values are viewable by everyone" on public.option_values;
create policy "Option values are viewable by everyone" on public.option_values for select to anon, authenticated using (true);
drop policy if exists "Admins manage option groups" on public.option_groups;
create policy "Admins manage option groups" on public.option_groups for all to authenticated
    using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "Admins manage option values" on public.option_values;
create policy "Admins manage option values" on public.option_values for all to authenticated
    using ((select public.is_admin())) with check ((select public.is_admin()));

-- place_order with product options. Each item may also send
--   "option_ids": [option_value uuid, ...]            (one per 'single' group at most)
--   "texts": [{"group_id": uuid, "text": "..."}, ...] ('text' groups)
-- Required groups must be answered. Chosen options are saved on the order item
-- (customizations jsonb) as {id, name: 'Size: 8 inch', price, type: 'option'} and
-- {id: group_id, name: 'Message: "…"', price: 0, type: 'text', text}.
create or replace function public.place_order(
    p_items          jsonb,
    p_address        text,
    p_city           text,
    p_state          text,
    p_phone          text,
    p_payment_method text default 'paystack',
    p_note           text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
    if coalesce(btrim(p_address), '') = '' or coalesce(btrim(p_city), '') = '' or coalesce(btrim(p_state), '') = '' then
        raise exception 'Please enter your delivery address';
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
            btrim(p_address), btrim(p_city), btrim(p_state), btrim(p_phone), nullif(btrim(p_note), ''))
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

        -- Choice options (size, flavour, …): must belong to this product, one per group
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

    -- ₦5,000 if anything is from Groceries & Essentials / The Local Market, else ₦2,000.
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
$$;

revoke all on function public.place_order(jsonb, text, text, text, text, text, text) from public, anon;
grant execute on function public.place_order(jsonb, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Delivery fee by category + Pay on delivery
--   Delivery: ₦2,000 per order, or ₦5,000 when the order has anything from the
--   'Groceries & Essentials' or 'The Local Market' main categories.
--   Keep in sync with DELIVERY_FEE / DELIVERY_FEE_MARKET in constants/index.ts.
--   payment_method 'pay_on_delivery': the customer pays the delivery fee online with
--   Paystack first (online_amount = delivery_fee); the order only reaches the kitchen
--   ('pending') once that is paid. The items (balance_due = subtotal) are paid to the
--   rider in cash or by transfer; an admin then marks the balance collected.
--   (place_order above and mark_order_paid earlier in this file use these columns.)
-- ---------------------------------------------------------------------------

alter table public.orders add column if not exists online_amount        numeric(12, 2);   -- null on old orders = total
alter table public.orders add column if not exists balance_due          numeric(12, 2) not null default 0;
alter table public.orders add column if not exists balance_collected_at timestamptz;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
    check (payment_method in ('paystack', 'pay_on_delivery', 'cash', 'transfer'));   -- cash/transfer kept only for old rows

alter table public.orders drop constraint if exists orders_balance_due_check;
alter table public.orders add constraint orders_balance_due_check check (balance_due >= 0);
alter table public.orders drop constraint if exists orders_online_amount_check;
alter table public.orders add constraint orders_online_amount_check check (online_amount is null or online_amount >= 0);

-- The delivery fee for an order containing these products. Walks each product's
-- category up to its main category. Also used by the app to show the fee before checkout.
create or replace function public.delivery_fee_for(p_menu_ids uuid[])
returns numeric
language sql
stable
set search_path = ''
as $$
    with recursive up as (
        select c.id, c.parent_id, c.name, 1 as depth
          from public.menu m
          join public.categories c on c.id = m.category_id
         where m.id = any (coalesce(p_menu_ids, '{}'))
        union all
        select c.id, c.parent_id, c.name, up.depth + 1
          from up
          join public.categories c on c.id = up.parent_id
         where up.depth < 10
    )
    select case when exists (
        select 1 from up where up.parent_id is null and up.name in ('Groceries & Essentials', 'The Local Market')
    ) then 5000::numeric else 2000::numeric end;
$$;
grant execute on function public.delivery_fee_for(uuid[]) to anon, authenticated;

-- Admin: the rider has collected the balance of a pay-on-delivery order.
create or replace function public.admin_mark_balance_collected(p_order_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_at timestamptz;
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    update public.orders
       set balance_collected_at = coalesce(balance_collected_at, now())
     where id = p_order_id
       and payment_method = 'pay_on_delivery'
       and payment_status = 'paid'
       and status <> 'cancelled'
    returning balance_collected_at into v_at;
    if v_at is null then
        raise exception 'Only a paid, pay-on-delivery order can have its balance collected';
    end if;
    return v_at;
end;
$$;
revoke all on function public.admin_mark_balance_collected(uuid) from public, anon;
grant execute on function public.admin_mark_balance_collected(uuid) to authenticated;

-- Revenue actually received: Paystack orders count their total once paid; pay-on-delivery
-- orders count the delivery fee once paid online, plus the balance once it's been collected.
create or replace function public.order_amount_received(o public.orders)
returns numeric
language sql
stable
set search_path = ''
as $$
    select case
        when o.payment_status <> 'paid' then 0
        when o.payment_method = 'pay_on_delivery'
            then coalesce(o.online_amount, o.delivery_fee) + case when o.balance_collected_at is not null then o.balance_due else 0 end
        else o.total
    end;
$$;

-- Dashboard numbers in one call (revenue = amount received, see above).
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
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
        'products',            (select count(*) from public.menu)
    );
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;
-- ---------------------------------------------------------------------------
-- Event requests (new 4-step form): time of day, indoor/outdoor and what the
-- customer needs. "Customised Event" under Catering › Events lets customers name
-- their own event (saved in event_type).
-- ---------------------------------------------------------------------------
alter table public.service_requests add column if not exists event_time text;
alter table public.service_requests add column if not exists venue_type text;
alter table public.service_requests add column if not exists needs      text[] not null default '{}';
alter table public.service_requests drop constraint if exists service_requests_event_time_check;
alter table public.service_requests add constraint service_requests_event_time_check
    check (event_time is null or event_time in ('Morning', 'Afternoon', 'Evening'));
alter table public.service_requests drop constraint if exists service_requests_venue_type_check;
alter table public.service_requests add constraint service_requests_venue_type_check
    check (venue_type is null or venue_type in ('Indoor', 'Outdoor', 'Not sure yet'));
alter table public.service_requests drop constraint if exists service_requests_needs_check;
alter table public.service_requests add constraint service_requests_needs_check
    check (cardinality(needs) <= 12);

insert into public.categories (name, description, parent_id, emoji, sort_order, kind)
select 'Customised Event', 'Something else? Tell us what you are planning.', e.id, '✨', 7, 'service'
  from public.categories e join public.categories c on c.id = e.parent_id
 where e.name = 'Events' and c.name = 'Catering' and c.parent_id is null
on conflict on constraint categories_parent_name_key do nothing;
-- ---------------------------------------------------------------------------
-- Home order (client, 8 Nov 2026): Food, Drinks, Cakes, Health & Wellness,
-- Groceries, Local Market, Catering (events) last.
-- ---------------------------------------------------------------------------
update public.categories c set sort_order = v.ord
  from (values ('Food', 1), ('Drinks & Refreshments', 2), ('Cakes & Celebrations', 3), ('Health & Wellness', 4),
               ('Groceries & Essentials', 5), ('The Local Market', 6), ('Catering', 7)) v(name, ord)
 where c.parent_id is null and c.name = v.name and c.sort_order is distinct from v.ord;

-- Christmas pre-order campaign progress (app Home slide + pre-order page):
-- paid orders since the campaign started. Returns only a number.
create or replace function public.campaign_progress()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
    select count(*)::integer from public.orders
     where payment_status = 'paid'
       and coalesce(paid_at, created_at) >= timestamptz '2026-11-01 00:00:00+01'
       and coalesce(paid_at, created_at) <  timestamptz '2026-12-16 00:00:00+01';
$$;
grant execute on function public.campaign_progress() to anon, authenticated;
-- ---------------------------------------------------------------------------
-- Website content the admin can edit (Admin › Website). Key 'website_hero':
-- { tag, title, highlight, subtitle, photos: [{ url, caption } x3] }
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
    key        text primary key,
    value      jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "Site settings are public" on public.site_settings;
create policy "Site settings are public" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "Admins manage site settings" on public.site_settings;
create policy "Admins manage site settings" on public.site_settings for all to authenticated
    using ((select public.is_admin())) with check ((select public.is_admin()));
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Optional per-product delivery fee (e.g. a test product). Used only when EVERY
-- item in the order has one; otherwise the category rule (2000 / 5000) applies.
-- ---------------------------------------------------------------------------
alter table public.menu add column if not exists delivery_fee numeric check (delivery_fee is null or delivery_fee >= 0);

create or replace function public.delivery_fee_for(p_menu_ids uuid[])
returns numeric language sql stable set search_path to '' as $$
    with recursive items as (
        select m.id, m.category_id, m.delivery_fee from public.menu m where m.id = any (coalesce(p_menu_ids, '{}'))
    ), up as (
        select c.id, c.parent_id, c.name, 1 as depth
          from items m join public.categories c on c.id = m.category_id
        union all
        select c.id, c.parent_id, c.name, up.depth + 1
          from up join public.categories c on c.id = up.parent_id
         where up.depth < 10
    )
    select case
        when exists (select 1 from items) and not exists (select 1 from items where delivery_fee is null)
            then (select max(delivery_fee) from items)
        when exists (select 1 from up where up.parent_id is null and up.name in ('Groceries & Essentials', 'The Local Market'))
            then 5000::numeric
        else 2000::numeric
    end;
$$;
