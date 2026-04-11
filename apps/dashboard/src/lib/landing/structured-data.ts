// apps/dashboard/src/lib/landing/structured-data.ts

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type':    'Organization',
  name:       'Hyperlocal Technologies Sdn Bhd',
  url:        'https://hyperlocal.app',
  logo:       'https://hyperlocal.app/images/logo.png',
  sameAs: [
    'https://www.facebook.com/hyperlocal.app',
    'https://www.instagram.com/hyperlocal.app',
    'https://www.linkedin.com/company/hyperlocal-app',
  ],
  contactPoint: {
    '@type':             'ContactPoint',
    contactType:         'customer support',
    availableLanguage:   ['English', 'Bahasa Malaysia'],
    url:                 'https://hyperlocal.app/contact',
  },
  address: {
    '@type':           'PostalAddress',
    addressCountry:    'MY',
    addressRegion:     'Kuala Lumpur',
  },
};

export const softwareApplicationSchema = {
  '@context':        'https://schema.org',
  '@type':           'SoftwareApplication',
  name:              'Hyperlocal Merchant OS',
  applicationCategory: 'BusinessApplication',
  operatingSystem:   'Web, iOS, Android',
  url:               'https://hyperlocal.app',
  description:       'All-in-one merchant operating system for Malaysian SMEs with POS, marketplace sync, accounting, and AI agents.',
  offers: {
    '@type':         'Offer',
    price:           '99',
    priceCurrency:   'MYR',
    priceSpecification: {
      '@type':         'UnitPriceSpecification',
      price:           99,
      priceCurrency:   'MYR',
      unitText:        'MONTH',
    },
  },
  aggregateRating: {
    '@type':        'AggregateRating',
    ratingValue:    '4.8',
    reviewCount:    '127',
    bestRating:     '5',
    worstRating:    '1',
  },
};

export const faqSchema = (faqs: Array<{ q: string; a: string }>) => ({
  '@context': 'https://schema.org',
  '@type':    'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type':          'Question',
    name:             faq.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text:    faq.a,
    },
  })),
});

export const breadcrumbSchema = (items: Array<{ name: string; url: string }>) => ({
  '@context': 'https://schema.org',
  '@type':    'BreadcrumbList',
  itemListElement: items.map((item, idx) => ({
    '@type':   'ListItem',
    position:  idx + 1,
    name:      item.name,
    item:      item.url,
  })),
});
