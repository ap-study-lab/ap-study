"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import { getPmQuestion } from "@/lib/questions";
import { createSession, finishSession, recordAttempts } from "@/lib/db";
import type { AnswerRecord, PmQuestion, PmSubQuestion } from "@/lib/types";
import { CHOICE_LABELS } from "@/lib/types";

/** 設問1つの解答状態 */
interface SubState {
  selected: number | null; // choice用
  text: string; // text用
  revealed: boolean;
  selfGrade: boolean | null; // text用の自己採点
}

function PmPlayer({ pm }: { pm: PmQuestion }) {
  const router = useRouter();
  const [states, setStates] = useState<Record<string, SubState>>(() =>
    Object.fromEntries(
      pm.subQuestions.map((sq) => [
        sq.id,
        { selected: null, text: "", revealed: false, selfGrade: null },
      ])
    )
  );
  const [saved, setSaved] = useState(false);
  const savingRef = useRef(false);

  function update(id: string, patch: Partial<SubState>) {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function isGraded(sq: PmSubQuestion, st: SubState): boolean {
    if (!st.revealed) return false;
    return sq.type === "choice" ? true : st.selfGrade !== null;
  }

  function isCorrect(sq: PmSubQuestion, st: SubState): boolean {
    return sq.type === "choice" ? st.selected === sq.answer : st.selfGrade === true;
  }

  const allGraded = pm.subQuestions.every((sq) => isGraded(sq, states[sq.id]));
  const correctCount = pm.subQuestions.filter(
    (sq) => isGraded(sq, states[sq.id]) && isCorrect(sq, states[sq.id])
  ).length;

  const records: AnswerRecord[] = useMemo(
    () =>
      pm.subQuestions
        .filter((sq) => isGraded(sq, states[sq.id]))
        .map((sq) => {
          const st = states[sq.id];
          return {
            questionId: `${pm.id}:${sq.id}`,
            exam: "pm" as const,
            field: null,
            category: pm.category,
            source: pm.source.type,
            selected:
              sq.type === "choice"
                ? CHOICE_LABELS[st.selected ?? 0]
                : st.text.slice(0, 100),
            isCorrect: isCorrect(sq, st),
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [states, pm]
  );

  async function saveResults() {
    if (savingRef.current) return;
    savingRef.current = true;
    const sessionId = await createSession("pm", "all");
    await recordAttempts(records, sessionId);
    if (sessionId) {
      await finishSession(sessionId, records.length, correctCount, { pmId: pm.id });
    }
    setSaved(true);
  }

  return (
    <div className="space-y-5">
      <div>
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
        </div>
        <h1 className="text-lg font-bold">{pm.title}</h1>
      </div>

      <div className="card p-4 sm:p-5">
        <div className="text-xs font-bold text-slate-500 mb-2">問題文</div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{pm.scenario}</p>
      </div>

      {pm.subQuestions.map((sq, idx) => {
        const st = states[sq.id];
        return (
          <div key={sq.id} className="card p-4 sm:p-5">
            <div className="font-bold text-sm mb-2">設問{idx + 1}</div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap mb-3">{sq.question}</p>

            {sq.type === "choice" && sq.choices ? (
              <div className="space-y-2">
                {sq.choices.map((choice, i) => {
                  let cls =
                    "border-slate-200 bg-white hover:border-violet-400 active:bg-violet-50";
                  if (st.revealed) {
                    if (i === sq.answer) cls = "border-emerald-500 bg-emerald-50";
                    else if (i === st.selected) cls = "border-rose-400 bg-rose-50";
                    else cls = "border-slate-200 opacity-70";
                  } else if (i === st.selected) {
                    cls = "border-violet-600 bg-violet-50";
                  }
                  return (
                    <button
                      key={i}
                      disabled={st.revealed}
                      onClick={() => update(sq.id, { selected: i, revealed: true })}
                      className={`w-full text-left border-2 rounded-lg px-3 py-2.5 text-sm flex gap-2 ${cls}`}
                    >
                      <span className="font-bold shrink-0">{CHOICE_LABELS[i]}</span>
                      <span className="whitespace-pre-wrap">{choice}</span>
                    </button>
                  );
                })}
                {st.revealed && (
                  <div
                    className={`rounded-lg px-3 py-2 text-sm font-bold ${
                      st.selected === sq.answer
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {st.selected === sq.answer
                      ? "正解!"
                      : `不正解… 正解は「${CHOICE_LABELS[sq.answer!]}」`}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={st.text}
                  onChange={(e) => update(sq.id, { text: e.target.value })}
                  disabled={st.revealed}
                  rows={3}
                  placeholder="解答を記述..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50"
                />
                {!st.revealed ? (
                  <button
                    onClick={() => update(sq.id, { revealed: true })}
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm text-white font-bold shadow-lg shadow-violet-600/25 transition-all hover:brightness-110 active:scale-[0.98]"
                  >
                    模範解答を見る
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-lg bg-violet-50 border border-violet-200 px-3 py-2 text-sm">
                      <span className="font-bold text-violet-800">模範解答: </span>
                      {sq.modelAnswer}
                    </div>
                    {st.selfGrade === null ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">自己採点:</span>
                        <button
                          onClick={() => update(sq.id, { selfGrade: true })}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-bold"
                        >
                          ○ 合ってた
                        </button>
                        <button
                          onClick={() => update(sq.id, { selfGrade: false })}
                          className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-sm font-bold"
                        >
                          × 違った
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`rounded-lg px-3 py-2 text-sm font-bold ${
                          st.selfGrade
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        自己採点: {st.selfGrade ? "○ 正解" : "× 不正解"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {st.revealed && (sq.type === "choice" || st.selfGrade !== null) && (
              <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                <div className="font-bold text-slate-700 mb-1">解説</div>
                {sq.explanation}
              </div>
            )}
          </div>
        );
      })}

      <div className="card p-4 text-center space-y-3">
        {saved ? (
          <>
            <div className="text-sm font-bold text-emerald-700">
              記録しました ({correctCount} / {pm.subQuestions.length} 問正解)
            </div>
            <button
              onClick={() => router.push("/exam/pm")}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-2.5 text-sm text-white font-bold shadow-lg shadow-violet-600/25 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              大問一覧へ戻る
            </button>
          </>
        ) : (
          <>
            <div className="text-sm text-slate-500">
              {allGraded
                ? `全設問に解答しました (${correctCount} / ${pm.subQuestions.length} 問正解)`
                : "すべての設問に解答すると結果を記録できます"}
            </div>
            <button
              onClick={saveResults}
              disabled={!allGraded}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-2.5 text-sm text-white font-bold shadow-lg shadow-violet-600/25 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
            >
              結果を記録する
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PmDetailClient({ id }: { id: string }) {
  const pm = getPmQuestion(id);
  return (
    <RequireAuth>
      {pm ? (
        <PmPlayer pm={pm} />
      ) : (
        <div className="text-center py-16 text-slate-500">問題が見つかりません</div>
      )}
    </RequireAuth>
  );
}
