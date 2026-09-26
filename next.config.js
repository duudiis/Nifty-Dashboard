/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // The dashboard is served behind a reverse proxy that terminates TLS.
    poweredByHeader: false,
    images: {
        // Artwork comes from many third-party hosts; we render with plain <img>.
        unoptimized: true
    },
    // The dashboard used to live under /dashboard; it is now the site root.
    // Old links (and anything still bookmarked) land on the matching new page —
    // /dashboard/album/spotify/xyz → /album/spotify/xyz. Temporary (307) rather
    // than permanent (308), which browsers cache indefinitely — that would make
    // the prefix impossible to reclaim later.
    async redirects() {
        return [
            { source: "/dashboard", destination: "/", permanent: false },
            { source: "/dashboard/:path*", destination: "/:path*", permanent: false }
        ];
    }
};

export default nextConfig;
