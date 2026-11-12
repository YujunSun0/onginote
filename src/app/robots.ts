import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://onginote.vercel.app";

/** 검색엔진에는 소개 화면과 약관 문서만 보여 준다. 나머지는 로그인해야 보이는 화면이다. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/$", "/landing/", "/_next/", "/terms", "/privacy", "/ai-notice"], disallow: "/" },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
