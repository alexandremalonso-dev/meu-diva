/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,

  // 🔥 FORÇAR HTTPS 🔥
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },

  // 🔥 REDIRECIONAR HTTP PARA HTTPS 🔥
  async redirects() {
    return [
      {
        source: '/(.*)',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://meudiva-frontend-prod-592671373665.southamerica-east1.run.app/$1',
        permanent: true,
      },
    ];
  },

  // 🔥 HARDCODED PARA PRODUÇÃO 🔥
  env: {
    NEXT_PUBLIC_API_URL: 'https://meudiva-api-backend-592671373665.southamerica-east1.run.app',
    NEXT_PUBLIC_BACKEND_URL: 'https://meudiva-api-backend-592671373665.southamerica-east1.run.app',
    NEXT_PUBLIC_JITSI_DOMAIN: 'meet.meudivaonline.com',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_51H4FAoLNtSoib57pmajUlQax7grzafACvuU45P7BrbgOMIHfEN3OgCdMhg7gSg7KuFGZHEoSDD7XvjHZ0ctL11EN00kcTCQujB5',
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'meudivaonline.com' },
    ],
  },

  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;