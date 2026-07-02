"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { tabs, isActive } from "@/components/nav";

// Desktop / tablet navigation. Hidden below the `md` breakpoint, where
// BottomNav takes over.
export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r px-3 py-5 md:flex"
      style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
    >
      <Link href="/" className="mb-6 flex items-center gap-2 px-2 text-lg font-extrabold tracking-tight">
        <span style={{ color: "var(--color-spotify)" }}>Stream</span>
        <span style={{ color: "var(--color-netflix)" }}>Rentals</span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} className="nav-link" data-active={active}>
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <Link href="/settings" className="nav-link" data-active={isActive(pathname, "/settings")}>
        <Settings size={20} /> Settings
      </Link>
    </aside>
  );
}
