/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a production build run beside `next dev` without sharing its cache: NEXT_DIST_DIR=.next-prod
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist', 'tesseract.js'],
    // Hosts that trace files (e.g. Vercel) must ship the OCR engine and its English data with the analyze route.
    outputFileTracingIncludes: { '/api/analyze': ['./node_modules/@tesseract.js-data/eng/4.0.0_best_int/**', './node_modules/tesseract.js-core/**', './node_modules/tesseract.js/src/worker-script/**'] },
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
};
module.exports = nextConfig;