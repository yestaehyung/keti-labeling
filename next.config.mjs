/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '166.104.112.110',
        port: '8000',
        pathname: '/images/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/images/:path*',
        destination: 'http://166.104.112.110:8000/images/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://166.104.112.110:8000/api/:path*',
      },
    ]
  },
}

export default nextConfig
