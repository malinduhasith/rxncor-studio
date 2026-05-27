export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  host: string;
  available: boolean;
};

function htmlEntityDecode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function metaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const propertyPattern = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const contentFirstPattern = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
    "i"
  );
  const match = html.match(propertyPattern) ?? html.match(contentFirstPattern);

  return match?.[1] ? htmlEntityDecode(match[1].trim()) : null;
}

function pageTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  return match?.[1]
    ? htmlEntityDecode(match[1].replace(/\s+/g, " ").trim())
    : null;
}

function absoluteUrl(value: string | null, baseUrl: string) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

export async function getLinkPreview(url: string): Promise<LinkPreview> {
  const parsed = new URL(url);
  const fallback = {
    url,
    title: null,
    description: null,
    imageUrl: null,
    host: parsed.hostname.replace(/^www\./, ""),
    available: false
  };

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "rxncor.studio link preview"
      },
      next: { revalidate: 60 * 60 },
      signal: AbortSignal.timeout(1800)
    });

    if (!response.ok) {
      return fallback;
    }

    const html = await response.text();
    const title = metaContent(html, "og:title") ?? pageTitle(html);
    const description =
      metaContent(html, "og:description") ?? metaContent(html, "description");
    const imageUrl = absoluteUrl(
      metaContent(html, "og:image") ?? metaContent(html, "twitter:image"),
      url
    );

    return {
      ...fallback,
      title,
      description,
      imageUrl,
      available: Boolean(title || description || imageUrl)
    };
  } catch {
    return fallback;
  }
}

export async function getLinkPreviewMap(urls: string[]) {
  const entries = await Promise.all(
    urls.map(async (url) => [url, await getLinkPreview(url)] as const)
  );

  return new Map(entries);
}
