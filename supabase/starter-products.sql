-- One starter product for each shop subcategory that was empty after category-restructure.sql.
-- Safe to re-run (skips products that already exist). Edit prices/photos in the admin › Products.
insert into public.menu (name, description, image_url, emoji, price, rating, calories, protein, category_id)
select v.name, v.description, v.image_url, v.emoji, v.price, v.rating, null, null, s.id
  from (values
    ('Food', 'Lait Caillé', 'Sweet Lait Caillé – 500ml Bottle',
     'Chilled, lightly sweetened curdled milk, smooth and refreshing. Best served cold.',
     'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/8068d67671134d28.jpg', '🥛', 2500::numeric, 4.6::numeric),
    ('Food', 'Ready-To-Eat', 'Jollof Rice & Chicken – Plate',
     'Smoky party jollof with a piece of fried chicken and plantain, delivered hot.',
     'https://images.unsplash.com/photo-1664993101841-036f189719b6?w=800&q=80&auto=format&fit=crop', '🍛', 5500::numeric, 4.8::numeric),
    ('Food', 'Bread & Pastries', 'Butter Croissants – Pack of 4',
     'Flaky, golden butter croissants baked fresh in the morning.',
     'https://images.unsplash.com/photo-1597528662465-55ece5734101?w=800&q=80&auto=format&fit=crop', '🥐', 4500::numeric, 4.6::numeric),
    ('Groceries & Essentials', 'Meat, Poultry & Fish', 'Whole Fresh Chicken – approx. 1.5kg',
     'A whole, cleaned fresh chicken, ready for stew, pepper soup or the grill.',
     'https://images.unsplash.com/photo-1787736366662-df37f577c9fb?w=800&q=80&auto=format&fit=crop', '🍗', 9000::numeric, 4.6::numeric),
    ('Groceries & Essentials', 'Frozen & Ice Cream', 'Vanilla Ice Cream – 1 Litre Tub',
     'Creamy vanilla ice cream, kept frozen until it reaches your door.',
     'https://images.unsplash.com/photo-1648971413826-8377e3c65039?w=800&q=80&auto=format&fit=crop', '🍨', 4800::numeric, 4.5::numeric)
  ) as v(main_name, sub_name, name, description, image_url, emoji, price, rating)
  join public.categories m on m.parent_id is null and m.name = v.main_name
  join public.categories s on s.parent_id = m.id and s.name = v.sub_name
on conflict (name) do nothing;
