import Link from "next/link";
import { Settings } from "lucide-react";
import BottomNav from "@/components/BottomNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <header
        className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3"
        style={{ background: "rgba(245,246,248,0.85)", borderColor: "var(--color-border)", backdropFilter: "blur(10px)" }}
      >
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
          <span style={{ color: "var(--color-spotify)" }}>Stream</span>
          <span style={{ color: "var(--color-netflix)" }}>Rentals</span>
        </Link>
        <Link href="/settings" aria-label="Settings" className="muted">
          <Settings size={22} />
        </Link>
      </header>

      <main className="flex-1 px-4 pb-28 pt-1">{children}</main>

      <BottomNav />
    </div>
  );
}
