-- "Price on request" switch per product (2026-11-14). The admin turns it on for a product:
-- the app hides its price everywhere and customers send an enquiry instead of paying.
-- It replaces the hard-coded "wedding in the name" rule; wedding cakes start with it on.
-- Safe to run more than once.

alter table public.menu add column if not exists hide_price boolean not null default false;

update public.menu set hide_price = true
 where name ilike '%wedding%' and not is_campaign and not hide_price;

-- Enquiry only: the product's switch, or its category (or one above it) marked "Enquiry only".
create or replace function public.is_enquiry_only(p_menu uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
    with recursive up as (
        select c.id, c.parent_id, c.enquiry_only, 1 as depth
          from public.menu m join public.categories c on c.id = m.category_id where m.id = p_menu
        union all
        select c.id, c.parent_id, c.enquiry_only, up.depth + 1
          from up join public.categories c on c.id = up.parent_id where up.depth < 10
    )
    select exists (select 1 from up where up.enquiry_only)
        or exists (select 1 from public.menu m where m.id = p_menu and m.hide_price)
$$;
