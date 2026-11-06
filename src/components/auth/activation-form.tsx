"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ActivationForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [activated, setActivated] = useState(false);

  const tooShort = password.length > 0 && password.length < 12;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 12) {
      setError("Kata sandi minimal 12 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi kata sandi belum sama.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/v1/accounts/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };

      if (!response.ok) {
        setError(
          payload.error?.message ?? "Akun tidak dapat diaktifkan. Coba lagi.",
        );
        return;
      }

      setActivated(true);
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setPending(false);
    }
  }

  if (activated) {
    return (
      <div className="flex flex-col gap-5">
        <p className="flex items-start gap-2 rounded-lg border border-brand-teal-500/30 bg-brand-teal-100/60 px-3 py-3 text-sm text-brand-teal-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          Akun Anda sudah aktif. Masuk memakai email dan kata sandi yang baru
          dibuat.
        </p>
        <Button asChild size="lg" className="h-11 w-full">
          <Link href="/masuk">Masuk ke DAKOSTA</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="activation-password">Kata sandi baru</Label>
        <Input
          id="activation-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={12}
          aria-describedby="activation-password-hint"
          className="h-11"
        />
        <p
          id="activation-password-hint"
          className={
            tooShort ? "text-xs text-status-rejected" : "text-xs text-ink-muted"
          }
        >
          Minimal 12 karakter. Gunakan kombinasi yang hanya Anda ketahui.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="activation-confirm">Ulangi kata sandi baru</Label>
        <Input
          id="activation-confirm"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          aria-describedby={mismatch ? "activation-confirm-error" : undefined}
          className="h-11"
        />
        {mismatch && (
          <p
            id="activation-confirm-error"
            className="text-xs text-status-rejected"
          >
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
        {pending ? "Mengaktifkan…" : "Aktifkan akun"}
      </Button>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
        <ShieldCheck
          className="mt-0.5 size-4 shrink-0 text-brand-blue-700"
          aria-hidden
        />
        Tautan ini hanya dapat dipakai satu kali dan kedaluwarsa dalam 48 jam.
      </p>
    </form>
  );
}
