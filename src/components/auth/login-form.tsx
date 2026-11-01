"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ demoMode }: { demoMode: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [demoPending, setDemoPending] = useState<"admin" | "client" | null>(
    null,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(
          result.error.status === 401
            ? "Email atau kata sandi tidak sesuai."
            : "Tidak dapat masuk saat ini. Coba lagi.",
        );
        return;
      }
      await redirectToWorkspace();
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi Anda.");
    } finally {
      setPending(false);
    }
  }

  async function redirectToWorkspace() {
    try {
      const response = await fetch("/api/v1/me", { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as {
          data?: { redirectTo?: string };
        };
        router.replace(payload.data?.redirectTo ?? "/");
      } else {
        router.replace("/");
      }
    } catch {
      router.replace("/");
    }
    router.refresh();
  }

  async function handleDemoLogin(role: "admin" | "client") {
    setDemoPending(role);

    try {
      const response = await fetch("/api/v1/demo/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        toast.error("Masuk demo tidak tersedia. Pastikan mode demo aktif.");
        return;
      }

      await redirectToWorkspace();
    } catch {
      toast.error("Tidak dapat menghubungi server.");
    } finally {
      setDemoPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="nama@contoh.demo"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            aria-describedby={error ? "login-error" : undefined}
            className="h-11"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Kata sandi</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              aria-describedby={error ? "login-error" : undefined}
              className="h-11 pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
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

        {error && (
          <p
            id="login-error"
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
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <LogIn className="size-4" aria-hidden />
          )}
          {pending ? "Memeriksa akses…" : "Masuk"}
        </Button>
      </form>

      {demoMode && (
        <section
          aria-labelledby="demo-login-title"
          className="rounded-xl border border-brand-blue-100 bg-brand-blue-100/40 p-4"
        >
          <div className="flex items-start gap-3">
            <ShieldCheck
              className="mt-0.5 size-5 shrink-0 text-brand-blue-700"
              aria-hidden
            />
            <div className="space-y-3">
              <div>
                <h2
                  id="demo-login-title"
                  className="text-sm font-semibold text-brand-blue-800"
                >
                  Akses demo
                </h2>
                <p className="text-sm leading-relaxed text-ink-muted">
                  Masuk cepat ke akun sintetis berlabel DEMO. Tidak ada data
                  institusional atau data pribadi nyata.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 flex-1 bg-surface"
                  onClick={() => handleDemoLogin("admin")}
                  disabled={demoPending !== null}
                >
                  {demoPending === "admin" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  Admin demo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 flex-1 bg-surface"
                  onClick={() => handleDemoLogin("client")}
                  disabled={demoPending !== null}
                >
                  {demoPending === "client" ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  Client demo
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <p className="text-sm leading-relaxed text-ink-muted">
        Akun dibuat oleh Master Admin. Registrasi publik ditutup. Jika Anda
        menerima kredensial sementara, Anda akan diminta mengganti kata sandi
        saat pertama masuk.
      </p>
    </div>
  );
}
