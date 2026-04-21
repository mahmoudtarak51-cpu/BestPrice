import process from 'node:process';

const apiBaseUrl = (
  process.env.API_BASE_URL ?? 'http://127.0.0.1:3001/api/v1'
).replace(/\/$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
