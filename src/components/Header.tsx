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
    <header className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between h-12">
          <Link href="/" className="font-bold text-indigo-700 whitespace-nowrap">
            AP Study
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="text-slate-500 hidden sm:inline max-w-40 truncate">
                  {user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-slate-600 hover:text-indigo-700"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <Link href="/login" className="text-indigo-600 font-medium">
                ログイン
              </Link>
            )}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto -mb-px pb-0">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 ${
                  active
                    ? "border-indigo-600 text-indigo-700 font-medium"
                    : "border-transparent text-slate-500 hover:text-slate-800"
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
