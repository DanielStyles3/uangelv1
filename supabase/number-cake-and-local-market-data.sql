-- Data changes from Mr Ecclesia's brief (2026-11-14). Safe to run more than once.
do $$
declare
    v_lm uuid; v_fv uuid; v_fruits uuid; v_cake uuid; v_g uuid;
begin
    -- 1) The Local Market › Fruits & Vegetables › Fruits (Bananas, Citrus, Exotic Fruits) / Vegetables / Herbs
    select id into v_lm from public.categories where parent_id is null and name = 'The Local Market';
    if v_lm is not null then
        select id into v_fv from public.categories where parent_id = v_lm and name = 'Fruits & Vegetables';
        if v_fv is null then
            insert into public.categories (name, parent_id, kind, sort_order) values ('Fruits & Vegetables', v_lm, 'products', 0) returning id into v_fv;
        end if;
        select id into v_fruits from public.categories where parent_id = v_fv and name = 'Fruits';
        if v_fruits is null then
            insert into public.categories (name, parent_id, kind, sort_order) values ('Fruits', v_fv, 'products', 1) returning id into v_fruits;
        end if;
        -- The existing Vegetables (with its products) becomes a group inside Fruits & Vegetables.
        update public.categories set parent_id = v_fv, sort_order = 2 where parent_id = v_lm and name = 'Vegetables';
        if not exists (select 1 from public.categories where parent_id = v_fv and name = 'Herbs') then
            insert into public.categories (name, parent_id, kind, sort_order) values ('Herbs', v_fv, 'products', 3);
        end if;
        if not exists (select 1 from public.categories where parent_id = v_fruits and name = 'Bananas') then
            insert into public.categories (name, parent_id, kind, sort_order) values ('Bananas', v_fruits, 'products', 1);
        end if;
        if not exists (select 1 from public.categories where parent_id = v_fruits and name = 'Citrus') then
            insert into public.categories (name, parent_id, kind, sort_order) values ('Citrus', v_fruits, 'products', 2);
        end if;
        if not exists (select 1 from public.categories where parent_id = v_fruits and name = 'Exotic Fruits') then
            insert into public.categories (name, parent_id, kind, sort_order) values ('Exotic Fruits', v_fruits, 'products', 3);
        end if;
    end if;

    -- 2) Number Birthday Cake: renamed, with a required "number on the cake" question priced by digits
    --    (prices start at 0; set them in Admin › Products › Sizes & options).
    select id into v_cake from public.menu where name ilike 'kid%number birthday cake' or name = 'Number Birthday Cake' limit 1;
    if v_cake is not null then
        update public.menu set name = 'Number Birthday Cake' where id = v_cake;
        if not exists (select 1 from public.option_groups where menu_id = v_cake and kind = 'number') then
            insert into public.option_groups (menu_id, name, kind, required, placeholder, sort_order)
            values (v_cake, 'What number would you like on your cake?', 'number', true, 'e.g. 5 or 25', 0)
            returning id into v_g;
            insert into public.option_values (group_id, name, price, sort_order) values (v_g, '1 digit', 0, 1), (v_g, '2 digits', 0, 2);
        end if;
    end if;

    -- 3) Chocolate Birthday Cake: the two empty "choose one" questions become boxes customers type in.
    update public.option_groups g
       set kind = 'text', max_length = 20,
           placeholder = case when g.name ilike 'number topper%' then 'e.g. 5' else 'e.g. 25' end
      from public.menu m
     where m.id = g.menu_id and m.name = 'Chocolate Birthday Cake' and g.kind = 'single'
       and (g.name ilike 'number topper%' or g.name ilike 'specify the number%')
       and not exists (select 1 from public.option_values v where v.group_id = g.id);
end $$;
