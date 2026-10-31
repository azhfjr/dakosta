"use client";

import {
  BarChart3,
  Bell,
  Building2,
  ClipboardCheck,
  FileText,
  Home,
  LayoutDashboard,
  Map,
  PlusCircle,
  ScrollText,
  Target,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  ready: boolean;
};

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Ringkasan", icon: LayoutDashboard, exact: true, ready: true },
  { href: "/admin/validasi", label: "Validasi", icon: ClipboardCheck, ready: true },
  { href: "/admin/konten", label: "Konten", icon: FileText, ready: true },
  { href: "/admin/stakeholder", label: "Stakeholder", icon: Building2, ready: true },
  { href: "/admin/peta", label: "Peta", icon: Map, ready: true },
  { href: "/admin/analitik", label: "Analitik", icon: BarChart3, ready: true },
  { href: "/admin/target", label: "Target", icon: Target, ready: true },
  { href: "/admin/pengguna", label: "Pengguna", icon: Users, ready: true },
  { href: "/admin/notifikasi", label: "Notifikasi", icon: Bell, ready: true },
  { href: "/admin/audit", label: "Audit", icon: ScrollText, ready: true },
];

const CLIENT_NAV: NavItem[] = [
  { href: "/client", label: "Beranda", icon: Home, exact: true, ready: true },
  { href: "/client/lapor", label: "Lapor konten", icon: PlusCircle, ready: true },
  { href: "/client/konten", label: "Konten saya", icon: FileText, ready: true },
  { href: "/client/notifikasi", label: "Notifikasi", icon: Bell, ready: true },
  { href: "/client/profil", label: "Profil", icon: UserRound, ready: true },
];

export function getNavItems(role: "ADMIN" | "CLIENT"): NavItem[] {
  return (role === "ADMIN" ? ADMIN_NAV : CLIENT_NAV).filter((item) => item.ready);
}

export function isActivePath(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
