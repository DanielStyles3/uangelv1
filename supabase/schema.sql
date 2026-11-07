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

-- Flat delivery fee in naira. Keep in sync with DELIVERY_FEE in constants/index.ts.
create or replace function public.delivery_fee()
returns numeric
language sql
immutable
as $$ select 1500::numeric $$;

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
-- Paystack: orders are paid ONLINE immediately (no pay-on-delivery).
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
    check (payment_method in ('paystack', 'cash', 'transfer'));   -- cash/transfer kept only for old rows

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
    select id, total, payment_status, status into v_order
      from public.orders where paystack_reference = p_reference
     for update;

    if not found then
        raise exception 'Unknown payment reference';
    end if;
    if v_order.payment_status = 'paid' then
        return 'already_paid';
    end if;
    if p_amount_kobo <> round(v_order.total * 100) then
        update public.orders set payment_status = 'failed' where id = v_order.id;
        raise exception 'Amount mismatch for %', p_reference;
    end if;

    update public.orders
       set payment_status = 'paid',
           paid_at = now(),
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

-- ---------------------------------------------------------------------------
-- Admin role (web admin dashboard: website/admin/)
-- Admins are profiles with is_admin = true. Customers can never set it on
-- themselves: column-level grants exclude is_admin from what they may write.
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists is_admin boolean not null default false;

revoke insert, update on public.profiles from authenticated, anon;
grant insert (id, name, email, avatar, phone, address, city, state) on public.profiles to authenticated;
grant update (id, name, email, avatar, phone, address, city, state) on public.profiles to authenticated;

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

-- Customers with their order count and amount spent (paid orders).
create or replace function public.admin_customers()
returns table (id uuid, name text, email text, phone text, city text, state text, is_admin boolean,
               created_at timestamptz, orders_count bigint, total_spent numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    return query
        select p.id, p.name, p.email, p.phone, p.city, p.state, p.is_admin, p.created_at,
               count(o.id), coalesce(sum(o.total) filter (where o.payment_status = 'paid'), 0)
          from public.profiles p
          left join public.orders o on o.user_id = p.id
         group by p.id
         order by p.created_at desc;
end;
$$;
revoke all on function public.admin_customers() from public, anon;
grant execute on function public.admin_customers() to authenticated;

-- Grant / remove admin rights by email (keeps at least one admin).
create or replace function public.admin_set_admin(p_email text, p_make_admin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.is_admin() then raise exception 'Admins only'; end if;
    if not p_make_admin and (select count(*) from public.profiles where is_admin) <= 1
       and exists (select 1 from public.profiles where lower(email) = lower(btrim(p_email)) and is_admin) then
        raise exception 'There must be at least one admin';
    end if;
    update public.profiles set is_admin = p_make_admin where lower(email) = lower(btrim(p_email));
    if not found then raise exception 'No account with that email. They must sign up in the app first.'; end if;
end;
$$;
revoke all on function public.admin_set_admin(text, boolean) from public, anon;
grant execute on function public.admin_set_admin(text, boolean) to authenticated;

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
