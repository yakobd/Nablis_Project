/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ['@nablis/ui', '@nablis/shared', '@nablis/i18n'],
  webpack: (config) => {
    // Prevent bundling Node-only modules that firebase-admin pulls in
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      child_process: false,
    };
    return config;
  },
};

module.exports = nextConfig;
