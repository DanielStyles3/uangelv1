-- =============================================================================
-- 1) Catering / events for several days (a week, a month, a year…): optional end date.
-- 2) "Enquiry only" categories (Wedding Cakes): no online ordering. Customers send an
--    enquiry, the design is agreed on WhatsApp, they pay by bank transfer, then we bake.
-- 3) Cakes & Celebrations: "Delivery varies" (cupcakes same day; birthday, anniversary
--    and wedding cakes vary).
-- =============================================================================

-- 1) Date ranges
alter table public.service_requests add column if not exists end_date date;
alter table public.service_requests drop constraint if exists service_requests_end_after_start;
alter table public.service_requests add constraint service_requests_end_after_start
    check (end_date is null or end_date >= event_date);

-- 2) Enquiry-only categories
alter table public.categories add column if not exists enquiry_only boolean not null default false;
comment on column public.categories.enquiry_only is
    'Products here can''t be ordered online: the app shows "Send an enquiry" / WhatsApp instead of Add to cart.';
update public.categories set enquiry_only = true where name = 'Wedding Cakes';

-- Safety net: an enquiry-only product can never be ordered (even from an old app version).
create or replace function public.block_enquiry_only_items()
returns trigger language plpgsql security definer set search_path to '' as $$
declare v_name text;
begin
    select m.name into v_name
      from public.menu m join public.categories c on c.id = m.category_id
     where m.id = new.menu_id and c.enquiry_only;
    if found then
        raise exception '% is made to order. Please send us an enquiry from the product page and we''ll design it with you.', v_name;
    end if;
    return new;
end;
$$;
drop trigger if exists order_items_block_enquiry_only on public.order_items;
create trigger order_items_block_enquiry_only before insert on public.order_items
    for each row execute function public.block_enquiry_only_items();

-- 3) Delivery note on the cakes category
update public.categories set delivery_note = 'Delivery varies'
 where name = 'Cakes & Celebrations' and parent_id is null;
