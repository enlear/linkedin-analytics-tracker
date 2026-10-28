// Navigation definition shared by the sidebar (which renders the list) and the
// top bar (which only needs to name the current section). Keeping one source
// avoids the two drifting apart when a route is added.

import {
  BarChart3,
  Upload,
  Settings,
  Users,
  FileText,
  BookOpen,
  Building2,
  Trophy,
} from "lucide-react";
import { siteConfig } from "@/site.config";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  memberOnly?: boolean;
}

export const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/upload", label: "Upload post", icon: Upload, memberOnly: true },
  { href: "/standings", label: "Standings", icon: Trophy, memberOnly: true },
  { href: "/company", label: "Company analytics", icon: Building2, adminOnly: true },
  { href: "/team", label: "Employee list", icon: Users, adminOnly: true },
  { href: "/reports", label: "Monthly report", icon: FileText, adminOnly: true },
  { href: "/docs", label: "Documentation", icon: BookOpen, adminOnly: true },
];

/** Rendered on its own below the main list, so it lives outside `nav`. */
export const settingsItem: NavItem = { href: "/settings", label: "Settings", icon: Settings };

/** Which nav entries this role may see. */
export function navForRole(role: "admin" | "member"): NavItem[] {
  return nav.filter((i) => {
    if (i.adminOnly && role !== "admin") return false;
    if (i.memberOnly && role === "admin") return false;
    return true;
  });
}

/**
 * Name of the section the given path sits in — shown at the left of the top
 * bar. Longest matching href wins so `/reports/2026-05` still reads "Monthly
 * report" rather than matching a shorter prefix.
 */
export function sectionTitle(pathname: string): string {
  const match = [...nav, settingsItem]
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? siteConfig.name;
}
