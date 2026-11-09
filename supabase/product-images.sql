-- Product photos: one real photo per product, matched by exact product name.
-- Wikimedia photos are served from our own Supabase 'catalog' storage (Wikimedia blocks app requests).
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to re-run.
-- Sources and licenses are listed in supabase/IMAGE_CREDITS.md (Wikimedia CC BY / BY-SA
-- photos need the author credited if you publish the app).
-- Replace any of these with your own photos later from the admin dashboard.

do $$
declare
    v_updated integer;
    v_missing text;
begin
    with photos(name, url) as (values
        -- Cakes & Celebrations
        ('Red Velvet Cupcakes – Box of 12', 'https://images.unsplash.com/photo-1761746350766-a5855433561f?w=800&q=80&auto=format&fit=crop'),
        ('Assorted Buttercream Cupcakes – Box of 6', 'https://images.unsplash.com/photo-1587536849024-daaa4a417b16?w=800&q=80&auto=format&fit=crop'),
        ('Chocolate Fudge Cake in a Can', 'https://images.unsplash.com/photo-1587271672455-a306f63dfcd7?w=800&q=80&auto=format&fit=crop'),
        ('Red Velvet Cake in a Can – Set of 3', 'https://images.unsplash.com/photo-1767776048551-475547912ac8?w=800&q=80&auto=format&fit=crop'),
        ('Chocolate Birthday Cake – 10 inch', 'https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=800&q=80&auto=format&fit=crop'),
        ('Kids'' Number Birthday Cake – 8 inch', 'https://images.unsplash.com/photo-1565631478786-14e93d376fa2?w=800&q=80&auto=format&fit=crop'),
        ('Heart-Shaped Red Velvet Anniversary Cake – 8 inch', 'https://images.unsplash.com/photo-1771129859451-26dd3fa2e757?w=800&q=80&auto=format&fit=crop'),
        ('Rose & Pearls Anniversary Cake – 8 inch', 'https://images.unsplash.com/photo-1778447849704-913b5e8a5695?w=800&q=80&auto=format&fit=crop'),
        ('Three-Tier Buttercream Wedding Cake – 150 Guests', 'https://images.unsplash.com/photo-1559373098-e1caaccae791?w=800&q=80&auto=format&fit=crop'),
        ('Four-Tier Fondant Wedding Cake – 250 Guests', 'https://images.unsplash.com/photo-1525257831700-183b9b8bf5c4?w=800&q=80&auto=format&fit=crop'),
        ('Custom Gold Luxury Cake – 2 Tiers', 'https://images.unsplash.com/photo-1693059740560-21151639561f?w=800&q=80&auto=format&fit=crop'),
        ('Custom Colour Theme Cake – 8 inch', 'https://images.unsplash.com/photo-1552689486-ce080445fbb6?w=800&q=80&auto=format&fit=crop'),
        ('Mini Chocolate Bento Cake Gift Box', 'https://images.unsplash.com/photo-1771252399516-0d8aeefea953?w=800&q=80&auto=format&fit=crop'),
        ('Cake & Pastry Treat Gift Box', 'https://images.unsplash.com/photo-1623313622825-3db2b60faa70?w=800&q=80&auto=format&fit=crop'),

        -- Drinks & Refreshments
        ('Fresh Pineapple Juice – 1L', 'https://images.unsplash.com/photo-1676159434861-58935554bfcc?w=800&q=80&auto=format&fit=crop'),
        ('Fresh Orange Juice – 1L', 'https://images.unsplash.com/photo-1621506289894-c3a62d6be8f3?w=800&q=80&auto=format&fit=crop'),
        ('Chapman – 50cl Bottle', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/07516e40e42eec94.jpg'),
        ('Blue Lagoon Mocktail – 50cl', 'https://images.unsplash.com/photo-1783705956680-195b93288b17?w=800&q=80&auto=format&fit=crop'),
        ('Mango-Banana Smoothie – 50cl', 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=800&q=80&auto=format&fit=crop'),
        ('Green Detox Smoothie – 50cl', 'https://images.unsplash.com/photo-1759006249055-8c4030a2d56a?w=800&q=80&auto=format&fit=crop'),
        ('Malt Drink – 33cl Can (Pack of 6)', 'https://images.unsplash.com/photo-1780539091772-55654671f433?w=800&q=80&auto=format&fit=crop'),
        ('Cola Soft Drink – 50cl PET (Pack of 12)', 'https://images.unsplash.com/photo-1629654613528-5d0a2e4166de?w=800&q=80&auto=format&fit=crop'),
        ('Imported Red Wine – 75cl (Cabernet Sauvignon)', 'https://images.unsplash.com/photo-1714377769989-140c9e47fbb9?w=800&q=80&auto=format&fit=crop'),
        ('Imported White Wine – 75cl (Sauvignon Blanc)', 'https://images.unsplash.com/photo-1761222835470-6c198d2a5d8e?w=800&q=80&auto=format&fit=crop'),
        ('Table Water – 75cl x 12', 'https://images.unsplash.com/photo-1738104563925-3f41933a81ff?w=800&q=80&auto=format&fit=crop'),
        ('Table Water – 50cl x 20', 'https://images.unsplash.com/photo-1728512552043-51d51e7aa9f8?w=800&q=80&auto=format&fit=crop'),
        ('Party Drinks Package – 50 Guests', 'https://images.unsplash.com/photo-1761281137117-42da05306117?w=800&q=80&auto=format&fit=crop'),
        ('Kunu & Zobo Party Pack – 24 Bottles (50cl)', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/62e9767b92e70230.jpg'),

        -- Health & Wellness
        ('Dried Tiger Nuts – 1kg', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/6484bd68b13a0054.jpg'),
        ('Unripe Plantain Flour – 1kg', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/24b28dbd640537f0.jpg'),
        ('Zobo Drink – 1L Bottle', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/b10f4d2ee29f02de.jpg'),
        ('Ginger & Turmeric Shots – Pack of 6 (60ml)', 'https://images.unsplash.com/photo-1612182062936-e33efa5d537e?w=800&q=80&auto=format&fit=crop'),
        ('Moringa Leaf Powder – 200g', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/0d014cf8d9f8b441.jpg'),
        ('Lemongrass & Ginger Tea – 20 Bags', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/826dce149b351121.jpg'),
        ('Daily Multivitamin Tablets – 60 Count', 'https://images.unsplash.com/photo-1588718889344-f7bd7a565d20?w=800&q=80&auto=format&fit=crop'),
        ('Omega-3 Fish Oil – 90 Softgels', 'https://images.unsplash.com/photo-1670850756988-a1943aa0e554?w=800&q=80&auto=format&fit=crop'),
        ('Baked Plantain Chips – 6 x 50g', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/2ed811e649248e78.jpg'),
        ('Mixed Nuts & Dried Fruit – 500g', 'https://images.unsplash.com/photo-1543158181-1274e5362710?w=800&q=80&auto=format&fit=crop'),
        ('Virgin Coconut Oil – 500ml Jar', 'https://images.unsplash.com/photo-1588413333412-82148535db53?w=800&q=80&auto=format&fit=crop'),
        ('Shea Butter Cooking Oil – 500ml', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/cf039744dcdd891e.jpg'),
        ('Acha (Fonio) Grain – 1kg', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/22758e0f79fde3ac.jpg'),
        ('Gluten-Free Oats – 1kg', 'https://images.unsplash.com/photo-1510776478953-fa4dc5de04ca?w=800&q=80&auto=format&fit=crop'),
        ('Sugar-Free Peanut Butter – 500g', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/8bc6f76bb9323ac9.jpg'),
        ('Unsweetened Kunun Aya – 1L', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/391bcd9d550bbad6.jpg'),
        ('Whey Protein Powder – 2lb (Chocolate)', 'https://images.unsplash.com/photo-1774935989989-922da81ad1bc?w=800&q=80&auto=format&fit=crop'),
        ('Protein Bars – Box of 12', 'https://images.unsplash.com/photo-1704650311540-e3b58fa6dc74?w=800&q=80&auto=format&fit=crop'),

        -- The Local Market
        ('Fresh Yam Tuber – Large', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/4399578cf6b56b8b.jpg'),
        ('Unripe Plantain – Bunch', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/fc401386662355cf.jpg'),
        ('Crayfish – 1 Paint Bucket', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/7da890ab8a7db3d1.jpg'),
        ('Dried Pepper (Ata Gigun) – 1kg', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/31c4c1cc9cca6cdc.jpg'),
        ('Frozen Chicken Wings – 1kg', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/336537499887acf2.jpg'),
        ('Frozen Mackerel (Titus) – 1kg', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/6d3115d2cafb6c9e.jpg'),
        ('Goat Meat (per kg)', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/ebed2f0015665357.jpg'),
        ('Ponmo – 1kg', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/1f5c4700715e0382.jpg'),
        ('Fresh Tilapia (per kg)', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/e0ccb594bf1d9f77.jpg'),
        ('Stockfish (Okporoko) – Medium Pack', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/stockfish-okporoko.jpg'),
        ('Fresh Eggs – Crate of 30', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/2a0738c4625d8063.jpg'),
        ('Fura da Nono – 1 Litre', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/a5b21400408b2542.jpg'),
        ('Ugwu Leaves – Bunch', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/2c3fcfb122386a4c.jpg'),
        ('Tatashe & Scotch Bonnet Mix – 1kg', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/c3b2aa3ba7ada41d.jpg'),
        ('Palm Oil – 4 Litres', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/f00fc03e9a8fb22c.jpg'),
        ('Groundnut Oil – 4 Litres', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/f9a743e649954421.jpg'),
        ('Ofada Rice – 5kg', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/0bdb12a1e6eb461c.jpg'),
        ('Ijebu Garri – 5kg', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/1e6767be468a6640.jpg'),
        ('Roasted Plantain (Boli) & Groundnut', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/boli-and-groundnut.png'),
        ('Roasted Corn – 4 Cobs', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/0719f44a48eb16b8.jpg'),
        ('Sachet Water – Bag of 20', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/53376f4d7ed21145.jpg'),
        ('Dispenser Water – 18.9 Litres', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/a8bd287bde1d41d7.jpg'),

        -- Groceries & Essentials
        ('Cream Crackers – Pack of 12', 'https://images.unsplash.com/photo-1637010640564-dce7b13c9734?w=800&q=80&auto=format&fit=crop'),
        ('Plantain Chips – Pack of 10', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/2ed811e649248e78.jpg'),
        ('Bottled Table Water – 75cl (Pack of 12)', 'https://images.unsplash.com/photo-1788375077205-76daee0b1e51?w=800&q=80&auto=format&fit=crop'),
        ('Orange Fruit Juice – 1 Litre (Pack of 6)', 'https://images.unsplash.com/photo-1782292017157-49788d0ec639?w=800&q=80&auto=format&fit=crop'),
        ('Seasoning Cubes – Pack of 100', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/f68e3816fcc12554.jpg'),
        ('Tomato Paste – Tin (Pack of 12)', 'https://images.unsplash.com/photo-1472476443507-c7a5948772fc?w=800&q=80&auto=format&fit=crop'),
        ('Cocoa Beverage Drink – 900g', 'https://images.unsplash.com/photo-1546334169-864ef455d3f8?w=800&q=80&auto=format&fit=crop'),
        ('Instant Coffee – 200g Jar', 'https://images.unsplash.com/photo-1510776537653-6d0da167186c?w=800&q=80&auto=format&fit=crop'),
        ('Pure Honey – 1 Litre', 'https://images.unsplash.com/photo-1572102329980-f9e3c4b955e1?w=800&q=80&auto=format&fit=crop'),
        ('Natural Honeycomb – 500g', 'https://images.unsplash.com/photo-1773957949187-c7e9b989bcbf?w=800&q=80&auto=format&fit=crop'),
        ('Evaporated Milk – Tin (Pack of 12)', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/b215d060085b7fb3.jpg'),
        ('Plain Yoghurt – 1 Litre', 'https://images.unsplash.com/photo-1571212515416-fef01fc43637?w=800&q=80&auto=format&fit=crop'),
        ('Sliced Bread – Large Loaf', 'https://images.unsplash.com/photo-1706954622635-939539dd9246?w=800&q=80&auto=format&fit=crop'),
        ('Meat Pie – Pack of 4', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/9f32ea076477ce99.jpg'),
        ('Red Wine – 75cl Bottle', 'https://images.unsplash.com/photo-1759931002745-50708843e356?w=800&q=80&auto=format&fit=crop'),
        ('White Wine – 75cl Bottle', 'https://images.unsplash.com/photo-1611571940159-425a28706d6f?w=800&q=80&auto=format&fit=crop'),
        ('Agbalumo (African Star Apple) – Pack of 10', 'https://rembodejacmfbeohvmhl.supabase.co/storage/v1/object/public/catalog/products/wm/c79074e3ed723cb3.jpg'),
        ('Pineapple – Large', 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=800&q=80&auto=format&fit=crop'),
        ('Dry Dog Food – 3kg', 'https://images.unsplash.com/photo-1764249453855-2e575db33354?w=800&q=80&auto=format&fit=crop'),
        ('Wet Cat Food – Pouch (Pack of 12)', 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Cat_eating_wet_plant-based_cat_food.jpg')
    ),
    updated as (
        update public.menu m set image_url = p.url
          from photos p
         where m.name = p.name
        returning m.name
    )
    select (select count(*) from updated),
           (select string_agg(p.name, ', ') from photos p where p.name not in (select name from updated))
      into v_updated, v_missing;

    raise notice 'Product photos set: % of 88', v_updated;
    if v_missing is not null then
        raise notice 'No product with these names (renamed?): %', v_missing;
    end if;
end $$;
