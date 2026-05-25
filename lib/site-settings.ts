import { siteConfig } from "@/config/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SiteSocialLink = {
  label: string;
  handle: string;
  href: string;
  detail: string;
};

export type SiteContactSettings = {
  id: string;
  contactEmail: string;
  contactPhone: string | null;
  location: string;
  instagramHandle: string;
  instagramUrl: string;
  threadsHandle: string | null;
  threadsUrl: string | null;
  linkedinHandle: string | null;
  linkedinUrl: string | null;
  youtubeHandle: string | null;
  youtubeUrl: string | null;
  socialLinks: SiteSocialLink[];
  source: "database" | "fallback";
  setupMissing: boolean;
};

type SiteContactSettingsRow = {
  id: string;
  contact_email: string | null;
  contact_phone: string | null;
  location: string | null;
  instagram_handle: string | null;
  instagram_url: string | null;
  threads_handle: string | null;
  threads_url: string | null;
  linkedin_handle: string | null;
  linkedin_url: string | null;
  youtube_handle: string | null;
  youtube_url: string | null;
};

function clean(value: string | null | undefined) {
  const next = value?.trim();

  return next ? next : null;
}

function socialLinksFromSettings(
  settings: Omit<SiteContactSettings, "socialLinks" | "source" | "setupMissing">
): SiteSocialLink[] {
  return [
    clean(settings.instagramUrl)
      ? {
          label: "Instagram",
          handle: clean(settings.instagramHandle) ?? "@rxncor.studio",
          href: settings.instagramUrl,
          detail: "Recent work, behind-the-scenes frames, and updates."
        }
      : null,
    clean(settings.threadsUrl)
      ? {
          label: "Threads",
          handle: clean(settings.threadsHandle) ?? "rxncor.studio",
          href: settings.threadsUrl,
          detail: "Short updates and work-in-progress notes."
        }
      : null,
    clean(settings.linkedinUrl)
      ? {
          label: "LinkedIn",
          handle: clean(settings.linkedinHandle) ?? "Malindu Herath",
          href: settings.linkedinUrl,
          detail: "Creative, software, and systems background."
        }
      : null,
    clean(settings.youtubeUrl)
      ? {
          label: "YouTube",
          handle: clean(settings.youtubeHandle) ?? "rxncor.studio",
          href: settings.youtubeUrl,
          detail: "Video work and longer-form visual stories."
        }
      : null
  ].filter((link): link is SiteSocialLink => Boolean(link));
}

export const fallbackSiteContactSettings: SiteContactSettings = {
  id: "main",
  contactEmail: siteConfig.contactEmail,
  contactPhone: siteConfig.contactPhone || null,
  location: siteConfig.location,
  instagramHandle: siteConfig.instagramHandle,
  instagramUrl: siteConfig.instagramUrl,
  threadsHandle: null,
  threadsUrl: null,
  linkedinHandle: null,
  linkedinUrl: null,
  youtubeHandle: null,
  youtubeUrl: null,
  socialLinks: siteConfig.socialLinks,
  source: "fallback",
  setupMissing: false
};

function normaliseSettings(
  row: SiteContactSettingsRow | null,
  setupMissing = false
): SiteContactSettings {
  if (!row) {
    return {
      ...fallbackSiteContactSettings,
      setupMissing
    };
  }

  const base = {
    id: row.id,
    contactEmail: clean(row.contact_email) ?? fallbackSiteContactSettings.contactEmail,
    contactPhone: clean(row.contact_phone),
    location: clean(row.location) ?? fallbackSiteContactSettings.location,
    instagramHandle:
      clean(row.instagram_handle) ?? fallbackSiteContactSettings.instagramHandle,
    instagramUrl: clean(row.instagram_url) ?? fallbackSiteContactSettings.instagramUrl,
    threadsHandle: clean(row.threads_handle),
    threadsUrl: clean(row.threads_url),
    linkedinHandle: clean(row.linkedin_handle),
    linkedinUrl: clean(row.linkedin_url),
    youtubeHandle: clean(row.youtube_handle),
    youtubeUrl: clean(row.youtube_url)
  };

  return {
    ...base,
    socialLinks: socialLinksFromSettings(base),
    source: "database",
    setupMissing: false
  };
}

export async function getSiteContactSettings(): Promise<SiteContactSettings> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("site_contact_settings")
      .select(
        "id, contact_email, contact_phone, location, instagram_handle, instagram_url, threads_handle, threads_url, linkedin_handle, linkedin_url, youtube_handle, youtube_url"
      )
      .eq("id", "main")
      .maybeSingle();

    if (error) {
      return normaliseSettings(null, true);
    }

    return normaliseSettings(data as SiteContactSettingsRow | null);
  } catch {
    return normaliseSettings(null, true);
  }
}
