"use client";

import {
  Bell,
  FileText,
  LayoutDashboard,
  Map,
  Network,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Target,
  Upload,
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

export type NavSection = {
  id: string;
  label?: string;
  items: NavItem[];
};

/**
 * The six primary items keep the same relative order for every role (R02).
 * Management tooling lives in a separate group so Master Admin keeps access to
 * accounts, imports and sync without reordering the main navigation.
 */
const ADMIN_PRIMARY: NavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
    ready: true,
  },
  { href: "/admin/validasi", label: "SLA", icon: ShieldCheck, ready: true },
  { href: "/admin/laporan", label: "Kinerja", icon: Target, ready: true },
  {
    href: "/admin/konten",
    label: "Detail Konten",
    icon: FileText,
    ready: true,
  },
  {
    href: "/admin/red-notice",
    label: "Red Notice",
    icon: Network,
    ready: true,
  },
  { href: "/admin/notifikasi", label: "Notifikasi", icon: Bell, ready: true },
];

const ADMIN_MANAGEMENT: NavItem[] = [
  { href: "/admin/wilayah", label: "Wilayah", icon: Network, ready: true },
  { href: "/admin/edufast", label: "EDUFAST", icon: Target, ready: true },
  { href: "/admin/impor", label: "Impor akun", icon: Upload, ready: true },
  {
    href: "/admin/konten/impor",
    label: "Impor konten",
    icon: Upload,
    ready: true,
  },
  { href: "/admin/akun", label: "Akun", icon: Users, ready: true },
  { href: "/admin/peta", label: "Peta", icon: Map, ready: true },
  { href: "/admin/target", label: "Target", icon: Target, ready: true },
  { href: "/admin/audit", label: "Audit", icon: ScrollText, ready: true },
  {
    href: "/admin/sinkronisasi",
    label: "Sinkronisasi",
    icon: RefreshCw,
    ready: true,
  },
];

const REGIONAL_PRIMARY: NavItem[] = [
  {
    href: "/wilayah/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    ready: true,
  },
  {
    href: "/wilayah",
    label: "SLA",
    icon: ShieldCheck,
    exact: true,
    ready: true,
  },
  { href: "/wilayah/kinerja", label: "Kinerja", icon: Target, ready: true },
  {
    href: "/wilayah/konten",
    label: "Detail Konten",
    icon: FileText,
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

const BRANCH_PRIMARY: NavItem[] = [
  {
    href: "/cabang/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    ready: true,
  },
  {
    href: "/cabang",
    label: "SLA",
    icon: ShieldCheck,
    exact: true,
    ready: true,
  },
  { href: "/cabang/kinerja", label: "Kinerja", icon: Target, ready: true },
  {
    href: "/cabang/konten",
    label: "Detail Konten",
    icon: FileText,
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

const CLIENT_PRIMARY: NavItem[] = [
  {
    href: "/client",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
    ready: true,
  },
  {
    href: "/client/konten",
    label: "Detail Konten",
    icon: FileText,
    ready: true,
  },
  { href: "/client/notifikasi", label: "Notifikasi", icon: Bell, ready: true },
];

const SECTIONS_BY_ROLE: Record<AppRole, NavSection[]> = {
  MASTER_ADMIN: [
    { id: "primary", items: ADMIN_PRIMARY },
    { id: "management", label: "Manajemen", items: ADMIN_MANAGEMENT },
  ],
  REGIONAL_ADMIN: [{ id: "primary", items: REGIONAL_PRIMARY }],
  BRANCH_ADMIN: [{ id: "primary", items: BRANCH_PRIMARY }],
  STAKEHOLDER: [{ id: "primary", items: CLIENT_PRIMARY }],
};

export function getNavSections(role: AppRole): NavSection[] {
  return SECTIONS_BY_ROLE[role]
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.ready),
    }))
    .filter((section) => section.items.length > 0);
}

export function getNavItems(role: AppRole): NavItem[] {
  return getNavSections(role).flatMap((section) => section.items);
}

export function isActivePath(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
