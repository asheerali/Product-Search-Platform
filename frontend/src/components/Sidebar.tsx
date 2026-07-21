"use client";
import clsx from "clsx";
import {
    ClipboardList,
    Inbox,
    LayoutDashboard,
    Package,
    Search,
    Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Data Upload", icon: Inbox },
  { href: "/ingest", label: "Ingest", icon: Upload },
  { href: "/search", label: "Search", icon: Search },
  { href: "/products", label: "Products", icon: Package },
  { href: "/jobs", label: "Jobs", icon: ClipboardList },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 bg-slate-900 text-white flex flex-col shrink-0">
      <div className="px-5 py-5 border-b border-slate-700">
        <span className="text-brand-500 font-bold text-lg leading-tight">
          Product<br />Search
        </span>
        <p className="text-slate-400 text-xs mt-0.5">AI Catalog Platform</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname === href
                ? "bg-brand-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-slate-700 text-slate-500 text-xs">
        v1.0.0 · Provider-Agnostic AI
      </div>
    </aside>
  );
}
