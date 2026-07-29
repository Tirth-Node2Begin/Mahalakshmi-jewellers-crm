import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// The CRM is served under this obscure path on the website's domain (deploy its
// build into website/public_html/gate-7q4k9x2z/). Keep in sync with BASE_PATH in
// src/lib/auth.tsx. Everything (login, dashboard, assets, routes) sits below it.
const basePath = "/gate-7q4k9x2z";

const nextConfig: NextConfig = {
  // Static CSR export in prod only (dev keeps full routing) — planning/04 §1
  ...(isProd ? { output: "export" as const } : {}),
  basePath,
  // Folder-style URLs (/leads/ -> leads/index.html) so Apache serves each route
  // as a static file on hard-refresh/deep-link. Without this the export emits flat
  // leads.html + an EMPTY leads/ dir, and refreshing /gate-7q4k9x2z/leads 404s.
  // Matches the public website's config and the deploy .htaccess assumption.
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    optimizePackageImports: [
      "recharts",
      "lucide-react",
      "framer-motion",
      "date-fns",
      "cmdk",
      "react-day-picker",
    ],
  },
  compiler: {
    removeConsole: isProd ? { exclude: ["error", "warn"] } : false,
  },
};

export default nextConfig;
