"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import QuestionPlayer from "@/components/QuestionPlayer";
import { getAmQuestion, getPmQuestion, shuffle } from "@/lib/questions";
import { fetchAttempts, summarizeByQuestion, type QuestionStatus } from "@/lib/db";
import type { AmQuestion, AttemptRow } from "@/lib/types";

function ReviewInner() {
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null);
  const [playing, setPlaying] = useState<AmQuestion[] | null>(null);
  const [tab, setTab] = useState<"need" | "cleared">("need");

  useEffect(() => {
    fetchAttempts().then(setAttempts);
  }, []);

  const summary = useMemo(
    () => (attempts ? [...summarizeByQuestion(attempts).values()] : []),
    [attempts]
  );

  const needReview = summary.filter((s) => !s.lastCorrect);
  const cleared = summary.filter((s) => s.lastCorrect && s.correctCount < s.attempts);

  const amNeed = needReview
    .filter((s) => s.exam === "am")
    .map((s) => ({ status: s, q: getAmQuestion(s.questionId) }))
    .filter((x): x is { status: QuestionStatus; q: AmQuestion } => !!x.q);
  const pmNeed = needReview.filter((s) => s.exam === "pm");

  function startReview() {
    setPlaying(shuffle(amNeed.map((x) => x.q)));
    window.scrollTo(0, 0);
  }

  if (playing) {
    return (
      <QuestionPlayer
        questions={playing}
        mode="review"
        sourceFilter="all"
        onExit={() => {
          setPlaying(null);
          fetchAttempts().then(setAttempts);
        }}
        onRetryWrong={(wrong) => setPlaying(shuffle(wrong))}
      />
    );
  }

  if (!attempts) {
    return <div className="text-center py-16 text-slate-400 text-sm">読み込み中...</div>;
  }

  const list = tab === "need" ? needReview : cleared;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">復習モード</h1>
        <p className="text-sm text-slate-500 mt-1">
          最後に解いたときに間違えていた問題 = 要復習。解き直して正解すると克服済みになります。
        </p>
      </div>

      {amNeed.length > 0 && (
        <button
          onClick={startReview}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold shadow-lg shadow-rose-500/25 transition-all hover:brightness-110 active:scale-[0.98]"
        >
          🔁 要復習の午前問題 {amNeed.length} 問を解き直す
        </button>
      )}

      {pmNeed.length > 0 && (
        <div className="card p-4">
          <div className="text-sm font-bold mb-2">要復習の午後問題</div>
          <div className="space-y-1.5">
            {[...new Set(pmNeed.map((s) => s.questionId.split(":")[0]))].map((pmId) => {
              const pm = getPmQuestion(pmId);
              if (!pm) return null;
              const count = pmNeed.filter((s) => s.questionId.startsWith(pmId + ":")).length;
              return (
                <Link
                  key={pmId}
                  href={`/exam/pm/${pmId}`}
                  className="block border border-slate-200 rounded-lg px-3 py-2 text-sm hover:border-violet-400"
                >
                  <span className="font-medium">{pm.title}</span>
                  <span className="text-xs text-rose-600 ml-2">設問{count}問が要復習</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex rounded-2xl p-1 bg-slate-200/70 gap-1 text-sm">
        <button
          onClick={() => setTab("need")}
          className={`flex-1 py-2 font-bold rounded-xl transition-all ${
            tab === "need"
              ? "bg-white text-rose-600 shadow-md"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          要復習 ({needReview.length})
        </button>
        <button
          onClick={() => setTab("cleared")}
          className={`flex-1 py-2 font-bold rounded-xl transition-all ${
            tab === "cleared"
              ? "bg-white text-emerald-600 shadow-md"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          克服済み ({cleared.length})
        </button>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-sm">
          {tab === "need"
            ? attempts.length === 0
              ? "まだ解答履歴がありません。まずは演習してみましょう!"
              : "要復習の問題はありません 🎉"
            : "一度間違えてから克服した問題がここに表示されます"}
        </div>
      ) : (
        <div className="space-y-1.5">
          {list.map((s) => {
            if (s.exam === "am") {
              const q = getAmQuestion(s.questionId);
              if (!q) return null;
              return (
                <div key={s.questionId} className="card px-3 py-2.5">
                  <div className="text-xs text-slate-400 mb-0.5">
                    {q.category} ・ {s.attempts}回解答 / {s.correctCount}回正解
                  </div>
                  <div className="text-sm line-clamp-2">{q.question}</div>
                </div>
              );
            }
            const [pmId] = s.questionId.split(":");
            const pm = getPmQuestion(pmId);
            if (!pm) return null;
            return (
              <Link
                key={s.questionId}
                href={`/exam/pm/${pmId}`}
                className="card card-hover block px-3 py-2.5"
              >
                <div className="text-xs text-slate-400 mb-0.5">午後 ・ {pm.category}</div>
                <div className="text-sm">{pm.title} の設問</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  return (
    <RequireAuth>
      <ReviewInner />
    </RequireAuth>
  );
}
