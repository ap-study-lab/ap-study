"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needConfirm, setNeedConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await getSupabase().auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}`
            : undefined,
      },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      router.push("/");
    } else {
      // メール確認が必要な設定の場合
      setNeedConfirm(true);
    }
  }

  if (needConfirm) {
    return (
      <div className="max-w-sm mx-auto mt-8 card p-6 text-center">
        <h1 className="text-lg font-bold mb-3">確認メールを送信しました</h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          {email} 宛に確認メールを送りました。メール内のリンクをクリックして登録を完了してから、
          <Link href="/login" className="text-indigo-600 font-medium">
            ログイン
          </Link>
          してください。
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto mt-8">
      <h1 className="text-xl font-bold mb-6 text-center">新規登録</h1>
      <form onSubmit={handleSubmit} className="space-y-4 card p-6">
        <div>
          <label className="block text-sm font-medium mb-1">メールアドレス</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            パスワード (6文字以上)
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400"
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="btn-primary w-full py-2.5 text-sm"
        >
          {busy ? "登録中..." : "登録する"}
        </button>
      </form>
      <p className="text-sm text-center mt-4 text-slate-600">
        すでにアカウントがある場合は{" "}
        <Link href="/login" className="text-indigo-600 font-medium">
          ログイン
        </Link>
      </p>
    </div>
  );
}
