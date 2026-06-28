import type { MetadataRoute } from 'next'

// This app is a logged-in business tool, not a content site — every route
// past /login requires auth and shows nothing to a crawler but a login
// screen. There's no SEO upside to indexing app internals, and doing so
// just risks Google flagging soft-404/login-wall pages. Disallow
// everything except the login page itself, which is the only page a
// search result pointing here would ever usefully show.
export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://construction-manager-web.vercel.app'

  return {
    rules: {
      userAgent: '*',
      allow: ['/login'],
      disallow: ['/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
