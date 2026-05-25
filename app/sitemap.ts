import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const publicRoutes = [
    siteConfig.routes.home,
    siteConfig.routes.about,
    siteConfig.routes.portfolio,
    siteConfig.routes.albums,
    "/privacy",
    "/terms"
  ];

  return publicRoutes.map((route) => ({
    url: new URL(route, siteConfig.url).toString(),
    lastModified: now,
    changeFrequency: route === siteConfig.routes.home ? "weekly" : "monthly",
    priority: route === siteConfig.routes.home ? 1 : 0.7
  }));
}
