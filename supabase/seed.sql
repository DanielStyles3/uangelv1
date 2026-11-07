-- U Angel Foods catalog seed. GENERATED from the catalog JSON parts — edit those or the data in Supabase.
-- RESETS the catalog: deletes all categories, products, customizations and their links, then inserts
-- 7 main categories, their subcategories and 2 sample products each (none for the service
-- categories Catering / Events & Celebrations: those take requests instead). Prices in naira (NGN).
-- Photos are web URLs (Unsplash / Pexels / Wikimedia Commons, see IMAGE_CREDITS.md); `emoji` is the
-- fallback the app shows when a photo is missing or fails to load. Order history is kept (order_items
-- store their own snapshot; menu_id becomes null). Run after schema.sql in the Supabase SQL editor.

begin;

delete from public.menu_customizations;
delete from public.menu;
delete from public.customizations;
delete from public.categories;

-- Main categories (Home cards)
-- kind: 'products' (shop) or 'service' (no products; customers send a request).
insert into public.categories (name, description, parent_id, emoji, color, image_url, sort_order, delivery_note, kind) values
    ('Cakes & Celebrations', 'Freshly baked cakes and sweet treats for every milestone, made to order in Lagos.', null, '🎂', '#9D174D', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/cakes-celebrations.jpg', 1, null, 'products'),
    ('Catering', 'Full-service catering for offices, parties and events of every size across Lagos.', null, '🍽️', '#991B1B', 'https://images.unsplash.com/photo-1555244162-803834f70033?w=1200&q=80&auto=format&fit=crop', 2, null, 'service'),
    ('Events & Celebrations', 'Party and event planning packages with food, decor and service handled for you.', null, '🎉', '#6B21A8', 'https://images.unsplash.com/photo-1783314867628-220ab03cac99?w=1200&q=80&auto=format&fit=crop', 3, null, 'service'),
    ('Drinks & Refreshments', 'Chilled juices, Chapman, smoothies, soft drinks, wines and party drink bundles delivered cold.', null, '🥤', '#9A3412', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/drinks-refreshments.jpg', 4, null, 'products'),
    ('Health & Wellness', 'Wholesome Nigerian staples, herbal drinks, teas and better-for-you snacks.', null, '🌿', '#166534', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/af7d4b890ca15915.jpg', 5, null, 'products'),
    ('The Local Market', 'Fresh open-market produce, meat, fish and staples, picked and delivered to your door.', null, '🛒', '#7A4419', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/c400d6d44be0f38b.jpg', 6, 'Standard next-day delivery', 'products'),
    ('Groceries & Essentials', 'Packaged supermarket favourites and household essentials, delivered fast.', null, '🛍️', '#0F5B78', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/515f10b6338b1cd8.jpg', 7, null, 'products');

-- Subcategories
insert into public.categories (name, description, parent_id, emoji, image_url, sort_order, kind)
select v.name, v.description, m.id, v.emoji, v.image_url, v.sort_order, m.kind
from (values
    ('Cakes & Celebrations', 'Cupcakes', 'Soft, generously frosted cupcakes by the box.', '🧁', 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=800&q=80&auto=format&fit=crop', 1),
    ('Cakes & Celebrations', 'Cake in a Can', 'Layered cake and cream sealed in a jar – perfect for gifting or snacking.', '🫙', 'https://images.unsplash.com/photo-1590080874810-8180c3eb1016?w=800&q=80&auto=format&fit=crop', 2),
    ('Cakes & Celebrations', 'Birthday Cakes', 'Celebration cakes for little ones and grown-ups alike.', '🎂', 'https://images.unsplash.com/photo-1545696563-af8f6ec2295a?w=800&q=80&auto=format&fit=crop', 3),
    ('Cakes & Celebrations', 'Anniversary Cakes', 'Romantic cakes to toast another year together.', '💝', 'https://images.unsplash.com/photo-1712615966845-62b79e9829f6?w=800&q=80&auto=format&fit=crop', 4),
    ('Cakes & Celebrations', 'Wedding Cakes', 'Elegant tiered cakes for your big day, with tasting and delivery set-up.', '💒', 'https://images.unsplash.com/photo-1525257831700-183b9b8bf5c4?w=800&q=80&auto=format&fit=crop', 5),
    ('Cakes & Celebrations', 'Custom Cakes', 'Your theme, your colours – designed with our cake artists.', '🎨', 'https://images.unsplash.com/photo-1557308536-ee471ef2c390?w=800&q=80&auto=format&fit=crop', 6),
    ('Cakes & Celebrations', 'Cake Gift Boxes', 'Beautifully boxed cakes and treats, ready to send to someone special.', '🎁', 'https://images.unsplash.com/photo-1771016834009-bda415d14c64?w=800&q=80&auto=format&fit=crop', 7),
    ('Catering', 'Corporate Catering', 'Staff lunches, meetings and boardroom meals delivered on time.', '💼', 'https://images.unsplash.com/photo-1672826979217-7156a305acf5?w=800&q=80&auto=format&fit=crop', 1),
    ('Catering', 'Event Catering', 'Complete food service for weddings, birthdays and big celebrations.', '🥘', 'https://images.unsplash.com/photo-1773409414133-9c5d141cb4c5?w=800&q=80&auto=format&fit=crop', 2),
    ('Catering', 'Food Stands', 'Live food stations that keep guests coming back for more.', '🍢', 'https://images.unsplash.com/photo-1763256340762-f0ffc4b3ad18?w=800&q=80&auto=format&fit=crop', 3),
    ('Catering', 'Buffet Services', 'Self-serve buffets with chafing dishes, staff and full set-up.', '🫕', 'https://images.unsplash.com/photo-1770990409935-17f1ae739b21?w=800&q=80&auto=format&fit=crop', 4),
    ('Catering', 'Party Food Packages', 'Ready-packed party food delivered hot to your venue.', '🥡', 'https://images.unsplash.com/photo-1652862729869-2f4e80c1849d?w=800&q=80&auto=format&fit=crop', 5),
    ('Catering', 'Small Gathering Packages', 'Home-style catering for intimate get-togethers.', '🏡', 'https://images.unsplash.com/photo-1773912309963-f4cf04d5d962?w=800&q=80&auto=format&fit=crop', 6),
    ('Catering', 'Custom Catering Requests', 'Tell us your menu and budget – our chefs will build it for you.', '📝', 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=800&q=80&auto=format&fit=crop', 7),
    ('Events & Celebrations', 'Birthday Parties', 'Fun, stress-free birthday parties for kids and adults.', '🥳', 'https://images.unsplash.com/photo-1741969494307-55394e3e4071?w=800&q=80&auto=format&fit=crop', 1),
    ('Events & Celebrations', 'Business Gatherings', 'Launches, conferences and office parties run professionally.', '🤝', 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&q=80&auto=format&fit=crop', 2),
    ('Events & Celebrations', 'Church Events', 'Harvests, thanksgivings and church receptions catered with care.', '⛪', 'https://images.unsplash.com/photo-1759127481171-30a27de310ad?w=800&q=80&auto=format&fit=crop', 3),
    ('Events & Celebrations', 'Feasts', 'Big, generous spreads for owambes and festive family feasts.', '🍗', 'https://images.unsplash.com/photo-1539755530862-00f623c00f52?w=800&q=80&auto=format&fit=crop', 4),
    ('Events & Celebrations', 'House Parties', 'Turn your home into the party spot – food, drinks and vibes sorted.', '🏠', 'https://images.unsplash.com/photo-1764174861962-5b109301b1ad?w=800&q=80&auto=format&fit=crop', 5),
    ('Events & Celebrations', 'Wedding Parties', 'Traditional and white wedding receptions, planned end to end.', '💍', 'https://images.unsplash.com/photo-1780337092772-d85ad9dc562c?w=800&q=80&auto=format&fit=crop', 6),
    ('Events & Celebrations', 'Special Occasions', 'Baby showers, graduations and every moment worth celebrating.', '🎊', 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&q=80&auto=format&fit=crop', 7),
    ('Drinks & Refreshments', 'Fresh Juices', 'Freshly pressed fruit juices with no added sugar.', '🍊', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/fresh-juices.jpg', 1),
    ('Drinks & Refreshments', 'Mocktails', 'Alcohol-free party favourites, mixed fresh to order.', '🍹', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/0eb80b9de418f568.jpg', 2),
    ('Drinks & Refreshments', 'Smoothies', 'Thick blended fruit smoothies made with real fruit.', '🍓', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/b9823e1c795eb7ac.jpg', 3),
    ('Drinks & Refreshments', 'Soft Drinks', 'Your favourite fizzy drinks and malt in handy packs.', '🥫', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/01ee8f6af7352f05.jpg', 4),
    ('Drinks & Refreshments', 'Wines', 'Imported red and white wines for dinners and celebrations (18+ only).', '🍷', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/88a418c86dfab4f3.jpg', 5),
    ('Drinks & Refreshments', 'Bottled Water', 'Clean NAFDAC-registered table water in packs for home and office.', '💧', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/4cf8c1dfa089ba25.jpg', 6),
    ('Drinks & Refreshments', 'Drink Packages', 'Ready-made drink bundles for parties, owambe and office events.', '🎉', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/af6a2c38f886d028.jpg', 7),
    ('Health & Wellness', 'Whole Foods', 'Minimally processed grains, nuts and flours.', '🫘', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/f3900b7a1d479772.jpg', 1),
    ('Health & Wellness', 'Herbal Drinks', 'Traditional zobo and herbal shots made fresh with natural ingredients.', '🌺', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/0891c1be2755651f.jpg', 2),
    ('Health & Wellness', 'Teas', 'Soothing herbal and leaf teas for every time of day.', '🍵', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/be4a0a6e66bc69a3.jpg', 3),
    ('Health & Wellness', 'Supplements & Daily Wellness', 'Everyday vitamins and supplements to complement a balanced diet.', '💊', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/b346c172a55f2493.jpg', 4),
    ('Health & Wellness', 'Healthy Bites', 'Better-for-you snacks for work, school and the gym bag.', '🥜', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/8523bd30ac1055cd.jpg', 5),
    ('Health & Wellness', 'Organic Oils', 'Natural, cold-pressed oils for cooking and baking.', '🫒', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/61f664da28ac8796.jpg', 6),
    ('Health & Wellness', 'Gluten-Free Products', 'Grains, flours and treats made without wheat or gluten.', '🌾', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/b3eba422cb3731d6.jpg', 7),
    ('Health & Wellness', 'Sugar-Free Products', 'No-added-sugar spreads, drinks and breakfast favourites.', '🥄', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/3a10fe589b4806af.jpg', 8),
    ('Health & Wellness', 'Fitness Nutrition', 'Protein powders and bars to fuel your training.', '💪', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/2b60d6572a8ab565.jpg', 9),
    ('The Local Market', 'Fresh Food', 'Yam, plantain and everyday market staples, freshly picked.', '🍠', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/8940f5358fa68984.jpg', 1),
    ('The Local Market', 'Condiments & Spices', 'Crayfish, dried pepper and the market spices that make Nigerian soups.', '🌶️', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/8c69efc7246d7e57.jpg', 2),
    ('The Local Market', 'Frozen Foods', 'Cold-room chicken, fish and more, kept frozen until delivery.', '🧊', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/f318911312ca2121.jpg', 3),
    ('The Local Market', 'Meat', 'Fresh-cut goat, beef and ponmo from trusted market butchers.', '🥩', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/e832e359a93b906d.jpg', 4),
    ('The Local Market', 'Fish & Seafood', 'Fresh fish, prawns and stockfish for every pot.', '🐟', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/553dd782ab371237.jpg', 5),
    ('The Local Market', 'Eggs & Dairy', 'Farm-fresh eggs by the crate and local dairy.', '🥚', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/2a6a1c2366ef1dca.jpg', 6),
    ('The Local Market', 'Fresh Vegetables', 'Ugwu, peppers, tomatoes and leafy greens, fresh from the market.', '🥬', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/06154dadf10c4d3f.jpg', 7),
    ('The Local Market', 'Cooking Oils', 'Red palm oil and groundnut oil, measured fresh.', '🫗', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/17259edde3ea998e.jpg', 8),
    ('The Local Market', 'Measurable Foods (Rice, Beans, Garri, etc.)', 'Rice, beans and garri measured by the kg, mudu or bag.', '🌾', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/7f6b4524717888b5.jpg', 9),
    ('The Local Market', 'Roasted Foods', 'Hot roadside favourites, roasted fresh on the grill.', '🔥', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/69e79699bd64bf8f.jpg', 10),
    ('The Local Market', 'Water', 'Sachet and dispenser water delivered in bulk.', '💧', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/05fea080ae0b2ae4.jpg', 11),
    ('Groceries & Essentials', 'Biscuits & Snacks', 'Crackers, chips and crunchy treats for any time of day.', '🍪', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/82e87252d18fde3a.jpg', 1),
    ('Groceries & Essentials', 'Drinks & Water', 'Bottled water, juices and soft drinks by the pack.', '🧃', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/92206a463a4267ad.jpg', 2),
    ('Groceries & Essentials', 'Condiments, Spices & Ingredients', 'Seasoning, tomato paste and pantry basics for everyday cooking.', '🧂', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/00f0fa6768d2bafa.jpg', 3),
    ('Groceries & Essentials', 'Beverages', 'Cocoa drinks, coffee and tea for breakfast and beyond.', '☕', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/8f0e3d4c64870818.jpg', 4),
    ('Groceries & Essentials', 'Honey', 'Pure natural honey, straight from the hive.', '🍯', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/0259ba5b4accad30.jpg', 5),
    ('Groceries & Essentials', 'Dairy & Eggs', 'Milk, yoghurt, butter and eggs for the fridge.', '🥛', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/271321f6982ea8ef.jpg', 6),
    ('Groceries & Essentials', 'Bakery', 'Fresh loaves, rolls and baked snacks every morning.', '🍞', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/886db2fcc01525db.jpg', 7),
    ('Groceries & Essentials', 'Wines', 'Red, white and sparkling wines for dinners and celebrations.', '🍷', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/c369bf592ac3412a.jpg', 8),
    ('Groceries & Essentials', 'Fruits & Fresh Foods', 'Seasonal fruits like agbalumo and pineapple, fresh and juicy.', '🍍', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/3d9ca2fffcb37507.jpg', 9),
    ('Groceries & Essentials', 'Pet Food', 'Nutritious food and treats for your dogs and cats.', '🐾', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/wm/680fc5430c7b490e.jpg', 10)
) as v(main_name, name, description, emoji, image_url, sort_order)
join public.categories m on m.parent_id is null and m.name = v.main_name;

-- Add-ons (topping) and Extras (side)
insert into public.customizations (name, price, type) values
    ('Birthday Candles', 500, 'topping'),
    ('Edible Photo Topper', 3500, 'topping'),
    ('Extra Frosting', 1500, 'topping'),
    ('Gift Message Card', 500, 'topping'),
    ('Extra Ice', 0, 'topping'),
    ('Chilled Delivery', 1000, 'topping'),
    ('Cake Knife & Plates Set', 2500, 'side'),
    ('Gift Box Packaging', 2000, 'side'),
    ('Balloons Bundle', 5000, 'side'),
    ('Extra Server/Waiter', 15000, 'side'),
    ('Disposable Plates & Cutlery Pack', 8000, 'side'),
    ('Chairs & Tables Setup', 50000, 'side');

-- Products
insert into public.menu (name, description, image_url, emoji, price, rating, calories, protein, category_id)
select v.name, v.description, v.image_url, v.emoji, v.price, v.rating, v.calories, v.protein, s.id
from (values
    ('Cakes & Celebrations', 'Cupcakes', 'Red Velvet Cupcakes – Box of 12', 'Moist red velvet cupcakes topped with cream cheese frosting.', null, '🧁', 18000::numeric, 4.8::numeric, 410::integer, 4::integer),
    ('Cakes & Celebrations', 'Cupcakes', 'Assorted Buttercream Cupcakes – Box of 6', 'Vanilla, chocolate and strawberry cupcakes with buttercream swirls.', null, '🧁', 9500::numeric, 4.6::numeric, 380::integer, 4::integer),
    ('Cakes & Celebrations', 'Cake in a Can', 'Chocolate Fudge Cake in a Can', 'Chocolate sponge layered with rich fudge cream in a sealed jar.', null, '🍫', 4500::numeric, 4.7::numeric, 520::integer, 6::integer),
    ('Cakes & Celebrations', 'Cake in a Can', 'Red Velvet Cake in a Can – Set of 3', 'Three jars of red velvet sponge, berry compote and cream cheese layers.', null, '🫙', 12500::numeric, 4.5::numeric, 480::integer, 5::integer),
    ('Cakes & Celebrations', 'Birthday Cakes', 'Chocolate Birthday Cake – 10 inch', 'Two-layer chocolate cake with buttercream roses and a piped name.', null, '🎂', 45000::numeric, 4.8::numeric, 450::integer, 5::integer),
    ('Cakes & Celebrations', 'Birthday Cakes', 'Kids'' Number Birthday Cake – 8 inch', 'Vanilla sponge with colourful frosting and a number topper for the big day.', null, '🎈', 38000::numeric, 4.6::numeric, 430::integer, 4::integer),
    ('Cakes & Celebrations', 'Anniversary Cakes', 'Heart-Shaped Red Velvet Anniversary Cake – 8 inch', 'Heart-shaped red velvet with silky cream cheese frosting.', null, '❤️', 42000::numeric, 4.9::numeric, 460::integer, 5::integer),
    ('Cakes & Celebrations', 'Anniversary Cakes', 'Rose & Pearls Anniversary Cake – 8 inch', 'Strawberry cream cake finished with a buttercream rose and sugar pearls.', null, '🌹', 48000::numeric, 4.7::numeric, 440::integer, 4::integer),
    ('Cakes & Celebrations', 'Wedding Cakes', 'Three-Tier Buttercream Wedding Cake – 150 Guests', 'Vanilla, red velvet and chocolate tiers dressed with fresh flowers.', null, '💒', 350000::numeric, 4.8::numeric, null::integer, null::integer),
    ('Cakes & Celebrations', 'Wedding Cakes', 'Four-Tier Fondant Wedding Cake – 250 Guests', 'Classic white fondant fruit and sponge tiers with sugar-flower detail.', null, '👰', 650000::numeric, 4.9::numeric, null::integer, null::integer),
    ('Cakes & Celebrations', 'Custom Cakes', 'Custom Gold Luxury Cake – 2 Tiers', 'Two-tier designer cake with gold leaf accents in your chosen flavours.', null, '✨', 180000::numeric, 4.7::numeric, null::integer, null::integer),
    ('Cakes & Celebrations', 'Custom Cakes', 'Custom Colour Theme Cake – 8 inch', 'Single-tier cake decorated in your party colours, with optional photo topper.', null, '🎨', 55000::numeric, 4.5::numeric, 440::integer, 4::integer),
    ('Cakes & Celebrations', 'Cake Gift Boxes', 'Mini Chocolate Bento Cake Gift Box', 'A 4-inch chocolate bento cake in a cute gift box with a fork.', null, '🎁', 15000::numeric, 4.6::numeric, 480::integer, 6::integer),
    ('Cakes & Celebrations', 'Cake Gift Boxes', 'Cake & Pastry Treat Gift Box', 'Cake slices, cupcakes and pastries packed in an elegant gift box.', null, '🍰', 25000::numeric, 4.4::numeric, 500::integer, 6::integer),
    ('Drinks & Refreshments', 'Fresh Juices', 'Fresh Pineapple Juice – 1L', 'Cold-pressed sweet pineapple juice, bottled fresh daily.', null, '🍍', 4500::numeric, 4.7::numeric, 130::integer, 1::integer),
    ('Drinks & Refreshments', 'Fresh Juices', 'Fresh Orange Juice – 1L', 'Freshly squeezed Nigerian oranges, pulp and all.', null, '🍊', 5000::numeric, 4.8::numeric, 115::integer, 2::integer),
    ('Drinks & Refreshments', 'Mocktails', 'Chapman – 50cl Bottle', 'Classic Nigerian Chapman with citrus, cucumber and a splash of grenadine.', null, '🍹', 3500::numeric, 4.9::numeric, 180::integer, 0::integer),
    ('Drinks & Refreshments', 'Mocktails', 'Blue Lagoon Mocktail – 50cl', 'Zesty lemonade layered with blue curacao syrup, no alcohol.', null, '🧊', 4000::numeric, 4.5::numeric, 160::integer, 0::integer),
    ('Drinks & Refreshments', 'Smoothies', 'Mango-Banana Smoothie – 50cl', 'Ripe mango and banana blended with yoghurt.', null, '🥭', 5000::numeric, 4.7::numeric, 280::integer, 6::integer),
    ('Drinks & Refreshments', 'Smoothies', 'Green Detox Smoothie – 50cl', 'Spinach, cucumber, apple, ginger and lime blended smooth.', null, '🥬', 5500::numeric, 4.4::numeric, 190::integer, 3::integer),
    ('Drinks & Refreshments', 'Soft Drinks', 'Malt Drink – 33cl Can (Pack of 6)', 'Rich, non-alcoholic malt drink, best served ice-cold.', null, '🥫', 5400::numeric, 4.6::numeric, 230::integer, 2::integer),
    ('Drinks & Refreshments', 'Soft Drinks', 'Cola Soft Drink – 50cl PET (Pack of 12)', 'Classic fizzy cola in party-ready 50cl bottles.', null, '🥤', 7800::numeric, 4.5::numeric, 210::integer, 0::integer),
    ('Drinks & Refreshments', 'Wines', 'Imported Red Wine – 75cl (Cabernet Sauvignon)', 'Smooth, full-bodied dry red, great with grilled meat and asun.', null, '🍷', 18000::numeric, 4.6::numeric, 125::integer, 0::integer),
    ('Drinks & Refreshments', 'Wines', 'Imported White Wine – 75cl (Sauvignon Blanc)', 'Crisp, fruity dry white that pairs well with seafood and pepper soup.', null, '🥂', 16500::numeric, 4.5::numeric, 120::integer, 0::integer),
    ('Drinks & Refreshments', 'Bottled Water', 'Table Water – 75cl x 12', 'A shrink-wrapped pack of twelve 75cl bottles of table water.', null, '💧', 3600::numeric, 4.6::numeric, 0::integer, 0::integer),
    ('Drinks & Refreshments', 'Bottled Water', 'Table Water – 50cl x 20', 'Twenty handy 50cl bottles, perfect for events and road trips.', null, '🚰', 4200::numeric, 4.4::numeric, 0::integer, 0::integer),
    ('Drinks & Refreshments', 'Drink Packages', 'Party Drinks Package – 50 Guests', 'Assorted soft drinks, malt, juice and water with ice coolers for 50 guests.', null, '🎊', 150000::numeric, 4.7::numeric, null::integer, null::integer),
    ('Drinks & Refreshments', 'Drink Packages', 'Kunu & Zobo Party Pack – 24 Bottles (50cl)', 'Twelve kunu and twelve zobo bottles, freshly made for your event.', null, '🍶', 36000::numeric, 4.8::numeric, null::integer, null::integer),
    ('Health & Wellness', 'Whole Foods', 'Dried Tiger Nuts – 1kg', 'Sun-dried tiger nuts for snacking or making kunun aya at home.', null, '🌰', 6500::numeric, 4.6::numeric, null::integer, null::integer),
    ('Health & Wellness', 'Whole Foods', 'Unripe Plantain Flour – 1kg', 'Stone-milled green plantain flour (elubo ogede) for swallow.', null, '🍌', 4500::numeric, 4.7::numeric, null::integer, null::integer),
    ('Health & Wellness', 'Herbal Drinks', 'Zobo Drink – 1L Bottle', 'Hibiscus zobo brewed with ginger, cloves and pineapple.', null, '🌺', 3000::numeric, 4.8::numeric, 110::integer, 0::integer),
    ('Health & Wellness', 'Herbal Drinks', 'Ginger & Turmeric Shots – Pack of 6 (60ml)', 'Fiery cold-pressed ginger, turmeric and lemon shots.', null, '🫚', 7500::numeric, 4.5::numeric, 25::integer, 0::integer),
    ('Health & Wellness', 'Teas', 'Moringa Leaf Powder – 200g', 'Finely milled moringa leaves to brew as tea or stir into smoothies.', null, '🍃', 4000::numeric, 4.5::numeric, null::integer, null::integer),
    ('Health & Wellness', 'Teas', 'Lemongrass & Ginger Tea – 20 Bags', 'Caffeine-free lemongrass and ginger tea bags.', null, '🍵', 3500::numeric, 4.6::numeric, 5::integer, 0::integer),
    ('Health & Wellness', 'Supplements & Daily Wellness', 'Daily Multivitamin Tablets – 60 Count', 'One-a-day multivitamin and mineral tablets for adults.', null, '💊', 9500::numeric, 4.4::numeric, null::integer, null::integer),
    ('Health & Wellness', 'Supplements & Daily Wellness', 'Omega-3 Fish Oil – 90 Softgels', 'Easy-to-swallow fish oil softgels with EPA and DHA.', null, '🐟', 14000::numeric, 4.6::numeric, null::integer, null::integer),
    ('Health & Wellness', 'Healthy Bites', 'Baked Plantain Chips – 6 x 50g', 'Crunchy oven-baked plantain chips, lightly salted.', null, '🍌', 4800::numeric, 4.7::numeric, 250::integer, 1::integer),
    ('Health & Wellness', 'Healthy Bites', 'Mixed Nuts & Dried Fruit – 500g', 'Cashews, almonds, groundnuts and dried fruit in a resealable pack.', null, '🥜', 9000::numeric, 4.6::numeric, 170::integer, 5::integer),
    ('Health & Wellness', 'Organic Oils', 'Virgin Coconut Oil – 500ml Jar', 'Cold-pressed virgin coconut oil for cooking and baking.', null, '🥥', 7500::numeric, 4.7::numeric, null::integer, null::integer),
    ('Health & Wellness', 'Organic Oils', 'Shea Butter Cooking Oil – 500ml', 'Refined food-grade shea butter (ori) traditionally used for frying.', null, '🧈', 6000::numeric, 4.3::numeric, null::integer, null::integer),
    ('Health & Wellness', 'Gluten-Free Products', 'Acha (Fonio) Grain – 1kg', 'Naturally gluten-free ancient grain from Northern Nigeria, cleaned and destoned.', null, '🌾', 5500::numeric, 4.6::numeric, null::integer, null::integer),
    ('Health & Wellness', 'Gluten-Free Products', 'Gluten-Free Oats – 1kg', 'Certified gluten-free rolled oats for porridge or blending into oat flour.', null, '🥣', 7000::numeric, 4.5::numeric, null::integer, null::integer),
    ('Health & Wellness', 'Sugar-Free Products', 'Sugar-Free Peanut Butter – 500g', '100% roasted groundnuts with a pinch of salt, nothing else.', null, '🥜', 5500::numeric, 4.7::numeric, 190::integer, 8::integer),
    ('Health & Wellness', 'Sugar-Free Products', 'Unsweetened Kunun Aya – 1L', 'Creamy tiger nut, coconut and date drink with no added sugar.', null, '🥛', 4000::numeric, 4.6::numeric, 150::integer, 2::integer),
    ('Health & Wellness', 'Fitness Nutrition', 'Whey Protein Powder – 2lb (Chocolate)', 'Chocolate whey protein, about 24g protein per scoop.', null, '💪', 45000::numeric, 4.6::numeric, 120::integer, 24::integer),
    ('Health & Wellness', 'Fitness Nutrition', 'Protein Bars – Box of 12', 'Chewy chocolate and nut protein bars for on-the-go snacking.', null, '🍫', 24000::numeric, 4.4::numeric, 210::integer, 20::integer),
    ('The Local Market', 'Fresh Food', 'Fresh Yam Tuber – Large', 'One big, firm Abuja yam tuber, perfect for pounding, frying or porridge.', null, '🍠', 8500::numeric, 4.6::numeric, null::integer, null::integer),
    ('The Local Market', 'Fresh Food', 'Unripe Plantain – Bunch', 'A full bunch of firm green plantain, ready to ripen or cook as is.', null, '🍌', 12000::numeric, 4.5::numeric, null::integer, null::integer),
    ('The Local Market', 'Condiments & Spices', 'Crayfish – 1 Paint Bucket', 'Clean, well-dried crayfish, measured in a full paint bucket.', null, '🦐', 28000::numeric, 4.8::numeric, null::integer, null::integer),
    ('The Local Market', 'Condiments & Spices', 'Dried Pepper (Ata Gigun) – 1kg', 'Sun-dried red pepper for stews, pepper soup and suya spice.', null, '🌶️', 9000::numeric, 4.4::numeric, null::integer, null::integer),
    ('The Local Market', 'Frozen Foods', 'Frozen Chicken Wings – 1kg', 'Meaty frozen chicken wings, great for grilling, peppering or frying.', null, '🍗', 7500::numeric, 4.5::numeric, null::integer, null::integer),
    ('The Local Market', 'Frozen Foods', 'Frozen Mackerel (Titus) – 1kg', 'Whole frozen mackerel, the go-to fish for stews and pepper soup.', null, '🐟', 8500::numeric, 4.6::numeric, null::integer, null::integer),
    ('The Local Market', 'Meat', 'Goat Meat (per kg)', 'Freshly cut goat meat with bone, ideal for pepper soup and asun.', null, '🐐', 14000::numeric, 4.7::numeric, null::integer, null::integer),
    ('The Local Market', 'Meat', 'Ponmo – 1kg', 'Soft, well-cleaned cow skin, ready for stews and soups.', null, '🥩', 8000::numeric, 4.4::numeric, null::integer, null::integer),
    ('The Local Market', 'Fish & Seafood', 'Fresh Tilapia (per kg)', 'Whole fresh tilapia, gutted and scaled on request.', null, '🐟', 7000::numeric, 4.6::numeric, null::integer, null::integer),
    ('The Local Market', 'Fish & Seafood', 'Stockfish (Okporoko) – Medium Pack', 'Cut and soaked-ready stockfish for egusi, ofe onugbu and more.', null, '🐟', 15000::numeric, 4.7::numeric, null::integer, null::integer),
    ('The Local Market', 'Eggs & Dairy', 'Fresh Eggs – Crate of 30', 'A full crate of 30 fresh farm eggs, carefully packed.', null, '🥚', 6500::numeric, 4.8::numeric, null::integer, null::integer),
    ('The Local Market', 'Eggs & Dairy', 'Fura da Nono – 1 Litre', 'Fresh cow-milk nono with millet fura balls, a creamy northern classic.', null, '🥛', 3500::numeric, 4.3::numeric, 250::integer, 8::integer),
    ('The Local Market', 'Fresh Vegetables', 'Ugwu Leaves – Bunch', 'A fresh bunch of fluted pumpkin leaves for edikaikong and egusi.', null, '🥬', 1500::numeric, 4.6::numeric, null::integer, null::integer),
    ('The Local Market', 'Fresh Vegetables', 'Tatashe & Scotch Bonnet Mix – 1kg', 'Red bell pepper and ata rodo mix, the perfect base for stew.', null, '🌶️', 6000::numeric, 4.7::numeric, null::integer, null::integer),
    ('The Local Market', 'Cooking Oils', 'Palm Oil – 4 Litres', 'Rich, pure red palm oil for banga, egusi and ofe nsala.', null, '🫗', 11000::numeric, 4.7::numeric, null::integer, null::integer),
    ('The Local Market', 'Cooking Oils', 'Groundnut Oil – 4 Litres', 'Locally pressed groundnut oil with a lovely nutty aroma.', null, '🥜', 16000::numeric, 4.5::numeric, null::integer, null::integer),
    ('The Local Market', 'Measurable Foods (Rice, Beans, Garri, etc.)', 'Ofada Rice – 5kg', 'Stone-free local ofada rice with its signature aroma.', null, '🍚', 13500::numeric, 4.6::numeric, null::integer, null::integer),
    ('The Local Market', 'Measurable Foods (Rice, Beans, Garri, etc.)', 'Ijebu Garri – 5kg', 'Crisp, sour Ijebu garri for soaking or making eba.', null, '🌾', 6500::numeric, 4.8::numeric, null::integer, null::integer),
    ('The Local Market', 'Roasted Foods', 'Roasted Plantain (Boli) & Groundnut', 'Two fire-roasted ripe plantains with a wrap of roasted groundnuts.', null, '🍌', 2500::numeric, 4.7::numeric, 450::integer, 10::integer),
    ('The Local Market', 'Roasted Foods', 'Roasted Corn – 4 Cobs', 'Four sweet corn cobs roasted over charcoal.', null, '🌽', 3000::numeric, 4.5::numeric, 180::integer, 5::integer),
    ('The Local Market', 'Water', 'Sachet Water – Bag of 20', 'A bag of 20 cool, clean 50cl water sachets.', null, '💧', 700::numeric, 4.4::numeric, 0::integer, 0::integer),
    ('The Local Market', 'Water', 'Dispenser Water – 18.9 Litres', 'A sealed 18.9L refill bottle for your water dispenser.', null, '🚰', 2500::numeric, 4.5::numeric, 0::integer, 0::integer),
    ('Groceries & Essentials', 'Biscuits & Snacks', 'Cream Crackers – Pack of 12', 'Light, crispy cream crackers in handy single packs.', null, '🍘', 4800::numeric, 4.5::numeric, 140::integer, 3::integer),
    ('Groceries & Essentials', 'Biscuits & Snacks', 'Plantain Chips – Pack of 10', 'Crunchy, lightly salted plantain chips, great for snacking.', null, '🍌', 5000::numeric, 4.7::numeric, 150::integer, 1::integer),
    ('Groceries & Essentials', 'Drinks & Water', 'Bottled Table Water – 75cl (Pack of 12)', 'Twelve bottles of clean table water for home or office.', null, '💧', 3600::numeric, 4.6::numeric, 0::integer, 0::integer),
    ('Groceries & Essentials', 'Drinks & Water', 'Orange Fruit Juice – 1 Litre (Pack of 6)', 'Six cartons of 100% orange juice with no added sugar.', null, '🧃', 13500::numeric, 4.5::numeric, 110::integer, 2::integer),
    ('Groceries & Essentials', 'Condiments, Spices & Ingredients', 'Seasoning Cubes – Pack of 100', 'Savoury seasoning cubes for stews, jollof and soups.', null, '🧂', 2800::numeric, 4.6::numeric, null::integer, null::integer),
    ('Groceries & Essentials', 'Condiments, Spices & Ingredients', 'Tomato Paste – Tin (Pack of 12)', 'Twelve 210g tins of rich double-concentrated tomato paste.', null, '🥫', 9500::numeric, 4.4::numeric, null::integer, null::integer),
    ('Groceries & Essentials', 'Beverages', 'Cocoa Beverage Drink – 900g', 'Chocolate malted cocoa powder, a breakfast-table staple.', null, '🍫', 9500::numeric, 4.7::numeric, 80::integer, 2::integer),
    ('Groceries & Essentials', 'Beverages', 'Instant Coffee – 200g Jar', 'Smooth instant coffee granules, just add hot water.', null, '☕', 8500::numeric, 4.3::numeric, 2::integer, 0::integer),
    ('Groceries & Essentials', 'Honey', 'Pure Honey – 1 Litre', 'Golden, unadulterated natural honey in a 1-litre bottle.', null, '🍯', 12000::numeric, 4.8::numeric, 64::integer, 0::integer),
    ('Groceries & Essentials', 'Honey', 'Natural Honeycomb – 500g', 'Raw honeycomb chunks, dripping with fresh honey.', null, '🐝', 9000::numeric, 4.6::numeric, 60::integer, 0::integer),
    ('Groceries & Essentials', 'Dairy & Eggs', 'Evaporated Milk – Tin (Pack of 12)', 'Twelve tins of creamy evaporated milk for tea, cereal and cooking.', null, '🥫', 14500::numeric, 4.7::numeric, null::integer, null::integer),
    ('Groceries & Essentials', 'Dairy & Eggs', 'Plain Yoghurt – 1 Litre', 'Thick, creamy plain yoghurt, lovely with fruit or granola.', null, '🥛', 4500::numeric, 4.4::numeric, 150::integer, 8::integer),
    ('Groceries & Essentials', 'Bakery', 'Sliced Bread – Large Loaf', 'Soft, fluffy sliced bread, baked fresh daily.', null, '🍞', 2000::numeric, 4.6::numeric, 160::integer, 5::integer),
    ('Groceries & Essentials', 'Bakery', 'Meat Pie – Pack of 4', 'Buttery pastry filled with seasoned minced beef, potato and carrot.', null, '🥧', 4000::numeric, 4.7::numeric, 350::integer, 10::integer),
    ('Groceries & Essentials', 'Wines', 'Red Wine – 75cl Bottle', 'A smooth, fruity dry red, great with grilled meats.', null, '🍷', 12000::numeric, 4.5::numeric, null::integer, null::integer),
    ('Groceries & Essentials', 'Wines', 'White Wine – 75cl Bottle', 'A crisp, refreshing white wine, best served chilled.', null, '🥂', 11500::numeric, 4.4::numeric, null::integer, null::integer),
    ('Groceries & Essentials', 'Fruits & Fresh Foods', 'Agbalumo (African Star Apple) – Pack of 10', 'Ten ripe, sweet-sour agbalumo fruits in season.', null, '🍊', 4000::numeric, 4.8::numeric, 60::integer, 1::integer),
    ('Groceries & Essentials', 'Fruits & Fresh Foods', 'Pineapple – Large', 'One large, sweet and juicy ripe pineapple.', null, '🍍', 3000::numeric, 4.6::numeric, 80::integer, 1::integer),
    ('Groceries & Essentials', 'Pet Food', 'Dry Dog Food – 3kg', 'Complete, balanced dry kibble for adult dogs.', null, '🐕', 15000::numeric, 4.5::numeric, null::integer, null::integer),
    ('Groceries & Essentials', 'Pet Food', 'Wet Cat Food – Pouch (Pack of 12)', 'Tender chunks in gravy, twelve single-serve pouches.', null, '🐈', 9600::numeric, 4.3::numeric, null::integer, null::integer)
) as v(main_name, sub_name, name, description, image_url, emoji, price, rating, calories, protein)
join public.categories m on m.parent_id is null and m.name = v.main_name
join public.categories s on s.parent_id = m.id and s.name = v.sub_name;

-- Which add-ons/extras each product offers
insert into public.menu_customizations (menu_id, customization_id)
select p.id, c.id
from (values
    ('Red Velvet Cupcakes – Box of 12', 'Birthday Candles'),
    ('Red Velvet Cupcakes – Box of 12', 'Extra Frosting'),
    ('Red Velvet Cupcakes – Box of 12', 'Gift Message Card'),
    ('Red Velvet Cupcakes – Box of 12', 'Gift Box Packaging'),
    ('Assorted Buttercream Cupcakes – Box of 6', 'Birthday Candles'),
    ('Assorted Buttercream Cupcakes – Box of 6', 'Extra Frosting'),
    ('Assorted Buttercream Cupcakes – Box of 6', 'Gift Message Card'),
    ('Chocolate Fudge Cake in a Can', 'Gift Message Card'),
    ('Chocolate Fudge Cake in a Can', 'Chilled Delivery'),
    ('Red Velvet Cake in a Can – Set of 3', 'Gift Message Card'),
    ('Red Velvet Cake in a Can – Set of 3', 'Gift Box Packaging'),
    ('Red Velvet Cake in a Can – Set of 3', 'Chilled Delivery'),
    ('Chocolate Birthday Cake – 10 inch', 'Birthday Candles'),
    ('Chocolate Birthday Cake – 10 inch', 'Edible Photo Topper'),
    ('Chocolate Birthday Cake – 10 inch', 'Extra Frosting'),
    ('Chocolate Birthday Cake – 10 inch', 'Cake Knife & Plates Set'),
    ('Chocolate Birthday Cake – 10 inch', 'Balloons Bundle'),
    ('Kids'' Number Birthday Cake – 8 inch', 'Birthday Candles'),
    ('Kids'' Number Birthday Cake – 8 inch', 'Edible Photo Topper'),
    ('Kids'' Number Birthday Cake – 8 inch', 'Cake Knife & Plates Set'),
    ('Kids'' Number Birthday Cake – 8 inch', 'Balloons Bundle'),
    ('Heart-Shaped Red Velvet Anniversary Cake – 8 inch', 'Gift Message Card'),
    ('Heart-Shaped Red Velvet Anniversary Cake – 8 inch', 'Edible Photo Topper'),
    ('Heart-Shaped Red Velvet Anniversary Cake – 8 inch', 'Cake Knife & Plates Set'),
    ('Heart-Shaped Red Velvet Anniversary Cake – 8 inch', 'Gift Box Packaging'),
    ('Rose & Pearls Anniversary Cake – 8 inch', 'Gift Message Card'),
    ('Rose & Pearls Anniversary Cake – 8 inch', 'Extra Frosting'),
    ('Rose & Pearls Anniversary Cake – 8 inch', 'Cake Knife & Plates Set'),
    ('Three-Tier Buttercream Wedding Cake – 150 Guests', 'Cake Knife & Plates Set'),
    ('Three-Tier Buttercream Wedding Cake – 150 Guests', 'Gift Message Card'),
    ('Four-Tier Fondant Wedding Cake – 250 Guests', 'Cake Knife & Plates Set'),
    ('Four-Tier Fondant Wedding Cake – 250 Guests', 'Gift Message Card'),
    ('Custom Gold Luxury Cake – 2 Tiers', 'Birthday Candles'),
    ('Custom Gold Luxury Cake – 2 Tiers', 'Edible Photo Topper'),
    ('Custom Gold Luxury Cake – 2 Tiers', 'Cake Knife & Plates Set'),
    ('Custom Gold Luxury Cake – 2 Tiers', 'Gift Message Card'),
    ('Custom Colour Theme Cake – 8 inch', 'Birthday Candles'),
    ('Custom Colour Theme Cake – 8 inch', 'Edible Photo Topper'),
    ('Custom Colour Theme Cake – 8 inch', 'Extra Frosting'),
    ('Custom Colour Theme Cake – 8 inch', 'Cake Knife & Plates Set'),
    ('Mini Chocolate Bento Cake Gift Box', 'Birthday Candles'),
    ('Mini Chocolate Bento Cake Gift Box', 'Gift Message Card'),
    ('Mini Chocolate Bento Cake Gift Box', 'Edible Photo Topper'),
    ('Cake & Pastry Treat Gift Box', 'Gift Message Card'),
    ('Cake & Pastry Treat Gift Box', 'Balloons Bundle'),
    ('Fresh Pineapple Juice – 1L', 'Extra Ice'),
    ('Fresh Pineapple Juice – 1L', 'Chilled Delivery'),
    ('Fresh Orange Juice – 1L', 'Extra Ice'),
    ('Fresh Orange Juice – 1L', 'Chilled Delivery'),
    ('Chapman – 50cl Bottle', 'Extra Ice'),
    ('Chapman – 50cl Bottle', 'Chilled Delivery'),
    ('Blue Lagoon Mocktail – 50cl', 'Extra Ice'),
    ('Blue Lagoon Mocktail – 50cl', 'Chilled Delivery'),
    ('Mango-Banana Smoothie – 50cl', 'Extra Ice'),
    ('Mango-Banana Smoothie – 50cl', 'Chilled Delivery'),
    ('Green Detox Smoothie – 50cl', 'Extra Ice'),
    ('Green Detox Smoothie – 50cl', 'Chilled Delivery'),
    ('Malt Drink – 33cl Can (Pack of 6)', 'Chilled Delivery'),
    ('Cola Soft Drink – 50cl PET (Pack of 12)', 'Chilled Delivery'),
    ('Imported Red Wine – 75cl (Cabernet Sauvignon)', 'Chilled Delivery'),
    ('Imported Red Wine – 75cl (Cabernet Sauvignon)', 'Gift Box Packaging'),
    ('Imported Red Wine – 75cl (Cabernet Sauvignon)', 'Gift Message Card'),
    ('Imported White Wine – 75cl (Sauvignon Blanc)', 'Chilled Delivery'),
    ('Imported White Wine – 75cl (Sauvignon Blanc)', 'Gift Box Packaging'),
    ('Imported White Wine – 75cl (Sauvignon Blanc)', 'Gift Message Card'),
    ('Table Water – 75cl x 12', 'Chilled Delivery'),
    ('Table Water – 50cl x 20', 'Chilled Delivery'),
    ('Party Drinks Package – 50 Guests', 'Chilled Delivery'),
    ('Party Drinks Package – 50 Guests', 'Disposable Plates & Cutlery Pack'),
    ('Party Drinks Package – 50 Guests', 'Extra Server/Waiter'),
    ('Kunu & Zobo Party Pack – 24 Bottles (50cl)', 'Chilled Delivery'),
    ('Zobo Drink – 1L Bottle', 'Extra Ice'),
    ('Zobo Drink – 1L Bottle', 'Chilled Delivery'),
    ('Ginger & Turmeric Shots – Pack of 6 (60ml)', 'Chilled Delivery'),
    ('Unsweetened Kunun Aya – 1L', 'Chilled Delivery'),
    ('Sachet Water – Bag of 20', 'Chilled Delivery'),
    ('Bottled Table Water – 75cl (Pack of 12)', 'Chilled Delivery'),
    ('Orange Fruit Juice – 1 Litre (Pack of 6)', 'Chilled Delivery'),
    ('Pure Honey – 1 Litre', 'Gift Message Card'),
    ('Pure Honey – 1 Litre', 'Gift Box Packaging'),
    ('Natural Honeycomb – 500g', 'Gift Message Card'),
    ('Natural Honeycomb – 500g', 'Gift Box Packaging'),
    ('Plain Yoghurt – 1 Litre', 'Chilled Delivery'),
    ('Red Wine – 75cl Bottle', 'Chilled Delivery'),
    ('Red Wine – 75cl Bottle', 'Gift Box Packaging'),
    ('Red Wine – 75cl Bottle', 'Gift Message Card'),
    ('White Wine – 75cl Bottle', 'Chilled Delivery'),
    ('White Wine – 75cl Bottle', 'Gift Box Packaging'),
    ('White Wine – 75cl Bottle', 'Gift Message Card')
) as v(product_name, customization_name)
join public.menu p on p.name = v.product_name
join public.customizations c on c.name = v.customization_name
on conflict do nothing;

-- Fail loudly if any row was silently dropped by a join (e.g. a typo).
do $$
begin
    if (select count(*) from public.categories where parent_id is null) <> 7 then raise exception 'main category count mismatch'; end if;
    if (select count(*) from public.categories where parent_id is not null) <> 58 then raise exception 'subcategory count mismatch'; end if;
    if (select count(*) from public.menu) <> 88 then raise exception 'product count mismatch'; end if;
    if (select count(*) from public.menu_customizations) <> 89 then raise exception 'customization link count mismatch'; end if;
    if exists (select 1 from public.categories s where s.parent_id is not null and s.kind = 'products'
               and not exists (select 1 from public.menu p where p.category_id = s.id)) then
        raise exception 'a subcategory has no products';
    end if;
end;
$$;

commit;
