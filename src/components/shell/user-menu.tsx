"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  CircleHelp,
  Info,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppRole } from "@/lib/authz/types";
import { authClient } from "@/lib/auth-client";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

const roleLabel: Record<AppRole, string> = {
  MASTER_ADMIN: "Master Admin",
  REGIONAL_ADMIN: "Admin Wilayah",
  BRANCH_ADMIN: "Admin Cabang",
  STAKEHOLDER: "Stakeholder",
};

export function UserMenu({
  name,
  email,
  role,
  displayTitle,
  compact = false,
}: {
  name: string;
  email: string;
  role: AppRole;
  displayTitle: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      await authClient.signOut();
      router.replace("/masuk");
      router.refresh();
    } catch {
      toast.error("Gagal keluar. Coba lagi.");
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={
            compact
              ? "size-11 justify-center px-0"
              : "h-11 w-full justify-start gap-2.5 px-2 text-left"
          }
          aria-label={compact ? `Menu akun ${name}` : undefined}
        >
          <span aria-hidden="true">
            <Avatar className="size-8 border border-border">
              <AvatarFallback className="bg-brand-blue-100 text-xs font-semibold text-brand-blue-800">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
          </span>
          {!compact && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">
                {name}
              </span>
              <span className="block truncate text-xs text-ink-muted">
                {displayTitle ?? roleLabel[role]}
              </span>
            </span>
          )}
          <ChevronDown
            className={compact ? "hidden" : "size-4 shrink-0 text-ink-muted"}
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-semibold text-foreground">
            {name}
          </span>
          <span className="block truncate text-xs text-ink-muted">{email}</span>
          <span className="mt-1 inline-flex items-center gap-1 text-xs text-brand-blue-700">
            <ShieldCheck className="size-3.5" aria-hidden />
            {roleLabel[role]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/bantuan">
            <CircleHelp className="size-4" aria-hidden />
            Bantuan
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/tentang">
            <Info className="size-4" aria-hidden />
            Tentang &amp; disclaimer
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={(event) => {
            event.preventDefault();
            if (!pending) void handleSignOut();
          }}
          disabled={pending}
        >
          <LogOut className="size-4" aria-hidden />
          {pending ? "Keluar…" : "Keluar"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
