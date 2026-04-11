// apps/dashboard/src/app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { 
        userAgent: '*', 
        allow: ['/', '/landing', '/pricing', '/solutions', '/platform'], 
        disallow: ['/api/', '/_next/', '/dashboard/', '/admin/', '/pos/'] 
      },
    ],
    sitemap: 'https://dashboard.hyperlocal.app/sitemap.xml',
    host:    'https://dashboard.hyperlocal.app',
  };
}
