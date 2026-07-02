import Link from "next/link";
import { Settings } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full w-full">
      <Sidebar />

      <div className="flex min-h-full w-full flex-1 flex-col">
        {/* Mobile top bar — the sidebar replaces it from `md` up. */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 md:hidden"
          style={{ background: "rgba(255,255,255,0.8)", borderColor: "var(--color-border)", backdropFilter: "blur(12px)" }}
        >
          <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
            <span style={{ color: "var(--color-spotify)" }}>Stream</span>
            <span style={{ color: "var(--color-netflix)" }}>Rentals</span>
          </Link>
          <Link href="/settings" aria-label="Settings" className="muted">
            <Settings size={22} />
          </Link>
        </header>

        <main className="flex-1 px-4 pb-28 pt-1 md:px-8 md:pb-10 md:pt-4">
          <div className="mx-auto w-full max-w-2xl">{children}</div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
