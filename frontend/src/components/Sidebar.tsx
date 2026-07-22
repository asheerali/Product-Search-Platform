"use client";
import clsx from "clsx";
import {
    ClipboardList,
    Inbox,
    LayoutDashboard,
    Package,
    PanelLeftClose,
    PanelLeftOpen,
    Search,
    Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Data Upload", icon: Inbox },
  { href: "/ingest", label: "Ingest", icon: Upload },
  { href: "/search", label: "Search", icon: Search },
  { href: "/products", label: "Products", icon: Package },
  { href: "/jobs", label: "Jobs", icon: ClipboardList },
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
        "bg-slate-900 text-white flex flex-col shrink-0 transition-[width] duration-200 ease-in-out",
        collapsed ? "w-16" : "w-60",
        !mounted && "duration-0"
      )}
    >
      <div className={clsx("flex items-center border-b border-slate-800/80 h-16 shrink-0", collapsed ? "justify-center px-2" : "justify-between px-5")}>
        {!collapsed && (
          <div>
            <span className="text-sky-400 font-bold text-lg leading-tight tracking-tight">
              Product Search
            </span>
            <p className="text-slate-500 text-[11px] mt-0.5">AI Catalog Platform</p>
          </div>
        )}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="flex-1 px-2.5 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-xl text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2.5",
                active
                  ? "bg-sky-600 text-white shadow-sm shadow-sky-900/50"
                  : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="px-5 py-4 border-t border-slate-800/80 text-slate-500 text-[11px]">
          v1.0.0 · Provider-Agnostic AI
        </div>
      )}
    </aside>
  );
}
