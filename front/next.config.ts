import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // ✅ ESSENCIAL PARA O CLOUD RUN

  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'meudivaonline.com',
      },
      {
        protocol: 'https',
        hostname: '*.southamerica-east1.run.app',
      },
    ],
  },

  // ⚠️ REMOVIDO: rewrites hardcoded (causavam chamadas para localhost)
  // Agora o frontend chamará o backend diretamente via NEXT_PUBLIC_API_URL

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;