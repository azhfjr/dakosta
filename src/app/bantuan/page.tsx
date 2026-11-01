import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ClipboardCheck, KeyRound, MapPin } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SiteFooter } from "@/components/site-footer";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = {
  title: "Bantuan",
  description: "Panduan singkat penggunaan ruang kerja DAKOSTA.",
};

const guides = [
  {
    title: "Stakeholder",
    icon: MapPin,
    steps: [
      "Masuk dengan akun yang diberikan Master Admin.",
      "Buka Lapor Konten dan isi jenis konten, tema, narasi, serta URL publikasi.",
      "Tandai lokasi dengan GPS, pin manual, atau lokasi organisasi.",
      "Simpan draf, lalu kirim. Catat nomor referensi yang muncul.",
      "Pantau status dan alasan revisi pada halaman Konten Saya.",
    ],
  },
  {
    title: "Reviewer cabang",
    icon: ClipboardCheck,
    steps: [
      "Masuk dengan akun Branch Admin untuk cabang Anda.",
      "Buka antrean review cabang, lalu mulai tinjau konten yang masuk.",
      "Periksa detail, checklist, lokasi, dan riwayat sebelum memutuskan.",
      "Setujui, minta revisi, atau tolak dengan alasan yang jelas.",
      "Capaian dan notifikasi diperbarui setelah keputusan tersimpan.",
    ],
  },
  {
    title: "Master & wilayah",
    icon: KeyRound,
    steps: [
      "Master Admin mengelola wilayah, cabang, organisasi, akun, dan kebijakan EDUFAST.",
      "Regional Admin memiliki akses baca untuk wilayah yang ditugaskan.",
      "Perubahan peran atau cakupan langsung berlaku pada permintaan berikutnya.",
      "Semua akses API diverifikasi di server, termasuk cakupan data.",
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

      <main
        id="konten"
        className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6"
      >
        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-wide text-brand-teal-700 uppercase">
            Bantuan
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-brand-blue-900">
            Panduan singkat ruang kerja
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-ink-muted">
            DAKOSTA memisahkan peran Master Admin, Regional Admin, Branch Admin,
            dan Stakeholder. Setiap peran hanya melihat data sesuai cakupannya.
            {isDemoMode ? " Semua data adalah sintetis." : null}
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
            terputus, kotak notifikasi tetap memuat data tersimpan. Untuk
            masalah peta, gunakan daftar lokasi di bawah peta. Untuk masalah
            akses, keluar lalu masuk kembali dengan akun Anda.
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
