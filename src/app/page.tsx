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
    icon: "📝",
    title: "模擬試験",
    sub: "午前 80問",
    desc: "本試験と同じ構成・分野配分。150分タイマー付きで実戦練習。",
    tile: "from-indigo-500 to-indigo-600",
  },
  {
    href: "/exam/am?mode=quick",
    icon: "⚡",
    title: "クイック演習",
    sub: "午前 5〜20問",
    desc: "1問ごとに即解説。分野を絞ってスキマ時間に。",
    tile: "from-sky-500 to-cyan-600",
  },
  {
    href: "/exam/pm",
    icon: "📖",
    title: "午後演習",
    sub: "長文 12大問",
    desc: "選択式は自動採点、記述式は模範解答と見比べて自己採点。",
    tile: "from-violet-500 to-purple-600",
  },
  {
    href: "/review",
    icon: "🔁",
    title: "復習モード",
    sub: "弱点をつぶす",
    desc: "間違えた問題だけを解き直し。克服するまで追跡。",
    tile: "from-rose-500 to-pink-600",
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
    <div className="space-y-8">
      <section className="text-center pt-6 pb-2">
        <span className="pill bg-indigo-100/80 text-indigo-700 mb-4">
          応用情報技術者試験 対策
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
          合格まで、<span className="grad-text">最短ルート</span>で。
        </h1>
        <p className="text-sm text-slate-500 mt-3">
          過去問 + AI作成問題 —{" "}
          <span className="font-bold text-slate-700">午前 {AM_QUESTIONS.length}問</span>
          {" / "}
          <span className="font-bold text-slate-700">午後 {PM_QUESTIONS.length}大問</span>
          を収録
        </p>
      </section>

      {!loading && !user && (
        <div className="card p-6 text-center bg-gradient-to-br from-indigo-50/90 to-violet-50/90">
          <p className="text-sm text-indigo-900 mb-4">
            学習記録(正答率・苦手分析・復習リスト)を使うにはログインが必要です
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/signup" className="btn-primary px-6 py-2.5 text-sm">
              無料ではじめる
            </Link>
            <Link href="/login" className="btn-ghost px-6 py-2.5 text-sm">
              ログイン
            </Link>
          </div>
        </div>
      )}

      {user && attempts && total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <div className="text-2xl font-extrabold text-indigo-600">{total}</div>
            <div className="text-xs text-slate-500 mt-0.5">累計解答数</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-extrabold text-emerald-600">{rate}%</div>
            <div className="text-xs text-slate-500 mt-0.5">通算正答率</div>
          </div>
          <Link href="/review" className="card card-hover p-4 text-center">
            <div className="text-2xl font-extrabold text-rose-500">{needReview}</div>
            <div className="text-xs text-slate-500 mt-0.5">要復習の問題</div>
          </Link>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        {MODES.map((m) => (
          <Link key={m.href} href={m.href} className="card card-hover p-5 group">
            <div className="flex items-start gap-4">
              <span
                className={`w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br ${m.tile} flex items-center justify-center text-2xl shadow-md group-hover:scale-105 transition-transform`}
              >
                {m.icon}
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-extrabold text-slate-800">{m.title}</span>
                  <span className="text-xs text-slate-400 font-medium">{m.sub}</span>
                </div>
                <p className="text-sm text-slate-500 leading-relaxed mt-1">{m.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <p className="text-xs text-slate-400 text-center leading-relaxed pb-4">
        収録している過去問は IPA 応用情報技術者試験の公開過去問題を元にしています(出典表記付き)。
        <br />
        AI作成問題は過去問の出題傾向を元にした学習用オリジナル問題です。
      </p>
    </div>
  );
}
