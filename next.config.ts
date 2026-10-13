import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // מד ההסלמה ישראל–איראן הוא דף סטטי ב-public/iran
  async rewrites() {
    return [{ source: "/iran", destination: "/iran/index.html" }];
  },
};

export default nextConfig;
