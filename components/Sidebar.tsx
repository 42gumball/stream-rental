"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { tabs, isActive } from "@/components/nav";

type SidebarUser = { name: string | null; email: string; image: string | null } | null;

// Desktop / tablet navigation. Hidden below the `md` breakpoint, where
// BottomNav takes over.
export default function Sidebar({ user }: { user: SidebarUser }) {
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

      {user && (
        <Link
          href="/settings"
          className="mt-2 flex items-center gap-2 rounded-xl border px-3 py-2"
          style={{ borderColor: "var(--color-border)" }}
        >
          <Avatar name={user.name} email={user.email} image={user.image} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{user.name ?? "Account"}</div>
            <div className="truncate text-xs muted">{user.email}</div>
          </div>
        </Link>
      )}
    </aside>
  );
}

function Avatar({ name, email, image }: { name: string | null; email: string; image: string | null }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  const initial = (name?.trim()?.[0] ?? email[0] ?? "?").toUpperCase();
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
      style={{ background: "var(--color-brand)" }}
    >
      {initial}
    </span>
  );
}
