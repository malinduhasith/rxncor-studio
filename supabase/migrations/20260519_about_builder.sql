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
  'I am Malindu, Sri Lankan-born and based in Melbourne. RXNCOR is where I am shaping a photography practice around portraits, events, street moments, and honest client stories.',
  'I am interested in photographs that feel lived in: real light, real people, a little atmosphere, and a frame that carries something true without trying too hard.',
  '[["Based in","Melbourne"],["Origin","Sri Lanka"],["Focus","Portraits / Events / Stories"],["Brand","RXNCOR.STUDIO"]]'::jsonb
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
    ('intro_cards', 'card', 'About', 'Photography first. Everything else stays out of the way.', 'I am still figuring out my visual language. I am drawn to images that feel alive, imperfect, atmospheric, and honest. Photography feels like observation first, then a small act of construction: noticing a moment and shaping how it is remembered.', null, 10),
    ('intro_cards', 'card', 'Creative practice', 'People, movement, light, and the quiet parts between.', 'I like portraits, people, events, street moments, documentary-style frames, and cinematic light. I look for mood, movement, texture, contrast, and emotion. I do not want the work to feel overly perfect. I want it to feel present and real.', null, 20),
    ('intro_cards', 'card', 'Client delivery', 'A simple, private place for finished stories.', 'After the shoot, the work needs to feel just as careful as the day itself. Galleries are kept clean, private when needed, easy to view, and ready for clients to download without making the experience feel heavy.', null, 30),
    ('banners', 'banner', 'Perspective', 'Real light, real people, and enough room for the moment.', 'I like photographs that feel present rather than polished into something flat. The work looks for small gestures, imperfect timing, atmosphere, and the feeling around the person.', 'Honest portraits
Documentary feeling
Available light
Emotion over perfection
Quiet details
Client stories', 10),
    ('banners', 'banner', 'Photography / Delivery', 'A photograph should feel easy to enter.', 'The work starts with noticing people, light, gesture, and atmosphere. After the shoot, delivery should stay quiet and simple: clean galleries, clear downloads, and enough room for the images to speak.', 'Portraits
Events
Street
Documentary
Cinematic light
Real moments
Private galleries
Melbourne
Sri Lanka', 20),
    ('banners', 'banner', 'Name', 'RXNCOR is the mark around the photography.', 'RXNCOR is the visual identity around the work: portraits, events, street frames, and private client galleries. The name is treated as a mark for the images, not a long explanation.', null, 30),
    ('spoken', 'spoken', null, 'Look for the quiet second before the pose.', null, 'Portrait timing', 10),
    ('spoken', 'spoken', null, 'Let real light keep some of its rough edges.', null, 'Available light', 20),
    ('spoken', 'spoken', null, 'The best frame usually feels a little lived in.', null, 'Documentary feeling', 30),
    ('spoken', 'spoken', null, 'Leave some air around the person.', null, 'Human presence', 40),
    ('spoken', 'spoken', null, 'Deliver it simply. The gallery should not get in the way of the photograph.', null, 'Client delivery / private galleries', 50),
    ('spoken', 'spoken', null, 'Do not polish the life out of it.', null, 'Imperfect beauty', 60),
    ('timeline', 'timeline', null, 'Sri Lanka', 'Early memories, faces, streets, colour, and the beginning of a visual eye.', null, 10),
    ('timeline', 'timeline', null, 'First cameras', 'Learning by trying, missing frames, watching light, and slowly understanding timing.', null, 20),
    ('timeline', 'timeline', null, 'Portraits and people', 'A growing interest in faces, mood, gestures, and the quiet parts between posed moments.', null, 30),
    ('timeline', 'timeline', null, 'Melbourne', 'A deeper photography practice shaped by events, street moments, client stories, and changing light.', null, 40),
    ('timeline', 'timeline', null, 'RXNCOR.STUDIO', 'An independent photography portfolio focused on honest frames and private gallery delivery.', null, 50),
    ('tools', 'tool', null, 'Sony A7 IV', null, null, 10),
    ('tools', 'tool', null, 'Sony 35mm f/1.4 GM', null, null, 20),
    ('tools', 'tool', null, 'Sony 85mm f/1.4 GM II', null, null, 30),
    ('tools', 'tool', null, 'Portrait sessions', null, null, 40),
    ('tools', 'tool', null, 'Event coverage', null, null, 50),
    ('tools', 'tool', null, 'Street moments', null, null, 60),
    ('tools', 'tool', null, 'Documentary frames', null, null, 70),
    ('tools', 'tool', null, 'Client galleries', null, null, 80)
) as seed(section, kind, label, title, body, reference, sort_order)
where not exists (select 1 from public.about_page_blocks);
