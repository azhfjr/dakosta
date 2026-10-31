import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const DEFAULT_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

function mapOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() || DEFAULT_MAP_STYLE_URL;
  if (raw.startsWith("/")) return [];
  try {
    return [...new Set([new URL(raw).origin])];
  } catch {
    return ["https://tiles.openfreemap.org"];
  }
}

const mapSources = mapOrigins();
const connectSources = ["'self'", ...mapSources, ...(isDev ? ["ws:", "wss:"] : [])];
const imageSources = ["'self'", "data:", "blob:", ...mapSources];

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src ${imageSources.join(" ")}`,
  "font-src 'self' data:",
  `connect-src ${connectSources.join(" ")}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "media-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()",
  },
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Authed pages read cookies/session on every request; prerendering them fails.
  cacheComponents: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
