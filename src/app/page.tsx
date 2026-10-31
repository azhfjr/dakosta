import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  ClipboardCheck,
  Database,
  MapPin,
  ShieldCheck,
  ChartNoAxesCombined,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { isDemoMode } from "@/lib/env";

const workflow = [
  {
    title: "Stakeholder melapor",
    description:
      "Konten, tautan publikasi, tema, dan lokasi wajib dicatat dalam draf yang dapat disimpan.",
    icon: MapPin,
  },
  {
    title: "Reviewer cabang memvalidasi",
    description:
      "Antrean review per cabang dengan checklist, riwayat revisi, dan keputusan yang tercatat di audit log.",
    icon: ClipboardCheck,
  },
  {
    title: "Capaian dihitung",
    description:
      "Hanya konten berstatus APPROVED yang masuk KPI. Angka dihitung dari query database.",
    icon: ChartNoAxesCombined,
  },
];

export default function HomePage() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="DAKOSTA — beranda" className="shrink-0">
            <BrandLogo priority className="w-[9.5rem] sm:w-[11rem]" />
          </Link>
          <nav aria-label="Navigasi utama" className="hidden items-center gap-6 text-sm sm:flex">
            <Link className="text-ink-muted hover:text-foreground" href="/tentang">
              Tentang
            </Link>
            <Link className="text-ink-muted hover:text-foreground" href="/bantuan">
              Bantuan
            </Link>
          </nav>
          <Button asChild className="h-10 px-4">
            <Link href="/masuk">
              Masuk
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </header>

      <main id="konten" className="flex-1">
        <section className="relative overflow-hidden border-b border-border">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1.5 brand-rule"
          />
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-24">
            <div className="flex flex-col justify-center gap-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-brand-blue-100 bg-brand-blue-100/50 px-3 py-1 text-xs font-semibold tracking-wide text-brand-blue-800 uppercase">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  Proyek demonstrasi pribadi
                </span>
                {isDemoMode ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-muted px-3 py-1 text-xs font-medium text-ink-muted">
                    Data sintetis · label DEMO
                  </span>
                ) : null}
              </div>

              <div className="space-y-5">
                <h1 className="max-w-2xl text-4xl leading-[1.08] font-semibold tracking-tight text-brand-blue-900 sm:text-5xl lg:text-[3.4rem]">
                  Dashboard Konten Kolaborasi Stakeholder yang dapat diaudit.
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
                  DAKOSTA menyatukan pelaporan stakeholder, validasi reviewer
                  cabang, dan pengukuran capaian dalam satu ruang kerja
                  berjenjang. Setiap angka berasal dari data yang tersimpan,
                  bukan grafik dekoratif.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="h-11 px-5">
                  <Link href="/masuk">
                    {isDemoMode ? "Masuk ke ruang demo" : "Masuk ke ruang kerja"}
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-11 px-5">
                  <Link href="/tentang">Pelajari batas proyek</Link>
                </Button>
              </div>

              <dl className="grid max-w-xl grid-cols-1 gap-4 pt-2 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-surface p-4">
                  <dt className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Database className="size-4 text-brand-teal-700" aria-hidden />
                    Persisten
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink-muted">
                    Data tersimpan di PostgreSQL, bukan di memori browser.
                  </dd>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <dt className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <BadgeCheck className="size-4 text-brand-green-700" aria-hidden />
                    Approved-only
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink-muted">
                    Status selain APPROVED tidak pernah dihitung sebagai capaian.
                  </dd>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <dt className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <ShieldCheck className="size-4 text-brand-blue-700" aria-hidden />
                    Server-side
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink-muted">
                    Peran dan akses diverifikasi pada setiap permintaan API.
                  </dd>
                </div>
              </dl>
            </div>

            <div className="flex items-center justify-center">
              <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-foreground">
                    Alur kerja inti
                  </p>
                  <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-muted">
                    4 tahap
                  </span>
                </div>
                <ol className="mt-6 space-y-5">
                  {workflow.map((step, index) => (
                    <li key={step.title} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-brand-blue-100 bg-brand-blue-100/60 text-sm font-semibold text-brand-blue-700">
                          {index + 1}
                        </span>
                        {index < workflow.length - 1 && (
                          <span
                            className="mt-2 h-full w-px bg-border"
                            aria-hidden
                          />
                        )}
                      </div>
                      <div className="space-y-1 pb-1">
                        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <step.icon
                            className="size-4 text-brand-teal-700"
                            aria-hidden
                          />
                          {step.title}
                        </p>
                        <p className="text-sm leading-relaxed text-ink-muted">
                          {step.description}
                        </p>
                      </div>
                    </li>
                  ))}
                  <li className="flex gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-brand-green-100 bg-brand-green-100/70 text-brand-green-700">
                      <BadgeCheck className="size-5" aria-hidden />
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        Capaian diperbarui
                      </p>
                      <p className="text-sm leading-relaxed text-ink-muted">
                        Notifikasi terkirim dan dashboard menghitung ulang dari
                        data terbaru.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {workflow.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-border bg-surface p-6"
              >
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-surface-muted text-brand-blue-700">
                  <item.icon className="size-5" aria-hidden />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-foreground">
                  {item.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-surface-muted/60">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                Batas penggunaan yang jelas
              </h2>
              <p className="text-sm leading-relaxed text-ink-muted">
                DAKOSTA adalah proyek personal nonkomersial untuk belajar,
                portofolio, dan alur kerja kolaborasi. Tidak ada data peserta,
                NIK, nomor JKN, atau rekam medis. Tidak ada klaim afiliasi
                institusional.
              </p>
            </div>
            <Button asChild variant="outline" className="h-10 shrink-0">
              <Link href="/tentang">Baca disclaimer lengkap</Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
