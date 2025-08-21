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
        hostname: '114.110.129.109',
        port: '8000',
        pathname: '/images/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/images/:path*',
        destination: 'http://114.110.129.109:8000/images/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://114.110.129.109:8000/api/:path*',
      },
    ]
  },
}

export default nextConfig
