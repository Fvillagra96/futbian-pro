const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Aquí silenciamos el error de turbopack que te apareció antes
  turbopack: {},
  
  // Si tienes otras configuraciones (como imágenes), van aquí
  images: {
    unoptimized: true,
  },
};

module.exports = withPWA(nextConfig);