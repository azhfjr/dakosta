import type { Metadata } from "next";
import { BookOpen, FileSpreadsheet, ShieldCheck } from "lucide-react";

import { ContentImportWizard } from "@/components/imports/content-import-wizard";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import {
  CONTENT_IMPORT_MAX_ROWS,
  CONTENT_IMPORT_REQUIRED,
} from "@/lib/imports/content";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = {
  title: "Impor konten",
};

export const dynamic = "force-dynamic";

const COLUMNS: Array<{
  name: string;
  required: boolean;
  example: string;
  note: string;
}> = [
  {
    name: "organisasi",
    required: true,
    example: "FKTP-BDG-001 atau Nama Organisasi",
    note: "Kode Faskes atau nama organisasi persis seperti pada direktori.",
  },
  {
    name: "judul",
    required: false,
    example: "Edukasi Mobile JKN",
    note: "Maksimal 140 karakter.",
  },
  {
    name: "tautan",
    required: true,
    example: "https://www.instagram.com/p/…",
    note: "URL https konten. Tautan ganda otomatis ditolak.",
  },
  {
    name: "platform",
    required: true,
    example: "instagram, facebook, x, tiktok, youtube, website",
    note: "Nama platform atau singkatan yang didukung.",
  },
  {
    name: "jenis_konten",
    required: true,
    example: "video / infografis",
    note: "Hanya Video atau Infografis.",
  },
  {
    name: "tema_utama",
    required: true,
    example: "edufast / non-edufast",
    note: "EDUFAST mengikuti kebijakan sub-tema bulan berjalan.",
  },
  {
    name: "sub_tema",
    required: true,
    example: "mobile jkn",
    note: "Salah satu dari enam sub-tema kanonik.",
  },
  {
    name: "narasi",
    required: true,
    example: "Ringkasan konten minimal 40 karakter.",
    note: "Tanpa data pribadi (NIK, JKN, nomor identitas).",
  },
  {
    name: "tanggal_konten",
    required: true,
    example: "2026-10-05",
    note: "Tanggal konten dibuat, tidak boleh di masa depan.",
  },
  {
    name: "tanggal_terbit",
    required: false,
    example: "2026-10-06",
    note: "Opsional, tidak boleh di masa depan.",
  },
  {
    name: "lintang / bujur",
    required: false,
    example: "-6.9147 / 107.6098",
    note: "Opsional. Bila kosong memakai koordinat organisasi.",
  },
  {
    name: "lokasi",
    required: false,
    example: "Kantor FKTP Bandung",
    note: "Label lokasi. Bila kosong memakai nama organisasi.",
  },
];

export default async function AdminContentImportPage() {
  const admin = await requireRole("ADMIN");

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Master Admin"
        title="Impor konten massal"
        description="Unggah konten dari banyak Faskes, Pemda, dan stakeholder sekaligus. Setiap baris valid langsung dikirim ke antrean validasi cabang, tanpa melewati proses review."
      />

      <section
        aria-labelledby="cara-pakai"
        className="rounded-xl border border-border bg-surface p-5 shadow-sm"
      >
        <h2
          id="cara-pakai"
          className="flex items-center gap-2 text-base font-semibold text-foreground"
        >
          <BookOpen className="size-4 text-brand-blue-600" aria-hidden />
          Cara penggunaan
        </h2>
        <ol className="mt-3 grid gap-3 text-sm text-ink-muted sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              "1. Unduh template",
              "Buka template CSV terbaru agar nama kolom sesuai.",
            ],
            [
              "2. Isi baris konten",
              `Satu baris satu konten, maksimal ${CONTENT_IMPORT_MAX_ROWS} baris per berkas.`,
            ],
            [
              "3. Pratinjau & validasi",
              "Sistem memeriksa organisasi, tautan, taksonomi, PII, dan kebijakan EDUFAST.",
            ],
            [
              "4. Konfirmasi impor",
              "Masukkan kata sandi Anda. Konten valid dikirim ke antrean validasi.",
            ],
          ].map(([title, body]) => (
            <li key={title} className="rounded-lg border border-border/70 p-3">
              <p className="text-sm font-medium text-foreground">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed">{body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck
              className="size-3.5 text-status-approved"
              aria-hidden
            />
            Konten terdeteksi memuat NIK/JKN otomatis ditolak.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck
              className="size-3.5 text-status-approved"
              aria-hidden
            />
            Impor tidak pernah berstatus disetujui; validasi tetap di cabang.
          </span>
        </div>
      </section>

      <ContentImportWizard readOnly={admin.isDemo} />

      <section
        aria-labelledby="referensi-kolom"
        className="rounded-xl border border-border bg-surface shadow-sm"
      >
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <FileSpreadsheet className="size-4 text-ink-muted" aria-hidden />
          <h2
            id="referensi-kolom"
            className="text-base font-semibold text-foreground"
          >
            Referensi kolom template
          </h2>
        </div>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <caption className="sr-only">Kolom template impor konten</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-ink-muted uppercase">
                <th scope="col" className="px-5 py-2.5">
                  Kolom
                </th>
                <th scope="col" className="px-5 py-2.5">
                  Wajib
                </th>
                <th scope="col" className="px-5 py-2.5">
                  Contoh
                </th>
                <th scope="col" className="px-5 py-2.5">
                  Keterangan
                </th>
              </tr>
            </thead>
            <tbody>
              {COLUMNS.map((column) => (
                <tr
                  key={column.name}
                  className="border-b border-border/70 last:border-0"
                >
                  <td className="px-5 py-2.5 font-mono text-xs text-foreground">
                    {column.name}
                  </td>
                  <td className="px-5 py-2.5 text-ink-muted">
                    {column.required ? "Wajib" : "Opsional"}
                  </td>
                  <td className="px-5 py-2.5 text-ink-muted">
                    {column.example}
                  </td>
                  <td className="px-5 py-2.5 text-ink-muted">{column.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-5 py-3 text-xs text-ink-muted">
          Kolom wajib: {CONTENT_IMPORT_REQUIRED.join(", ")}. Baris dengan tautan
          yang sudah terdaftar pada konten aktif akan ditolak agar tidak terjadi
          duplikasi.
        </p>
      </section>
    </PageContainer>
  );
}
