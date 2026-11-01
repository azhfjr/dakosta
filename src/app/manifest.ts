import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DAKOSTA — Dashboard Konten Kolaborasi Stakeholder",
    short_name: "DAKOSTA",
    description:
      "Demonstrasi alur pelaporan konten stakeholder, validasi admin, dan capaian berbasis konten disetujui.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#006B3C",
    lang: "id",
    icons: [
      {
        src: "/brand/dakosta-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand/dakosta-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
