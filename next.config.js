/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a production build run beside `next dev` without sharing its cache: NEXT_DIST_DIR=.next-prod
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: { serverComponentsExternalPackages: ['pdfjs-dist'] },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};
module.exports = nextConfig;