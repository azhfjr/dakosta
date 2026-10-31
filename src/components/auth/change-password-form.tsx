"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangePasswordForm({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const tooShort = newPassword.length > 0 && newPassword.length < 12;
  const mismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 12) {
      setError("Kata sandi baru minimal 12 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi kata sandi belum sama.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/v1/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string; code?: string; details?: unknown };
      };

      if (!response.ok) {
        setError(
          payload.error?.code === "UNAUTHORIZED"
            ? "Kata sandi saat ini tidak sesuai."
            : payload.error?.message ?? "Kata sandi tidak dapat diubah.",
        );
        return;
      }

      toast.success("Kata sandi berhasil diperbarui.");
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-ink-muted">
        Akun: <span className="font-medium text-foreground">{email}</span>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="current-password">Kata sandi saat ini</Label>
        <div className="relative">
          <Input
            id="current-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            className="h-11 pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={
              showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
            }
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-ink-muted hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">Kata sandi baru</Label>
        <Input
          id="new-password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          required
          minLength={12}
          aria-describedby="password-hint"
          className="h-11"
        />
        <p
          id="password-hint"
          className={
            tooShort ? "text-xs text-status-rejected" : "text-xs text-ink-muted"
          }
        >
          Minimal 12 karakter. Gunakan kombinasi yang hanya Anda ketahui.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password">Ulangi kata sandi baru</Label>
        <Input
          id="confirm-password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          aria-describedby={mismatch ? "confirm-error" : undefined}
          className="h-11"
        />
        {mismatch && (
          <p id="confirm-error" className="text-xs text-status-rejected">
            Konfirmasi belum sama dengan kata sandi baru.
          </p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="h-11 w-full"
        disabled={pending || tooShort || mismatch}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <KeyRound className="size-4" aria-hidden />
        )}
        {pending ? "Menyimpan…" : "Simpan kata sandi baru"}
      </Button>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-blue-700" aria-hidden />
        Setelah tersimpan, sesi lain akan diakhiri dan Anda dapat melanjutkan ke
        ruang kerja.
      </p>
    </form>
  );
}
