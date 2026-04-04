import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['recharts'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dgafjyrittkskxlgswvf.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/einvoices',
        destination: '/einvoice',
        permanent: true,
      },
      {
        source: '/einvoices/:path*',
        destination: '/einvoice/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
