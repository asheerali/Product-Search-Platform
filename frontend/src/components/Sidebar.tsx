"use client";
import clsx from "clsx";
import {
    ClipboardList,
    Database,
    Inbox,
    LayoutDashboard,
    Package,
    PanelLeftClose,
    PanelLeftOpen,
    Search,
    Sparkles,
    Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ingest", label: "Ingest", icon: Upload },
  { href: "/search", label: "Search", icon: Search },
  { href: "/products", label: "Products", icon: Package },
  { href: "/jobs", label: "Jobs", icon: ClipboardList },
];

// Kept visually separate from the main pipeline nav: these two are a plain
// S3 archive (upload + browse), not part of the AI ingestion flow above.
const storageNavItems = [
  { href: "/upload", label: "Data Upload", icon: Inbox },
  { href: "/storage", label: "Storage Files", icon: Database },
];

const STORAGE_KEY = "sidebarCollapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    setMounted(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <aside
      className={clsx(
        "relative bg-gradient-to-b from-slate-900 to-slate-950 text-white flex flex-col shrink-0 transition-[width] duration-200 ease-in-out shadow-2xl shadow-black/40",
        collapsed ? "w-16" : "w-64",
        !mounted && "duration-0"
      )}
    >
      {/* subtle right-edge glow */}
      <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-sky-500/20 to-transparent" />

      <div className={clsx("flex items-center h-16 shrink-0", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        <div className={clsx("flex items-center gap-2.5", collapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center shrink-0 shadow-lg shadow-sky-500/30">
            <Sparkles size={16} className="text-white" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-bold text-[15px] leading-tight tracking-tight block bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Product Search
              </span>
              <p className="text-slate-500 text-[10.5px] mt-0.5">AI Catalog Platform</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            title="Collapse sidebar"
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors shrink-0"
          >
            <PanelLeftClose size={17} />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={toggleCollapsed}
          title="Expand sidebar"
          className="mx-auto mb-2 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
        >
          <PanelLeftOpen size={17} />
        </button>
      )}

      <nav className="flex-1 px-2.5 py-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={clsx(
                "group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150",
                collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
                active
                  ? "bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-lg shadow-sky-950/50"
                  : "text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-0.5"
              )}
            >
              <Icon size={18} className={clsx("shrink-0 transition-transform", active && "drop-shadow")} />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      <div className="px-2.5 pb-2">
        {!collapsed && (
          <p className="px-3 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Storage
          </p>
        )}
        <div className="space-y-1">
          {storageNavItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={clsx(
                  "group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-150",
                  collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
                  active
                    ? "bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-950/50"
                    : "text-slate-400 hover:bg-white/5 hover:text-white hover:translate-x-0.5"
                )}
              >
                <Icon size={18} className={clsx("shrink-0 transition-transform", active && "drop-shadow")} />
                {!collapsed && label}
              </Link>
            );
          })}
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 py-4 mx-3 mb-3 rounded-xl bg-white/[0.03] text-slate-500 text-[10.5px] leading-relaxed">
          v1.0.0 · Provider-Agnostic AI
        </div>
      )}
    </aside>
  );
}
