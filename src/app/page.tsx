"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { fetchAttempts, summarizeByQuestion } from "@/lib/db";
import { AM_QUESTIONS, PM_QUESTIONS } from "@/lib/questions";
import type { AttemptRow } from "@/lib/types";

const MODES = [
  {
    href: "/exam/am?mode=mock",
    title: "模擬試験 (午前)",
    desc: "本試験と同じ80問構成・分野配分。全問解答後にまとめて採点。",
    color: "bg-indigo-600",
  },
  {
    href: "/exam/am?mode=quick",
    title: "クイック演習 (午前)",
    desc: "10問 / 20問をサクッと。1問ごとに解説が出る。分野の絞り込みも可能。",
    color: "bg-sky-600",
  },
  {
    href: "/exam/pm",
    title: "午後演習",
    desc: "長文問題を大問単位で演習。記述式は模範解答と見比べて自己採点。",
    color: "bg-violet-600",
  },
  {
    href: "/review",
    title: "復習モード",
    desc: "過去に間違えた問題だけを解き直す。克服したかどうかも記録。",
    color: "bg-rose-600",
  },
];

export default function Home() {
  const { user, loading } = useAuth();
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);

  useEffect(() => {
    if (user) fetchAttempts().then(setAttempts);
  }, [user]);

  const total = attempts?.length ?? 0;
  const correct = attempts?.filter((a) => a.is_correct).length ?? 0;
  const rate = total > 0 ? Math.round((correct / total) * 100) : null;
  const needReview = attempts
    ? [...summarizeByQuestion(attempts).values()].filter((s) => !s.lastCorrect).length
    : 0;

  return (
    <div className="space-y-6">
      <section className="text-center py-4">
        <h1 className="text-2xl font-bold">応用情報技術者試験 対策</h1>
        <p className="text-sm text-slate-500 mt-2">
          過去問 + AI作成問題 全{AM_QUESTIONS.length}問(午前) / {PM_QUESTIONS.length}大問(午後)
        </p>
      </section>

      {!loading && !user && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 text-center">
          <p className="text-sm text-indigo-900 mb-3">
            学習記録(正答率・苦手分析・復習リスト)を使うにはログインが必要です
          </p>
          <div className="flex gap-2 justify-center">
            <Link
              href="/signup"
              className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold"
            >
              新規登録
            </Link>
            <Link
              href="/login"
              className="px-5 py-2 rounded-lg border border-indigo-300 bg-white text-indigo-700 text-sm font-bold"
            >
              ログイン
            </Link>
          </div>
        </div>
      )}

      {user && attempts && total > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <div className="text-2xl font-bold text-indigo-700">{total}</div>
            <div className="text-xs text-slate-500">累計解答数</div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600">{rate}%</div>
            <div className="text-xs text-slate-500">通算正答率</div>
          </div>
          <Link href="/review" className="bg-white rounded-xl border border-slate-200 p-3 text-center hover:border-rose-300">
            <div className="text-2xl font-bold text-rose-600">{needReview}</div>
            <div className="text-xs text-slate-500">要復習の問題</div>
          </Link>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        {MODES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow"
          >
            <div className={`inline-block px-2.5 py-1 rounded-md text-white text-xs font-bold mb-2 ${m.color}`}>
              {m.title}
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{m.desc}</p>
          </Link>
        ))}
      </section>

      <p className="text-xs text-slate-400 text-center leading-relaxed">
        収録している過去問は IPA 応用情報技術者試験の公開過去問題を元にしています(出典表記付き)。
        <br />
        AI作成問題は過去問の出題傾向を元にした学習用オリジナル問題です。
      </p>
    </div>
  );
}
