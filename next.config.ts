import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Razvojni i produkcijski build imaju odvojene mape.
   *
   * Dijele li istu, `npm run dev` i `npm run serve` pišu jedan preko drugoga:
   * pokrenuti produkcijski poslužitelj gubi svoje datoteke, a razvojni javlja
   * da ne može naći svoje. Ovako se mogu izmjenjivati bez ponovnog buildanja.
   */
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
