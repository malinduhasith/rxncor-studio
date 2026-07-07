-- Reset the About Builder content to a photography-only profile.
-- Run this after 20260519_about_builder.sql if the live About page still has
-- old mixed-profile wording.

update public.about_page_settings
set
  hero_label = 'About / Malindu Herath',
  hero_title = 'Melbourne photographer. Portraits, events, and honest stories.',
  intro = 'I am Malindu, Sri Lankan-born and based in Melbourne. RXNCOR is where I am shaping a photography practice around portraits, events, street moments, and honest client stories.',
  closing = 'I am interested in photographs that feel lived in: real light, real people, a little atmosphere, and a frame that carries something true without trying too hard.',
  meta_items = '[["Based in","Melbourne"],["Origin","Sri Lanka"],["Focus","Portraits / Events / Stories"],["Brand","RXNCOR.STUDIO"]]'::jsonb,
  updated_at = now()
where id = 'main';

delete from public.about_page_blocks;

insert into public.about_page_blocks (
  section,
  kind,
  label,
  title,
  body,
  reference,
  sort_order,
  is_active
)
values
  ('intro_cards', 'card', 'About', 'Photography first. Everything else stays out of the way.', 'I am still figuring out my visual language. I am drawn to images that feel alive, imperfect, atmospheric, and honest. Photography feels like observation first, then a small act of construction: noticing a moment and shaping how it is remembered.', null, 10, true),
  ('intro_cards', 'card', 'Creative practice', 'People, movement, light, and the quiet parts between.', 'I like portraits, people, events, street moments, documentary-style frames, and cinematic light. I look for mood, movement, texture, contrast, and emotion. I do not want the work to feel overly perfect. I want it to feel present and real.', null, 20, true),
  ('intro_cards', 'card', 'Client delivery', 'A simple, private place for finished stories.', 'After the shoot, the work needs to feel just as careful as the day itself. Galleries are kept clean, private when needed, easy to view, and ready for clients to download without making the experience feel heavy.', null, 30, true),
  ('banners', 'banner', 'Perspective', 'Real light, real people, and enough room for the moment.', 'I like photographs that feel present rather than polished into something flat. The work looks for small gestures, imperfect timing, atmosphere, and the feeling around the person.', 'Honest portraits
Documentary feeling
Available light
Emotion over perfection
Quiet details
Client stories', 10, true),
  ('banners', 'banner', 'Photography / Delivery', 'A photograph should feel easy to enter.', 'The work starts with noticing people, light, gesture, and atmosphere. After the shoot, delivery should stay quiet and simple: clean galleries, clear downloads, and enough room for the images to speak.', 'Portraits
Events
Street
Documentary
Cinematic light
Real moments
Private galleries
Melbourne
Sri Lanka', 20, true),
  ('banners', 'banner', 'Name', 'RXNCOR is the mark around the photography.', 'RXNCOR is the visual identity around the work: portraits, events, street frames, and private client galleries. The name is treated as a mark for the images, not a long explanation.', null, 30, true),
  ('spoken', 'spoken', null, 'Look for the quiet second before the pose.', null, 'Portrait timing', 10, true),
  ('spoken', 'spoken', null, 'Let real light keep some of its rough edges.', null, 'Available light', 20, true),
  ('spoken', 'spoken', null, 'The best frame usually feels a little lived in.', null, 'Documentary feeling', 30, true),
  ('spoken', 'spoken', null, 'Leave some air around the person.', null, 'Human presence', 40, true),
  ('spoken', 'spoken', null, 'Deliver it simply. The gallery should not get in the way of the photograph.', null, 'Client delivery / private galleries', 50, true),
  ('spoken', 'spoken', null, 'Do not polish the life out of it.', null, 'Imperfect beauty', 60, true),
  ('timeline', 'timeline', null, 'Sri Lanka', 'Early memories, faces, streets, colour, and the beginning of a visual eye.', null, 10, true),
  ('timeline', 'timeline', null, 'First cameras', 'Learning by trying, missing frames, watching light, and slowly understanding timing.', null, 20, true),
  ('timeline', 'timeline', null, 'Portraits and people', 'A growing interest in faces, mood, gestures, and the quiet parts between posed moments.', null, 30, true),
  ('timeline', 'timeline', null, 'Melbourne', 'A deeper photography practice shaped by events, street moments, client stories, and changing light.', null, 40, true),
  ('timeline', 'timeline', null, 'RXNCOR.STUDIO', 'An independent photography portfolio focused on honest frames and private gallery delivery.', null, 50, true),
  ('tools', 'tool', null, 'Sony A7 IV', null, null, 10, true),
  ('tools', 'tool', null, 'Sony 35mm f/1.4 GM', null, null, 20, true),
  ('tools', 'tool', null, 'Sony 85mm f/1.4 GM II', null, null, 30, true),
  ('tools', 'tool', null, 'Portrait sessions', null, null, 40, true),
  ('tools', 'tool', null, 'Event coverage', null, null, 50, true),
  ('tools', 'tool', null, 'Street moments', null, null, 60, true),
  ('tools', 'tool', null, 'Documentary frames', null, null, 70, true),
  ('tools', 'tool', null, 'Client galleries', null, null, 80, true);
