import withPWA from "@ducanh2912/next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
    eslint: { ignoreDuringBuilds: true },
    typescript: { ignoreBuildErrors: true },
};

export default withPWA({
    dest: "public",
    disable: true, // TEMPORARY: Force disable to clear client cache
    register: true,
    skipWaiting: true,
})(nextConfig);
