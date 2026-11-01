"use client";

import { useCallback, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function isStepUpRequired(
  response: Response,
  body: { error?: { code?: string } } | null,
): boolean {
  return response.status === 403 && body?.error?.code === "STEP_UP_REQUIRED";
}

export function StepUpDialog({
  open,
  onOpenChange,
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
}) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/me/step-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "Konfirmasi kata sandi gagal.");
        return;
      }
      setPassword("");
      toast.success("Konfirmasi diterima. Tindakan dilanjutkan.");
      onConfirmed();
    } catch {
      setError(
        "Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-brand-blue-700" aria-hidden />
            Konfirmasi kata sandi
          </DialogTitle>
          <DialogDescription>
            Tindakan ini sensitif dan tercatat pada audit. Masukkan kata sandi
            akun Anda. Konfirmasi berlaku 15 menit.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="step-up-password">Kata sandi</Label>
            <Input
              id="step-up-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={1}
              className="h-11"
              autoFocus
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="h-11"
              disabled={pending || password.length === 0}
            >
              {pending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              Konfirmasi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function useStepUp() {
  const [open, setOpen] = useState(false);
  const [retry, setRetry] = useState<(() => void | Promise<void>) | null>(null);

  const prompt = useCallback((action: () => void | Promise<void>) => {
    setRetry(() => action);
    setOpen(true);
  }, []);

  const dialog = (
    <StepUpDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setRetry(null);
      }}
      onConfirmed={() => {
        setOpen(false);
        const action = retry;
        setRetry(null);
        if (action) void action();
      }}
    />
  );

  return { prompt, dialog };
}
