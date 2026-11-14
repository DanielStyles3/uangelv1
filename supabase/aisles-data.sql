-- Aisle layout for every category (2026-11-14): groups (the buttons under a tab in the app) and
-- sections (headings), with each existing product moved into its group. Safe to run more than once.
-- Small subcategories with 2-3 similar products stay a simple grid.

create or replace function pg_temp.cat(p_parent uuid, p_name text, p_sort int) returns uuid language plpgsql as $$
declare v uuid;
begin
    if p_parent is null then raise exception 'Parent missing for %', p_name; end if;
    select id into v from public.categories where parent_id = p_parent and name = p_name;
    if v is null then
        insert into public.categories (name, parent_id, kind, sort_order) values (p_name, p_parent, 'products', p_sort) returning id into v;
    else
        update public.categories set sort_order = p_sort where id = v;
    end if;
    return v;
end $$;

-- A subcategory by its path, e.g. ('Groceries & Essentials', 'Milk, Dairy & Eggs').
create or replace function pg_temp.sub(p_main text, p_sub text) returns uuid language sql as $$
    select s.id from public.categories s join public.categories m on m.id = s.parent_id
     where m.parent_id is null and m.name = p_main and s.name = p_sub limit 1
$$;

-- Move products (name starts with p_prefix) that currently sit in p_from into p_to.
create or replace function pg_temp.mv(p_from uuid, p_prefix text, p_to uuid) returns void language sql as $$
    update public.menu set category_id = p_to
     where not is_campaign and name ilike p_prefix || '%'
       and category_id in (select p_from union all select id from public.categories where parent_id = p_from)
$$;

do $$
declare
    s uuid; g uuid; x uuid;
begin
    ---------------------------------------------------------------- Cakes & Celebrations
    s := pg_temp.sub('Cakes & Celebrations', 'Cup Cakes');
    perform pg_temp.mv(s, 'Chocolate Cupcakes', pg_temp.cat(s, 'Boxes of 12', 1));
    perform pg_temp.mv(s, 'Red Velvet Cupcakes', pg_temp.cat(s, 'Boxes of 12', 1));
    perform pg_temp.mv(s, 'Vanilla Cupcakes', pg_temp.cat(s, 'Boxes of 12', 1));
    perform pg_temp.mv(s, 'Assorted Buttercream Cupcakes', pg_temp.cat(s, 'Boxes of 6', 2));
    perform pg_temp.mv(s, 'Cake & Pastry Treat Gift Box', pg_temp.cat(s, 'Gift Boxes', 3));

    ---------------------------------------------------------------- Drinks & Refreshments
    s := pg_temp.sub('Drinks & Refreshments', 'Soft Drinks');
    perform pg_temp.mv(s, 'Cola Soft Drink', pg_temp.cat(s, 'Cola & Malt', 1));
    perform pg_temp.mv(s, 'Malt Drink', pg_temp.cat(s, 'Cola & Malt', 1));
    perform pg_temp.mv(s, 'Kunu & Zobo Party Pack', pg_temp.cat(s, 'Party Packs', 2));
    perform pg_temp.mv(s, 'Party Drinks Package', pg_temp.cat(s, 'Party Packs', 2));

    ---------------------------------------------------------------- Groceries & Essentials
    -- Fruits & Vegetables: Fruits (Bananas, Citrus, Exotic Fruits, Local Fruits) / Vegetables / Herbs
    s := pg_temp.sub('Groceries & Essentials', 'Fruits & Vegetables');
    g := pg_temp.cat(s, 'Fruits', 1);
    perform pg_temp.cat(g, 'Bananas', 1);
    perform pg_temp.cat(g, 'Citrus', 2);
    perform pg_temp.mv(s, 'Pineapple', pg_temp.cat(g, 'Exotic Fruits', 3));
    perform pg_temp.mv(s, 'Agbalumo', pg_temp.cat(g, 'Local Fruits', 4));
    perform pg_temp.cat(s, 'Vegetables', 2);
    perform pg_temp.cat(s, 'Herbs', 3);

    s := pg_temp.sub('Groceries & Essentials', 'Meat, Poultry & Fish');
    perform pg_temp.mv(s, 'Whole Fresh Chicken', pg_temp.cat(s, 'Poultry', 1));
    perform pg_temp.cat(s, 'Meat', 2);
    perform pg_temp.cat(s, 'Fish & Seafood', 3);

    s := pg_temp.sub('Groceries & Essentials', 'Milk, Dairy & Eggs');
    perform pg_temp.mv(s, 'Evaporated Milk', pg_temp.cat(s, 'Milk', 1));
    perform pg_temp.mv(s, 'Plain Yoghurt', pg_temp.cat(s, 'Yoghurt', 2));
    perform pg_temp.cat(s, 'Cheese & Butter', 3);
    perform pg_temp.cat(s, 'Eggs', 4);

    s := pg_temp.sub('Groceries & Essentials', 'Breakfast & Provisions');
    perform pg_temp.mv(s, 'Cocoa Beverage', pg_temp.cat(s, 'Hot Drinks', 1));
    perform pg_temp.mv(s, 'Instant Coffee', pg_temp.cat(s, 'Hot Drinks', 1));
    perform pg_temp.mv(s, 'Natural Honeycomb', pg_temp.cat(s, 'Honey & Spreads', 2));
    perform pg_temp.mv(s, 'Pure Honey', pg_temp.cat(s, 'Honey & Spreads', 2));
    perform pg_temp.cat(s, 'Cereals & Oats', 3);

    s := pg_temp.sub('Groceries & Essentials', 'Bread & Pastries');
    perform pg_temp.mv(s, 'Sliced Bread', pg_temp.cat(s, 'Bread', 1));
    perform pg_temp.mv(s, 'Meat Pie', pg_temp.cat(s, 'Pastries', 2));

    s := pg_temp.sub('Groceries & Essentials', 'Foodstuff & Ingredients');
    perform pg_temp.mv(s, 'Seasoning Cubes', pg_temp.cat(s, 'Seasoning & Spices', 1));
    perform pg_temp.mv(s, 'Tomato Paste', pg_temp.cat(s, 'Tins & Pastes', 2));

    s := pg_temp.sub('Groceries & Essentials', 'Salty & Sweet Snacks');
    perform pg_temp.mv(s, 'Cream Crackers', pg_temp.cat(s, 'Biscuits & Crackers', 1));
    perform pg_temp.mv(s, 'Plantain Chips', pg_temp.cat(s, 'Chips & Crisps', 2));

    s := pg_temp.sub('Groceries & Essentials', 'Water, Soft Drinks, Juices & Sparkling Drink');
    perform pg_temp.mv(s, 'Bottled Table Water', pg_temp.cat(s, 'Water', 1));
    perform pg_temp.mv(s, 'Orange Fruit Juice', pg_temp.cat(s, 'Juices', 2));
    perform pg_temp.cat(s, 'Soft Drinks', 3);
    perform pg_temp.mv(s, 'Red Wine', pg_temp.cat(s, 'Wines', 4));
    perform pg_temp.mv(s, 'White Wine', pg_temp.cat(s, 'Wines', 4));

    ---------------------------------------------------------------- The Local Market
    -- Fruits & Vegetables › Vegetables gets sections.
    s := pg_temp.sub('The Local Market', 'Fruits & Vegetables');
    g := (select id from public.categories where parent_id = s and name = 'Vegetables');
    if g is not null then
        perform pg_temp.mv(g, 'Tatashe', pg_temp.cat(g, 'Peppers & Tomatoes', 1));
        perform pg_temp.mv(g, 'Ugwu', pg_temp.cat(g, 'Leafy Greens', 2));
    end if;

    -- Names from the brief.
    update public.categories set name = 'Meat, Poultry & Fish'
     where name = 'Meat, Fish & Seafood' and parent_id = (select id from public.categories where parent_id is null and name = 'The Local Market');
    update public.categories set name = 'Dairy & Eggs'
     where name = 'Eggs & Dairy' and parent_id = (select id from public.categories where parent_id is null and name = 'The Local Market');

    s := pg_temp.sub('The Local Market', 'Meat, Poultry & Fish');
    perform pg_temp.mv(s, 'Goat Meat', pg_temp.cat(s, 'Meat', 1));
    perform pg_temp.mv(s, 'Ponmo', pg_temp.cat(s, 'Meat', 1));
    perform pg_temp.cat(s, 'Poultry', 2);
    perform pg_temp.mv(s, 'Fresh Tilapia', pg_temp.cat(s, 'Fresh Fish', 3));
    perform pg_temp.mv(s, 'Stockfish', pg_temp.cat(s, 'Dried Fish', 4));

    s := pg_temp.sub('The Local Market', 'Dairy & Eggs');
    perform pg_temp.mv(s, 'Fresh Eggs', pg_temp.cat(s, 'Eggs', 1));
    perform pg_temp.mv(s, 'Fura da Nono', pg_temp.cat(s, 'Dairy', 2));

    s := pg_temp.sub('The Local Market', 'Food');
    perform pg_temp.mv(s, 'Fresh Yam', pg_temp.cat(s, 'Tubers', 1));
    perform pg_temp.mv(s, 'Unripe Plantain', pg_temp.cat(s, 'Plantain', 2));

    s := pg_temp.sub('The Local Market', 'Measurable Foods');
    perform pg_temp.mv(s, 'Ijebu Garri', pg_temp.cat(s, 'Garri', 1));
    perform pg_temp.mv(s, 'Ofada Rice', pg_temp.cat(s, 'Rice', 2));
    perform pg_temp.cat(s, 'Beans', 3);

    s := pg_temp.sub('The Local Market', 'Condiments');
    perform pg_temp.mv(s, 'Crayfish', pg_temp.cat(s, 'Crayfish', 1));
    perform pg_temp.mv(s, 'Dried Pepper', pg_temp.cat(s, 'Pepper', 2));

    s := pg_temp.sub('The Local Market', 'Cooking Oils');
    perform pg_temp.mv(s, 'Palm Oil', pg_temp.cat(s, 'Palm Oil', 1));
    perform pg_temp.mv(s, 'Groundnut Oil', pg_temp.cat(s, 'Groundnut Oil', 2));

    s := pg_temp.sub('The Local Market', 'Frozen');
    perform pg_temp.mv(s, 'Frozen Chicken', pg_temp.cat(s, 'Poultry', 1));
    perform pg_temp.mv(s, 'Frozen Mackerel', pg_temp.cat(s, 'Fish', 2));
end $$;
