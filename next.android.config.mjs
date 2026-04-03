import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: { ignoreDuringBuilds: true },
    typescript: { ignoreBuildErrors: true },
    output: 'export',
    trailingSlash: true,
    images: { unoptimized: true },
};

// For Android static builds, we skip PWA as it conflicts with static export
export default nextConfig;
