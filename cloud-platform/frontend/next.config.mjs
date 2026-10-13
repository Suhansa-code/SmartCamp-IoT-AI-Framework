/** @type {import('next').NextConfig} */
const devOrigins = process.env.NEXT_DEV_ALLOWED_ORIGINS
  ? process.env.NEXT_DEV_ALLOWED_ORIGINS
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : undefined

const nextConfig = {
  output: 'standalone',
  ...(devOrigins ? { allowedDevOrigins: devOrigins } : {}),
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_API_URL || 'http://localhost:3001'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
