/** @type {import('next').NextConfig} */
const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

const nextConfig = (phase) => ({
  // Dev and production builds must not share generated chunks: a build can otherwise break a running dev server.
  distDir: process.env.NEXT_DIST_DIR || (phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next'),
  experimental: {
    // The local photo reader (PaddleOCR on ONNX) and sharp are native code: loaded from node_modules, not bundled.
    serverComponentsExternalPackages: ['pdfjs-dist', '@gutenye/ocr-node', '@gutenye/ocr-common', '@gutenye/ocr-models', 'onnxruntime-node', 'sharp'],
    // Hosts that trace files (e.g. Vercel) must ship the OCR models and the Linux runtime with the analyze route,
    // and can leave out the Windows and macOS runtimes (about 250 MB) that the same package carries.
    outputFileTracingIncludes: { '/api/analyze': ['./node_modules/@gutenye/ocr-models/**', './node_modules/onnxruntime-node/bin/napi-v6/linux/**'] },
    outputFileTracingExcludes: { '/api/analyze': ['./node_modules/onnxruntime-node/bin/napi-v6/win32/**', './node_modules/onnxruntime-node/bin/napi-v6/darwin/**'] },
  },
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
});
module.exports = nextConfig;
