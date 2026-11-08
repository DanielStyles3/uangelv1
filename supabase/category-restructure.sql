-- Category structure requested by the client (8 Nov 2026). Run ONCE in the Supabase
-- SQL Editor, after schema.sql. Safe to re-run: every step checks before it changes.
--
-- Home order: Food, Groceries, Local Market, Cakes, Drinks, Health & Wellness, Catering.
-- "Events & Celebrations" is no longer a main category: it becomes "Events" inside
-- Catering, with the six event types under it (Catering › Events › Wedding Parties).
--
-- Products in subcategories that no longer exist are MOVED to the closest new one.
-- Only the two sample pet-food products are deleted (no matching category).
-- Past orders and requests keep their details (they store snapshots).

do $$
declare
    v_food uuid; v_groc uuid; v_mkt uuid; v_cake uuid; v_drink uuid; v_health uuid; v_cater uuid; v_events_main uuid; v_events uuid;
begin
    -- ---------- Main categories ----------
    insert into public.categories (name, description, parent_id, emoji, color, sort_order, kind)
    values ('Food', 'Ready-to-eat meals, lait caillé, bread and pastries.', null, '🍲', '#B45309', 1, 'products')
    on conflict on constraint categories_parent_name_key do nothing;

    select id into v_food   from public.categories where parent_id is null and name = 'Food';
    select id into v_groc   from public.categories where parent_id is null and name = 'Groceries & Essentials';
    select id into v_mkt    from public.categories where parent_id is null and name = 'The Local Market';
    select id into v_cake   from public.categories where parent_id is null and name = 'Cakes & Celebrations';
    select id into v_drink  from public.categories where parent_id is null and name = 'Drinks & Refreshments';
    select id into v_health from public.categories where parent_id is null and name = 'Health & Wellness';
    select id into v_cater  from public.categories where parent_id is null and name = 'Catering';
    select id into v_events_main from public.categories where parent_id is null and name = 'Events & Celebrations';

    if v_groc is null or v_mkt is null or v_cake is null or v_drink is null or v_health is null or v_cater is null then
        raise exception 'A main category is missing or was renamed. Check the Categories page in the admin.';
    end if;

    update public.categories set sort_order = 1 where id = v_food;
    update public.categories set sort_order = 2 where id = v_groc;
    update public.categories set sort_order = 3 where id = v_mkt;
    update public.categories set sort_order = 4 where id = v_cake;
    update public.categories set sort_order = 5 where id = v_drink;
    update public.categories set sort_order = 6 where id = v_health;
    update public.categories set sort_order = 7 where id = v_cater;

    -- ---------- Helpers as temp tables ----------
    -- (main, old name, new name): rename if the old one exists and the new one doesn't
    create temp table _ren (main uuid, old text, new text) on commit drop;
    -- (main, from name, to name): move products from one subcategory to another, then delete "from"
    create temp table _merge (main uuid, src text, dst text) on commit drop;
    -- (main, name, sort): the final list and order
    create temp table _final (main uuid, name text, sort int, emoji text) on commit drop;

    insert into _ren values
      -- Groceries
      (v_groc, 'Fruits & Fresh Foods', 'Fruits & Vegetables'),
      (v_groc, 'Dairy & Eggs', 'Milk, Dairy & Eggs'),
      (v_groc, 'Beverages', 'Breakfast & Provisions'),
      (v_groc, 'Bakery', 'Bread & Pastries'),
      (v_groc, 'Biscuits & Snacks', 'Salty & Sweet Snacks'),
      (v_groc, 'Condiments, Spices & Ingredients', 'Foods & Ingredients'),
      (v_groc, 'Drinks & Water', 'Water, Soft Drinks, Juices & Wines'),
      -- Local Market
      (v_mkt, 'Fresh Food', 'Food'),
      (v_mkt, 'Condiments & Spices', 'Condiments'),
      (v_mkt, 'Frozen Foods', 'Frozen'),
      (v_mkt, 'Meat', 'Meat, Fish & Seafood'),
      (v_mkt, 'Fresh Vegetables', 'Vegetables'),
      (v_mkt, 'Measurable Foods (Rice, Beans, Garri, etc.)', 'Measurable Foods'),
      (v_mkt, 'Roasted Foods', 'Roasted Food'),
      -- Cakes
      (v_cake, 'Cupcakes', 'Cup Cakes'),
      (v_cake, 'Cake in a Can', 'Cake In A Can'),
      (v_cake, 'Anniversary Cakes', 'Special Anniversary Cakes'),
      -- Drinks
      (v_drink, 'Fresh Juices', 'Fresh Juice'),
      (v_drink, 'Bottled Water', 'Water'),
      -- Health
      (v_health, 'Gluten-Free Products', 'Gluten Free'),
      (v_health, 'Sugar-Free Products', 'Sugar Free'),
      (v_health, 'Fitness Nutrition', 'Fitness');

    insert into _merge values
      (v_groc, 'Honey', 'Breakfast & Provisions'),
      (v_groc, 'Wines', 'Water, Soft Drinks, Juices & Wines'),
      (v_mkt, 'Fish & Seafood', 'Meat, Fish & Seafood'),
      (v_cake, 'Custom Cakes', 'Birthday Cakes'),
      (v_cake, 'Cake Gift Boxes', 'Cup Cakes'),
      (v_drink, 'Drink Packages', 'Soft Drinks');

    insert into _final values
      (v_food, 'Lait Caillé', 1, '🥛'), (v_food, 'Ready-To-Eat', 2, '🍛'), (v_food, 'Bread & Pastries', 3, '🥐'),
      (v_groc, 'Fruits & Vegetables', 1, '🍍'), (v_groc, 'Meat, Poultry & Fish', 2, '🍗'), (v_groc, 'Milk, Dairy & Eggs', 3, '🥛'),
      (v_groc, 'Frozen & Ice Cream', 4, '🍨'), (v_groc, 'Breakfast & Provisions', 5, '☕'), (v_groc, 'Bread & Pastries', 6, '🍞'),
      (v_groc, 'Salty & Sweet Snacks', 7, '🍪'), (v_groc, 'Foods & Ingredients', 8, '🧂'), (v_groc, 'Water, Soft Drinks, Juices & Wines', 9, '🧃'),
      (v_mkt, 'Food', 1, '🍠'), (v_mkt, 'Condiments', 2, '🌶️'), (v_mkt, 'Frozen', 3, '🧊'), (v_mkt, 'Meat, Fish & Seafood', 4, '🥩'),
      (v_mkt, 'Eggs & Dairy', 5, '🥚'), (v_mkt, 'Vegetables', 6, '🥬'), (v_mkt, 'Cooking Oils', 7, '🫗'), (v_mkt, 'Measurable Foods', 8, '🌾'),
      (v_mkt, 'Roasted Food', 9, '🔥'), (v_mkt, 'Water', 10, '💧'),
      (v_cake, 'Cup Cakes', 1, '🧁'), (v_cake, 'Cake In A Can', 2, '🫙'), (v_cake, 'Birthday Cakes', 3, '🎂'),
      (v_cake, 'Special Anniversary Cakes', 4, '💝'), (v_cake, 'Wedding Cakes', 5, '💒'),
      (v_drink, 'Fresh Juice', 1, '🍊'), (v_drink, 'Mocktails', 2, '🍹'), (v_drink, 'Smoothies', 3, '🍓'),
      (v_drink, 'Soft Drinks', 4, '🥫'), (v_drink, 'Wines', 5, '🍷'), (v_drink, 'Water', 6, '💧'),
      (v_health, 'Whole Foods', 1, '🫘'), (v_health, 'Herbal Drinks', 2, '🌺'), (v_health, 'Teas', 3, '🍵'),
      (v_health, 'Supplements & Daily Wellness', 4, '💊'), (v_health, 'Healthy Bites', 5, '🥜'), (v_health, 'Organic Oils', 6, '🫒'),
      (v_health, 'Gluten Free', 7, '🌾'), (v_health, 'Sugar Free', 8, '🥄'), (v_health, 'Fitness', 9, '💪'),
      (v_cater, 'Corporate Catering', 1, '💼'), (v_cater, 'Food Stands', 2, '🍢'), (v_cater, 'Events', 3, '🎉');

    -- Renames
    update public.categories c set name = r.new
      from _ren r
     where c.parent_id = r.main and c.name = r.old
       and not exists (select 1 from public.categories x where x.parent_id = r.main and x.name = r.new);

    -- Create any final subcategory that doesn't exist yet
    insert into public.categories (name, parent_id, emoji, sort_order, kind)
    select f.name, f.main, f.emoji, f.sort, m.kind
      from _final f join public.categories m on m.id = f.main
     where not exists (select 1 from public.categories x where x.parent_id = f.main and x.name = f.name);

    -- Merges: move products, then remove the old subcategory
    update public.menu p set category_id = d.id
      from _merge g
      join public.categories s on s.parent_id = g.main and s.name = g.src
      join public.categories d on d.parent_id = g.main and d.name = g.dst
     where p.category_id = s.id;
    delete from public.categories c using _merge g where c.parent_id = g.main and c.name = g.src;

    -- Pet food: no matching category any more (sample products only)
    delete from public.menu where category_id in (select id from public.categories where parent_id = v_groc and name = 'Pet Food');
    delete from public.categories where parent_id = v_groc and name = 'Pet Food';

    -- Final order
    update public.categories c set sort_order = f.sort from _final f where c.parent_id = f.main and c.name = f.name;

    -- ---------- Catering › Events › event types ----------
    select id into v_events from public.categories where parent_id = v_cater and name = 'Events';
    update public.categories set kind = 'service', description = coalesce(description, 'Birthdays, weddings, church and business events, planned for you.')
     where id = v_events;

    -- Move the event types from the old "Events & Celebrations" main into Catering › Events
    if v_events_main is not null then
        update public.categories set name = 'Business Gathering'
         where parent_id = v_events_main and name = 'Business Gatherings'
           and not exists (select 1 from public.categories x where x.parent_id = v_events_main and x.name = 'Business Gathering');
        update public.categories c set parent_id = v_events, kind = 'service'
         where c.parent_id = v_events_main
           and c.name in ('Birthday Parties', 'House Parties', 'Wedding Parties', 'Business Gathering', 'Church Events', 'Feasts')
           and not exists (select 1 from public.categories x where x.parent_id = v_events and x.name = c.name);
        -- Keep the old main's photo for "Events" if it has none
        update public.categories e set image_url = m.image_url from public.categories m
         where e.id = v_events and e.image_url is null and m.id = v_events_main;
        delete from public.categories where id = v_events_main;   -- also removes "Special Occasions"
    end if;

    insert into public.categories (name, parent_id, emoji, sort_order, kind)
    select v.name, v_events, v.emoji, 0, 'service'
      from (values ('Birthday Parties', '🥳'), ('House Parties', '🏠'), ('Wedding Parties', '💍'),
                   ('Business Gathering', '🤝'), ('Church Events', '⛪'), ('Feasts', '🍗')) v(name, emoji)
     where not exists (select 1 from public.categories x where x.parent_id = v_events and x.name = v.name);

    update public.categories c set sort_order = v.sort
      from (values ('Birthday Parties', 1), ('House Parties', 2), ('Wedding Parties', 3),
                   ('Business Gathering', 4), ('Church Events', 5), ('Feasts', 6)) v(name, sort)
     where c.parent_id = v_events and c.name = v.name;

    -- Catering subcategories the client didn't list (request forms keep their snapshots)
    delete from public.categories
     where parent_id = v_cater and name not in ('Corporate Catering', 'Food Stands', 'Events');

    -- Photos for the new categories (only where none is set yet). Credits: supabase/IMAGE_CREDITS.md
    update public.categories c set image_url = v.url
      from (values
        (v_food, null::text, 'https://images.unsplash.com/photo-1763048443535-1243379234e2?w=1200&q=80&auto=format&fit=crop'),
        (v_food, 'Lait Caillé', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Thiakry_2013.jpg/960px-Thiakry_2013.jpg'),
        (v_food, 'Ready-To-Eat', 'https://images.unsplash.com/photo-1664993101841-036f189719b6?w=800&q=80&auto=format&fit=crop'),
        (v_food, 'Bread & Pastries', 'https://images.unsplash.com/photo-1597528662465-55ece5734101?w=800&q=80&auto=format&fit=crop'),
        (v_groc, 'Bread & Pastries', 'https://images.unsplash.com/photo-1597528662465-55ece5734101?w=800&q=80&auto=format&fit=crop'),
        (v_groc, 'Meat, Poultry & Fish', 'https://images.unsplash.com/photo-1787736366662-df37f577c9fb?w=800&q=80&auto=format&fit=crop'),
        (v_groc, 'Frozen & Ice Cream', 'https://images.unsplash.com/photo-1648971413826-8377e3c65039?w=800&q=80&auto=format&fit=crop'),
        (v_cater, 'Events', 'https://images.unsplash.com/photo-1765946025847-b2821cc25995?w=800&q=80&auto=format&fit=crop')
      ) as v(main, name, url)
     where c.image_url is null
       and ((v.name is null and c.id = v.main) or (c.parent_id = v.main and c.name = v.name));

    -- Any other leftover subcategory not in the client's list: report it, don't delete it
    raise notice 'Left in place (not in the client list): %', (
        select coalesce(string_agg(m.name || ' › ' || c.name, ', '), 'none')
          from public.categories c join public.categories m on m.id = c.parent_id
         where m.parent_id is null and m.id <> v_cater
           and not exists (select 1 from _final f where f.main = m.id and f.name = c.name));
end $$;
