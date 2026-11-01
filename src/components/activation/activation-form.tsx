"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crosshair, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Position = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

const MAX_ACCURACY_METERS = 150;

function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

export function ActivationForm({ homePath }: { homePath: string }) {
  const router = useRouter();
  const [position, setPosition] = useState<Position | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [consented, setConsented] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function locate() {
    setError(null);
    if (!navigator.geolocation) {
      setError(
        "Peramban ini tidak menyediakan Geolocation API. Gunakan peramban terbaru di perangkat dengan lokasi aktif.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracyMeters: result.coords.accuracy,
        });
        setLocating(false);
      },
      (failure) => {
        setLocating(false);
        if (failure.code === failure.PERMISSION_DENIED) {
          setError(
            "Izin lokasi ditolak. Buka pengaturan situs di peramban, izinkan lokasi untuk situs ini, lalu coba lagi. Tidak ada jalur bypass.",
          );
        } else if (failure.code === failure.TIMEOUT) {
          setError(
            "Waktu pengambilan lokasi habis. Pindahkan perangkat ke area terbuka lalu coba lagi.",
          );
        } else {
          setError(
            "Lokasi tidak tersedia. Pastikan GPS/perkiraan lokasi perangkat aktif, lalu coba lagi.",
          );
        }
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  async function submit() {
    if (!position || !consented) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/activation/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(position),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string; code?: string };
      } | null;
      if (!response.ok) {
        if (payload?.error?.code === "PASSWORD_CHANGE_REQUIRED") {
          router.replace("/ganti-password");
          return;
        }
        setError(
          payload?.error?.message ??
            "Lokasi tidak dapat disimpan. Periksa akurasi lalu coba lagi.",
        );
        return;
      }
      toast.success("Lokasi perangkat tersimpan. Akun Anda aktif.");
      router.replace(homePath);
      router.refresh();
    } catch {
      setError(
        "Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.",
      );
    } finally {
      setSaving(false);
    }
  }

  const accuracyTooLow =
    position !== null && position.accuracyMeters > MAX_ACCURACY_METERS;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface-muted/60 p-4 text-sm leading-relaxed text-ink-muted">
        <p className="font-medium text-foreground">Mengapa lokasi diminta?</p>
        <p className="mt-1">
          Lokasi dipakai sekali saat aktivasi untuk memetakan instansi Anda pada
          peta agregat. Lokasi tidak ditanyakan lagi per konten dan tidak
          menggantikan lokasi resmi instansi.
        </p>
      </div>

      {position ? (
        <div className="rounded-xl border border-border p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <MapPin className="size-4 text-brand-blue-700" aria-hidden />
            {formatCoordinate(position.latitude)},{" "}
            {formatCoordinate(position.longitude)}
          </p>
          <p
            className={
              accuracyTooLow
                ? "mt-1 text-sm font-medium text-destructive"
                : "mt-1 text-sm text-ink-muted"
            }
          >
            Akurasi ±{Math.round(position.accuracyMeters)} m ·{" "}
            {accuracyTooLow
              ? `di atas batas ${MAX_ACCURACY_METERS} m`
              : "memenuhi batas akurasi"}
          </p>
          {accuracyTooLow ? (
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              Pindahkan perangkat ke area terbuka, aktifkan GPS presisi tinggi,
              lalu ambil lokasi ulang. Nilai ini tidak dapat diubah manual.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant={position ? "outline" : "default"}
          className="h-11"
          onClick={locate}
          disabled={locating || saving}
        >
          {locating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Crosshair className="size-4" aria-hidden />
          )}
          {position ? "Ambil ulang lokasi" : "Ambil lokasi perangkat"}
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-border p-4">
        <Checkbox
          id="activation-consent"
          checked={consented}
          onCheckedChange={(checked) => setConsented(checked === true)}
          className="mt-1"
        />
        <div>
          <Label htmlFor="activation-consent" className="font-medium">
            Saya menyetujui lokasi perangkat disimpan untuk aktivasi akun
          </Label>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Koordinat disimpan terbatas, hanya dapat diakses pengelola akun, dan
            dipakai untuk pemetaan agregat. Geolocation peramban dapat memakai
            GPS, Wi-Fi, atau perkiraan jaringan, sehingga bukan jaminan chip
            GPS.
          </p>
        </div>
      </div>

      <Button
        type="button"
        className="h-11 w-full"
        onClick={submit}
        disabled={
          !position || !consented || accuracyTooLow || saving || locating
        }
      >
        {saving ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <ShieldCheck className="size-4" aria-hidden />
        )}
        Simpan dan aktifkan akun
      </Button>

      <p className="text-xs leading-relaxed text-ink-muted">
        Jika perangkat tidak memiliki GPS, gunakan komputer/mode peramban yang
        mengizinkan perkiraan lokasi. Bila tetap gagal, hubungi Master Admin
        untuk bantuan; tidak ada fallback koordinat manual.
      </p>
    </div>
  );
}
