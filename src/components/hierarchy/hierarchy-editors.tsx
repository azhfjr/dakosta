"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
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

const selectClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

async function sendJson(
  url: string,
  method: "POST" | "PATCH",
  payload: unknown,
): Promise<string | null> {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  if (!response.ok)
    return body?.error?.message ?? "Perubahan tidak dapat disimpan.";
  return null;
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function RegionEditor({
  region,
  readOnly = false,
}: {
  region?: { id: string; code: string; name: string; status: string };
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(region?.code ?? "");
  const [name, setName] = useState(region?.name ?? "");
  const [status, setStatus] = useState(region?.status ?? "ACTIVE");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDialog() {
    setCode(region?.code ?? "");
    setName(region?.name ?? "");
    setStatus(region?.status ?? "ACTIVE");
    setError(null);
    setOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const message = await sendJson(
        region ? `/api/v1/admin/regions/${region.id}` : "/api/v1/admin/regions",
        region ? "PATCH" : "POST",
        { code, name, status },
      );
      if (message) {
        setError(message);
        return;
      }
      toast.success(region ? "Wilayah diperbarui." : "Wilayah ditambahkan.");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setPending(false);
    }
  }

  if (readOnly) return null;

  return (
    <>
      <Button
        type="button"
        size={region ? "sm" : "default"}
        variant={region ? "outline" : "default"}
        className={region ? "h-8" : "h-10"}
        onClick={openDialog}
      >
        {region ? (
          <Pencil className="mr-1 size-3.5" aria-hidden />
        ) : (
          <Plus className="mr-1.5 size-4" aria-hidden />
        )}
        {region ? "Ubah" : "Tambah wilayah"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {region ? "Ubah wilayah" : "Tambah wilayah"}
            </DialogTitle>
            <DialogDescription>
              Kode wilayah unik. Status nonaktif menyembunyikan wilayah dari
              pilihan akun baru.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="region-name">Nama wilayah</Label>
              <Input
                id="region-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={3}
                maxLength={120}
                required
                className="h-10"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="region-code">Kode</Label>
                <Input
                  id="region-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  minLength={2}
                  maxLength={24}
                  required
                  className="h-10 uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="region-status">Status</Label>
                <select
                  id="region-status"
                  className={selectClass}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="INACTIVE">Nonaktif</option>
                </select>
              </div>
            </div>
            <FormError message={error} />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Batal
              </Button>
              <Button type="submit" className="h-11" disabled={pending}>
                {pending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : null}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BranchEditor({
  branch,
  regions,
  readOnly = false,
}: {
  branch?: {
    id: string;
    code: string;
    name: string;
    status: string;
    regionId: string;
  };
  regions: Array<{ id: string; name: string }>;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [regionalOfficeId, setRegionalOfficeId] = useState(
    branch?.regionId ?? regions[0]?.id ?? "",
  );
  const [code, setCode] = useState(branch?.code ?? "");
  const [name, setName] = useState(branch?.name ?? "");
  const [status, setStatus] = useState(branch?.status ?? "ACTIVE");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDialog() {
    setRegionalOfficeId(branch?.regionId ?? regions[0]?.id ?? "");
    setCode(branch?.code ?? "");
    setName(branch?.name ?? "");
    setStatus(branch?.status ?? "ACTIVE");
    setError(null);
    setOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const message = await sendJson(
        branch
          ? `/api/v1/admin/branches/${branch.id}`
          : "/api/v1/admin/branches",
        branch ? "PATCH" : "POST",
        { regionalOfficeId, code, name, status },
      );
      if (message) {
        setError(message);
        return;
      }
      toast.success(branch ? "Cabang diperbarui." : "Cabang ditambahkan.");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setPending(false);
    }
  }

  if (readOnly) return null;

  return (
    <>
      <Button
        type="button"
        size={branch ? "sm" : "default"}
        variant={branch ? "outline" : "default"}
        className={branch ? "h-8" : "h-10"}
        onClick={openDialog}
      >
        {branch ? (
          <Pencil className="mr-1 size-3.5" aria-hidden />
        ) : (
          <Plus className="mr-1.5 size-4" aria-hidden />
        )}
        {branch ? "Ubah" : "Tambah cabang"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {branch ? "Ubah cabang" : "Tambah cabang"}
            </DialogTitle>
            <DialogDescription>
              Reviewer cabang hanya dapat memutuskan konten organisasi pada
              cabang ini.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="branch-region">Wilayah</Label>
              <select
                id="branch-region"
                className={selectClass}
                value={regionalOfficeId}
                onChange={(event) => setRegionalOfficeId(event.target.value)}
                required
              >
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="branch-name">Nama cabang</Label>
              <Input
                id="branch-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={3}
                maxLength={120}
                required
                className="h-10"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="branch-code">Kode</Label>
                <Input
                  id="branch-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  minLength={2}
                  maxLength={24}
                  required
                  className="h-10 uppercase"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="branch-status">Status</Label>
                <select
                  id="branch-status"
                  className={selectClass}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="INACTIVE">Nonaktif</option>
                </select>
              </div>
            </div>
            <FormError message={error} />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Batal
              </Button>
              <Button type="submit" className="h-11" disabled={pending}>
                {pending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : null}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function OrganizationEditor({
  organization,
  branches,
  impact,
  readOnly = false,
}: {
  organization?: {
    id: string;
    name: string;
    organizationType: string;
    faskesClass: string | null;
    faskesCode: string | null;
    serviceArea: string;
    addressLabel: string | null;
    latitude: number;
    longitude: number;
    status: string;
    branchId: string | null;
  };
  branches: Array<{ id: string; name: string; regionName: string }>;
  impact?: { contents: number; accounts: number };
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(organization?.name ?? "");
  const [branchOfficeId, setBranchOfficeId] = useState(
    organization?.branchId ?? branches[0]?.id ?? "",
  );
  const [organizationType, setOrganizationType] = useState(
    organization?.organizationType ?? "FASKES",
  );
  const [faskesClass, setFaskesClass] = useState(
    organization?.faskesClass ?? "FKTP",
  );
  const [faskesCode, setFaskesCode] = useState(organization?.faskesCode ?? "");
  const [serviceArea, setServiceArea] = useState(
    organization?.serviceArea ?? "",
  );
  const [addressLabel, setAddressLabel] = useState(
    organization?.addressLabel ?? "",
  );
  const [latitude, setLatitude] = useState(
    String(organization?.latitude ?? -6.9147),
  );
  const [longitude, setLongitude] = useState(
    String(organization?.longitude ?? 107.6098),
  );
  const [status, setStatus] = useState(organization?.status ?? "ACTIVE");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openDialog() {
    setName(organization?.name ?? "");
    setBranchOfficeId(organization?.branchId ?? branches[0]?.id ?? "");
    setOrganizationType(organization?.organizationType ?? "FASKES");
    setFaskesClass(organization?.faskesClass ?? "FKTP");
    setFaskesCode(organization?.faskesCode ?? "");
    setServiceArea(organization?.serviceArea ?? "");
    setAddressLabel(organization?.addressLabel ?? "");
    setLatitude(String(organization?.latitude ?? -6.9147));
    setLongitude(String(organization?.longitude ?? 107.6098));
    setStatus(organization?.status ?? "ACTIVE");
    setError(null);
    setOpen(true);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const message = await sendJson(
        organization
          ? `/api/v1/admin/organizations/${organization.id}`
          : "/api/v1/admin/organizations",
        organization ? "PATCH" : "POST",
        {
          name,
          branchOfficeId,
          organizationType,
          faskesClass: organizationType === "FASKES" ? faskesClass : null,
          faskesCode: organizationType === "FASKES" ? faskesCode : null,
          serviceArea,
          addressLabel: addressLabel || null,
          latitude: Number(latitude),
          longitude: Number(longitude),
          status,
        },
      );
      if (message) {
        setError(message);
        return;
      }
      toast.success(
        organization ? "Organisasi diperbarui." : "Organisasi ditambahkan.",
      );
      setOpen(false);
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setPending(false);
    }
  }

  if (readOnly) return null;

  return (
    <>
      <Button
        type="button"
        size={organization ? "sm" : "default"}
        variant={organization ? "outline" : "default"}
        className={organization ? "h-8" : "h-10"}
        onClick={openDialog}
      >
        {organization ? (
          <Pencil className="mr-1 size-3.5" aria-hidden />
        ) : (
          <Plus className="mr-1.5 size-4" aria-hidden />
        )}
        {organization ? "Ubah" : "Tambah organisasi"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {organization ? "Ubah organisasi" : "Tambah organisasi"}
            </DialogTitle>
            <DialogDescription>
              Faskes wajib memiliki kelas FKTP/FKRTL dan kode unik. PEMDA dan
              organisasi lain tidak memakai kode Faskes.
            </DialogDescription>
          </DialogHeader>
          {impact ? (
            <p className="rounded-lg border border-border bg-surface-muted/60 px-3 py-2 text-xs text-ink-muted">
              Dampak saat ini: {impact.contents} konten dan {impact.accounts}{" "}
              akun tertaut. Perubahan cabang memengaruhi cakupan review dan
              capaian.
            </p>
          ) : null}
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Nama organisasi</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={3}
                maxLength={120}
                required
                className="h-10"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="org-branch">Cabang</Label>
                <select
                  id="org-branch"
                  className={selectClass}
                  value={branchOfficeId}
                  onChange={(event) => setBranchOfficeId(event.target.value)}
                  required
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} — {branch.regionName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-type">Jenis organisasi</Label>
                <select
                  id="org-type"
                  className={selectClass}
                  value={organizationType}
                  onChange={(event) => setOrganizationType(event.target.value)}
                >
                  <option value="FASKES">Faskes</option>
                  <option value="PEMDA">Pemerintah daerah</option>
                  <option value="OTHER">Lainnya</option>
                </select>
              </div>
            </div>

            {organizationType === "FASKES" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="org-class">Kelas Faskes</Label>
                  <select
                    id="org-class"
                    className={selectClass}
                    value={faskesClass}
                    onChange={(event) => setFaskesClass(event.target.value)}
                  >
                    <option value="FKTP">FKTP</option>
                    <option value="FKRTL">FKRTL</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="org-code">Kode Faskes</Label>
                  <Input
                    id="org-code"
                    value={faskesCode}
                    onChange={(event) =>
                      setFaskesCode(event.target.value.toUpperCase())
                    }
                    minLength={2}
                    maxLength={24}
                    required
                    className="h-10 uppercase"
                    placeholder="Contoh: 0101U001"
                  />
                  <p className="text-xs text-ink-muted">
                    Kode disimpan tanpa spasi dan tidak membuang angka nol di
                    depan.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="org-area">Wilayah layanan</Label>
                <Input
                  id="org-area"
                  value={serviceArea}
                  onChange={(event) => setServiceArea(event.target.value)}
                  minLength={2}
                  maxLength={120}
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-address">Alamat ringkas (opsional)</Label>
                <Input
                  id="org-address"
                  value={addressLabel}
                  onChange={(event) => setAddressLabel(event.target.value)}
                  maxLength={160}
                  className="h-10"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="org-lat">Latitude</Label>
                <Input
                  id="org-lat"
                  type="number"
                  step="0.000001"
                  min={-90}
                  max={90}
                  value={latitude}
                  onChange={(event) => setLatitude(event.target.value)}
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-lng">Longitude</Label>
                <Input
                  id="org-lng"
                  type="number"
                  step="0.000001"
                  min={-180}
                  max={180}
                  value={longitude}
                  onChange={(event) => setLongitude(event.target.value)}
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-status">Status</Label>
                <select
                  id="org-status"
                  className={selectClass}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="INACTIVE">Nonaktif</option>
                </select>
              </div>
            </div>

            <FormError message={error} />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Batal
              </Button>
              <Button type="submit" className="h-11" disabled={pending}>
                {pending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                ) : null}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
