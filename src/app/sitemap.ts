import type { MetadataRoute } from 'next'

// Only /login is actually public — everything else requires
// authentication and would just show a redirect to a crawler. A sitemap
// listing routes a crawler can't meaningfully access provides no SEO
// value and can look like a soft-404 farm to search engines, so this
// stays intentionally minimal rather than listing every app route.
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://construction-manager-web.vercel.app'

  return [
    {
      url: `${siteUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
