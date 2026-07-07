"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AmQuestion, AnswerRecord, SessionMode, SourceFilter } from "@/lib/types";
import { CHOICE_LABELS, FIELD_NAMES } from "@/lib/types";
import { createSession, finishSession, recordAttempts } from "@/lib/db";

interface Props {
  questions: AmQuestion[];
  mode: SessionMode;
  sourceFilter: SourceFilter;
  /** true: 1問ごとに正誤+解説を表示 / false: 全問解答後にまとめて採点(模試) */
  immediateFeedback: boolean;
  timeLimitMinutes?: number;
  onExit: () => void;
  onRetryWrong?: (wrong: AmQuestion[]) => void;
}

function toRecord(q: AmQuestion, selected: number): AnswerRecord {
  return {
    questionId: q.id,
    exam: "am",
    field: q.field,
    category: q.category,
    source: q.source.type,
    selected: CHOICE_LABELS[selected],
    isCorrect: selected === q.answer,
  };
}

export function SourceBadge({ q }: { q: AmQuestion }) {
  return q.source.type === "past" ? (
    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
      過去問 {q.source.label}
    </span>
  ) : (
    <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
      AI作成
    </span>
  );
}

export function CategoryBadge({ q }: { q: AmQuestion }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
      {FIELD_NAMES[q.field]}・{q.category}
    </span>
  );
}

export function ExplanationBox({ q, selected }: { q: AmQuestion; selected: number | null }) {
  const correct = selected === q.answer;
  return (
    <div className="mt-4 space-y-3">
      <div
        className={`rounded-lg px-4 py-3 font-bold text-sm ${
          correct ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
        }`}
      >
        {correct ? "正解! " : "不正解… "}
        正解は「{CHOICE_LABELS[q.answer]}」
        {selected !== null && !correct && ` (あなたの解答: ${CHOICE_LABELS[selected]})`}
      </div>
      <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
        <div className="font-bold text-slate-700 mb-1">解説</div>
        {q.explanation}
      </div>
    </div>
  );
}

function ChoiceList({
  q,
  selected,
  revealed,
  onSelect,
}: {
  q: AmQuestion;
  selected: number | null;
  revealed: boolean;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="space-y-2">
      {q.choices.map((choice, i) => {
        let cls =
          "border-slate-200 bg-white hover:border-indigo-400 hover:-translate-y-px hover:shadow-md hover:shadow-indigo-100 active:bg-indigo-50";
        let chipCls = "bg-slate-100 text-slate-600";
        if (revealed) {
          if (i === q.answer) {
            cls = "border-emerald-500 bg-emerald-50/80";
            chipCls = "bg-emerald-500 text-white";
          } else if (i === selected) {
            cls = "border-rose-400 bg-rose-50/80";
            chipCls = "bg-rose-400 text-white";
          } else {
            cls = "border-slate-200 bg-white opacity-60";
          }
        } else if (i === selected) {
          cls = "border-indigo-600 bg-indigo-50/80 shadow-md shadow-indigo-100";
          chipCls = "bg-gradient-to-br from-indigo-600 to-violet-600 text-white";
        }
        return (
          <button
            key={i}
            disabled={revealed}
            onClick={() => onSelect(i)}
            className={`w-full text-left border-2 rounded-xl px-3 py-2.5 text-sm leading-relaxed transition-all flex gap-2.5 items-start ${cls}`}
          >
            <span
              className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5 transition-colors ${chipCls}`}
            >
              {CHOICE_LABELS[i]}
            </span>
            <span className="whitespace-pre-wrap">{choice}</span>
          </button>
        );
      })}
    </div>
  );
}

function Timer({ minutes, onExpire }: { minutes: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(minutes * 60);
  const expiredRef = useRef(false);
  useEffect(() => {
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1 && !expiredRef.current) {
          expiredRef.current = true;
          clearInterval(t);
          onExpire();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  return (
    <span
      className={`font-mono text-sm px-2 py-1 rounded ${
        remaining < 600 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      残り {mm}:{String(ss).padStart(2, "0")}
    </span>
  );
}

export default function QuestionPlayer({
  questions,
  mode,
  sourceFilter,
  immediateFeedback,
  timeLimitMinutes,
  onExit,
  onRetryWrong,
}: Props) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    questions.map(() => null)
  );
  const [revealedCount, setRevealedCount] = useState(0); // immediate mode: 何問目まで解説表示済みか
  const [finished, setFinished] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const sessionReady = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (immediateFeedback && !sessionReady.current) {
      sessionReady.current = createSession(mode, sourceFilter).then((id) => {
        sessionIdRef.current = id;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = questions[current];
  const answered = answers.filter((a) => a !== null).length;
  const currentRevealed = immediateFeedback && current < revealedCount;

  async function selectChoice(i: number) {
    if (finished) return;
    const next = [...answers];
    next[current] = i;
    setAnswers(next);
    if (immediateFeedback && current >= revealedCount) {
      setRevealedCount(current + 1);
      // 即時記録 (セッション作成完了を待ってから)
      if (sessionReady.current) await sessionReady.current;
      recordAttempts([toRecord(q, i)], sessionIdRef.current);
    }
  }

  async function finishImmediate() {
    const correct = questions.filter((qq, i) => answers[i] === qq.answer).length;
    if (sessionReady.current) await sessionReady.current;
    if (sessionIdRef.current) {
      await finishSession(sessionIdRef.current, questions.length, correct);
    }
    setFinished(true);
  }

  async function submitMock() {
    const records = questions
      .map((qq, i) =>
        answers[i] !== null ? toRecord(qq, answers[i] as number) : null
      )
      .filter((r): r is AnswerRecord => r !== null);
    const correct = records.filter((r) => r.isCorrect).length;
    const sessionId = await createSession(mode, sourceFilter);
    if (sessionId) {
      await recordAttempts(records, sessionId);
      await finishSession(sessionId, questions.length, correct);
    }
    setFinished(true);
  }

  function handleSubmitClick() {
    const unanswered = questions.length - answered;
    if (unanswered > 0) {
      if (!confirm(`未解答が ${unanswered} 問あります。採点しますか?\n(未解答は不正解として扱われます)`)) {
        return;
      }
    }
    submitMock();
  }

  if (questions.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>出題できる問題がありません。</p>
        <button onClick={onExit} className="mt-4 text-indigo-600 underline">
          戻る
        </button>
      </div>
    );
  }

  if (finished) {
    return (
      <ResultView
        questions={questions}
        answers={answers}
        onExit={onExit}
        onRetryWrong={onRetryWrong}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-sm text-slate-500 font-medium">
          問{current + 1} / {questions.length}
        </div>
        <div className="flex items-center gap-2">
          {timeLimitMinutes && !immediateFeedback && (
            <Timer minutes={timeLimitMinutes} onExpire={submitMock} />
          )}
          <button
            onClick={() => {
              if (confirm("演習を中断して戻りますか?")) onExit();
            }}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            中断
          </button>
        </div>
      </div>

      <div className="h-2 bg-slate-200/80 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all"
          style={{ width: `${(answered / questions.length) * 100}%` }}
        />
      </div>

      <div className="card p-4 sm:p-6">
        <div className="flex gap-2 flex-wrap mb-3">
          <CategoryBadge q={q} />
          <SourceBadge q={q} />
        </div>
        <p className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap mb-4 font-medium">
          {q.question}
        </p>
        <ChoiceList
          q={q}
          selected={answers[current]}
          revealed={currentRevealed}
          onSelect={selectChoice}
        />
        {currentRevealed && <ExplanationBox q={q} selected={answers[current]} />}
      </div>

      <div className="flex items-center justify-between mt-4 gap-2">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="btn-ghost px-4 py-2 text-sm"
        >
          ← 前へ
        </button>
        {immediateFeedback ? (
          current === questions.length - 1 && currentRevealed ? (
            <button
              onClick={finishImmediate}
              className="btn-primary px-6 py-2 text-sm"
            >
              結果を見る ✨
            </button>
          ) : (
            <button
              onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
              disabled={!currentRevealed}
              className="btn-primary px-5 py-2 text-sm"
            >
              次へ →
            </button>
          )
        ) : (
          <>
            <button
              onClick={handleSubmitClick}
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm text-white font-bold shadow-lg shadow-emerald-600/25 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              採点する
            </button>
            <button
              onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
              disabled={current === questions.length - 1}
              className="btn-ghost px-4 py-2 text-sm"
            >
              次へ →
            </button>
          </>
        )}
      </div>

      {!immediateFeedback && (
        <div className="mt-6 card p-3">
          <div className="text-xs text-slate-500 mb-2">問題一覧 (タップで移動)</div>
          <div className="grid grid-cols-10 gap-1.5">
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-8 rounded-lg text-xs font-medium transition-colors ${
                  i === current
                    ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-bold shadow-sm"
                    : answers[i] !== null
                      ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                      : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultView({
  questions,
  answers,
  onExit,
  onRetryWrong,
}: {
  questions: AmQuestion[];
  answers: (number | null)[];
  onExit: () => void;
  onRetryWrong?: (wrong: AmQuestion[]) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const correct = questions.filter((q, i) => answers[i] === q.answer).length;
  const rate = Math.round((correct / questions.length) * 100);
  const wrong = questions.filter((q, i) => answers[i] !== q.answer);

  const fieldStats = useMemo(() => {
    const stats: Record<string, { total: number; correct: number }> = {};
    questions.forEach((q, i) => {
      const key = FIELD_NAMES[q.field];
      stats[key] ??= { total: 0, correct: 0 };
      stats[key].total++;
      if (answers[i] === q.answer) stats[key].correct++;
    });
    return stats;
  }, [questions, answers]);

  return (
    <div className="space-y-4">
      <div
        className={`rounded-2xl p-8 text-center text-white shadow-xl ${
          rate >= 60
            ? "bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 shadow-indigo-600/30"
            : "bg-gradient-to-br from-slate-600 to-slate-700 shadow-slate-600/30"
        }`}
      >
        <div className="text-sm opacity-80 mb-1">
          {rate >= 60 ? "🎉 お見事!" : "💪 あと少し!"} 正答率
        </div>
        <div className="text-6xl font-extrabold tracking-tight">{rate}%</div>
        <div className="mt-2 opacity-90">
          {correct} / {questions.length} 問正解
          {questions.length >= 80 && (
            <span className="block text-xs mt-1 opacity-70">
              (本試験の合格基準は 60% 以上)
            </span>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="font-bold text-sm mb-3">分野別</div>
        <div className="space-y-2">
          {Object.entries(fieldStats).map(([name, s]) => {
            const r = Math.round((s.correct / s.total) * 100);
            return (
              <div key={name}>
                <div className="flex justify-between text-xs text-slate-600 mb-0.5">
                  <span>{name}</span>
                  <span>
                    {s.correct}/{s.total} ({r}%)
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${r >= 60 ? "bg-emerald-500" : "bg-rose-400"}`}
                    style={{ width: `${r}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        {wrong.length > 0 && onRetryWrong && (
          <button
            onClick={() => onRetryWrong(wrong)}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 text-white text-sm font-bold shadow-lg shadow-rose-500/25 transition-all hover:brightness-110 active:scale-[0.98]"
          >
            🔁 間違えた {wrong.length} 問を解き直す
          </button>
        )}
        <button onClick={onExit} className="btn-ghost flex-1 py-2.5 text-sm">
          終了する
        </button>
      </div>

      <div className="card p-4">
        <div className="font-bold text-sm mb-3">全問題の解説 (タップで開閉)</div>
        <div className="space-y-1.5">
          {questions.map((q, i) => {
            const isCorrect = answers[i] === q.answer;
            const open = openId === q.id;
            return (
              <div key={q.id} className="border border-slate-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenId(open ? null : q.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm bg-slate-50"
                >
                  <span
                    className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCorrect ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {isCorrect ? "○" : "×"}
                  </span>
                  <span className="text-slate-400 text-xs shrink-0">問{i + 1}</span>
                  <span className="truncate">{q.question}</span>
                </button>
                {open && (
                  <div className="p-3">
                    <div className="flex gap-2 flex-wrap mb-2">
                      <CategoryBadge q={q} />
                      <SourceBadge q={q} />
                    </div>
                    <p className="text-sm whitespace-pre-wrap mb-3">{q.question}</p>
                    <div className="space-y-1 text-sm mb-2">
                      {q.choices.map((c, ci) => (
                        <div
                          key={ci}
                          className={`px-2 py-1 rounded ${
                            ci === q.answer
                              ? "bg-emerald-50 font-medium"
                              : ci === answers[i]
                                ? "bg-rose-50"
                                : ""
                          }`}
                        >
                          <span className="font-bold mr-1">{CHOICE_LABELS[ci]}</span>
                          {c}
                          {ci === q.answer && (
                            <span className="text-emerald-600 text-xs ml-1">← 正解</span>
                          )}
                          {ci === answers[i] && ci !== q.answer && (
                            <span className="text-rose-500 text-xs ml-1">← あなたの解答</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="text-sm bg-slate-50 rounded p-3 whitespace-pre-wrap leading-relaxed">
                      {q.explanation}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
