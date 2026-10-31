"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UserMenu } from "@/components/shell/user-menu";

export function MobileNav({
  role,
  name,
  email,
  displayTitle,
}: {
  role: "ADMIN" | "CLIENT";
  name: string;
  email: string;
  displayTitle: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 lg:hidden"
          aria-label="Buka menu navigasi"
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(20rem,85vw)] p-0">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="sr-only">Navigasi aplikasi</SheetTitle>
          <BrandLogo variant="compact" className="w-32" />
        </SheetHeader>
        <div className="flex h-[calc(100dvh-4.5rem)] flex-col justify-between px-3 py-4">
          <SidebarNav role={role} onNavigate={() => setOpen(false)} />
          <div className="border-t border-border pt-3">
            <UserMenu
              name={name}
              email={email}
              role={role}
              displayTitle={displayTitle}
              compact
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
