-- "Customise your cake": sets up options on every Birthday, Special Anniversary and Wedding cake.
-- Run once after schema.sql. Safe to re-run: products that already have options are skipped.
--
-- • Removes the two standalone "Custom …" sample cakes (every cake is customisable now).
-- • Birthday / anniversary cakes: the size moves out of the name into a Size option, and the
--   price becomes the 6-inch price (e.g. "Chocolate Birthday Cake – 10 inch" ₦45,000 becomes
--   "Chocolate Birthday Cake" from ₦30,000, and choosing 10 inch brings it back to ₦45,000).
-- • Wedding cakes keep their tiers in the name (each product is a tier size already).
-- Everything can be changed later in Admin › Products › Customer options.

do $$
declare
    v_cakes uuid;
    p record;
    v_kind text;          -- 'birthday' | 'anniversary' | 'wedding'
    v_size int;
    v_delta numeric;
    g uuid;
    v_sort int;
begin
    select id into v_cakes from public.categories where parent_id is null and name = 'Cakes & Celebrations';
    if v_cakes is null then raise exception 'Cakes & Celebrations category not found'; end if;

    delete from public.menu where name in ('Custom Gold Luxury Cake – 2 Tiers', 'Custom Colour Theme Cake – 8 inch');

    for p in
        select m.id, m.name, m.price, s.name as sub
          from public.menu m join public.categories s on s.id = m.category_id
         where s.parent_id = v_cakes and s.name in ('Birthday Cakes', 'Special Anniversary Cakes', 'Wedding Cakes')
           and not exists (select 1 from public.option_groups og where og.menu_id = m.id)
    loop
        v_kind := case p.sub when 'Birthday Cakes' then 'birthday' when 'Wedding Cakes' then 'wedding' else 'anniversary' end;
        v_sort := 0;

        -- Size (birthday / anniversary): take it out of the name, price from 6 inch
        if v_kind <> 'wedding' then
            v_size := nullif(substring(p.name from '(\d+) inch$'), '')::int;
            v_delta := case
                when v_size = 8  then case v_kind when 'birthday' then 7000 else 6000 end
                when v_size = 10 then case v_kind when 'birthday' then 15000 else 14000 end
                else 0 end;
            update public.menu
               set name = regexp_replace(name, '\s*[–-]\s*\d+ inch$', ''),
                   price = greatest(price - v_delta, 0)
             where id = p.id
               and not exists (select 1 from public.menu x where x.name = regexp_replace(p.name, '\s*[–-]\s*\d+ inch$', '') and x.id <> p.id);

            v_sort := v_sort + 1;
            insert into public.option_groups (menu_id, name, kind, required, sort_order) values (p.id, 'Size', 'single', true, v_sort) returning id into g;
            insert into public.option_values (group_id, name, price, hint, sort_order) values
              (g, '6 inch', 0, case v_kind when 'birthday' then 'serves 8–10' else 'for two' end, 1),
              (g, '8 inch', case v_kind when 'birthday' then 7000 else 6000 end, 'serves 15–20', 2),
              (g, '10 inch', case v_kind when 'birthday' then 15000 else 14000 end, 'serves 25–30', 3);
        end if;

        -- Shape
        v_sort := v_sort + 1;
        insert into public.option_groups (menu_id, name, kind, required, sort_order) values (p.id, 'Shape', 'single', false, v_sort) returning id into g;
        if v_kind = 'anniversary' then
            insert into public.option_values (group_id, name, price, sort_order) values (g, 'Round', 0, 1), (g, 'Heart', 4000, 2);
        else
            insert into public.option_values (group_id, name, price, sort_order) values
              (g, 'Round', 0, 1), (g, 'Square', case v_kind when 'wedding' then 20000 else 3000 end, 2);
        end if;

        -- Flavour (required)
        v_sort := v_sort + 1;
        insert into public.option_groups (menu_id, name, kind, required, sort_order) values (p.id, 'Flavour', 'single', true, v_sort) returning id into g;
        insert into public.option_values (group_id, name, price, sort_order) values
          (g, 'Vanilla', 0, 1), (g, 'Chocolate', 0, 2),
          (g, 'Red Velvet', case v_kind when 'wedding' then 15000 else 2500 end, 3),
          (g, 'Strawberry', case v_kind when 'wedding' then 10000 else 2000 end, 4),
          (g, 'Fruit cake', case v_kind when 'wedding' then 30000 else 4000 end, 5);

        -- Colour theme (swatches) + your own colours
        v_sort := v_sort + 1;
        insert into public.option_groups (menu_id, name, kind, required, sort_order) values (p.id, 'Colour theme', 'single', false, v_sort) returning id into g;
        insert into public.option_values (group_id, name, price, swatch, sort_order) values
          (g, 'White & gold', 0, '#F5E6B8', 1), (g, 'Pink', 0, '#F9A8C8', 2), (g, 'Blue', 0, '#93C5FD', 3),
          (g, 'Purple', 0, '#C4B5FD', 4), (g, 'Red', 0, '#F87171', 5), (g, 'Rainbow', 0, '#FBBF24', 6);
        v_sort := v_sort + 1;
        insert into public.option_groups (menu_id, name, kind, required, max_length, placeholder, sort_order)
        values (p.id, 'Your own colours', 'text', false, 60, 'e.g. navy & silver', v_sort);

        -- Message on the cake + notes for the baker
        v_sort := v_sort + 1;
        insert into public.option_groups (menu_id, name, kind, required, max_length, placeholder, sort_order)
        values (p.id, 'Message on the cake', 'text', false, 40,
                case v_kind when 'wedding' then 'e.g. Tolu & Ade, 12.12.26' when 'anniversary' then 'e.g. Happy 10th, my love' else 'e.g. Happy 10th, Tolu!' end, v_sort);
        v_sort := v_sort + 1;
        insert into public.option_groups (menu_id, name, kind, required, max_length, placeholder, sort_order)
        values (p.id, 'Notes for the baker', 'text', false, 300, 'Theme ideas, characters, anything else', v_sort);
    end loop;

    raise notice 'Cakes with options: %', (select count(distinct menu_id) from public.option_groups);
end $$;
