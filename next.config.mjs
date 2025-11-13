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
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias.canvas = false;
    if (isServer) {
      if (typeof config.externals === 'function') {
        config.externals = config.externals({
          context: undefined, // Replace with actual context if needed
          request: 'better-sqlite3',
        });
      }
      if (Array.isArray(config.externals)) {
        config.externals.push('better-sqlite3');
      } else {
        config.externals = ['better-sqlite3'];
      }
    }
    return config;
  },
}

export default nextConfig
