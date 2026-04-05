import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: [
    'recharts',
    '@project1/agent',
    '@project1/domain',
    '@project1/support-agent',
    '@project1/db'
  ],
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
  typescript: {
    ignoreBuildErrors: true,
  },
  outputFileTracingRoot: path.resolve(__dirname, "../../"),
  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },
};

export default nextConfig;
