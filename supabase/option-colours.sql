-- Colour choices added in the admin with an emoji in the name ("🟢 Green") and no swatch:
-- strip the emoji and give them a swatch from the name, so the app shows them as colour dots.
with c(word, hex, len) as (
  select w, h, length(w) from (values
    ('vanilla cream','#F5E6B8'),('chocolate brown','#8B5A3C'),('baby blue','#BFDBFE'),('light blue','#BFDBFE'),
    ('sky blue','#7DD3FC'),('navy blue','#1E3A8A'),('royal blue','#2563EB'),('baby pink','#FBCFE8'),('hot pink','#EC4899'),
    ('light pink','#FBCFE8'),('rose gold','#E8B4A0'),('lilac','#D8B4FE'),('lavender','#DDD6FE'),('mint','#A7F3D0'),
    ('teal','#2DD4BF'),('turquoise','#5EEAD4'),('peach','#FDBA8C'),('coral','#FB7185'),('maroon','#9F1239'),
    ('burgundy','#881337'),('wine','#7F1D1D'),('navy','#1E3A8A'),('cream','#FFF4D6'),('ivory','#FFFBEB'),('beige','#E7D7B8'),
    ('champagne','#F3E5C0'),('nude','#E8C4A8'),('brown','#8B5A3C'),('chocolate','#7B4A2E'),('caramel','#C68A4E'),
    ('silver','#CBD5E1'),('grey','#9CA3AF'),('gray','#9CA3AF'),('gold','#FBBF24'),('white','#FFFFFF'),('black','#1F2937'),
    ('red','#F87171'),('pink','#F9A8C8'),('orange','#FB923C'),('yellow','#FDE047'),('green','#4ADE80'),('blue','#93C5FD'),
    ('purple','#C4B5FD'),('violet','#A78BFA'),('rainbow','#FBBF24')
  ) v(w, h)
),
cleaned as (
  select v.id,
         coalesce(nullif(trim(regexp_replace(v.name, '^[^A-Za-z0-9À-ɏ]+', '')), ''), v.name) as new_name,
         v.swatch
  from public.option_values v
  join public.option_groups g on g.id = v.group_id
  where g.kind = 'single'
)
update public.option_values o
set name = x.new_name,
    swatch = coalesce(o.swatch,
      (select c.hex from c where lower(x.new_name) ~ ('\m' || c.word || '\M') order by c.len desc limit 1))
from cleaned x
where o.id = x.id
  and (o.name <> x.new_name
       or (o.swatch is null and exists (select 1 from public.option_groups g2 where g2.id = o.group_id and g2.name ilike '%colo%r%')));
