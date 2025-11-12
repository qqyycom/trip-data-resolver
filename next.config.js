const path = require("path")

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  outputFileTracingRoot: path.join(__dirname, ".."),
}

module.exports = nextConfig
