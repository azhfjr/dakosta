import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

// Self-hosted so production builds never depend on fetching Google Fonts.
const jakarta = localFont({
  src: "./fonts/PlusJakartaSans-latin-var.woff2",
  variable: "--font-plus-jakarta",
  weight: "200 800",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "DAKOSTA — Dashboard Konten Kolaborasi Stakeholder",
    template: "%s · DAKOSTA",
  },
  description:
    "Dasbor kolaborasi konten stakeholder: pelaporan, validasi berjenjang, capaian, peta, dan analitik. Proyek pribadi nonkomersial.",
  applicationName: "DAKOSTA",
  authors: [{ name: "Ratu Sevilla Hizriyah" }],
  keywords: [
    "DAKOSTA",
    "dashboard konten",
    "kolaborasi stakeholder",
    "pelaporan konten",
  ],
  icons: {
    icon: [
      { url: "/brand/dakosta-icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/brand/dakosta-icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/dakosta-app-icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/brand/dakosta-icon-180.png", sizes: "180x180" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "DAKOSTA",
    title: "DAKOSTA — Dashboard Konten Kolaborasi Stakeholder",
    description:
      "Alur pelaporan konten, validasi reviewer cabang, dan capaian yang dihitung dari konten disetujui.",
  },
};

export const viewport: Viewport = {
  themeColor: "#006B3C",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#konten"
          className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Lewati ke konten utama
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
