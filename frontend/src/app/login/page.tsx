"use client";
import { setToken } from "@/lib/auth";
import { login } from "@/lib/api";
import { Loader2, Lock, Sparkles, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return toast.error("Enter a username and password.");
    setLoading(true);
    try {
      const res = await login(username.trim(), password);
      setToken(res.access_token);
      router.replace("/");
    } catch {
      toast.error("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center shadow-lg shadow-sky-500/30 mb-3">
            <Sparkles size={22} className="text-white" />
          </div>
          <h1 className="font-bold text-xl text-slate-800 dark:text-slate-100 tracking-tight">Product Search</h1>
          <p className="text-slate-400 dark:text-slate-500 text-sm">AI Catalog Platform</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 rounded-2xl ring-1 ring-black/5 dark:ring-white/10 shadow-sm p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Username</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-sky-400/20 focus:border-sky-400 dark:focus:border-sky-500 transition-shadow"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-sky-400/20 focus:border-sky-400 dark:focus:border-sky-500 transition-shadow"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 shadow-lg shadow-sky-500/25 active:scale-[0.98] transition-all"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
