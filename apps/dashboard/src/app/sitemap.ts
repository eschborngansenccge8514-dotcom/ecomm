// apps/dashboard/src/app/sitemap.ts
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://dashboard.hyperlocal.app'; // Updated to match dashboard domain
  const now     = new Date();

  return [
    {
      url:            baseUrl,
      lastModified:   now,
      changeFrequency: 'weekly',
      priority:       1.0,
    },
    {
      url:            `${baseUrl}/landing`,
      lastModified:   now,
      changeFrequency: 'weekly',
      priority:       0.9,
    },
    {
      url:            `${baseUrl}/pricing`,
      lastModified:   now,
      changeFrequency: 'monthly',
      priority:       0.8,
    },
    {
      url:            `${baseUrl}/privacy-policy`,
      lastModified:   now,
      changeFrequency: 'monthly',
      priority:       0.3,
    },
    {
      url:            `${baseUrl}/terms`,
      lastModified:   now,
      changeFrequency: 'monthly',
      priority:       0.3,
    },
    {
      url:            `${baseUrl}/cookie-policy`,
      lastModified:   now,
      changeFrequency: 'monthly',
      priority:       0.3,
    },
  ];
}
