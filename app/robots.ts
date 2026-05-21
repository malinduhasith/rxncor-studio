import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/portfolio", "/albums"],
        disallow: [
          "/admin",
          "/rxncor-admin",
          "/login",
          "/client",
          "/client-portal",
          "/api"
        ]
      }
    ],
    host: siteConfig.domain
  };
}
