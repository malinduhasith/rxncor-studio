create table if not exists public.about_page_settings (
  id text primary key default 'main',
  hero_label text not null default 'About / Malindu Herath',
  hero_title text not null,
  intro text not null,
  closing text not null,
  meta_items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.about_page_blocks (
  id uuid primary key default gen_random_uuid(),
  section text not null default 'intro_cards'
    check (section in ('intro_cards', 'banners', 'spoken', 'timeline', 'tools')),
  kind text not null default 'card'
    check (kind in ('card', 'banner', 'spoken', 'timeline', 'tool')),
  label text,
  title text not null,
  body text,
  reference text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists about_page_blocks_section_sort_idx
  on public.about_page_blocks(section, sort_order, created_at);

alter table public.about_page_settings enable row level security;
alter table public.about_page_blocks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'about_page_settings'
      and policyname = 'Admins can manage about page settings'
  ) then
    create policy "Admins can manage about page settings"
      on public.about_page_settings for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'about_page_blocks'
      and policyname = 'Admins can manage about page blocks'
  ) then
    create policy "Admins can manage about page blocks"
      on public.about_page_blocks for all
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end $$;

insert into public.about_page_settings (
  id,
  hero_label,
  hero_title,
  intro,
  closing,
  meta_items
)
values (
  'main',
  'About / Malindu Herath',
  'Melbourne photographer. Portraits, events, and honest stories.',
  'I am Malindu, Sri Lankan-born and based in Melbourne. RXNCOR is where I am putting together portraits, events, street moments, video, design, and the simple systems needed to deliver work properly.',
  'I am interested in work that feels lived in: images with atmosphere, simple systems with purpose, and creative work that carries a bit of truth without trying too hard to explain itself.',
  '[["Based in","Melbourne"],["Origin","Sri Lanka"],["Focus","Photography / Design / Software"],["Brand","RXNCOR.STUDIO"]]'::jsonb
)
on conflict (id) do nothing;

insert into public.about_page_blocks (
  section,
  kind,
  label,
  title,
  body,
  reference,
  sort_order
)
select *
from (
  values
    ('intro_cards', 'card', 'About', 'A quiet mix of looking and making.', 'I am still figuring out my visual language. I am drawn to images that feel alive, imperfect, atmospheric, and honest. Photography feels like observation first, then a small act of construction: noticing a moment and shaping how it is remembered.', null, 10),
    ('intro_cards', 'card', 'Creative practice', 'People, movement, light, and the quiet parts between.', 'I like portraits, people, events, street moments, documentary-style frames, and cinematic light. I look for mood, movement, texture, contrast, and emotion. I do not want the work to feel overly perfect. I want it to feel present and real.', null, 20),
    ('intro_cards', 'card', 'Systems practice', 'Small systems that help the work move.', 'My software background is part of how I think, but I try not to make it the whole story. I have worked with automation, data, dashboards, APIs, internal business systems, and digital workflows. The useful part is the habit of breaking things down and making the process easier for the person using it.', null, 30),
    ('banners', 'banner', 'Perspective', 'Live and let live, with room for the absurd.', 'The way I look at life is close to secular Buddhism: Buddhism as a way of life rather than a religion. Pay attention, cause less harm, stay kind where possible, and do not hold everything too tightly. I also like the absurd side of life. Not everything needs a clean explanation. Some things are strange, funny, painful, beautiful, and unfinished at the same time.', 'Live and let live
Secular Buddhism
Pay attention
Cause less harm
Do not force perfection
Leave room for the absurd', 10),
    ('banners', 'banner', 'Creative / Systems', 'Two interests that keep teaching each other.', 'The camera side is about feeling, light, atmosphere, and timing. The software side is about structure, systems, repeatability, and making things easier to use. For now, RXNCOR is the place where I am learning how those two sides can support each other.', 'React
JavaScript
C#
ASP.NET
Java
Python
SQL
Firebase
HTML
CSS
PHP
Power Apps
Power Automate
SharePoint
Power BI
API integrations', 20),
    ('banners', 'banner', 'Name', 'RXNCOR is a stylised spelling, not a mood to copy.', 'Rancor, or rancour in Australian English, can mean a bitter feeling that stays around for too long. RXNCOR replaces the A with X. I do not use the name to glorify resentment. I use it more as a visual mark for tension, memory, emotion, and the process of turning heavy feeling into something made.', null, 30),
    ('spoken', 'spoken', null, 'Look first. Let the frame answer before I do.', null, 'Street / documentary observation', 10),
    ('spoken', 'spoken', null, 'Hold it lightly. Nothing needs to become a cage.', null, 'Secular Buddhism / non-attachment', 20),
    ('spoken', 'spoken', null, 'If life is strange, let the image admit it.', null, 'Absurdism / Camus', 30),
    ('spoken', 'spoken', null, 'Leave some air around the person. The quiet part matters.', null, 'Portraiture / human presence', 40),
    ('spoken', 'spoken', null, 'Build the boring parts well, so the work can move.', null, 'Systems thinking / delivery', 50),
    ('spoken', 'spoken', null, 'Do not polish the life out of it.', null, 'Wabi-sabi / imperfect beauty', 60),
    ('timeline', 'timeline', null, 'Sri Lanka', 'Early creative and problem-solving foundation.', null, 10),
    ('timeline', 'timeline', null, 'School media / IT / robotics', 'Content creation, problem solving, and making things by experimenting.', null, 20),
    ('timeline', 'timeline', null, 'Software engineering', 'BSc (Hons) in Software Engineering from University of Plymouth / NSBM.', null, 30),
    ('timeline', 'timeline', null, 'Melbourne', 'Master of Information Technology at CQUniversity Australia, professional growth, and a deeper photography practice.', null, 40),
    ('timeline', 'timeline', null, 'RXNCOR.STUDIO', 'An independent portfolio direction across photography, simple systems, and client delivery.', null, 50),
    ('tools', 'tool', null, 'Sony A7 IV', null, null, 10),
    ('tools', 'tool', null, 'Sony 35mm f/1.4 GM', null, null, 20),
    ('tools', 'tool', null, 'Sony 85mm f/1.4 GM II', null, null, 30),
    ('tools', 'tool', null, 'Adobe creative tools', null, null, 40),
    ('tools', 'tool', null, 'React / modern web stack', null, null, 50),
    ('tools', 'tool', null, 'Automation and data systems', null, null, 60)
) as seed(section, kind, label, title, body, reference, sort_order)
where not exists (select 1 from public.about_page_blocks);
