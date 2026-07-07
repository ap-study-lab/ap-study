"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { PM_QUESTIONS } from "@/lib/questions";
import { fetchAttempts, summarizeByQuestion } from "@/lib/db";
import type { AttemptRow } from "@/lib/types";

function PmListInner() {
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  useEffect(() => {
    fetchAttempts().then(setAttempts);
  }, []);
  const byQuestion = summarizeByQuestion(attempts);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">午後演習</h1>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          大問単位で演習します。選択式の設問は自動採点、記述式の設問は模範解答と見比べて自己採点します。
        </p>
      </div>
      <div className="grid gap-3">
        {PM_QUESTIONS.map((pm) => {
          // 大問内の設問ごとの状況を集計
          const subStatuses = pm.subQuestions
            .map((sq) => byQuestion.get(`${pm.id}:${sq.id}`))
            .filter((s) => s !== undefined);
          const done = subStatuses.length > 0;
          const lastAllCorrect = done && subStatuses.every((s) => s!.lastCorrect);
          return (
            <Link
              key={pm.id}
              href={`/exam/pm/${pm.id}`}
              className="card card-hover p-4"
            >
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 font-medium">
                  {pm.category}
                </span>
                {pm.source.type === "past" ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    過去問 {pm.source.label}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
                    AI作成
                  </span>
                )}
                {done && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      lastAllCorrect
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {lastAllCorrect ? "クリア済み" : "要復習あり"}
                  </span>
                )}
              </div>
              <div className="font-bold">{pm.title}</div>
              <div className="text-xs text-slate-400 mt-1">
                設問 {pm.subQuestions.length} 問
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function PmListPage() {
  return (
    <RequireAuth>
      <PmListInner />
    </RequireAuth>
  );
}
