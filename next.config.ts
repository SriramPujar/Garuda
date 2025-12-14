import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const config: NextConfig = {
  // your next config
};

const withPWAConfig = withPWA({
  dest: "public",
  disable: true, // TEMPORARY: Force disable to clear client cache
  register: true,
  skipWaiting: true,
});

export default withPWAConfig(config);
