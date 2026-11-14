-- Service questionnaires (2026-11-14). Each service type (Private Chef, Corporate Catering, Food
-- Stands, an event type…) can ask its own questions in the request form, e.g. Private Chef:
-- "What cuisine would you like?" and "What would you like the chef to do?". Set in Admin › Categories.
-- The customer's answers are saved on the request as [{question, answer}]. Safe to run more than once.

create table if not exists public.request_questions (
    id          uuid primary key default gen_random_uuid(),
    category_id uuid not null references public.categories (id) on delete cascade,
    question    text not null check (length(btrim(question)) between 1 and 120),
    -- 'single' = pick one, 'multi' = pick any, 'text' = type an answer
    kind        text not null default 'text' check (kind in ('single', 'multi', 'text')),
    choices     text[] not null default '{}',
    required    boolean not null default false,
    placeholder text,
    sort_order  integer not null default 0,
    created_at  timestamptz not null default now()
);
create index if not exists request_questions_category_idx on public.request_questions (category_id, sort_order);

alter table public.request_questions enable row level security;
drop policy if exists "Request questions are viewable by everyone" on public.request_questions;
create policy "Request questions are viewable by everyone" on public.request_questions for select to anon, authenticated using (true);
drop policy if exists "Admins manage request questions" on public.request_questions;
create policy "Admins manage request questions" on public.request_questions for all to authenticated
    using ((select public.is_admin())) with check ((select public.is_admin()));

alter table public.service_requests add column if not exists answers jsonb not null default '[]'::jsonb;

-- Starter questions for Private Chef (edit them in the admin).
do $$
declare v_chef uuid;
begin
    select c.id into v_chef from public.categories c join public.categories p on p.id = c.parent_id
     where c.name = 'Private Chef' and p.parent_id is null and c.kind = 'service' limit 1;
    if v_chef is not null and not exists (select 1 from public.request_questions where category_id = v_chef) then
        insert into public.request_questions (category_id, question, kind, choices, required, placeholder, sort_order) values
          (v_chef, 'What cuisine would you like?', 'multi',
           array['Local (Nigerian)', 'Continental', 'Intercontinental', 'Asian', 'Baking & pastries', 'Healthy / diet meals'], true, null, 1),
          (v_chef, 'How often do you need the chef?', 'single',
           array['One time', 'A few times a week', 'Every day', 'Live-in chef'], false, null, 2),
          (v_chef, 'What would you like the chef to do?', 'text', '{}', true,
           'e.g. Cook dinner for 6 every Saturday, bake a birthday cake, prepare meals for the week…', 3);
    end if;
end $$;
