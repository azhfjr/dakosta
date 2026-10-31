export type DuplicateMatch = {
  inScope: boolean;
  id: string;
  referenceCode: string;
  status: string;
  stakeholderName: string;
};

export type DuplicateDetails =
  | { inScope: false }
  | {
      inScope: true;
      submissionId: string;
      referenceCode: string;
      status: string;
      stakeholderName: string;
    };

// Identitas konten hanya boleh keluar saat duplikat berada dalam lingkup akses pelapor.
export function duplicateDetails(match: DuplicateMatch | null): DuplicateDetails {
  if (!match || !match.inScope) return { inScope: false };
  return {
    inScope: true,
    submissionId: match.id,
    referenceCode: match.referenceCode,
    status: match.status,
    stakeholderName: match.stakeholderName,
  };
}

export function duplicateMessage(match: DuplicateMatch | null): string {
  return match?.inScope
    ? "Tautan ini sudah pernah dilaporkan. Periksa daftar konten atau tetap kirim jika ini konten berbeda."
    : "Tautan ini sudah pernah dilaporkan. Periksa daftar konten Anda, atau tetap kirim jika ini konten berbeda.";
}
