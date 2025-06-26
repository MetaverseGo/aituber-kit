/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  assetPrefix: process.env.BASE_PATH || '',
  basePath: process.env.BASE_PATH || '',
  trailingSlash: true,
  publicRuntimeConfig: {
    root: process.env.BASE_PATH || '',
  },
  optimizeFonts: false,

  // Build optimization for deployment size limits
  experimental: {
    outputFileTracingExcludes: {
      // Exclude large VRM and audio files from deployment
      '/': [
        './public/vrm/**/*',
        './public/live2d/**/*',
        './public/**/*.wav',
        './public/ogp.png',
      ],
    },
  },
}

module.exports = nextConfig
