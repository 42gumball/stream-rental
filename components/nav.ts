import { Home, LayoutGrid, Users, Wallet, Bell, type LucideIcon } from "lucide-react";

export type NavTab = { href: string; label: string; icon: LucideIcon };

// Primary navigation, shared by the mobile bottom bar and the desktop sidebar.
// Individual streaming platforms live under the single "Platforms" tab — see
// lib/platforms.ts — instead of one hardcoded tab each.
export const tabs: NavTab[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/accounts", label: "Platforms", icon: LayoutGrid },
  { href: "/customers", label: "People", icon: Users },
  { href: "/finances", label: "Money", icon: Wallet },
  { href: "/reminders", label: "Reminders", icon: Bell },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
