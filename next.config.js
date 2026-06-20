/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // The dashboard is served behind a reverse proxy that terminates TLS.
    poweredByHeader: false,
    images: {
        // Artwork comes from many third-party hosts; we render with plain <img>.
        unoptimized: true
    }
};

export default nextConfig;
