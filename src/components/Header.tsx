"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { getSupabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { href: "/", label: "ホーム" },
  { href: "/exam/am", label: "午前演習" },
  { href: "/exam/pm", label: "午後演習" },
  { href: "/review", label: "復習" },
  { href: "/stats", label: "成績" },
];

export default function Header() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await getSupabase().auth.signOut();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-20 bg-white/75 backdrop-blur-lg border-b border-slate-200/70">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white text-[11px] font-black shadow-md shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              AP
            </span>
            <span className="font-extrabold tracking-tight text-slate-800">
              Study
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="text-slate-400 hidden sm:inline max-w-40 truncate text-xs">
                  {user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-indigo-700 font-medium transition-colors"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="btn-primary px-4 py-1.5 text-sm"
              >
                ログイン
              </Link>
            )}
          </div>
        </div>
        <nav className="flex gap-1.5 overflow-x-auto pb-2 -mt-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3.5 py-1.5 text-sm whitespace-nowrap rounded-full transition-all ${
                  active
                    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold shadow-md shadow-indigo-600/25"
                    : "text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 font-medium"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
