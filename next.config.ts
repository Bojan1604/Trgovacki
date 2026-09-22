import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
