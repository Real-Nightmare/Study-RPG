/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pg', 'pgvector', 'ws', 'socket.io'],
  },
};

module.exports = nextConfig;
