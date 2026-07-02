"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tabs, isActive } from "@/components/nav";

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 border-t md:hidden"
      style={{ background: "rgba(255,255,255,0.88)", borderColor: "var(--color-border)", backdropFilter: "blur(10px)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-1 py-2.5"
              style={{ color: active ? "var(--color-brand)" : "var(--color-muted)" }}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[11px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
