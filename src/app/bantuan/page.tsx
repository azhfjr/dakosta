import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck, KeyRound, MapPin } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Bantuan",
  description: "Panduan singkat penggunaan ruang demo DAKOSTA.",
};

const guides = [
  {
    title: "Untuk Client",
    icon: MapPin,
    steps: [
      "Masuk dengan akun penguji dari Admin demo.",
      "Buka Laporkan Konten dan isi narasi, URL publikasi, serta tema.",
      "Tandai lokasi dengan GPS (opsional) atau pin manual.",
      "Simpan draf, lalu kirim. Catat nomor referensi yang muncul.",
      "Pantau status dan alasan revisi pada halaman Konten Saya.",
    ],
  },
  {
    title: "Untuk Admin",
    icon: ClipboardCheck,
    steps: [
      "Masuk dengan akun Admin demo.",
      "Buka Validation Center untuk melihat antrean terbaru.",
      "Periksa detail, checklist, lokasi, dan riwayat sebelum memutuskan.",
      "Approve, minta revisi, atau tolak dengan alasan yang jelas.",
      "Capaian dan notifikasi diperbarui setelah keputusan tersimpan.",
    ],
  },
  {
    title: "Keamanan akun",
    icon: KeyRound,
    steps: [
      "Registrasi publik ditutup; akun dibuat oleh Admin demo.",
      "Kata sandi sementara wajib diganti saat pertama masuk.",
      "Jangan bagikan sesi atau kata sandi demo di luar pengujian.",
      "Semua akses API diverifikasi di server, termasuk kepemilikan data.",
    ],
  },
];

export default function BantuanPage() {
  return (
    <>
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Kembali ke beranda DAKOSTA">
            <BrandLogo priority className="w-[9.5rem]" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Beranda
          </Link>
        </div>
      </header>

      <main id="konten" className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-wide text-brand-teal-700 uppercase">
            Bantuan
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-brand-blue-900">
            Panduan singkat ruang demo
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-ink-muted">
            DAKOSTA mendemonstrasikan dua peran: Client yang melaporkan konten
            dan Admin yang memvalidasi. Semua data adalah sintetis.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {guides.map((guide) => (
            <section
              key={guide.title}
              className="rounded-2xl border border-border bg-surface p-6"
              aria-labelledby={`guide-${guide.title}`}
            >
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-blue-100/60 text-brand-blue-700">
                <guide.icon className="size-5" aria-hidden />
              </span>
              <h2
                id={`guide-${guide.title}`}
                className="mt-4 text-lg font-semibold text-foreground"
              >
                {guide.title}
              </h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-muted">
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-surface-muted/60 p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Jika sesuatu tidak berjalan
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Notifikasi realtime memiliki fallback polling; jika koneksi realtime
            terputus, kotak notifikasi tetap memuat data tersimpan. Untuk masalah
            peta, gunakan daftar lokasi di bawah peta. Untuk masalah akses,
            keluar lalu masuk kembali dengan akun penguji Anda.
          </p>
          <p className="mt-3 text-sm text-ink-muted">
            Catatan: proyek ini tidak menyediakan dukungan operasional
            institusional.
          </p>
        </div>
      </main>

      <SiteFooter compact />
    </>
  );
}
