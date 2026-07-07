import {
  aboutBrandNote,
  aboutPhotographyTags,
  aboutPerspective,
  aboutProfile,
  aboutSections,
  aboutTimeline,
  aboutTools,
  aboutValues
} from "@/lib/about-content";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const aboutBlockSections = [
  "intro_cards",
  "banners",
  "spoken",
  "timeline",
  "tools"
] as const;

export const aboutBlockKinds = ["card", "banner", "spoken", "timeline", "tool"] as const;

export type AboutBlockSection = (typeof aboutBlockSections)[number];
export type AboutBlockKind = (typeof aboutBlockKinds)[number];

export type AboutPageSettings = {
  id: string;
  heroLabel: string;
  heroTitle: string;
  intro: string;
  closing: string;
  metaItems: Array<[string, string]>;
};

export type AboutPageBlock = {
  id: string;
  section: AboutBlockSection;
  kind: AboutBlockKind;
  label: string | null;
  title: string;
  body: string | null;
  reference: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type AboutPageContent = {
  settings: AboutPageSettings;
  blocks: AboutPageBlock[];
  source: "database" | "fallback";
  setupMissing: boolean;
};

type AboutSettingsRow = {
  id: string;
  hero_label: string | null;
  hero_title: string | null;
  intro: string | null;
  closing: string | null;
  meta_items: unknown;
};

type AboutBlockRow = {
  id: string;
  section: string | null;
  kind: string | null;
  label: string | null;
  title: string | null;
  body: string | null;
  reference: string | null;
  sort_order: number | null;
  is_active: boolean | null;
};

export const aboutBlockSectionCopy: Record<
  AboutBlockSection,
  { label: string; detail: string }
> = {
  intro_cards: {
    label: "Intro cards",
    detail: "Main explanation panels near the top of the About page."
  },
  banners: {
    label: "Banners",
    detail: "Wide split sections for worldview, brand meaning, or bigger ideas."
  },
  spoken: {
    label: "Spoken snippets",
    detail: "Short editorial lines with a reference or influence underneath."
  },
  timeline: {
    label: "Timeline",
    detail: "Background moments shown in the compact path section."
  },
  tools: {
    label: "Tools",
    detail: "Camera gear, lenses, shoot types, and delivery details."
  }
};

export const aboutBlockKindCopy: Record<AboutBlockKind, string> = {
  card: "Card",
  banner: "Banner",
  spoken: "Spoken snippet",
  timeline: "Timeline item",
  tool: "Tool tag"
};

export const defaultAboutSettings: AboutPageSettings = {
  id: "main",
  heroLabel: "About / Malindu Herath",
  heroTitle: aboutProfile.hero,
  intro: aboutProfile.intro,
  closing: aboutProfile.closing,
  metaItems: aboutProfile.metadata.map(([label, value]) => [label, value])
};

export const defaultAboutBlocks: AboutPageBlock[] = [
  ...aboutSections.map((section, index) => ({
    id: `default-card-${section.index}`,
    section: "intro_cards" as const,
    kind: "card" as const,
    label: section.label,
    title: section.title,
    body: section.body,
    reference: null,
    sortOrder: (index + 1) * 10,
    isActive: true
  })),
  {
    id: "default-banner-perspective",
    section: "banners",
    kind: "banner",
    label: aboutPerspective.label,
    title: aboutPerspective.title,
    body: aboutPerspective.body,
    reference: aboutPerspective.points.join("\n"),
    sortOrder: 10,
    isActive: true
  },
  {
    id: "default-banner-delivery",
    section: "banners",
    kind: "banner",
    label: "Photography / Delivery",
    title: "A photograph should feel easy to enter.",
    body:
      "The work starts with noticing people, light, gesture, and atmosphere. After the shoot, delivery should stay quiet and simple: clean galleries, clear downloads, and enough room for the images to speak.",
    reference: aboutPhotographyTags.join("\n"),
    sortOrder: 20,
    isActive: true
  },
  {
    id: "default-banner-rxncor",
    section: "banners",
    kind: "banner",
    label: aboutBrandNote.label,
    title: aboutBrandNote.title,
    body: aboutBrandNote.body,
    reference: null,
    sortOrder: 30,
    isActive: true
  },
  ...aboutValues.map((value, index) => ({
    id: `default-spoken-${index + 1}`,
    section: "spoken" as const,
    kind: "spoken" as const,
    label: null,
    title: value.line,
    body: null,
    reference: value.reference,
    sortOrder: (index + 1) * 10,
    isActive: true
  })),
  ...aboutTimeline.map((item, index) => ({
    id: `default-timeline-${index + 1}`,
    section: "timeline" as const,
    kind: "timeline" as const,
    label: null,
    title: item.place,
    body: item.detail,
    reference: null,
    sortOrder: (index + 1) * 10,
    isActive: true
  })),
  ...aboutTools.map((tool, index) => ({
    id: `default-tool-${index + 1}`,
    section: "tools" as const,
    kind: "tool" as const,
    label: null,
    title: tool,
    body: null,
    reference: null,
    sortOrder: (index + 1) * 10,
    isActive: true
  }))
];

function isSection(value: string | null | undefined): value is AboutBlockSection {
  return aboutBlockSections.includes(value as AboutBlockSection);
}

function isKind(value: string | null | undefined): value is AboutBlockKind {
  return aboutBlockKinds.includes(value as AboutBlockKind);
}

function normaliseMetaItems(value: unknown): Array<[string, string]> {
  if (!Array.isArray(value)) {
    return defaultAboutSettings.metaItems;
  }

  const items = value
    .map((item): [string, string] | null => {
      if (!Array.isArray(item) || item.length < 2) {
        return null;
      }

      const label = String(item[0] ?? "").trim();
      const detail = String(item[1] ?? "").trim();

      return label && detail ? [label, detail] : null;
    })
    .filter((item): item is [string, string] => Boolean(item));

  return items.length ? items : defaultAboutSettings.metaItems;
}

function normaliseSettings(row: AboutSettingsRow | null): AboutPageSettings {
  if (!row) {
    return defaultAboutSettings;
  }

  return {
    id: row.id,
    heroLabel: row.hero_label || defaultAboutSettings.heroLabel,
    heroTitle: row.hero_title || defaultAboutSettings.heroTitle,
    intro: row.intro || defaultAboutSettings.intro,
    closing: row.closing || defaultAboutSettings.closing,
    metaItems: normaliseMetaItems(row.meta_items)
  };
}

function normaliseBlock(row: AboutBlockRow): AboutPageBlock | null {
  if (!row.title || !isSection(row.section) || !isKind(row.kind)) {
    return null;
  }

  return {
    id: row.id,
    section: row.section,
    kind: row.kind,
    label: row.label,
    title: row.title,
    body: row.body,
    reference: row.reference,
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active ?? true
  };
}

function fallbackContent(setupMissing = false): AboutPageContent {
  return {
    settings: defaultAboutSettings,
    blocks: defaultAboutBlocks,
    source: "fallback",
    setupMissing
  };
}

export function blockReferenceItems(value: string | null | undefined) {
  return (value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function metaItemsToLines(items: Array<[string, string]>) {
  return items.map(([label, value]) => `${label}: ${value}`).join("\n");
}

export function parseMetaItemsFromLines(value: string) {
  const items = value
    .split(/\r?\n/)
    .map((line): [string, string] | null => {
      const separatorIndex = line.search(/[:|]/);

      if (separatorIndex < 0) {
        return null;
      }

      const label = line.slice(0, separatorIndex).trim();
      const detail = line.slice(separatorIndex + 1).trim();

      return label && detail ? [label, detail] : null;
    })
    .filter((item): item is [string, string] => Boolean(item));

  return items.slice(0, 8);
}

export async function getAboutPageContent(
  options: { includeInactive?: boolean } = {}
): Promise<AboutPageContent> {
  try {
    const supabase = createSupabaseAdminClient();
    const [settingsResult, blocksResult] = await Promise.all([
      supabase
        .from("about_page_settings")
        .select("id, hero_label, hero_title, intro, closing, meta_items")
        .eq("id", "main")
        .maybeSingle(),
      supabase
        .from("about_page_blocks")
        .select("id, section, kind, label, title, body, reference, sort_order, is_active")
        .order("section", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    ]);

    if (settingsResult.error || blocksResult.error) {
      return fallbackContent(true);
    }

    const blocks = ((blocksResult.data ?? []) as AboutBlockRow[])
      .map(normaliseBlock)
      .filter((block): block is AboutPageBlock => Boolean(block))
      .filter((block) => options.includeInactive || block.isActive)
      .sort((left, right) => left.sortOrder - right.sortOrder);

    return {
      settings: normaliseSettings(settingsResult.data as AboutSettingsRow | null),
      blocks,
      source: "database",
      setupMissing: false
    };
  } catch {
    return fallbackContent(true);
  }
}
