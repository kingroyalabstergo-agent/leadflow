"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Leads", icon: "👥" },
  { href: "/dashboard/scrape", label: "Scrape Jobs", icon: "🔍" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-zinc-800 bg-zinc-950 p-6 flex flex-col gap-2">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-blue-500">LeadFlow</h1>
          <p className="text-xs text-zinc-500 mt-1">FX Lead Generation</p>
        </div>
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              pathname === item.href ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
            )}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
