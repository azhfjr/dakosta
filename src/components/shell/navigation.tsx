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
  Network,
  PlusCircle,
  ScrollText,
  ShieldCheck,
  Target,
  Upload,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { AppRole } from "@/lib/authz/types";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  ready: boolean;
};

const ADMIN_NAV: NavItem[] = [
  {
    href: "/admin",
    label: "Ringkasan",
    icon: LayoutDashboard,
    exact: true,
    ready: true,
  },
  {
    href: "/admin/validasi",
    label: "Validasi",
    icon: ClipboardCheck,
    ready: true,
  },
  { href: "/admin/konten", label: "Konten", icon: FileText, ready: true },
  { href: "/admin/wilayah", label: "Wilayah", icon: Network, ready: true },
  { href: "/admin/cabang", label: "Cabang", icon: Building2, ready: true },
  {
    href: "/admin/organisasi",
    label: "Organisasi",
    icon: Building2,
    ready: true,
  },
  { href: "/admin/edufast", label: "EDUFAST", icon: Target, ready: true },
  {
    href: "/admin/red-notice",
    label: "Red Notice",
    icon: Network,
    ready: true,
  },
  { href: "/admin/impor", label: "Impor akun", icon: Upload, ready: true },
  {
    href: "/admin/konten/impor",
    label: "Impor konten",
    icon: Upload,
    ready: true,
  },
  { href: "/admin/akun", label: "Akun", icon: Users, ready: true },
  { href: "/admin/peta", label: "Peta", icon: Map, ready: true },
  { href: "/admin/analitik", label: "Analitik", icon: BarChart3, ready: true },
  { href: "/admin/target", label: "Target", icon: Target, ready: true },
  { href: "/admin/laporan", label: "Laporan", icon: ScrollText, ready: true },
  { href: "/admin/notifikasi", label: "Notifikasi", icon: Bell, ready: true },
  { href: "/admin/audit", label: "Audit", icon: ScrollText, ready: true },
];

const REGIONAL_NAV: NavItem[] = [
  {
    href: "/wilayah",
    label: "SLA Check",
    icon: ShieldCheck,
    exact: true,
    ready: true,
  },
  {
    href: "/wilayah/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    ready: true,
  },
  { href: "/wilayah/kinerja", label: "Kinerja", icon: Target, ready: true },
  { href: "/wilayah/cabang", label: "Cabang", icon: Building2, ready: true },
  {
    href: "/wilayah/organisasi",
    label: "Organisasi",
    icon: Building2,
    ready: true,
  },
  {
    href: "/wilayah/red-notice",
    label: "Red Notice",
    icon: Network,
    ready: true,
  },
  { href: "/wilayah/notifikasi", label: "Notifikasi", icon: Bell, ready: true },
];

const BRANCH_NAV: NavItem[] = [
  {
    href: "/cabang",
    label: "SLA Check",
    icon: ShieldCheck,
    exact: true,
    ready: true,
  },
  {
    href: "/cabang/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    ready: true,
  },
  { href: "/cabang/kinerja", label: "Kinerja", icon: Target, ready: true },
  {
    href: "/cabang/organisasi",
    label: "Organisasi",
    icon: Building2,
    ready: true,
  },
  {
    href: "/cabang/red-notice",
    label: "Red Notice",
    icon: Network,
    ready: true,
  },
  { href: "/cabang/notifikasi", label: "Notifikasi", icon: Bell, ready: true },
];

const CLIENT_NAV: NavItem[] = [
  { href: "/client", label: "Beranda", icon: Home, exact: true, ready: true },
  {
    href: "/client/lapor",
    label: "Lapor konten",
    icon: PlusCircle,
    ready: true,
  },
  { href: "/client/konten", label: "Konten saya", icon: FileText, ready: true },
  { href: "/client/analitik", label: "Analitik", icon: BarChart3, ready: true },
  { href: "/client/notifikasi", label: "Notifikasi", icon: Bell, ready: true },
  { href: "/client/profil", label: "Profil", icon: UserRound, ready: true },
];

const NAV_BY_ROLE: Record<AppRole, NavItem[]> = {
  MASTER_ADMIN: ADMIN_NAV,
  REGIONAL_ADMIN: REGIONAL_NAV,
  BRANCH_ADMIN: BRANCH_NAV,
  STAKEHOLDER: CLIENT_NAV,
};

export function getNavItems(role: AppRole): NavItem[] {
  return NAV_BY_ROLE[role].filter((item) => item.ready);
}

export function isActivePath(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
