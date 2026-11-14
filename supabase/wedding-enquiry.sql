-- Wedding cakes are made to order (2026-11-14): no cart, customers send an enquiry.
-- A product is enquiry-only when its category, or any category above it, is marked "Enquiry only",
-- OR its name contains "wedding" (wherever it's filed). Safe to run more than once.

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
        or exists (select 1 from public.menu m where m.id = p_menu and not m.is_campaign and m.name ilike '%wedding%')
$$;

create or replace function public.block_enquiry_only_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
    if public.is_enquiry_only(new.menu_id) then
        raise exception '% is made to order. Please send us an enquiry from the product page and we''ll design it with you.',
            (select m.name from public.menu m where m.id = new.menu_id);
    end if;
    return new;
end;
$function$;
