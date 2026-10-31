import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Tentang & Disclaimer",
  description:
    "Identitas proyek, batas penggunaan, dan disclaimer DAKOSTA sebagai demonstrasi pribadi nonkomersial.",
};

export default function TentangPage() {
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
        <article className="space-y-10">
          <header className="space-y-4">
            <p className="text-sm font-semibold tracking-wide text-brand-teal-700 uppercase">
              Tentang proyek
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-brand-blue-900 sm:text-4xl">
              DAKOSTA — Dashboard Konten Kolaborasi Stakeholder
            </h1>
            <p className="max-w-3xl text-base leading-relaxed text-ink-muted">
              DAKOSTA adalah proyek pribadi independen yang dibuat oleh Ratu
              Sevilla Hizriyah untuk belajar full-stack, mendemonstrasikan alur
              kerja kolaborasi, dan menjadi bagian portofolio. Aplikasi ini bukan
              sistem resmi, bukan produk institusi, dan tidak digunakan untuk
              operasi nyata.
            </p>
            <div className="h-1.5 w-28 rounded-full brand-rule" aria-hidden />
          </header>

          <section
            aria-labelledby="disclaimer"
            className="rounded-2xl border border-warning/30 bg-warning/5 p-6"
          >
            <h2
              id="disclaimer"
              className="text-lg font-semibold text-foreground"
            >
              Disclaimer
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Proyek demonstrasi pribadi. Tidak berafiliasi dengan atau
              mewakili BPJS Kesehatan. Konteks BPJS Kesehatan Cabang Bandung dan
              Program JKN hanya digunakan sebagai inspirasi studi kasus untuk
              kategori pengguna, skema konten, dan visualisasi. Tidak ada
              kemitraan, pengesahan, penugasan, atau akses ke sistem dan data
              resmi.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Seluruh akun, stakeholder, lokasi, tautan, dan konten pada demo
              bersifat sintetis dan berlabel DEMO. Keputusan approval adalah
              simulasi oleh Admin demo, bukan validasi editorial institusional.
            </p>
          </section>

          <section aria-labelledby="data" className="space-y-3">
            <h2 id="data" className="text-lg font-semibold text-foreground">
              Data dan privasi
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink-muted">
              <li>
                Tidak ada data peserta, pasien, NIK, nomor kartu JKN, diagnosis,
                atau rekam medis.
              </li>
              <li>
                Tidak ada kontak pribadi nyata, daftar kontak internal, atau
                koordinat sensitif.
              </li>
              <li>
                Titik lokasi merupakan simulasi atau hasil penandaan manual yang
                diberi label tingkat verifikasi.
              </li>
              <li>
                Geolokasi perangkat hanya diminta setelah Anda memilih tindakan
                dan memberi izin; penandaan manual selalu tersedia.
              </li>
              <li>
                Data demo dapat direset oleh Admin demo. Reset tidak menyentuh
                data di luar dataset demo.
              </li>
            </ul>
          </section>

          <section aria-labelledby="status" className="space-y-3">
            <h2 id="status" className="text-lg font-semibold text-foreground">
              Status penggunaan
            </h2>
            <p className="text-sm leading-relaxed text-ink-muted">
              Proyek ini berjalan sebagai demonstrasi personal nonkomersial di
              Vercel Hobby sesuai ketentuan yang berlaku. Jika proyek kemudian
              digunakan untuk pekerjaan berbayar, kepentingan bisnis, atau
              operasi organisasi, paket dan izin harus dievaluasi ulang.
            </p>
          </section>

          <section aria-labelledby="kredit" className="space-y-3">
            <h2 id="kredit" className="text-lg font-semibold text-foreground">
              Kredit
            </h2>
            <p className="text-sm leading-relaxed text-ink-muted">
              Penggagas dan pemilik proyek: Ratu Sevilla Hizriyah. Identitas
              visual DAKOSTA menggunakan aset wordmark yang disetujui pemilik
              proyek. Peta menggunakan data OpenStreetMap melalui penyedia gaya
              peta yang mencantumkan atribusi.
            </p>
          </section>

          <p className="border-t border-border pt-6 text-sm text-ink-muted">
            <Link className="font-medium text-brand-blue-700 hover:underline" href="/masuk">
              Masuk ke ruang demo
            </Link>{" "}
            atau kembali ke{" "}
            <Link className="font-medium text-brand-blue-700 hover:underline" href="/">
              beranda
            </Link>
            .
          </p>
        </article>
      </main>

      <SiteFooter compact />
    </>
  );
}
