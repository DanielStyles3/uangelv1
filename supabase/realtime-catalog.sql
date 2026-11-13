-- Live shop updates: the app listens to these tables and refreshes quietly when the admin
-- adds or changes a product, category, choice or promotion. (Applied 2026-11-13.)
alter publication supabase_realtime add table
    public.menu, public.categories, public.option_groups, public.option_values, public.promotions;
